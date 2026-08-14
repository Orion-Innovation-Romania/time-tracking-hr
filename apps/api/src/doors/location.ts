import type { DoorRole } from '@ttah/shared';
import { DIRECTION_KEYWORDS } from '@ttah/shared';

export interface ParsedLocation {
  readerNo: number | null;
  panel: string | null;
  floor: string | null;
  /** Suggested physical-door name (direction words and floor stripped). */
  suggestedName: string;
  suggestedRole: DoorRole;
}

/** Real AxTraxNG reader: `3\Panel 1\Et. 4 Intrare fata Drivenets` */
const AXTRAX_LOCATION = /^\d+\\Panel\s+\d+\\.+/i;
const HAS_DATETIME = /\d{2}\/\d{2}\/\d{4}/;
const HAS_NOISE =
  /(EventLocationDate|Access Granted|Access Denied|Print\s*date|AxTraxNG|User\s*Name|Department:)/i;

/**
 * True only for a clean AxTrax reader path. Rejects PDF header leftovers
 * (print dates, EventLocationDate, glued multi-row blobs).
 */
export function isValidAxTraxLocation(rawLocation: string): boolean {
  const loc = rawLocation.replace(/\s+/g, ' ').trim();
  if (!loc || loc.length > 160) return false;
  if (HAS_DATETIME.test(loc)) return false;
  if (HAS_NOISE.test(loc)) return false;
  if (!AXTRAX_LOCATION.test(loc)) return false;
  return loc.split('\\').length === 3;
}

/** Stable key so entry/exit readers of the same door keep grouping after rename. */
export function doorGroupingKey(name: string, floor: string | null): string {
  return `${name.trim().toLowerCase()}|${(floor ?? '').trim().toLowerCase()}`;
}

/**
 * Parse an AxTraxNG location such as "3\\Panel 1\\Et. 4 Intrare fata Drivenets".
 * Direction is inferred from the Intrare/Iesire keyword; the remaining text is
 * the suggested door name (HR can override name / office / floor later).
 */
export function parseLocation(rawLocation: string): ParsedLocation {
  const parts = rawLocation.split('\\').map((p) => p.trim());
  const readerRaw = parts[0] ?? '';
  const readerNo = /^\d+$/.test(readerRaw) ? Number(readerRaw) : null;
  const panel = parts.length >= 3 ? parts[1] : null;
  const descriptor = (parts.length >= 3 ? parts[2] : parts[parts.length - 1]) ?? '';

  const floorMatch = /Et\.?\s*(\d+)/i.exec(descriptor);
  let floor: string | null = floorMatch ? `Et. ${floorMatch[1]}` : null;
  if (!floor && /\bparter\b/i.test(descriptor)) floor = 'Parter';

  const lower = descriptor.toLowerCase();
  const isIn = DIRECTION_KEYWORDS.in.some((kw) => lower.includes(kw));
  const isOut = DIRECTION_KEYWORDS.out.some((kw) => lower.includes(kw));
  const suggestedRole: DoorRole = isIn ? 'IN' : isOut ? 'OUT' : 'NEUTRAL';

  let name = descriptor;
  if (floorMatch) name = name.replace(floorMatch[0], '');
  if (floor === 'Parter') name = name.replace(/\bparter\b/i, '');
  for (const kw of [...DIRECTION_KEYWORDS.in, ...DIRECTION_KEYWORDS.out]) {
    name = name.replace(new RegExp(kw, 'i'), '');
  }
  name = name.replace(/\s+/g, ' ').trim();

  return {
    readerNo,
    panel,
    floor,
    suggestedName: name || descriptor.trim() || 'Unnamed',
    suggestedRole,
  };
}
