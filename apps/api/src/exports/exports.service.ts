import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as ExcelJS from 'exceljs';
import {
  minutesToHours,
  type AttendanceFilter,
  type ExportAvailability,
  type ExportKind,
  type ExportRequest,
  type ExportTemplateInput,
  type ExportTemplateLayout,
  type MetricKey,
  type MonthAggregateView,
} from '@ttah/shared';
import { AuditService } from '../audit/audit.service';
import { AttendanceService } from '../attendance/attendance.service';
import { PrismaService } from '../prisma/prisma.service';

const DEFAULT_SUMMARY_COLUMNS: { key: MetricKey; header: string }[] = [
  { key: 'employeeName', header: 'Employee' },
  { key: 'department', header: 'Department' },
  { key: 'daysPresent', header: 'Days' },
  { key: 'workedHours', header: 'Worked (h)' },
  { key: 'expectedHours', header: 'Expected (h)' },
  { key: 'overtimeHours', header: 'Overtime (h)' },
  { key: 'deficitHours', header: 'Deficit (h)' },
  { key: 'anomalies', header: 'Anomalies' },
];

export interface GeneratedFile {
  filename: string;
  buffer: Buffer;
  contentType: string;
  scopeLabel: string;
  kind: ExportKind;
}

@Injectable()
export class ExportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly attendance: AttendanceService,
    private readonly audit: AuditService,
  ) {}

  // --- template CRUD ---
  listTemplates() {
    return this.prisma.exportTemplate.findMany({ orderBy: [{ kind: 'asc' }, { name: 'asc' }] });
  }

  async getTemplate(id: number) {
    const row = await this.prisma.exportTemplate.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Template not found');
    return row;
  }

  async createTemplate(input: ExportTemplateInput, actorId?: number | null) {
    const row = await this.prisma.exportTemplate.create({
      data: {
        name: input.name,
        kind: input.kind,
        layout: input.layout as unknown as Prisma.InputJsonValue,
        isDefault: input.isDefault ?? false,
        createdById: actorId ?? null,
      },
    });
    await this.audit.log({ userId: actorId ?? null, action: 'create', entity: 'ExportTemplate', entityId: row.id });
    return row;
  }

  async updateTemplate(id: number, input: ExportTemplateInput, actorId?: number | null) {
    await this.getTemplate(id);
    const row = await this.prisma.exportTemplate.update({
      where: { id },
      data: {
        name: input.name,
        kind: input.kind,
        layout: input.layout as unknown as Prisma.InputJsonValue,
        isDefault: input.isDefault ?? false,
      },
    });
    await this.audit.log({ userId: actorId ?? null, action: 'update', entity: 'ExportTemplate', entityId: id });
    return row;
  }

  async deleteTemplate(id: number, actorId?: number | null) {
    await this.getTemplate(id);
    await this.prisma.exportTemplate.delete({ where: { id } });
    await this.audit.log({ userId: actorId ?? null, action: 'delete', entity: 'ExportTemplate', entityId: id });
    return { ok: true };
  }

  async availability(filter: AttendanceFilter): Promise<ExportAvailability> {
    const days = await this.attendance.countSummaries(filter);
    return { hasData: days > 0 };
  }

  // --- generation ---
  async generate(request: ExportRequest, actorId?: number | null): Promise<GeneratedFile> {
    const { hasData } = await this.availability(request.filter);
    if (!hasData) {
      throw new BadRequestException('No data in this interval');
    }
    const { kind, layout } = await this.resolveKindAndLayout(request);
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'TTAH';
    workbook.created = new Date();

    if (kind === 'pontaj') {
      await this.buildPontaj(workbook, request, layout);
    } else if (kind === 'raw') {
      await this.buildRaw(workbook, request);
    } else {
      await this.buildSummary(workbook, request, layout);
    }

    const scope = await this.resolveScope(request.filter.employeeIds);
    const base = [
      'ttah',
      kind,
      scope.slug,
      `${request.filter.from}_${request.filter.to}`,
    ]
      .filter(Boolean)
      .join('-');
    await this.audit.log({
      userId: actorId ?? null,
      action: 'export',
      entity: 'Attendance',
      after: {
        kind,
        format: request.format,
        filter: request.filter,
        sendEmail: request.sendEmail ?? null,
        templateId: request.templateId ?? null,
      },
    });

    if (request.format === 'csv') {
      const buffer = (await workbook.csv.writeBuffer()) as unknown as Buffer;
      return {
        filename: `${base}.csv`,
        buffer,
        contentType: 'text/csv; charset=utf-8',
        scopeLabel: scope.label,
        kind,
      };
    }
    const buffer = (await workbook.xlsx.writeBuffer()) as unknown as Buffer;
    return {
      filename: `${base}.xlsx`,
      buffer,
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      scopeLabel: scope.label,
      kind,
    };
  }

  private async resolveScope(employeeIds?: number[]): Promise<{ label: string; slug: string }> {
    if (!employeeIds?.length) {
      return { label: 'all employees', slug: '' };
    }
    if (employeeIds.length === 1) {
      const employee = await this.prisma.employee.findUnique({ where: { id: employeeIds[0] } });
      const name = employee?.displayName?.trim() || `employee-${employeeIds[0]}`;
      return { label: name, slug: slugFilename(name) };
    }
    return { label: `${employeeIds.length} employees`, slug: `${employeeIds.length}-employees` };
  }

  private async resolveKindAndLayout(
    request: ExportRequest,
  ): Promise<{ kind: ExportKind; layout: ExportTemplateLayout }> {
    if (request.templateId) {
      const template = await this.getTemplate(request.templateId);
      return {
        kind: template.kind,
        layout: template.layout as unknown as ExportTemplateLayout,
      };
    }
    const kind = request.kind ?? 'summary';
    if (kind === 'pontaj') {
      return {
        kind,
        layout: { title: 'Pontaj', columns: [], includeTotals: true, matrixMetric: 'workedHours' },
      };
    }
    if (kind === 'raw') {
      return {
        kind,
        layout: { title: 'Raw attendance', columns: [], includeTotals: false, matrixMetric: 'workedHours' },
      };
    }
    return {
      kind: 'summary',
      layout: {
        title: 'Summary',
        columns: DEFAULT_SUMMARY_COLUMNS,
        includeTotals: true,
        matrixMetric: 'workedHours',
      },
    };
  }

  private metricValue(agg: MonthAggregateView, key: MetricKey): string | number {
    switch (key) {
      case 'employeeName':
        return agg.employeeName;
      case 'department':
        return agg.department ?? '';
      case 'daysPresent':
        return agg.daysPresent;
      case 'workedHours':
        return round2(minutesToHours(agg.workedMinutes));
      case 'workedMinutes':
        return agg.workedMinutes;
      case 'lunchMinutes':
        return agg.lunchMinutes;
      case 'expectedHours':
        return round2(minutesToHours(agg.expectedMinutes));
      case 'overtimeHours':
        return round2(minutesToHours(agg.overtimeMinutes));
      case 'deficitHours':
        return round2(minutesToHours(agg.deficitMinutes));
      case 'anomalies':
        return agg.anomalies;
      case 'firstIn':
      case 'lastOut':
      default:
        return '';
    }
  }

  private async buildSummary(
    workbook: ExcelJS.Workbook,
    request: ExportRequest,
    layout: ExportTemplateLayout,
  ) {
    const { year, month } = ymOf(request.filter.from);
    const aggregates = await this.attendance.getMonthAggregates(year, month, {
      employeeIds: request.filter.employeeIds,
      departments: request.filter.departments,
    });
    const columns = layout.columns.length ? layout.columns : DEFAULT_SUMMARY_COLUMNS;
    const sheet = workbook.addWorksheet(layout.title || 'Summary');
    sheet.addRow(columns.map((c) => c.header));
    sheet.getRow(1).font = { bold: true };

    for (const agg of aggregates) {
      sheet.addRow(columns.map((c) => this.metricValue(agg, c.key)));
    }

    columns.forEach((c, i) => {
      sheet.getColumn(i + 1).width = Math.max(12, c.header.length + 2);
    });
  }

  private async buildPontaj(
    workbook: ExcelJS.Workbook,
    request: ExportRequest,
    layout: ExportTemplateLayout,
  ) {
    const { year, month } = ymOf(request.filter.from);
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const from = `${year}-${pad(month)}-01`;
    const to = `${year}-${pad(month)}-${pad(lastDay)}`;

    const [aggregates, summaries] = await Promise.all([
      this.attendance.getMonthAggregates(year, month, {
        employeeIds: request.filter.employeeIds,
        departments: request.filter.departments,
      }),
      this.attendance.getSummaries({ ...request.filter, from, to }),
    ]);

    const useMinutes = layout.matrixMetric === 'workedMinutes';
    const cellFor = (minutes: number) => (useMinutes ? minutes : round2(minutesToHours(minutes)));

    const byKey = new Map<string, number>();
    for (const s of summaries) byKey.set(`${s.employeeId}|${s.date}`, s.workedMinutes);

    const sheet = workbook.addWorksheet(layout.title || 'Pontaj');
    const header = ['Employee', 'Department', ...range(1, lastDay).map(String), 'Total'];
    sheet.addRow(header);
    sheet.getRow(1).font = { bold: true };

    for (const agg of aggregates) {
      const row: (string | number)[] = [agg.employeeName, agg.department ?? ''];
      let total = 0;
      for (let d = 1; d <= lastDay; d++) {
        const key = `${agg.employeeId}|${year}-${pad(month)}-${pad(d)}`;
        const minutes = byKey.get(key) ?? 0;
        total += minutes;
        row.push(minutes ? cellFor(minutes) : '');
      }
      row.push(cellFor(total));
      sheet.addRow(row);
    }

    sheet.getColumn(1).width = 26;
    sheet.getColumn(2).width = 18;
    for (let d = 0; d < lastDay; d++) sheet.getColumn(3 + d).width = 6;
    sheet.getColumn(lastDay + 3).width = 10;
  }

  private async buildRaw(workbook: ExcelJS.Workbook, request: ExportRequest) {
    const summaries = await this.attendance.getSummaries(request.filter);
    const sheet = workbook.addWorksheet('Raw');
    sheet.addRow(['Date', 'Employee', 'First In', 'Last Out', 'Worked (h)', 'Lunch (min)', 'Flags']);
    sheet.getRow(1).font = { bold: true };
    for (const s of summaries) {
      sheet.addRow([
        s.date,
        s.employeeName ?? '',
        s.firstIn ?? '',
        s.lastOut ?? '',
        round2(minutesToHours(s.workedMinutes)),
        s.lunchMinutes,
        s.flags.join(', '),
      ]);
    }
    sheet.getColumn(1).width = 12;
    sheet.getColumn(2).width = 26;
    sheet.getColumn(7).width = 30;
  }
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function ymOf(dateStr: string): { year: number; month: number } {
  return { year: Number(dateStr.slice(0, 4)), month: Number(dateStr.slice(5, 7)) };
}

function range(start: number, end: number): number[] {
  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
}

function slugFilename(name: string): string {
  const slug = name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .toLowerCase();
  return slug || 'employee';
}
