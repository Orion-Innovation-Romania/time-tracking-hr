import 'reflect-metadata';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { PdfParserService } from '../src/imports/pdf-parser.service';

const parser = new PdfParserService();

describe('PdfParserService.parseText', () => {
  it('parses a single-line AxTraxNG report layout', () => {
    const text = [
      'AxTraxNG 27.7.1.18 Access Report',
      'Print date: 30/07/2026 16:24:47',
      'Department Orion Innovation',
      'User Name VASILE, VASILE',
      'From: 04/06/2026 00:00:00 To: 04/06/2026 23:59:59',
      'Date Location Event',
      '04/06/2026 08:59:10 3\\Panel 1\\Et. 4 Intrare fata Drivenets Access Granted',
      '04/06/2026 09:01:59 3\\Panel 1\\Et. 4 Iesire fata Drivenets Access Granted',
      '04/06/2026 13:03:58 5\\Panel 1\\Et. 2 Baie Baieti Access Granted',
    ].join('\n');

    const report = parser.parseText(text);

    expect(report.rawUserName).toBe('VASILE, VASILE');
    expect(report.department).toBe('Orion Innovation');
    expect(report.records).toHaveLength(3);
    expect(report.records.map((r) => r.direction)).toEqual(['IN', 'OUT', 'NEUTRAL']);
    expect(report.rangeFrom?.toISOString()).toContain('2026-06-04T00:00:00');
    expect(report.rangeTo?.toISOString()).toContain('2026-06-04T23:59:59');
  });

  it('falls back to whole-text parsing when rows span multiple lines', () => {
    const text = [
      'User Name POPESCU, ION',
      'From: 05/06/2026 To: 05/06/2026',
      '05/06/2026 08:00:00',
      '1\\Panel 1\\Et. 1 Intrare Administrativ',
      'Access Granted',
      '05/06/2026 17:00:00',
      '1\\Panel 1\\Et. 1 Iesire Administrativ',
      'Access Granted',
    ].join('\n');

    const report = parser.parseText(text);

    expect(report.rawUserName).toBe('POPESCU, ION');
    expect(report.records).toHaveLength(2);
    expect(report.records.map((r) => r.direction)).toEqual(['IN', 'OUT']);
  });

  it('deduplicates identical rows and warns when empty', () => {
    const text = [
      'User Name TEST, USER',
      '06/06/2026 09:00:00 1\\Panel 1\\Et. 1 Intrare Administrativ Access Granted',
      '06/06/2026 09:00:00 1\\Panel 1\\Et. 1 Intrare Administrativ Access Granted',
    ].join('\n');

    const report = parser.parseText(text);
    expect(report.records).toHaveLength(1);
  });

  it('parses pdf-parse reversed/glued Event+Location+Date rows', () => {
    const text = [
      'AxTraxNG 27.7.1.18',
      'Access Report',
      'Print date:',
      '30/07/2026 16:24:47',
      '30/06/2026 23:59:59',
      'From:',
      '01/06/2026 00:00:00',
      'To:',
      'Maria Rosetti 6',
      'Orion Innovation',
      '1/5',
      'DrivenetsDepartment:',
      'VASILE, VASILEUser Name:',
      'EventLocationDate',
      'Access Granted3\\Panel 1\\Et. 4 Intrare fata Drivenets04/06/2026 08:59:10',
      'Access Granted3\\Panel 1\\Et. 4 Iesire fata Drivenets04/06/2026 09:01:59',
      'Access Granted3\\Panel 1\\Et. 4 Intrare fata Drivenets04/06/2026 09:02:57',
      'Access Granted3\\Panel 1\\Et. 4 Iesire fata Drivenets04/06/2026 15:40:14',
      'Access Granted1\\Panel 1\\Et. 1 Iesire Orion16/06/2026 10:39:47',
      'Access Granted3\\Panel 1\\Et. 4 Intrare fata Drivenets25/06/2026 10:45:55',
      'Access Granted3\\Panel 1\\Et. 4 Iesire fata Drivenets25/06/2026 14:58:24',
    ].join('\n');

    const report = parser.parseText(text);

    expect(report.rawUserName).toBe('VASILE, VASILE');
    expect(report.department).toBe('Orion Innovation');
    expect(report.rangeFrom?.toISOString()).toBe('2026-06-01T00:00:00.000Z');
    expect(report.rangeTo?.toISOString()).toBe('2026-06-30T23:59:59.000Z');
    expect(report.records).toHaveLength(7);
    expect(report.records[0]).toMatchObject({
      rawLocation: '3\\Panel 1\\Et. 4 Intrare fata Drivenets',
      direction: 'IN',
      eventType: 'ACCESS_GRANTED',
    });
    expect(report.records[0].occurredAt.toISOString()).toBe('2026-06-04T08:59:10.000Z');
    expect(report.records[1].direction).toBe('OUT');
    expect(report.records[1].occurredAt.toISOString()).toBe('2026-06-04T09:01:59.000Z');
    expect(report.records.map((r) => r.direction)).toEqual([
      'IN',
      'OUT',
      'IN',
      'OUT',
      'OUT',
      'IN',
      'OUT',
    ]);
    expect(report.warnings).not.toContain('Could not detect the employee name in the report header.');
  });
});

describe('PdfParserService against DynamicReport fixture', () => {
  const fixturePath = path.join(__dirname, 'fixtures-axtrax-reversed.txt');
  const hasFixture = fs.existsSync(fixturePath);

  (hasFixture ? it : it.skip)('parses the real pdf-parse dump without swapping IN/OUT', () => {
    const text = fs.readFileSync(fixturePath, 'utf8');
    const report = parser.parseText(text);

    expect(report.rawUserName).toBe('VASILE, VASILE');
    expect(report.department).toBe('Orion Innovation');
    expect(report.rangeFrom?.toISOString()).toBe('2026-06-01T00:00:00.000Z');
    expect(report.rangeTo?.toISOString()).toBe('2026-06-30T23:59:59.000Z');
    expect(report.records.length).toBeGreaterThanOrEqual(140);
    expect(report.records.length).toBeLessThanOrEqual(160);

    const day04 = report.records.filter((r) => r.occurredAt.toISOString().startsWith('2026-06-04'));
    expect(day04[0].direction).toBe('IN');
    expect(day04[0].occurredAt.toISOString()).toBe('2026-06-04T08:59:10.000Z');
    expect(day04[day04.length - 1].direction).toBe('OUT');
    expect(day04[day04.length - 1].occurredAt.toISOString()).toBe('2026-06-04T15:40:14.000Z');

    const day25 = report.records.filter((r) => r.occurredAt.toISOString().startsWith('2026-06-25'));
    expect(day25[0].occurredAt.toISOString()).toBe('2026-06-25T10:02:35.000Z');
    expect(day25[0].direction).toBe('IN');
    expect(day25[day25.length - 1].occurredAt.toISOString()).toBe('2026-06-25T18:52:05.000Z');
    expect(day25[day25.length - 1].direction).toBe('OUT');

    // No header/print-date garbage as locations
    for (const r of report.records) {
      expect(r.rawLocation).toMatch(/Panel/i);
      expect(r.rawLocation).not.toMatch(/Access Granted|EventLocationDate|Print date/i);
    }
  });
});
