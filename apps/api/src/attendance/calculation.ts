import type { AnomalyFlag, ConditionType, DoorRole, EventType } from '@ttah/shared';
import { atTime } from '../common/time';

/**
 * Pure attendance engine. Given one employee's access events for a single day
 * plus the effective configuration, it produces worked/lunch minutes, presence
 * intervals, per-zone breakdown and anomaly flags.
 *
 * All Date values follow the "wall-clock stored as UTC" convention, so the math
 * here is timezone/DST independent. Durations are accumulated in milliseconds
 * and converted to whole minutes only at the boundaries to avoid drift.
 */

export interface EngineEvent {
  occurredAt: Date;
  role: DoorRole;
  zone: string | null;
  eventType: EventType;
  doorId?: number;
}

export interface DaySchedule {
  startTime: string; // HH:mm
  endTime: string; // HH:mm
}

export interface LunchOptions {
  windowStart: string;
  windowEnd: string;
  capMinutes: number;
  forceMinimum: boolean;
}

export interface ThresholdOptions {
  shortExitMinutes: number;
  roundingMinutes: number;
  overtimeThresholdMinutes: number;
}

export interface ConditionRuleLite {
  type: ConditionType;
  params: Record<string, unknown>;
}

export interface DayOptions {
  dayKey: string; // YYYY-MM-DD
  schedule: DaySchedule;
  lunch: LunchOptions;
  thresholds: ThresholdOptions;
  conditions: ConditionRuleLite[];
}

type IntervalSource = 'inside' | 'merged-short-exit' | 'grace';

interface Interval {
  start: Date;
  end: Date;
  zone: string | null;
  source: IntervalSource;
}

export interface DayIntervalResult {
  start: Date;
  end: Date;
  source: IntervalSource;
  zone: string | null;
}

export interface DayResult {
  workedMinutes: number;
  lunchMinutes: number;
  earlyMinutes: number;
  overtimeMinutes: number;
  firstIn: Date | null;
  lastOut: Date | null;
  perZone: Record<string, number>;
  flags: AnomalyFlag[];
  problemDoorIds: number[];
  intervals: DayIntervalResult[];
}

const MS_PER_MIN = 60000;

function overlapMs(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): number {
  const start = Math.max(aStart.getTime(), bStart.getTime());
  const end = Math.min(aEnd.getTime(), bEnd.getTime());
  return Math.max(0, end - start);
}

function durationMin(interval: { start: Date; end: Date }): number {
  return (interval.end.getTime() - interval.start.getTime()) / MS_PER_MIN;
}

