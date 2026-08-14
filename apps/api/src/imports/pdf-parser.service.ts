import { Injectable, Logger } from '@nestjs/common';
import pdfParse from 'pdf-parse';
import type { DoorRole, EventType } from '@ttah/shared';
import { parseLocation, isValidAxTraxLocation } from '../doors/location';
import { parseReportDateTime } from '../common/time';

export interface ParsedRecord {
  occurredAt: Date;
  rawLocation: string;
  direction: DoorRole;
  eventType: EventType;
}

export interface ParsedReport {
  rawUserName: string | null;
  department: string | null;
  rangeFrom: Date | null;
  rangeTo: Date | null;
  records: ParsedRecord[];
  warnings: string[];
}

const DATETIME = /\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}:\d{2}/;
const EVENT = /Access Granted|Access Denied/i;

/** Classic AxTraxNG row: `DD/MM/YYYY HH:MM:SS <location> Access Granted` */
const ROW_CLASSIC_LINE =
  /^(\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}:\d{2})\s+(.+?)\s+(Access Granted|Access Denied)\s*$/i;
const ROW_CLASSIC_GLOBAL =
  /(\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}:\d{2})\s+([\s\S]*?)\s+(Access Granted|Access Denied)/gi;

/**
 * pdf-parse often emits AxTraxNG table columns right-to-left and glued:
 * `Access Granted3\Panel 1\Et. 4 Intrare fata Drivenets04/06/2026 08:59:10`
 */
const ROW_REVERSED_LINE =
  /^(Access Granted|Access Denied)(.+?)(\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}:\d{2})\s*$/i;
const ROW_REVERSED_GLOBAL =
  /(Access Granted|Access Denied)([\s\S]*?)(\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}:\d{2})/gi;

const FROM_TO_CLASSIC =
  /From[:\s]+(\d{2}\/\d{2}\/\d{4}(?:\s+\d{2}:\d{2}:\d{2})?)[\s\S]{0,120}?To[:\s]+(\d{2}\/\d{2}\/\d{4}(?:\s+\d{2}:\d{2}:\d{2})?)/i;

/** Reversed header dump: Print date, orphan To value, then From: value, then empty To: */
const FROM_TO_REVERSED =
  /Print\s*date[:\s]*\n?\s*\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}:\d{2}\s*\n\s*(\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}:\d{2})\s*\n\s*From[:\s]*\n?\s*(\d{2}\/\d{2}\/\d{4}(?:\s+\d{2}:\d{2}:\d{2})?)/i;

const NOISE =
  /(AxTraxNG|Access Report|Print\s*date|^From\b|^To\b|Page\s*\d|^\d+\/\d+$|Department|User\s*Name|Date\s+Location\s+Event|EventLocationDate|Orion Innovation|Maria Rosetti)/i;

/**
 * Extracts employee, range and access events from an AxTraxNG "Access Report".
 * Supports both classic left-to-right text and the reversed/glued layout that
 * pdf-parse often produces from multi-column PDF tables.
 */
@Injectable()
export class PdfParserService {
  private readonly logger = new Logger(PdfParserService.name);

  async parseBuffer(buffer: Buffer): Promise<ParsedReport> {
    const data = await pdfParse(buffer);
    return this.parseText(data.text);
  }

  parseText(text: string): ParsedReport {
    const normalized = text.replace(/\r/g, '');
    const lines = normalized.split('\n');
    const warnings: string[] = [];

    const rawUserName = this.extractUserName(lines);
    const department = this.extractDepartment(lines);
    const { from, to } = this.extractRange(normalized);
    const records = this.extractRecords(normalized, lines);

    if (!rawUserName) {
      warnings.push('Could not detect the employee name in the report header.');
    }
    if (records.length === 0) {
      warnings.push('No access events were found in this report.');
    }
    const denied = records.filter((r) => r.eventType === 'ACCESS_DENIED').length;
    if (denied > 0) {
      warnings.push(`${denied} "Access Denied" event(s) were ignored for time calculation.`);
    }

    const times = records.map((r) => r.occurredAt.getTime());
    const rangeFrom = from ?? (times.length ? new Date(Math.min(...times)) : null);
    const rangeTo = to ?? (times.length ? new Date(Math.max(...times)) : null);

    return { rawUserName, department, rangeFrom, rangeTo, records, warnings };
  }

