import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  hhmmToMinutes,
  type AnomalyFlag,
  type AttendanceFilter,
  type DailySummaryView,
  type DayDetailView,
  type DashboardKpis,
  type DayCorrectionInput,
  type MonthAggregateView,
  type TrendPoint,
  type ZoneBreakdown,
} from '@ttah/shared';
import { AuditService } from '../audit/audit.service';
import { ConfigStoreService } from '../config/config-store.service';
import { PrismaService } from '../prisma/prisma.service';
import { addDays, dateOnly, dayKey, hhmm, hhmmss } from '../common/time';
import { annotateDayEvents } from './anomaly-explain';
import {
  computeDay,
  type ConditionRuleLite,
  type DaySchedule,
  type EngineEvent,
} from './calculation';

interface EffectiveConfig {
  schedule: DaySchedule;
  workingDaysGlobal: number[];
  lunch: { windowStart: string; windowEnd: string; capMinutes: number; forceMinimum: boolean };
  thresholds: { shortExitMinutes: number; roundingMinutes: number; overtimeThresholdMinutes: number };
  conditions: ConditionRuleLite[];
}

@Injectable()
export class AttendanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigStoreService,
    private readonly audit: AuditService,
  ) {}

  // --- configuration loading ---
  private async loadConfig(): Promise<EffectiveConfig> {
    const [schedule, lunch, thresholds, rules] = await Promise.all([
      this.config.getSchedule(),
      this.config.getLunch(),
      this.config.getThresholds(),
      this.config.getEnabledConditions(),
    ]);
    return {
      schedule: { startTime: schedule.startTime, endTime: schedule.endTime },
      workingDaysGlobal: schedule.workingDays,
      lunch,
      thresholds,
      conditions: rules.map((r) => ({
        type: r.type,
        params: (r.params ?? {}) as Record<string, unknown>,
      })),
    };
  }

  private effectiveSchedule(
    global: EffectiveConfig,
    override: { startTime: string | null; endTime: string | null; workingDays: number[] } | null,
  ): { schedule: DaySchedule; workingDays: number[] } {
    return {
      schedule: {
        startTime: override?.startTime ?? global.schedule.startTime,
        endTime: override?.endTime ?? global.schedule.endTime,
      },
      workingDays:
        override?.workingDays && override.workingDays.length
          ? override.workingDays
          : global.workingDaysGlobal,
    };
  }

  // --- recomputation ---
  async recomputeEmployeeDates(employeeId: number, dayKeys: string[]): Promise<void> {
    if (dayKeys.length === 0) return;
    const cfg = await this.loadConfig();
    const override = await this.prisma.employeeSchedule.findUnique({ where: { employeeId } });
    const eff = this.effectiveSchedule(cfg, override);
    const unique = [...new Set(dayKeys)];

    for (const key of unique) {
      const date = dateOnly(key);
      const existing = await this.prisma.dailySummary.findUnique({
        where: { employeeId_date: { employeeId, date } },
      });
      if (existing?.manual) continue;

      const events = await this.loadEngineEvents(employeeId, key);
      if (events.length === 0) {
        if (existing) {
          await this.prisma.dailySummary.delete({ where: { id: existing.id } });
        }
        continue;
      }

      const result = computeDay(events, {
        dayKey: key,
        schedule: eff.schedule,
        lunch: cfg.lunch,
        thresholds: cfg.thresholds,
        conditions: cfg.conditions,
      });

      const data = {
        workedMinutes: result.workedMinutes,
        lunchMinutes: result.lunchMinutes,
        earlyMinutes: result.earlyMinutes,
        overtimeMinutes: result.overtimeMinutes,
        firstIn: result.firstIn,
        lastOut: result.lastOut,
        perZone: result.perZone as Prisma.InputJsonValue,
        flags: result.flags,
        intervals: result.intervals.map((iv) => ({
          start: iv.start.toISOString(),
          end: iv.end.toISOString(),
          source: iv.source,
          zone: iv.zone,
        })) as unknown as Prisma.InputJsonValue,
        manual: false,
        computedAt: new Date(),
      };

      await this.prisma.dailySummary.upsert({
        where: { employeeId_date: { employeeId, date } },
        create: { employeeId, date, ...data },
        update: data,
      });
    }
  }

  async recomputeEmployeeRange(employeeId: number, from: string, to: string): Promise<void> {
    const events = await this.prisma.accessEvent.findMany({
      where: { employeeId, occurredAt: { gte: dateOnly(from), lt: addDays(dateOnly(to), 1) } },
      select: { occurredAt: true },
    });
    const days = [...new Set(events.map((e) => dayKey(e.occurredAt)))];
    await this.recomputeEmployeeDates(employeeId, days);
  }

  async recomputeAll(from: string, to: string, employeeIds?: number[]): Promise<{ employees: number }> {
    const ids = employeeIds?.length
      ? employeeIds
      : (await this.prisma.employee.findMany({ select: { id: true } })).map((e) => e.id);
    for (const id of ids) {
      await this.recomputeEmployeeRange(id, from, to);
    }
    return { employees: ids.length };
  }

  private async loadEngineEvents(employeeId: number, key: string): Promise<EngineEvent[]> {
    const dayStart = dateOnly(key);
    const dayEnd = addDays(dayStart, 1);
    const rows = await this.prisma.accessEvent.findMany({
      where: { employeeId, occurredAt: { gte: dayStart, lt: dayEnd } },
      include: { reader: { include: { door: true } } },
      orderBy: { occurredAt: 'asc' },
    });
    return rows.map((row) => ({
      occurredAt: row.occurredAt,
      role: row.reader.role,
      zone: row.reader.door.name,
      eventType: row.eventType,
      doorId: row.readerId,
    }));
  }

  // --- queries ---
  private buildWhere(filter: AttendanceFilter): Prisma.DailySummaryWhereInput {
    const where: Prisma.DailySummaryWhereInput = {
      date: { gte: dateOnly(filter.from), lte: dateOnly(filter.to) },
    };
    if (filter.employeeIds?.length) where.employeeId = { in: filter.employeeIds };
    if (filter.departments?.length) {
      where.employee = { departments: { some: { department: { in: filter.departments } } } };
    }
    return where;
  }

  private toSummaryView(row: Prisma.DailySummaryGetPayload<{ include: { employee: true } }>): DailySummaryView {
    return {
      date: dayKey(row.date),
      employeeId: row.employeeId,
      employeeName: row.employee.displayName,
      workedMinutes: row.workedMinutes,
      lunchMinutes: row.lunchMinutes,
      earlyMinutes: row.earlyMinutes,
      overtimeMinutes: row.overtimeMinutes,
      firstIn: row.firstIn ? hhmm(row.firstIn) : null,
      lastOut: row.lastOut ? hhmm(row.lastOut) : null,
      perZone: (row.perZone as Record<string, number>) ?? {},
      flags: (row.flags as AnomalyFlag[]) ?? [],
      manual: row.manual,
      manualReason: row.manualReason,
      intervals: Array.isArray(row.intervals)
        ? (row.intervals as unknown as DailySummaryView['intervals'])
        : [],
    };
  }

  async getSummaries(filter: AttendanceFilter): Promise<DailySummaryView[]> {
    const rows = await this.prisma.dailySummary.findMany({
      where: this.buildWhere(filter),
      include: { employee: true },
      orderBy: [{ date: 'asc' }, { employeeId: 'asc' }],
    });
    return rows.map((row) => this.toSummaryView(row));
  }

  countSummaries(filter: AttendanceFilter): Promise<number> {
    return this.prisma.dailySummary.count({ where: this.buildWhere(filter) });
  }

  async getDayDetail(employeeId: number, key: string): Promise<DayDetailView | null> {
    const dayStart = dateOnly(key);
    const [row, cfg, override, eventRows] = await Promise.all([
      this.prisma.dailySummary.findUnique({
        where: { employeeId_date: { employeeId, date: dayStart } },
        include: { employee: true },
      }),
      this.loadConfig(),
      this.prisma.employeeSchedule.findUnique({ where: { employeeId } }),
      this.prisma.accessEvent.findMany({
        where: { employeeId, occurredAt: { gte: dayStart, lt: addDays(dayStart, 1) } },
        include: { reader: { include: { door: { include: { office: true } } } } },
        orderBy: { occurredAt: 'asc' },
      }),
    ]);
    if (!row) return null;

    const { schedule } = this.effectiveSchedule(cfg, override);
    const annotated = annotateDayEvents(
      eventRows.map((ev) => ({
        occurredAt: ev.occurredAt,
        role: ev.reader.role,
        eventType: ev.eventType,
        doorLabel: ev.reader.door.name,
        zone: ev.reader.door.office?.name ?? ev.reader.door.floor,
      })),
    );

    return {
      ...this.toSummaryView(row),
      schedule,
      events: annotated.map((ev) => ({
        occurredAt: ev.occurredAt.toISOString(),
        time: hhmmss(ev.occurredAt),
        role: ev.role,
        doorLabel: ev.doorLabel,
        zone: ev.zone,
        eventType: ev.eventType,
        issue: ev.issue,
        insideAfter: ev.insideAfter,
      })),
    };
  }

  async getDashboard(filter: AttendanceFilter): Promise<{
    kpis: DashboardKpis;
    trend: TrendPoint[];
    zones: ZoneBreakdown[];
  }> {
    const rows = await this.prisma.dailySummary.findMany({
      where: this.buildWhere(filter),
      include: { employee: true },
    });

    const presentRows = rows.filter((r) => r.workedMinutes > 0);
    const totalWorked = presentRows.reduce((sum, r) => sum + r.workedMinutes, 0);
    const employees = new Set(presentRows.map((r) => r.employeeId));
    const anomalies = rows.filter((r) => (r.flags as string[]).length > 0).length;

    const trendMap = new Map<string, { worked: number; employees: Set<number> }>();
    const zoneMap = new Map<string, number>();
    for (const row of presentRows) {
      const key = dayKey(row.date);
      const bucket = trendMap.get(key) ?? { worked: 0, employees: new Set<number>() };
      bucket.worked += row.workedMinutes;
      bucket.employees.add(row.employeeId);
      trendMap.set(key, bucket);
      const perZone = (row.perZone as Record<string, number>) ?? {};
      for (const [zone, minutes] of Object.entries(perZone)) {
        zoneMap.set(zone, (zoneMap.get(zone) ?? 0) + minutes);
      }
    }

    const trend: TrendPoint[] = [...trendMap.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, v]) => ({ date, workedMinutes: v.worked, employeesPresent: v.employees.size }));

    const zones: ZoneBreakdown[] = [...zoneMap.entries()]
      .map(([zone, minutes]) => ({ zone, minutes }))
      .sort((a, b) => b.minutes - a.minutes);

    const kpis: DashboardKpis = {
      employees: employees.size,
      daysPresent: presentRows.length,
      totalWorkedMinutes: totalWorked,
      avgWorkedMinutesPerDay: presentRows.length ? Math.round(totalWorked / presentRows.length) : 0,
      anomalies,
      rangeFrom: filter.from,
      rangeTo: filter.to,
    };

    return { kpis, trend, zones };
  }

  async getMonthAggregates(
    year: number,
    month: number,
    filter?: { employeeIds?: number[]; departments?: string[] },
  ): Promise<MonthAggregateView[]> {
    const from = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const to = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

    const cfg = await this.loadConfig();
    const employeeWhere: Prisma.EmployeeWhereInput = {};
    if (filter?.employeeIds?.length) {
      employeeWhere.id = { in: filter.employeeIds };
    } else {
      employeeWhere.active = true;
    }
    if (filter?.departments?.length) {
      employeeWhere.departments = { some: { department: { in: filter.departments } } };
    }

    const employees = await this.prisma.employee.findMany({
      where: employeeWhere,
      include: { departments: true, schedule: true },
      orderBy: { displayName: 'asc' },
    });

    const [summaries, holidays, leaves] = await Promise.all([
      this.prisma.dailySummary.findMany({
        where: {
          date: { gte: dateOnly(from), lte: dateOnly(to) },
          employeeId: { in: employees.map((e) => e.id) },
        },
      }),
      this.config.listHolidays(year),
      this.prisma.leave.findMany({
        where: { date: { gte: dateOnly(from), lte: dateOnly(to) } },
      }),
    ]);

    const holidaySet = new Set(holidays.map((h) => dayKey(h.date)));
    const leaveByEmployee = new Map<number, Set<string>>();
    for (const leave of leaves) {
      const set = leaveByEmployee.get(leave.employeeId) ?? new Set<string>();
      set.add(dayKey(leave.date));
      leaveByEmployee.set(leave.employeeId, set);
    }

    const summariesByEmployee = new Map<number, typeof summaries>();
    for (const summary of summaries) {
      const list = summariesByEmployee.get(summary.employeeId) ?? [];
      list.push(summary);
      summariesByEmployee.set(summary.employeeId, list);
    }

    const monthDays = this.eachDay(from, to);

    return employees.map((employee) => {
      const eff = this.effectiveSchedule(cfg, employee.schedule ?? null);
      const expectedDaily = Math.max(
        0,
        hhmmToMinutes(eff.schedule.endTime) -
          hhmmToMinutes(eff.schedule.startTime) -
          cfg.lunch.capMinutes,
      );
      const leaveDays = leaveByEmployee.get(employee.id) ?? new Set<string>();

      let workingDays = 0;
      for (const day of monthDays) {
        const iso = this.isoWeekdayOf(day);
        if (!eff.workingDays.includes(iso)) continue;
        if (holidaySet.has(day)) continue;
        if (leaveDays.has(day)) continue;
        workingDays += 1;
      }

      const rows = summariesByEmployee.get(employee.id) ?? [];
      const workedMinutes = rows.reduce((s, r) => s + r.workedMinutes, 0);
      const lunchMinutes = rows.reduce((s, r) => s + r.lunchMinutes, 0);
      const daysPresent = rows.filter((r) => r.workedMinutes > 0).length;
      const anomalies = rows.filter((r) => (r.flags as string[]).length > 0).length;
      const perZone: Record<string, number> = {};
      for (const row of rows) {
        for (const [zone, minutes] of Object.entries((row.perZone as Record<string, number>) ?? {})) {
          perZone[zone] = (perZone[zone] ?? 0) + minutes;
        }
      }
      const expectedMinutes = workingDays * expectedDaily;

      return {
        employeeId: employee.id,
        employeeName: employee.displayName,
        department: employee.departments[0]?.department ?? null,
        year,
        month,
        daysPresent,
        workedMinutes,
        lunchMinutes,
        expectedMinutes,
        overtimeMinutes: Math.max(0, workedMinutes - expectedMinutes),
        deficitMinutes: Math.max(0, expectedMinutes - workedMinutes),
        perZone,
        anomalies,
      } satisfies MonthAggregateView;
    });
  }

  // --- manual corrections ---
  async applyCorrection(input: DayCorrectionInput, actorId?: number | null) {
    const date = dateOnly(input.date);
    const data = {
      workedMinutes: input.workedMinutes,
      lunchMinutes: input.lunchMinutes,
      manual: true,
      manualReason: input.reason,
      flags: ['MANUAL_OVERRIDE'] as string[],
    };
    const row = await this.prisma.dailySummary.upsert({
      where: { employeeId_date: { employeeId: input.employeeId, date } },
      create: {
        employeeId: input.employeeId,
        date,
        firstIn: null,
        lastOut: null,
        perZone: {} as Prisma.InputJsonValue,
        intervals: [] as unknown as Prisma.InputJsonValue,
        ...data,
      },
      update: data,
    });
    await this.audit.log({
      userId: actorId ?? null,
      action: 'manual-correction',
      entity: 'DailySummary',
      entityId: row.id,
      after: input,
    });
    return row;
  }

  /**
   * Permanently remove a day's hours: badge events + computed summary.
   * Events must go too, otherwise the next recompute recreates the summary.
   */
  async deleteDay(employeeId: number, key: string, actorId?: number | null) {
    const date = dateOnly(key);
    const dayEnd = addDays(date, 1);
    const [events, summaries] = await this.prisma.$transaction([
      this.prisma.accessEvent.deleteMany({
        where: { employeeId, occurredAt: { gte: date, lt: dayEnd } },
      }),
      this.prisma.dailySummary.deleteMany({
        where: { employeeId, date },
      }),
    ]);
    if (events.count === 0 && summaries.count === 0) {
      throw new NotFoundException('No hours found for this employee and date');
    }
    await this.audit.log({
      userId: actorId ?? null,
      action: 'delete',
      entity: 'DailySummary',
      entityId: `${employeeId}:${key}`,
      after: { eventsDeleted: events.count, summariesDeleted: summaries.count },
    });
    return { ok: true, eventsDeleted: events.count, summariesDeleted: summaries.count };
  }

  async clearCorrection(employeeId: number, key: string, actorId?: number | null) {
    const date = dateOnly(key);
    await this.prisma.dailySummary.updateMany({
      where: { employeeId, date },
      data: { manual: false, manualReason: null },
    });
    await this.recomputeEmployeeDates(employeeId, [key]);
    await this.audit.log({
      userId: actorId ?? null,
      action: 'clear-correction',
      entity: 'DailySummary',
      entityId: `${employeeId}:${key}`,
    });
    return { ok: true };
  }

  // --- date helpers ---
  private eachDay(from: string, to: string): string[] {
    const days: string[] = [];
    let cursor = dateOnly(from);
    const end = dateOnly(to);
    while (cursor.getTime() <= end.getTime()) {
      days.push(dayKey(cursor));
      cursor = addDays(cursor, 1);
    }
    return days;
  }

  private isoWeekdayOf(key: string): number {
    const dow = dateOnly(key).getUTCDay();
    return dow === 0 ? 7 : dow;
  }
}