function numParam(params: Record<string, unknown> | undefined, key: string, fallback: number): number {
  const value = params?.[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function strArrayParam(params: Record<string, unknown> | undefined, key: string): string[] {
  const value = params?.[key];
  return Array.isArray(value) ? value.filter((x): x is string => typeof x === 'string') : [];
}

export function computeDay(events: EngineEvent[], options: DayOptions): DayResult {
  const flags = new Set<AnomalyFlag>();
  const problemDoorIds = new Set<number>();
  const granted = events
    .filter((e) => e.eventType === 'ACCESS_GRANTED')
    .sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());

  const schedStart = atTime(options.dayKey, options.schedule.startTime);
  const schedEnd = atTime(options.dayKey, options.schedule.endTime);
  const lunchStart = atTime(options.dayKey, options.lunch.windowStart);
  const lunchEnd = atTime(options.dayKey, options.lunch.windowEnd);

  // 1) State machine -> raw inside intervals.
  const raw: Interval[] = [];
  let insideSince: Date | null = null;
  let openZone: string | null = null;
  let openDoorId: number | null = null;
  let firstIn: Date | null = null;
  let lastOut: Date | null = null;

  for (const ev of granted) {
    if (ev.role === 'IN') {
      if (insideSince === null) {
        insideSince = ev.occurredAt;
        openZone = ev.zone;
        openDoorId = ev.doorId ?? null;
        if (!firstIn) firstIn = ev.occurredAt;
      }
    } else if (ev.role === 'OUT') {
      if (insideSince !== null) {
        raw.push({ start: insideSince, end: ev.occurredAt, zone: openZone, source: 'inside' });
        lastOut = ev.occurredAt;
        insideSince = null;
        openZone = null;
        openDoorId = null;
      } else {
        flags.add('MISSING_ENTRY');
        if (ev.doorId != null) problemDoorIds.add(ev.doorId);
      }
    }
    // NEUTRAL events never change presence state.
  }

  if (insideSince !== null) {
    // Open interval at end of data: assume presence until schedule end for HR review.
    flags.add('MISSING_EXIT');
    if (openDoorId != null) problemDoorIds.add(openDoorId);
    const close = schedEnd.getTime() > insideSince.getTime() ? schedEnd : insideSince;
    raw.push({ start: insideSince, end: close, zone: openZone, source: 'inside' });
  }

  if (raw.length === 0) {
    if (granted.length > 0) flags.add('ZERO_DURATION');
    return {
      workedMinutes: 0,
      lunchMinutes: 0,
      earlyMinutes: 0,
      overtimeMinutes: 0,
      firstIn,
      lastOut,
      perZone: {},
      flags: [...flags],
      problemDoorIds: [...problemDoorIds],
      intervals: [],
    };
  }

  // 2) Merge short exits, but never bridge a gap overlapping the lunch window.
  const threshold = options.thresholds.shortExitMinutes;
  const merged: Interval[] = [];
  let cur: Interval = { ...raw[0] };
  for (let i = 1; i < raw.length; i++) {
    const next = raw[i];
    const gapMin = (next.start.getTime() - cur.end.getTime()) / MS_PER_MIN;
    const gapOverlapsLunch = overlapMs(cur.end, next.start, lunchStart, lunchEnd) > 0;
    if (gapMin > 0 && gapMin < threshold && !gapOverlapsLunch) {
      cur = { ...cur, end: next.end, source: 'merged-short-exit' };
    } else {
      merged.push(cur);
      cur = { ...next };
    }
  }
  merged.push(cur);

  // Out-of-schedule presence (measured from real intervals, before clamping).
  // MISSING_EXIT days close at schedEnd, so they never produce false overtime.
  const overtimeThreshold = options.thresholds.overtimeThresholdMinutes;
  let earlyMs = 0;
  let overtimeMs = 0;
  for (const iv of merged) {
    if (iv.start.getTime() < schedStart.getTime()) {
      earlyMs += Math.min(iv.end.getTime(), schedStart.getTime()) - iv.start.getTime();
    }
    if (iv.end.getTime() > schedEnd.getTime()) {
      overtimeMs += iv.end.getTime() - Math.max(iv.start.getTime(), schedEnd.getTime());
    }
  }
  const earlyMinutes = Math.max(0, Math.round(earlyMs / MS_PER_MIN));
  const overtimeMinutes = Math.max(0, Math.round(overtimeMs / MS_PER_MIN));
  if (earlyMinutes > 0 && earlyMinutes >= overtimeThreshold) flags.add('EARLY_START');
  if (overtimeMinutes > 0 && overtimeMinutes >= overtimeThreshold) flags.add('OVERTIME');

  const lunchWindowMs = Math.max(0, lunchEnd.getTime() - lunchStart.getTime());
  let insideLunchMs = 0;
  for (const iv of merged) insideLunchMs += overlapMs(iv.start, iv.end, lunchStart, lunchEnd);
  const measuredLunchOutside = Math.round(Math.max(0, lunchWindowMs - insideLunchMs) / MS_PER_MIN);

  // 3) Clamp to the schedule window.
  let clamped: Interval[] = [];
  for (const iv of merged) {
    const start = iv.start.getTime() < schedStart.getTime() ? schedStart : iv.start;
    const end = iv.end.getTime() > schedEnd.getTime() ? schedEnd : iv.end;
    if (end.getTime() > start.getTime()) {
      clamped.push({ ...iv, start, end });
    }
  }
  if (clamped.length === 0) {
    flags.add('ONLY_OUTSIDE_SCHEDULE');
    return {
      workedMinutes: 0,
      lunchMinutes: Math.min(options.lunch.capMinutes, measuredLunchOutside),
      earlyMinutes,
      overtimeMinutes,
      firstIn,
      lastOut,
      perZone: {},
      flags: [...flags],
      problemDoorIds: [...problemDoorIds],
      intervals: [],
    };
  }

  // 4) Special-conditions pipeline.
  const conditions = new Map<ConditionType, Record<string, unknown>>(
    options.conditions.map((c) => [c.type, c.params ?? {}]),
  );

  if (conditions.has('GRACE_START_MINUTES')) {
    const grace = numParam(conditions.get('GRACE_START_MINUTES'), 'minutes', 0);
    const first = clamped[0];
    const lateMin = (first.start.getTime() - schedStart.getTime()) / MS_PER_MIN;
    if (lateMin > 0 && lateMin <= grace) {
      clamped[0] = { ...first, start: schedStart, source: 'grace' };
    }
  }

  if (conditions.has('GRACE_END_MINUTES')) {
    const grace = numParam(conditions.get('GRACE_END_MINUTES'), 'minutes', 0);
    const last = clamped[clamped.length - 1];
    const earlyMin = (schedEnd.getTime() - last.end.getTime()) / MS_PER_MIN;
    if (earlyMin > 0 && earlyMin <= grace) {
      clamped[clamped.length - 1] = { ...last, end: schedEnd, source: 'grace' };
    }
  }

  if (conditions.has('MIN_SESSION_MINUTES')) {
    const min = numParam(conditions.get('MIN_SESSION_MINUTES'), 'minutes', 0);
    clamped = clamped.filter((iv) => durationMin(iv) >= min);
  }

  const ignoreZones = strArrayParam(conditions.get('IGNORE_ZONE'), 'zones');

  const perZone: Record<string, number> = {};
  let workedMs = 0;
  for (const iv of clamped) {
    if (ignoreZones.length && iv.zone && ignoreZones.includes(iv.zone)) continue;
    const ms = iv.end.getTime() - iv.start.getTime();
    workedMs += ms;
    const zoneKey = iv.zone ?? 'Unspecified';
    perZone[zoneKey] = (perZone[zoneKey] ?? 0) + Math.round(ms / MS_PER_MIN);
  }

  let workedMinutes = Math.round(workedMs / MS_PER_MIN);
  let lunchMinutes = Math.min(options.lunch.capMinutes, measuredLunchOutside);

  // Optional forced lunch deduction when the employee did not (fully) step out.
  if (options.lunch.forceMinimum && measuredLunchOutside < options.lunch.capMinutes) {
    const extra = options.lunch.capMinutes - measuredLunchOutside;
    workedMinutes = Math.max(0, workedMinutes - extra);
    lunchMinutes = options.lunch.capMinutes;
  }

  // Rounding: explicit condition wins over the global threshold.
  const roundStep = conditions.has('ROUND_DAILY_MINUTES')
    ? numParam(conditions.get('ROUND_DAILY_MINUTES'), 'minutes', options.thresholds.roundingMinutes)
    : options.thresholds.roundingMinutes;
  if (roundStep > 0) {
    workedMinutes = Math.round(workedMinutes / roundStep) * roundStep;
  }

  if (conditions.has('MAX_DAILY_MINUTES')) {
    const cap = numParam(conditions.get('MAX_DAILY_MINUTES'), 'minutes', 0);
    if (cap > 0 && workedMinutes > cap) workedMinutes = cap;
  }

  if (workedMinutes === 0 && granted.length > 0) flags.add('ZERO_DURATION');

  return {
    workedMinutes,
    lunchMinutes,
    earlyMinutes,
    overtimeMinutes,
    firstIn,
    lastOut,
    perZone,
    flags: [...flags],
    problemDoorIds: [...problemDoorIds],
    intervals: clamped.map((iv) => ({
      start: iv.start,
      end: iv.end,
      source: iv.source,
      zone: iv.zone,
    })),
  };
}
