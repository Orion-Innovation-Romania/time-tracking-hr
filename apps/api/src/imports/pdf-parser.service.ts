import { Injectable, Logger } from '@nestjs/common';
import pdfParse from 'pdf-parse';
import type { DoorRole, EventType } from '@ttah/shared';
import { parseLocation } from '../doors/location';
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

const ROW_LINE =
  /^(\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}:\d{2})\s+(.+?)\s+(Access Granted|Access Denied)\s*$/i;
const ROW_GLOBAL =
  /(\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}:\d{2})\s+([\s\S]*?)\s+(Access Granted|Access Denied)/gi;
const DATETIME = /\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}:\d{2}/;
const FROM_TO =
  /From[:\s]+(\d{2}\/\d{2}\/\d{4}(?:\s+\d{2}:\d{2}:\d{2})?)[\s\S]{0,80}?To[:\s]+(\d{2}\/\d{2}\/\d{4}(?:\s+\d{2}:\d{2}:\d{2})?)/i;
const NOISE =
  /(AxTraxNG|Access Report|Print\s*date|^From\b|^To\b|Page\s*\d|Department|User\s*Name|Date\s+Location\s+Event|Orion Innovation|Maria Rosetti)/i;

/**
 * Extracts employee, range and access events from an AxTraxNG "Access Report".
 * The text-facing core (`parseText`) is pure and unit-tested against fixtures;
 * `parseBuffer` only adds PDF text extraction on top.
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
      const m = /User\s*Name[:\s]+(.+)$/i.exec(line.trim());
      if (m) {
        const value = m[1].split(/\s+(?:Department|From|To|Print\s*date)\b/i)[0].trim();
        if (value) return value;
      }
    }
    return null;
  }

  private extractDepartment(lines: string[]): string | null {
    for (const line of lines) {
      const m = /Department[:\s]+(.+)$/i.exec(line.trim());
      if (m) {
        const value = m[1].split(/\s+(?:User\s*Name|From|To|Print\s*date)\b/i)[0].trim();
        if (value) return value;
      }
    }
    return null;
  }

  private extractRange(text: string): { from: Date | null; to: Date | null } {
    const m = FROM_TO.exec(text);
    if (!m) return { from: null, to: null };
    return { from: this.parseFlexible(m[1]), to: this.parseFlexible(m[2]) };
  }

  private parseFlexible(value: string): Date | null {
    const str = /\d{2}:\d{2}:\d{2}/.test(value) ? value : `${value} 00:00:00`;
    return parseReportDateTime(str);
  }

  private extractRecords(normalized: string, lines: string[]): ParsedRecord[] {
    const lineRecords = this.viaLines(lines);
    const body = this.stripHeaders(normalized);
    const expected = (body.match(new RegExp(DATETIME, 'g')) ?? []).length;

    let records = lineRecords;
    if (lineRecords.length < expected * 0.8) {
      const globalRecords = this.viaGlobal(body);
      if (globalRecords.length > lineRecords.length) records = globalRecords;
    }

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

  private viaLines(lines: string[]): ParsedRecord[] {
    const out: ParsedRecord[] = [];
    for (const line of lines) {
      const m = ROW_LINE.exec(line.trim());
      if (!m) continue;
      const record = this.buildRecord(m[1], m[2], m[3]);
      if (record) out.push(record);
    }
    return out;
  }

  private viaGlobal(body: string): ParsedRecord[] {
    const out: ParsedRecord[] = [];
    ROW_GLOBAL.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = ROW_GLOBAL.exec(body)) !== null) {
      const record = this.buildRecord(m[1], m[2], m[3]);
      if (record) out.push(record);
    }
    return out;
  }

  private buildRecord(dtStr: string, location: string, event: string): ParsedRecord | null {
    const occurredAt = parseReportDateTime(dtStr.trim());
    if (!occurredAt) return null;
    const rawLocation = location.replace(/\s+/g, ' ').trim();
    if (!rawLocation) return null;
    const direction = parseLocation(rawLocation).suggestedRole;
    const eventType: EventType = /denied/i.test(event) ? 'ACCESS_DENIED' : 'ACCESS_GRANTED';
    return { occurredAt, rawLocation, direction, eventType };
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
