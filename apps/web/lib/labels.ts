import type { AnomalyFlag, DoorRole, LeaveType, MetricKey, ConditionType, ExportKind } from '@ttah/shared';

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
    'The last counted entry has no matching exit. Presence is closed at the scheduled end, so worked hours for that last session are an estimate. Last out is still the last confirmed exit from a completed session — they may have entered again afterwards.',
  MISSING_ENTRY:
    'An exit badge was recorded while the person was not already inside. This does not mean First in is missing: First in is the first counted entry. Typical causes: an extra exit, an exit before the first entry, or a door classified as Exit that was used as Entry.',
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

/** One-line hint shown in the “Add condition” menu. */
export const CONDITION_HINTS: Record<ConditionType, string> = {
  MIN_SESSION_MINUTES: 'Hide very short inside sessions (accidental double-reads).',
  GRACE_START_MINUTES: 'A few minutes late still counts as arriving on time.',
  GRACE_END_MINUTES: 'A few minutes early still counts as leaving on time.',
  ROUND_DAILY_MINUTES: 'Override the daily rounding step above.',
  IGNORE_ZONE: 'Exclude named door zones from worked time.',
  MAX_DAILY_MINUTES: 'Hard cap on worked minutes for the day.',
};

export const CONDITION_DESCRIPTIONS: Record<ConditionType, string> = {
  MIN_SESSION_MINUTES:
    'Drop inside sessions shorter than N minutes (a badge in and out at the same door). Example: 2 minutes hides an accidental double-read; a 20-minute visit still counts.',
  GRACE_START_MINUTES:
    'If they badge in up to N minutes after the scheduled start, treat the day as starting on time. Example: start 09:00 and grace 10 → a 09:08 arrival counts from 09:00.',
  GRACE_END_MINUTES:
    'If they badge out up to N minutes before the scheduled end, treat the day as ending on time. Example: end 17:30 and grace 10 → a 17:22 exit counts through 17:30.',
  ROUND_DAILY_MINUTES:
    'Overrides “Round daily total” above with this step, only while the condition is enabled. Same nearest-multiple rounding.',
  IGNORE_ZONE:
    'Do not count presence in these door zones. Type names as imported, comma-separated. Events still appear in raw data; they just add no worked time.',
  MAX_DAILY_MINUTES:
    'Never report more than N worked minutes in a day, after lunch and rounding. Example: 480 caps the day at 8 hours.',
};

export const KIND_LABELS: Record<ExportKind, string> = {
  summary: 'Summary',
  pontaj: 'Pontaj',
  raw: 'Raw events',
};
