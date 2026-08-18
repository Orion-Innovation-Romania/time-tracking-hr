import { BadRequestException, Injectable } from '@nestjs/common';
import type { DoorRole, EventType } from '@ttah/shared';
import { parseLocation, isValidAxTraxLocation } from '../doors/location';
import { parseReportDateTime } from '../common/time';
import type { ParsedEmployee, ParsedRecord, ParsedReport } from './parsed-report';

const DATETIME = /^\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}:\d{2}$/;
const LOCATION = /\d+\\Panel\s+\d+\\/i;
const EVENT_VALUE = /^Access\s+(Granted|Denied|Recorded)$/i;

/**
 * Parses AxTraxNG "Access Report" CSV exports (all employees in one file).
 *
 * Layout is a sparse spreadsheet dump: header metadata, then repeating blocks
 * of Department / User Name / User Id / User Credentials / Date-Location-Event
 * rows. Column indexes are not stable, so we read labelled cells rather than
 * fixed positions. Re-importing a later export of the same window is safe at
 * the event layer (unique employee+time+reader).
 */
@Injectable()
export class CsvParserService {
  parseBuffer(buffer: Buffer): ParsedReport {
    return this.parseText(decodeCsvBuffer(buffer));
  }

  parseText(text: string): ParsedReport {
    const normalized = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    if (!looksLikeAxTraxCsv(normalized)) {
      throw new BadRequestException(
        'This CSV does not look like an AxTraxNG access report. Export the Access Report from AxTraxNG.',
      );
    }

    const delimiter = detectDelimiter(normalized);
    const warnings: string[] = [];
    const employees: ParsedEmployee[] = [];
    const records: ParsedRecord[] = [];

    let department: string | null = null;
    let currentName: string | null = null;
    let currentDept: string | null = null;
    let currentCount = 0;
    let rangeFrom: Date | null = null;
    let rangeTo: Date | null = null;
    let skippedEvents = 0;
    let denied = 0;
    let recorded = 0;

    const flushEmployee = () => {
      if (!currentName) return;
      employees.push({
        rawUserName: currentName,
        department: currentDept,
        eventCount: currentCount,
      });
      currentName = null;
      currentDept = null;
      currentCount = 0;
    };

    for (const rawLine of normalized.split('\n')) {
      if (!rawLine.trim()) continue;
      const cells = parseCsvLine(rawLine, delimiter).map((c) => c.trim());
      const nonempty = cells.filter(Boolean);
      if (nonempty.length === 0) continue;

      const label = stripLabel(cells[0] ?? '');

      if (label === 'department') {
        department = cells.slice(1).find((c) => c) ?? department;
        continue;
      }
      if (label === 'user name') {
        flushEmployee();
        const name = cells.slice(1).find((c) => c) ?? '';
        if (!name) {
          warnings.push('Skipped a user block with an empty User Name.');
          continue;
        }
        currentName = name;
        currentDept = department;
        currentCount = 0;
        continue;
      }
      if (label === 'user id' || label === 'user credentials') continue;
      if (label === 'date' && nonempty.some((c) => /^location$/i.test(c))) continue;

      const fromIdx = cells.findIndex((c) => stripLabel(c) === 'from');
      if (fromIdx >= 0 && !rangeFrom) {
        const value = cells.slice(fromIdx + 1).find((c) => DATETIME.test(c) || /^\d{2}\/\d{2}\/\d{4}/.test(c));
        if (value) rangeFrom = parseFlexible(value);
      }
      const toIdx = cells.findIndex((c) => stripLabel(c) === 'to');
      if (toIdx >= 0 && !rangeTo) {
        const value = cells.slice(toIdx + 1).find((c) => DATETIME.test(c) || /^\d{2}\/\d{2}\/\d{4}/.test(c));
        if (value) rangeTo = parseFlexible(value);
      }

      const dt = nonempty.find((c) => DATETIME.test(c));
      const loc = nonempty.find((c) => LOCATION.test(c));
      const ev = nonempty.find((c) => EVENT_VALUE.test(c));
      if (!dt && !loc && !ev) continue;
      // Header rows include From/To/Print date timestamps without a door or event.
      if (!loc && !ev) continue;
      if (!dt || !loc || !ev) {
        skippedEvents += 1;
        continue;
      }
      if (!currentName) {
        skippedEvents += 1;
        continue;
      }

      const record = buildRecord(dt, loc, ev, currentName, currentDept);
      if (!record) {
        skippedEvents += 1;
        continue;
      }
      if (record.eventType === 'ACCESS_DENIED') denied += 1;
      if (/recorded/i.test(ev)) recorded += 1;
      records.push(record);
      currentCount += 1;
    }
    flushEmployee();

    if (employees.length === 0) {
      warnings.push('No employees were found in this CSV report.');
    }
    if (records.length === 0) {
      warnings.push('No access events were found in this CSV report.');
    }
    if (denied > 0) {
      warnings.push(`${denied} "Access Denied" event(s) were ignored for time calculation.`);
    }
    if (recorded > 0) {
      warnings.push(
        `${recorded} "Access Recorded" event(s) were imported as granted badge reads.`,
      );
    }
    if (skippedEvents > 0) {
      warnings.push(`${skippedEvents} row(s) could not be parsed as access events.`);
    }

    const times = records.map((r) => r.occurredAt.getTime());
    return {
      kind: 'multi',
      rawUserName: null,
      department,
      rangeFrom: rangeFrom ?? (times.length ? new Date(Math.min(...times)) : null),
      rangeTo: rangeTo ?? (times.length ? new Date(Math.max(...times)) : null),
      records,
      employees,
      warnings,
    };
  }
}

