// Enumerations shared across API and web. Each is a const tuple + a derived
// string-literal type so the same values drive zod validation and TS typing.

export const ROLES = ['admin', 'user'] as const;
export type Role = (typeof ROLES)[number];

/** Direction role of a door/reader used by the presence state machine. */
export const DOOR_ROLES = ['IN', 'OUT', 'NEUTRAL'] as const;
export type DoorRole = (typeof DOOR_ROLES)[number];

export const EVENT_TYPES = ['ACCESS_GRANTED', 'ACCESS_DENIED', 'OTHER'] as const;
export type EventType = (typeof EVENT_TYPES)[number];

export const LEAVE_TYPES = ['vacation', 'sick', 'remote', 'other'] as const;
export type LeaveType = (typeof LEAVE_TYPES)[number];

/** Optional, reorderable "special conditions" applied after the core pipeline. */
export const CONDITION_TYPES = [
  'MIN_SESSION_MINUTES', // discard inside-sessions shorter than N minutes
  'GRACE_START_MINUTES', // count up to N minutes before schedule start
  'GRACE_END_MINUTES', // count up to N minutes after schedule end
  'ROUND_DAILY_MINUTES', // round daily worked minutes to nearest N
  'IGNORE_ZONE', // exclude events of a given zone from counting
  'MAX_DAILY_MINUTES', // cap daily worked minutes at N
] as const;
export type ConditionType = (typeof CONDITION_TYPES)[number];

export const ANOMALY_FLAGS = [
  'MISSING_EXIT', // entered but no matching exit before end of day
  'MISSING_ENTRY', // exit without a preceding entry
  'OVERNIGHT', // session appears to cross midnight
  'ZERO_DURATION', // computed worked time is zero despite events
  'ONLY_OUTSIDE_SCHEDULE', // all presence fell outside the work schedule
  'MANUAL_OVERRIDE', // a human edited this day
  'EARLY_START', // arrived measurably before schedule start
  'OVERTIME', // stayed measurably after schedule end
] as const;
export type AnomalyFlag = (typeof ANOMALY_FLAGS)[number];

export const EXPORT_KINDS = ['summary', 'pontaj', 'raw'] as const;
export type ExportKind = (typeof EXPORT_KINDS)[number];

export const EXPORT_FORMATS = ['xlsx', 'csv'] as const;
export type ExportFormat = (typeof EXPORT_FORMATS)[number];

/** Metrics selectable as columns in the export template builder. */
export const METRIC_KEYS = [
  'employeeName',
  'department',
  'daysPresent',
  'workedHours',
  'workedMinutes',
  'lunchMinutes',
  'expectedHours',
  'overtimeHours',
  'deficitHours',
  'firstIn',
  'lastOut',
  'anomalies',
] as const;
export type MetricKey = (typeof METRIC_KEYS)[number];
