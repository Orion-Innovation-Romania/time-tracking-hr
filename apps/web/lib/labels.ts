import type { AnomalyFlag, DoorRole, LeaveType, MetricKey, ConditionType } from '@ttah/shared';

export const DOOR_ROLE_LABELS: Record<DoorRole, string> = {
  IN: 'Entry',
  OUT: 'Exit',
  NEUTRAL: 'Neutral',
};

export const FLAG_LABELS: Record<AnomalyFlag, string> = {
  MISSING_EXIT: 'Missing exit',
  MISSING_ENTRY: 'Missing entry',
  OVERNIGHT: 'Overnight',
  ZERO_DURATION: 'Zero duration',
  ONLY_OUTSIDE_SCHEDULE: 'Outside schedule',
  MANUAL_OVERRIDE: 'Manual override',
  EARLY_START: 'Early start',
  OVERTIME: 'Overtime',
};

/** Human-readable explanation shown as a tooltip / legend in the UI. */
export const FLAG_DESCRIPTIONS: Record<AnomalyFlag, string> = {
  MISSING_EXIT:
    'The employee badged in but no matching exit was recorded. Presence is closed at the end of the schedule, so the worked hours are an estimate.',
  MISSING_ENTRY:
    'An exit badge was found without a preceding entry. Usually caused by a misclassified door or a badge read that was missed.',
  OVERNIGHT: 'The presence session appears to cross midnight into the next day.',
  ZERO_DURATION:
    'There are access events for the day, but no valid entry→exit interval could be built, so worked time is zero.',
  ONLY_OUTSIDE_SCHEDULE:
    'All recorded presence fell outside the configured work schedule, so no worked time counts against the day.',
  MANUAL_OVERRIDE: 'A person manually edited this day; the values were entered by hand, not computed.',
  EARLY_START:
    'The employee badged in before the scheduled start by at least the configured threshold. The extra minutes are tracked as early time.',
  OVERTIME:
    'The employee stayed past the scheduled end by at least the configured threshold. The extra minutes are tracked as overtime.',
};

export const LEAVE_LABELS: Record<LeaveType, string> = {
  vacation: 'Vacation',
  sick: 'Sick leave',
  remote: 'Remote',
  other: 'Other',
};

export const METRIC_LABELS: Record<MetricKey, string> = {
  employeeName: 'Employee',
  department: 'Department',
  daysPresent: 'Days present',
  workedHours: 'Worked (h)',
  workedMinutes: 'Worked (min)',
  lunchMinutes: 'Lunch (min)',
  expectedHours: 'Expected (h)',
  overtimeHours: 'Overtime (h)',
  deficitHours: 'Deficit (h)',
  firstIn: 'First in',
  lastOut: 'Last out',
  anomalies: 'Anomalies',
};

export const CONDITION_LABELS: Record<ConditionType, string> = {
  MIN_SESSION_MINUTES: 'Minimum session (min)',
  GRACE_START_MINUTES: 'Grace before start (min)',
  GRACE_END_MINUTES: 'Grace after end (min)',
  ROUND_DAILY_MINUTES: 'Round daily total (min)',
  IGNORE_ZONE: 'Ignore zone',
  MAX_DAILY_MINUTES: 'Cap daily total (min)',
};