  private extractUserName(lines: string[]): string | null {
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      // Classic: "User Name: VASILE, VASILE" / "User Name VASILE, VASILE"
      let m = /User\s*Name[:\s]+(.+)$/i.exec(trimmed);
      if (m) {
        const value = cleanHeaderValue(
          m[1].split(/\s+(?:Department|From|To|Print\s*date)\b/i)[0],
        );
        if (value) return value;
      }

      // Reversed glue: "VASILE, VASILEUser Name:"
      m = /^(.+?)\s*User\s*Name:?\s*$/i.exec(trimmed);
      if (m) {
        const value = cleanHeaderValue(m[1]);
        if (value) return value;
      }
    }
    return null;
  }

  private extractDepartment(lines: string[]): string | null {
    for (let i = 0; i < lines.length; i++) {
      const trimmed = lines[i].trim();
      if (!trimmed) continue;

      // Classic: "Department: Orion Innovation"
      let m = /Department[:\s]+(.+)$/i.exec(trimmed);
      if (m) {
        const value = cleanHeaderValue(
          m[1].split(/\s+(?:User\s*Name|From|To|Print\s*date)\b/i)[0],
        );
        if (value) return value;
      }

      // Reversed glue: "Orion InnovationDepartment:" — or garbage prefix + label
      m = /^(.+?)\s*Department:?\s*$/i.exec(trimmed);
      if (m) {
        const value = cleanHeaderValue(m[1]);
        // pdf-parse often leaves a door-zone fragment here ("Drivenets"); prefer
        // the previous meaningful line when the glued value looks incomplete.
        if (value && value.includes(' ')) return value;
        const prev = this.previousContentLine(lines, i);
        if (prev) return prev;
        if (value) return value;
      }
    }
    return null;
  }

  private previousContentLine(lines: string[], index: number): string | null {
    for (let i = index - 1; i >= 0; i--) {
      const t = lines[i].trim();
      if (!t) continue;
      if (/^\d+\/\d+$/.test(t)) continue; // page "1/5"
      if (NOISE.test(t) && !/Orion Innovation/i.test(t)) continue;
      if (EVENT.test(t) || DATETIME.test(t)) continue;
      if (t.length < 2) continue;
      return t;
    }
    return null;
  }

  private extractRange(text: string): { from: Date | null; to: Date | null } {
    const classic = FROM_TO_CLASSIC.exec(text);
    if (classic) {
      const from = this.parseFlexible(classic[1]);
      const to = this.parseFlexible(classic[2]);
      if (from && to) return { from, to };
    }

    const reversed = FROM_TO_REVERSED.exec(text);
    if (reversed) {
      // Group 1 = To (orphaned under Print date), group 2 = From
      return { from: this.parseFlexible(reversed[2]), to: this.parseFlexible(reversed[1]) };
    }

    const fromOnly = /From[:\s]+(\d{2}\/\d{2}\/\d{4}(?:\s+\d{2}:\d{2}:\d{2})?)/i.exec(text);
    const toOnly = /To[:\s]+(\d{2}\/\d{2}\/\d{4}(?:\s+\d{2}:\d{2}:\d{2})?)/i.exec(text);
    return {
      from: fromOnly ? this.parseFlexible(fromOnly[1]) : null,
      to: toOnly ? this.parseFlexible(toOnly[1]) : null,
    };
  }

  private parseFlexible(value: string): Date | null {
    const str = /\d{2}:\d{2}:\d{2}/.test(value) ? value : `${value} 00:00:00`;
    return parseReportDateTime(str);
  }

  private extractRecords(normalized: string, lines: string[]): ParsedRecord[] {
    const reversed = this.looksReversed(normalized);
    const body = this.stripHeaders(normalized);

    const candidates: ParsedRecord[][] = reversed
      ? [this.viaReversedLines(lines), this.viaReversedGlobal(body), this.viaClassicLines(lines)]
      : [this.viaClassicLines(lines), this.viaClassicGlobal(body), this.viaReversedLines(lines)];

    let records = candidates[0] ?? [];
    for (const c of candidates) {
      if (c.length > records.length) records = c;
    }

    // If classic line parse under-counts vs datetime-ish body, try the other global.
    const expected = (body.match(new RegExp(DATETIME.source, 'g')) ?? []).length;
    if (records.length < expected * 0.5) {
      const fallback = reversed ? this.viaClassicGlobal(body) : this.viaReversedGlobal(body);
      if (fallback.length > records.length) records = fallback;
    }

    return this.dedupeAndSort(records);
  }

  private looksReversed(text: string): boolean {
    const reversedHits = (text.match(/Access (?:Granted|Denied)\s*\d+\\Panel/gi) ?? []).length;
    const classicHits = (text.match(/\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}:\d{2}\s+\d+\\Panel/gi) ?? [])
      .length;
    return reversedHits > classicHits;
  }

  private viaClassicLines(lines: string[]): ParsedRecord[] {
    const out: ParsedRecord[] = [];
    for (const line of lines) {
      const m = ROW_CLASSIC_LINE.exec(line.trim());
      if (!m) continue;
      const record = this.buildRecord(m[1], m[2], m[3]);
      if (record) out.push(record);
    }
    return out;
  }

  private viaClassicGlobal(body: string): ParsedRecord[] {
    const out: ParsedRecord[] = [];
    ROW_CLASSIC_GLOBAL.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = ROW_CLASSIC_GLOBAL.exec(body)) !== null) {
      const record = this.buildRecord(m[1], m[2], m[3]);
      if (record) out.push(record);
    }
    return out;
  }

  private viaReversedLines(lines: string[]): ParsedRecord[] {
    const out: ParsedRecord[] = [];
    for (const line of lines) {
      const m = ROW_REVERSED_LINE.exec(line.trim());
      if (!m) continue;
      const record = this.buildRecord(m[3], m[2], m[1]);
      if (record) out.push(record);
    }
    return out;
  }

  private viaReversedGlobal(body: string): ParsedRecord[] {
    const out: ParsedRecord[] = [];
    ROW_REVERSED_GLOBAL.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = ROW_REVERSED_GLOBAL.exec(body)) !== null) {
      const record = this.buildRecord(m[3], m[2], m[1]);
      if (record) out.push(record);
    }
    return out;
  }

  private buildRecord(dtStr: string, location: string, event: string): ParsedRecord | null {
    const occurredAt = parseReportDateTime(dtStr.trim());
    if (!occurredAt) return null;
    const rawLocation = location.replace(/\s+/g, ' ').trim();
    if (!isValidAxTraxLocation(rawLocation)) return null;
    const direction = parseLocation(rawLocation).suggestedRole;
    const eventType: EventType = /denied/i.test(event) ? 'ACCESS_DENIED' : 'ACCESS_GRANTED';
    return { occurredAt, rawLocation, direction, eventType };
  }

  private dedupeAndSort(records: ParsedRecord[]): ParsedRecord[] {
    const seen = new Set<string>();
    const out: ParsedRecord[] = [];
    for (const record of records) {
      const key = `${record.occurredAt.toISOString()}|${record.rawLocation}|${record.direction}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(record);
    }
    out.sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());
    return out;
  }

  private stripHeaders(text: string): string {
    return text
      .split('\n')
      .filter((line) => {
        const l = line.trim();
        if (!l) return false;
        return !NOISE.test(l);
      })
      .join('\n');
  }
}

function cleanHeaderValue(raw: string): string | null {
  const value = raw.replace(/\s+/g, ' ').trim();
  if (!value) return null;
  if (/^EventLocationDate$/i.test(value)) return null;
  if (/^(From|To|Print\s*date)$/i.test(value)) return null;
  return value;
}
