import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import {
  DEFAULT_LUNCH,
  DEFAULT_SCHEDULE,
  DEFAULT_THRESHOLDS,
  SETTING_KEYS,
  lunchConfigSchema,
  scheduleConfigSchema,
  thresholdConfigSchema,
  type ConditionRuleInput,
  type HolidayInput,
  type LeaveInput,
  type LunchConfig,
  type ScheduleConfig,
  type ThresholdConfig,
} from '@ttah/shared';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { dateOnly } from '../common/time';

@Injectable()
export class ConfigStoreService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private async readSetting<S extends z.ZodTypeAny>(
    key: string,
    schema: S,
    fallback: z.infer<S>,
  ): Promise<z.infer<S>> {
    const row = await this.prisma.setting.findUnique({ where: { key } });
    if (!row) return fallback;
    const parsed = schema.safeParse(row.value);
    return parsed.success ? parsed.data : fallback;
  }

  private async writeSetting(key: string, value: unknown, actorId?: number | null) {
    const before = await this.prisma.setting.findUnique({ where: { key } });
    const row = await this.prisma.setting.upsert({
      where: { key },
      create: { key, value: value as Prisma.InputJsonValue },
      update: { value: value as Prisma.InputJsonValue },
    });
    await this.audit.log({
      userId: actorId ?? null,
      action: 'update',
      entity: 'Setting',
      entityId: key,
      before: before?.value,
      after: value,
    });
    return row.value;
  }

  // --- schedule / lunch / thresholds ---
  getSchedule(): Promise<ScheduleConfig> {
    return this.readSetting(SETTING_KEYS.SCHEDULE, scheduleConfigSchema, DEFAULT_SCHEDULE);
  }

  setSchedule(input: ScheduleConfig, actorId?: number | null) {
    return this.writeSetting(SETTING_KEYS.SCHEDULE, scheduleConfigSchema.parse(input), actorId);
  }

  getLunch(): Promise<LunchConfig> {
    return this.readSetting(SETTING_KEYS.LUNCH, lunchConfigSchema, DEFAULT_LUNCH);
  }

  setLunch(input: LunchConfig, actorId?: number | null) {
    return this.writeSetting(SETTING_KEYS.LUNCH, lunchConfigSchema.parse(input), actorId);
  }

  getThresholds(): Promise<ThresholdConfig> {
    return this.readSetting(SETTING_KEYS.THRESHOLDS, thresholdConfigSchema, DEFAULT_THRESHOLDS);
  }

  setThresholds(input: ThresholdConfig, actorId?: number | null) {
    return this.writeSetting(SETTING_KEYS.THRESHOLDS, thresholdConfigSchema.parse(input), actorId);
  }

  async getRetentionMonths(): Promise<number> {
    const row = await this.prisma.setting.findUnique({
      where: { key: SETTING_KEYS.RETENTION_MONTHS },
    });
    const value = typeof row?.value === 'number' ? row.value : Number(row?.value);
    return Number.isFinite(value) && value > 0 ? value : 24;
  }

  setRetentionMonths(months: number, actorId?: number | null) {
    const safe = Math.min(Math.max(Math.round(months), 1), 120);
    return this.writeSetting(SETTING_KEYS.RETENTION_MONTHS, safe, actorId);
  }

  // --- condition rules ---
  getConditions() {
    return this.prisma.conditionRule.findMany({ orderBy: { order: 'asc' } });
  }

  getEnabledConditions() {
    return this.prisma.conditionRule.findMany({
      where: { enabled: true },
      orderBy: { order: 'asc' },
    });
  }

  async replaceConditions(rules: ConditionRuleInput[], actorId?: number | null) {
    await this.prisma.$transaction([
      this.prisma.conditionRule.deleteMany({}),
      ...rules.map((rule, index) =>
        this.prisma.conditionRule.create({
          data: {
            type: rule.type,
            params: (rule.params ?? {}) as Prisma.InputJsonValue,
            enabled: rule.enabled ?? true,
            order: rule.order ?? index,
          },
        }),
      ),
    ]);
    await this.audit.log({
      userId: actorId ?? null,
      action: 'replace',
      entity: 'ConditionRule',
      after: rules,
    });
    return this.getConditions();
  }

  // --- holidays ---
  listHolidays(year?: number) {
    if (year) {
      return this.prisma.holiday.findMany({
        where: { date: { gte: dateOnly(`${year}-01-01`), lte: dateOnly(`${year}-12-31`) } },
        orderBy: { date: 'asc' },
      });
    }
    return this.prisma.holiday.findMany({ orderBy: { date: 'asc' } });
  }

  async upsertHoliday(input: HolidayInput, actorId?: number | null) {
    const date = dateOnly(input.date);
    const row = await this.prisma.holiday.upsert({
      where: { date },
      create: { date, name: input.name },
      update: { name: input.name },
    });
    await this.audit.log({
      userId: actorId ?? null,
      action: 'upsert',
      entity: 'Holiday',
      entityId: row.id,
      after: input,
    });
    return row;
  }

  async deleteHoliday(id: number, actorId?: number | null) {
    await this.prisma.holiday.delete({ where: { id } });
    await this.audit.log({ userId: actorId ?? null, action: 'delete', entity: 'Holiday', entityId: id });
    return { ok: true };
  }

  // --- leaves ---
  listLeaves(params: { from?: string; to?: string; employeeId?: number }) {
    const where: Prisma.LeaveWhereInput = {};
    if (params.employeeId) where.employeeId = params.employeeId;
    if (params.from || params.to) {
      where.date = {};
      if (params.from) (where.date as Prisma.DateTimeFilter).gte = dateOnly(params.from);
      if (params.to) (where.date as Prisma.DateTimeFilter).lte = dateOnly(params.to);
    }
    return this.prisma.leave.findMany({ where, orderBy: [{ date: 'asc' }] });
  }

  async upsertLeave(input: LeaveInput, actorId?: number | null) {
    const date = dateOnly(input.date);
    const row = await this.prisma.leave.upsert({
      where: { employeeId_date: { employeeId: input.employeeId, date } },
      create: { employeeId: input.employeeId, date, type: input.type, note: input.note ?? null },
      update: { type: input.type, note: input.note ?? null },
    });
    await this.audit.log({
      userId: actorId ?? null,
      action: 'upsert',
      entity: 'Leave',
      entityId: row.id,
      after: input,
    });
    return row;
  }

  async deleteLeave(id: number, actorId?: number | null) {
    await this.prisma.leave.delete({ where: { id } });
    await this.audit.log({ userId: actorId ?? null, action: 'delete', entity: 'Leave', entityId: id });
    return { ok: true };
  }
}