export function looksLikeAxTraxCsv(text: string): boolean {
  const head = text.slice(0, 4000);
  return /AxTraxNG/i.test(head) || /User\s*Name\s*:/i.test(head);
}

function decodeCsvBuffer(buffer: Buffer): string {
  if (buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
    return buffer.subarray(3).toString('utf8');
  }
  if (buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xfe) {
    return buffer.subarray(2).toString('utf16le');
  }
  return buffer.toString('utf8');
}

function detectDelimiter(text: string): ',' | ';' {
  const sample = text.split('\n').slice(0, 40).join('\n');
  const commas = (sample.match(/,/g) ?? []).length;
  const semis = (sample.match(/;/g) ?? []).length;
  return semis > commas ? ';' : ',';
}

function stripLabel(value: string): string {
  return value.replace(/:$/, '').trim().toLowerCase();
}

function parseFlexible(value: string): Date | null {
  const str = DATETIME.test(value.trim()) ? value.trim() : `${value.trim()} 00:00:00`;
  return parseReportDateTime(str);
}

function buildRecord(
  dtStr: string,
  location: string,
  event: string,
  rawUserName: string,
  department: string | null,
): ParsedRecord | null {
  const occurredAt = parseReportDateTime(dtStr.trim());
  if (!occurredAt) return null;
  const rawLocation = location.replace(/\s+/g, ' ').trim();
  if (!isValidAxTraxLocation(rawLocation)) return null;
  const direction: DoorRole = parseLocation(rawLocation).suggestedRole;
  const eventType: EventType = /denied/i.test(event) ? 'ACCESS_DENIED' : 'ACCESS_GRANTED';
  return { occurredAt, rawLocation, direction, eventType, rawUserName, department };
}

/** RFC4180-ish row parser. AxTraxNG quotes names and departments that contain commas. */
export function parseCsvLine(line: string, delimiter: ',' | ';' = ','): string[] {
  const out: string[] = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quoted) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        cur += c;
      }
    } else if (c === '"') {
      quoted = true;
    } else if (c === delimiter) {
      out.push(cur);
      cur = '';
    } else {
      cur += c;
    }
  }
  out.push(cur);
  return out;
}
