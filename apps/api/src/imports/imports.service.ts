import { createHash, randomUUID } from 'node:crypto';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  canonicalizeName,
  type DiscoveredDoor,
  type ImportCommitInput,
  type ImportPreview,
  type ImportResult,
  type ParsedEventRow,
} from '@ttah/shared';
import { AuditService } from '../audit/audit.service';
import { AttendanceService } from '../attendance/attendance.service';
import { DoorsService, parseLocation } from '../doors/doors.service';
import { EmployeesService } from '../employees/employees.service';
import { PrismaService } from '../prisma/prisma.service';
import { dayKey } from '../common/time';
import { PdfParserService } from './pdf-parser.service';
import { PreviewStore } from './preview-store.service';

@Injectable()
export class ImportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly parser: PdfParserService,
    private readonly employees: EmployeesService,
    private readonly doors: DoorsService,
    private readonly attendance: AttendanceService,
    private readonly audit: AuditService,
    private readonly store: PreviewStore,
  ) {}

  async preview(file: { originalname: string; buffer: Buffer }): Promise<ImportPreview> {
    const report = await this.parser.parseBuffer(file.buffer);
    const fileHash = createHash('sha256').update(file.buffer).digest('hex');
    const duplicate = await this.prisma.importBatch.findUnique({ where: { fileHash } });

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

    const rawLocations = [...new Set(report.records.map((r) => r.rawLocation))];
    const existing = await this.prisma.reader.findMany({
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
      matchedEmployeeId,
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
      };
    });

    return {
      previewId,
      fileName: file.originalname,
      fileHash,
      rawUserName: report.rawUserName ?? '',
      canonicalName,
      matchedEmployeeId,
      department: report.department,
      rangeFrom: report.rangeFrom ? report.rangeFrom.toISOString() : null,
      rangeTo: report.rangeTo ? report.rangeTo.toISOString() : null,
      rowsTotal: report.records.length,
      rowsParsed: report.records.length,
      duplicateOfBatchId: duplicate?.id ?? null,
      newDoors,
      sampleRows,
      warnings: report.warnings,
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
        rowsTotal: existingBatch.rowsTotal,
        rowsNew: 0,
        rowsDuplicate: existingBatch.rowsTotal,
        affectedDates: [],
      };
    }

    const employeeId = await this.resolveCommitEmployee(input, entry);

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
        employeeId,
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

    const created = await this.prisma.accessEvent.createMany({ data: rows, skipDuplicates: true });
    const rowsNew = created.count;
    const rowsDuplicate = rows.length - rowsNew;
    const affectedDates = [...new Set(entry.report.records.map((r) => dayKey(r.occurredAt)))];

    await this.prisma.importBatch.update({
      where: { id: batch.id },
      data: { rowsNew, rowsDuplicate, status: 'COMMITTED' },
    });

    await this.attendance.recomputeEmployeeDates(employeeId, affectedDates);
    await this.audit.log({
      userId: actorId ?? null,
      action: 'import',
      entity: 'ImportBatch',
      entityId: batch.id,
      after: { fileName: entry.fileName, rowsNew, rowsDuplicate, employeeId },
    });
    this.store.delete(input.previewId);

    return {
      batchId: batch.id,
      employeeId,
      rowsTotal: rows.length,
      rowsNew,
      rowsDuplicate,
      affectedDates,
    };
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
      employeeName: batch.employee?.displayName ?? '—',
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
      select: { occurredAt: true },
    });
    const dates = [...new Set(events.map((e) => dayKey(e.occurredAt)))];

    await this.prisma.accessEvent.deleteMany({ where: { importBatchId: id } });
    await this.prisma.importBatch.delete({ where: { id } });

    if (batch.employeeId) {
      await this.attendance.recomputeEmployeeDates(batch.employeeId, dates);
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
