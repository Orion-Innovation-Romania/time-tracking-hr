// Static, non-validated constants.

export const DEFAULT_TIMEZONE = 'Europe/Bucharest';

/** ISO weekday numbers: 1 = Monday ... 7 = Sunday. */
export const DEFAULT_WORKING_DAYS = [1, 2, 3, 4, 5];

/** Keys used in the Setting key/value store. */
export const SETTING_KEYS = {
  SCHEDULE: 'schedule.global',
  LUNCH: 'lunch',
  THRESHOLDS: 'thresholds',
  RETENTION_MONTHS: 'retention.months',
  TIMEZONE: 'timezone',
  MAIL: 'mail.graph',
} as const;
export type SettingKey = (typeof SETTING_KEYS)[keyof typeof SETTING_KEYS];

/** Keywords used to auto-detect a door's direction from its raw name. */
export const DIRECTION_KEYWORDS: { in: string[]; out: string[] } = {
  in: ['intrare'],
  out: ['iesire', 'ieşire', 'ieșire'],
};
