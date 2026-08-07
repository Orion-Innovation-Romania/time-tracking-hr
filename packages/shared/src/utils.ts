// Small formatting/parsing helpers shared by API and web.

export function hhmmToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

export function minutesToHhmm(total: number): string {
  const sign = total < 0 ? '-' : '';
  const m = Math.abs(Math.round(total));
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${sign}${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

/** Minutes -> "H:MM" (no leading zero on hours), e.g. 505 -> "8:25". */
export function formatMinutes(total: number): string {
  const sign = total < 0 ? '-' : '';
  const m = Math.abs(Math.round(total));
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${sign}${h}:${String(mm).padStart(2, '0')}`;
}

export function minutesToHours(min: number, digits = 2): number {
  const f = 10 ** digits;
  return Math.round((min / 60) * f) / f;
}

/** Normalize a raw "User Name" from the report into a canonical key. */
export function canonicalizeName(raw: string): string {
  return raw
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/** Convert a report "User Name" ("SURNAME, First") into a display name. */
export function toDisplayName(raw: string): string {
  const parts = raw.split(',').map((s) => s.trim()).filter(Boolean);
  if (parts.length === 2) {
    const [surname, first] = parts;
    return `${titleCase(first)} ${titleCase(surname)}`;
  }
  return titleCase(raw.trim());
}

function titleCase(s: string): string {
  return s
    .toLowerCase()
    .replace(/\b([a-zà-ÿ])/g, (m) => m.toUpperCase());
}
