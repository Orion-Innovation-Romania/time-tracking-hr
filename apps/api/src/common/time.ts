/**
 * Time helpers built on the "naive local stored as UTC" convention.
 *
 * Report timestamps carry site-local wall-clock time with no zone. We build
 * Date objects whose UTC components equal those wall-clock values, so all
 * duration and day-grouping math is timezone/DST independent. Always format
 * with the UTC getters below — never the local ones.
 */

const DATETIME_RE = /^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2}):(\d{2})$/;

/** Parse "DD/MM/YYYY HH:MM:SS" into a wall-clock-as-UTC Date, or null. */
export function parseReportDateTime(input: string): Date | null {
  const m = DATETIME_RE.exec(input.trim());
  if (!m) return null;
  const [, dd, mm, yyyy, hh, min, ss] = m;
  const date = new Date(
    Date.UTC(+yyyy, +mm - 1, +dd, +hh, +min, +ss),
  );
  return Number.isNaN(date.getTime()) ? null : date;
}

/** "YYYY-MM-DD" key from a wall-clock-as-UTC Date. */
export function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Midnight (00:00) of a YYYY-MM-DD as a wall-clock-as-UTC Date. */
export function dateOnly(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/** ISO weekday 1=Mon..7=Sun from a wall-clock-as-UTC Date. */
export function isoWeekday(date: Date): number {
  const dow = date.getUTCDay(); // 0=Sun..6=Sat
  return dow === 0 ? 7 : dow;
}

/** "HH:mm" of a wall-clock-as-UTC Date. */
export function hhmm(date: Date): string {
  return date.toISOString().slice(11, 16);
}

/** Combine a day (YYYY-MM-DD) with an "HH:mm" into a wall-clock-as-UTC Date. */
export function atTime(dayKeyStr: string, time: string): Date {
  const [y, m, d] = dayKeyStr.split('-').map(Number);
  const [hh, min] = time.split(':').map(Number);
  return new Date(Date.UTC(y, m - 1, d, hh, min, 0));
}

/** Whole-minute difference b - a. */
export function minutesBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 60000);
}

/** Minutes since midnight (UTC) for a wall-clock-as-UTC Date. */
export function minutesOfDay(date: Date): number {
  return date.getUTCHours() * 60 + date.getUTCMinutes();
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86400000);
}
