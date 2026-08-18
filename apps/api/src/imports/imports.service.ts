import { createHash, randomUUID } from 'node:crypto';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  canonicalizeName,
  type DiscoveredDoor,
  type ImportCommitInput,
  type ImportPreview,
  type ImportPreviewEmployee,
  type ImportResult,
  type ParsedEventRow,
} from '@ttah/shared';
import { AuditService } from '../audit/audit.service';
import { AttendanceService } from '../attendance/attendance.service';
import { DoorsService, parseLocation } from '../doors/doors.service';
import { EmployeesService } from '../employees/employees.service';
import { PrismaService } from '../prisma/prisma.service';
import { dayKey } from '../common/time';
import { CsvParserService } from './csv-parser.service';
import type { ParsedReport } from './parsed-report';
import { PdfParserService } from './pdf-parser.service';
import { PreviewStore } from './preview-store.service';

const EVENT_INSERT_CHUNK = 1000;

@Injectable()
export class ImportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly parser: PdfParserService,
    private readonly csvParser: CsvParserService,
    private readonly employees: EmployeesService,
    private readonly doors: DoorsService,
    private readonly attendance: AttendanceService,
    private readonly audit: AuditService,
    private readonly store: PreviewStore,
  ) {}

  async preview(file: {
    originalname: string;
    buffer: Buffer;
    mimetype?: string;
  }): Promise<ImportPreview> {
    const report = await this.parseUploaded(file);
    const fileHash = createHash('sha256').update(file.buffer).digest('hex');
    const duplicate = await this.prisma.importBatch.findUnique({ where: { fileHash } });

    const matched = await this.matchPreviewEmployees(report);

    const rawLocations = [...new Set(report.records.map((r) => r.rawLocation))];
    const existing =
      rawLocations.length === 0
        ? []
        : await this.prisma.reader.findMany({
            where: { rawLocation: { in: rawLocations } },
            select: { rawLocation: true },
          });
    const existingSet = new Set(existing.map((d) => d.rawLocation));
    const newDoors: DiscoveredDoor[] = rawLocations
      .filter((loc) => !existingSet.has(loc))
      .map((loc) => {
        const parsed = parseLocation(loc);
        return {
          rawLocation: loc,
          readerNo: parsed.readerNo,
          panel: parsed.panel,
          floor: parsed.floor,
          suggestedName: parsed.suggestedName,
          suggestedRole: parsed.suggestedRole,
        };
      });

    const previewId = randomUUID();
    this.store.put({
      previewId,
      fileName: file.originalname,
      fileHash,
      report,
      matchedEmployeeId: matched.matchedEmployeeId,
      createdAt: Date.now(),
    });

    const sampleRows: ParsedEventRow[] = report.records.slice(0, 50).map((r) => {
      const parsed = parseLocation(r.rawLocation);
      return {
        occurredAt: r.occurredAt.toISOString(),
        rawLocation: r.rawLocation,
        direction: r.direction,
        eventType: r.eventType,
        zone: parsed.suggestedName,
        floor: parsed.floor,
        employeeName: r.rawUserName ?? report.rawUserName ?? null,
      };
    });

    const warnings = [...report.warnings];
    if (report.kind === 'multi' && !duplicate) {
      warnings.push(
        'You can import another export of this window later. Badge reads already stored are skipped; only new events are added.',
      );
    }

    return {
      previewId,
      fileName: file.originalname,
      fileHash,
      kind: report.kind,
      rawUserName: report.rawUserName ?? '',
      canonicalName: matched.canonicalName,
      matchedEmployeeId: matched.matchedEmployeeId,
      department: report.department,
      rangeFrom: report.rangeFrom ? report.rangeFrom.toISOString() : null,
      rangeTo: report.rangeTo ? report.rangeTo.toISOString() : null,
      rowsTotal: report.records.length,
      rowsParsed: report.records.length,
      duplicateOfBatchId: duplicate?.id ?? null,
      newDoors,
      sampleRows,
      employees: matched.employees,
      warnings,
    };
  }

  async commit(input: ImportCommitInput, actorId?: number | null): Promise<ImportResult> {
    const entry = this.store.get(input.previewId);
    if (!entry) {
      throw new BadRequestException('Preview expired or not found. Please re-upload the file.');
    }

    const existingBatch = await this.prisma.importBatch.findUnique({
      where: { fileHash: entry.fileHash },
    });
    if (existingBatch) {
      this.store.delete(input.previewId);
      return {
        batchId: existingBatch.id,
        employeeId: existingBatch.employeeId ?? 0,
        employeeCount: existingBatch.employeeId ? 1 : 0,
        rowsTotal: existingBatch.rowsTotal,
        rowsNew: 0,
        rowsDuplicate: existingBatch.rowsTotal,
        affectedDates: [],
      };
    }

    const isMulti = entry.report.kind === 'multi';
    const idByName = new Map<string, number>();
    let singleEmployeeId: number | null = null;

    if (isMulti) {
      if (entry.report.employees.length === 0) {
        throw new BadRequestException('No employees were found in this report.');
      }
      for (const emp of entry.report.employees) {
        const resolved = await this.employees.resolveEmployee(emp.rawUserName, emp.department);
        idByName.set(emp.rawUserName, resolved.id);
      }
    } else {
      singleEmployeeId = await this.resolveCommitEmployee(input, entry);
    }

    const rawLocations = [...new Set(entry.report.records.map((r) => r.rawLocation))];
    const readerMap = new Map<string, { id: number; role: 'IN' | 'OUT' | 'NEUTRAL' }>();
    for (const loc of rawLocations) {
      const reader = await this.doors.resolveReader(loc);
      if (!reader) continue;
      readerMap.set(loc, { id: reader.id, role: reader.role });
    }

    const batch = await this.prisma.importBatch.create({
      data: {
        userId: actorId ?? null,
        employeeId: isMulti ? null : singleEmployeeId,
        fileName: entry.fileName,
        fileHash: entry.fileHash,
        department: entry.report.department ?? null,
        rangeFrom: entry.report.rangeFrom,
        rangeTo: entry.report.rangeTo,
        rowsTotal: entry.report.records.length,
        status: 'PENDING',
      },
    });

    const rows = entry.report.records.flatMap((r) => {
      const reader = readerMap.get(r.rawLocation);
      if (!reader) return [];
      const employeeId = isMulti
        ? (r.rawUserName ? idByName.get(r.rawUserName) : undefined)
        : singleEmployeeId!;
      if (!employeeId) return [];
      return [
        {
          employeeId,
          readerId: reader.id,
          occurredAt: r.occurredAt,
          direction: reader.role,
          eventType: r.eventType,
          importBatchId: batch.id,
        },
      ];
    });

    const rowsNew = await this.insertEvents(rows);
    const rowsDuplicate = rows.length - rowsNew;

    const datesByEmployee = new Map<number, Set<string>>();
    for (const r of entry.report.records) {
      const employeeId = isMulti
        ? (r.rawUserName ? idByName.get(r.rawUserName) : undefined)
        : singleEmployeeId!;
      if (!employeeId) continue;
      let dates = datesByEmployee.get(employeeId);
      if (!dates) {
        dates = new Set();
        datesByEmployee.set(employeeId, dates);
      }
      dates.add(dayKey(r.occurredAt));
    }
    const affectedDates = [...new Set([...datesByEmployee.values()].flatMap((s) => [...s]))];

    await this.prisma.importBatch.update({
      where: { id: batch.id },
      data: { rowsNew, rowsDuplicate, status: 'COMMITTED' },
    });

    for (const [employeeId, dates] of datesByEmployee) {
      await this.attendance.recomputeEmployeeDates(employeeId, [...dates]);
    }

    const employeeCount = isMulti ? entry.report.employees.length : 1;
    const primaryEmployeeId = isMulti ? 0 : (singleEmployeeId ?? 0);
    await this.audit.log({
      userId: actorId ?? null,
      action: 'import',
      entity: 'ImportBatch',
      entityId: batch.id,
      after: {
        fileName: entry.fileName,
        rowsNew,
        rowsDuplicate,
        employeeId: primaryEmployeeId,
        employeeCount,
      },
    });
    this.store.delete(input.previewId);

    return {
      batchId: batch.id,
      employeeId: primaryEmployeeId,
      employeeCount,
      rowsTotal: rows.length,
      rowsNew,
      rowsDuplicate,
      affectedDates,
    };
  }

  private async parseUploaded(file: {
    originalname: string;
    buffer: Buffer;
    mimetype?: string;
  }): Promise<ParsedReport> {
    const name = file.originalname ?? '';
    const mime = file.mimetype ?? '';
    const magic = file.buffer.subarray(0, 5).toString('utf8');
    const isPdf = magic.startsWith('%PDF') || /\.pdf$/i.test(name) || /pdf/i.test(mime);
    if (isPdf) return this.parser.parseBuffer(file.buffer);

    const head = file.buffer.subarray(0, 256).toString('utf8').replace(/^\uFEFF/, '');
    const isCsv =
      /\.csv$/i.test(name) ||
      /csv/i.test(mime) ||
      mime === 'application/vnd.ms-excel' ||
      /^AxTraxNG/i.test(head);
    if (isCsv) return this.csvParser.parseBuffer(file.buffer);

    throw new BadRequestException('Only AxTraxNG PDF or CSV access reports are supported.');
  }

  private async matchPreviewEmployees(report: ParsedReport): Promise<{
    matchedEmployeeId: number | null;
    canonicalName: string;
    employees: ImportPreviewEmployee[];
  }> {
    if (report.kind !== 'multi') {
      let matchedEmployeeId: number | null = null;
      let canonicalName = '';
      if (report.rawUserName) {
        canonicalName = canonicalizeName(report.rawUserName);
        const alias = await this.prisma.employeeAlias.findUnique({
          where: { rawUserName: report.rawUserName },
        });
        const employee = alias
          ? { id: alias.employeeId }
          : await this.prisma.employee.findUnique({ where: { canonicalName } });
        matchedEmployeeId = employee?.id ?? null;
      }
      return {
        matchedEmployeeId,
        canonicalName,
        employees: report.employees.map((e) => ({
          rawUserName: e.rawUserName,
          department: e.department,
          eventCount: e.eventCount,
          matchedEmployeeId,
        })),
      };
    }

    const names = report.employees.map((e) => e.rawUserName);
    const aliases =
      names.length === 0
        ? []
        : await this.prisma.employeeAlias.findMany({
            where: { rawUserName: { in: names } },
            select: { rawUserName: true, employeeId: true },
          });
    const aliasMap = new Map(aliases.map((a) => [a.rawUserName, a.employeeId]));
    const unmatchedCanonical = [
      ...new Set(
        report.employees
          .filter((e) => !aliasMap.has(e.rawUserName))
          .map((e) => canonicalizeName(e.rawUserName)),
      ),
    ];
    const existing =
      unmatchedCanonical.length === 0
        ? []
        : await this.prisma.employee.findMany({
            where: { canonicalName: { in: unmatchedCanonical } },
            select: { id: true, canonicalName: true },
          });
    const byCanonical = new Map(existing.map((e) => [e.canonicalName, e.id]));

    return {
      matchedEmployeeId: null,
      canonicalName: '',
      employees: report.employees.map((e) => ({
        rawUserName: e.rawUserName,
        department: e.department,
        eventCount: e.eventCount,
        matchedEmployeeId:
          aliasMap.get(e.rawUserName) ?? byCanonical.get(canonicalizeName(e.rawUserName)) ?? null,
      })),
    };
  }

  private async insertEvents(
    rows: Array<{
      employeeId: number;
      readerId: number;
      occurredAt: Date;
      direction: 'IN' | 'OUT' | 'NEUTRAL';
      eventType: 'ACCESS_GRANTED' | 'ACCESS_DENIED' | 'OTHER';
      importBatchId: number;
    }>,
  ): Promise<number> {
    let rowsNew = 0;
    for (let i = 0; i < rows.length; i += EVENT_INSERT_CHUNK) {
      const chunk = rows.slice(i, i + EVENT_INSERT_CHUNK);
      const created = await this.prisma.accessEvent.createMany({
        data: chunk,
        skipDuplicates: true,
      });
      rowsNew += created.count;
    }
    return rowsNew;
  }

  private async resolveCommitEmployee(
    input: ImportCommitInput,
    entry: NonNullable<ReturnType<PreviewStore['get']>>,
  ): Promise<number> {
    const chosen = input.employeeId ?? entry.matchedEmployeeId ?? null;
    if (chosen) {
      if (entry.report.rawUserName) {
        await this.prisma.employeeAlias.upsert({
          where: { rawUserName: entry.report.rawUserName },
          create: { rawUserName: entry.report.rawUserName, employeeId: chosen },
          update: {},
        });
      }
      if (entry.report.department) {
        await this.prisma.employeeDepartment.upsert({
          where: {
            employeeId_department: { employeeId: chosen, department: entry.report.department },
          },
          create: { employeeId: chosen, department: entry.report.department },
          update: {},
        });
      }
      return chosen;
    }

    if (!entry.report.rawUserName) {
      const manualName = input.employeeName?.trim();
      if (!manualName) {
        throw new BadRequestException(
          'No employee could be determined. Please select one or enter a name.',
        );
      }
      const employee = await this.employees.resolveEmployee(manualName, entry.report.department);
      return employee.id;
    }
    const employee = await this.employees.resolveEmployee(
      entry.report.rawUserName,
      entry.report.department,
    );
    return employee.id;
  }

  async listBatches() {
    const rows = await this.prisma.importBatch.findMany({
      orderBy: { createdAt: 'desc' },
      include: { employee: true, user: true },
    });
    return rows.map((batch) => ({
      id: batch.id,
      fileName: batch.fileName,
      employeeId: batch.employeeId ?? 0,
      employeeName: batch.employee?.displayName ?? (batch.employeeId == null ? 'Multiple employees' : '—'),
      rangeFrom: batch.rangeFrom ? batch.rangeFrom.toISOString() : null,
      rangeTo: batch.rangeTo ? batch.rangeTo.toISOString() : null,
      rowsTotal: batch.rowsTotal,
      rowsNew: batch.rowsNew,
      rowsDuplicate: batch.rowsDuplicate,
      status: batch.status,
      createdAt: batch.createdAt.toISOString(),
      createdByUsername: batch.user?.username ?? null,
    }));
  }

  async deleteBatch(id: number, actorId?: number | null) {
    const batch = await this.prisma.importBatch.findUnique({ where: { id } });
    if (!batch) throw new NotFoundException('Import batch not found');

    const events = await this.prisma.accessEvent.findMany({
      where: { importBatchId: id },
      select: { occurredAt: true, employeeId: true },
    });
    const datesByEmployee = new Map<number, Set<string>>();
    for (const event of events) {
      let dates = datesByEmployee.get(event.employeeId);
      if (!dates) {
        dates = new Set();
        datesByEmployee.set(event.employeeId, dates);
      }
      dates.add(dayKey(event.occurredAt));
    }

    await this.prisma.accessEvent.deleteMany({ where: { importBatchId: id } });
    await this.prisma.importBatch.delete({ where: { id } });

    for (const [employeeId, dates] of datesByEmployee) {
      await this.attendance.recomputeEmployeeDates(employeeId, [...dates]);
    }
    await this.audit.log({
      userId: actorId ?? null,
      action: 'delete-import',
      entity: 'ImportBatch',
      entityId: id,
    });
    return { ok: true };
  }
}
