import type { DoorRole } from '@ttah/shared';
import { DIRECTION_KEYWORDS } from '@ttah/shared';

export interface ParsedLocation {
  readerNo: number | null;
  panel: string | null;
  floor: string | null;
  zone: string | null;
  suggestedRole: DoorRole;
}

/**
 * Parse an AxTraxNG location such as "3\\Panel 1\\Et. 4 Intrare fata Drivenets".
 * Direction is inferred from the Intrare/Iesire keyword; a rough zone label is
 * derived for grouping (HR can override role/zone later in the door registry).
 */
export function parseLocation(rawLocation: string): ParsedLocation {
  const parts = rawLocation.split('\\').map((p) => p.trim());
  const readerRaw = parts[0] ?? '';
  const readerNo = /^\d+$/.test(readerRaw) ? Number(readerRaw) : null;
  const panel = parts.length >= 3 ? parts[1] : null;
  const descriptor = (parts.length >= 3 ? parts[2] : parts[parts.length - 1]) ?? '';

  const floorMatch = /Et\.?\s*(\d+)/i.exec(descriptor);
  const floor = floorMatch ? `Et. ${floorMatch[1]}` : null;

  const lower = descriptor.toLowerCase();
  const isIn = DIRECTION_KEYWORDS.in.some((kw) => lower.includes(kw));
  const isOut = DIRECTION_KEYWORDS.out.some((kw) => lower.includes(kw));
  const suggestedRole: DoorRole = isIn ? 'IN' : isOut ? 'OUT' : 'NEUTRAL';

  let zone = descriptor;
  if (floorMatch) zone = zone.replace(floorMatch[0], '');
  for (const kw of [...DIRECTION_KEYWORDS.in, ...DIRECTION_KEYWORDS.out]) {
    zone = zone.replace(new RegExp(kw, 'i'), '');
  }
  zone = zone.replace(/\s+/g, ' ').trim();

  return {
    readerNo,
    panel,
    floor,
    zone: zone || descriptor.trim() || null,
    suggestedRole,
  };
}
