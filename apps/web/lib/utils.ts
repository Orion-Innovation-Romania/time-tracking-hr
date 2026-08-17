import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatMinutes(total: number): string {
  const sign = total < 0 ? '-' : '';
  const abs = Math.abs(Math.round(total));
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return `${sign}${h}h ${String(m).padStart(2, '0')}m`;
}

export function minutesToHours(total: number): string {
  return (total / 60).toFixed(2);
}

/** Format a clock value: accepts either an "HH:mm" string (already formatted server-side) or a full ISO timestamp. */
export function formatClock(iso: string | null | undefined): string {
  if (!iso) return '—';
  if (/^\d{2}:\d{2}$/.test(iso)) return iso;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

export function formatDate(date: string | null | undefined): string {
  if (!date) return '—';
  // Accept ISO datetimes (2026-08-04T00:00:00.000Z), plain dates (2026-08-04),
  // or already formatted dd/mm/yyyy.
  // If it's already in dd/mm/yyyy, return as-is.
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(date)) return date;

  // Strip time portion if present
  const dateOnly = date.includes('T') ? date.split('T')[0] : date;

  const parts = dateOnly.split('-');
  if (parts.length === 3) {
    const [y, m, d] = parts;
    return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`;
  }

  // Fallback: try parsing with Date
  const parsed = new Date(date);
  if (!Number.isNaN(parsed.getTime())) {
    const dd = String(parsed.getUTCDate()).padStart(2, '0');
    const mm = String(parsed.getUTCMonth() + 1).padStart(2, '0');
    const yy = parsed.getUTCFullYear();
    return `${dd}/${mm}/${yy}`;
  }

  return String(date);
}

export function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`;
}

export function monthRange(year: number, month: number): { from: string; to: string } {
  const from = `${year}-${String(month).padStart(2, '0')}-01`;
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const to = `${year}-${String(month).padStart(2, '0')}-${String(last).padStart(2, '0')}`;
  return { from, to };
}

export function currentYearMonth(): { year: number; month: number } {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

export function currentMonthRange(): { from: string; to: string } {
  const { year, month } = currentYearMonth();
  return monthRange(year, month);
}

export function ymKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`;
}

export function parseYm(value: string): { year: number; month: number } | null {
  const match = /^(\d{4})-(\d{2})$/.exec(value.slice(0, 7));
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) return null;
  return { year, month };
}

export function isCurrentMonth(year: number, month: number): boolean {
  const now = currentYearMonth();
  return now.year === year && now.month === month;
}

export function shiftMonth(
  year: number,
  month: number,
  delta: number,
): { year: number; month: number } {
  const date = new Date(Date.UTC(year, month - 1 + delta, 1));
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1 };
}
