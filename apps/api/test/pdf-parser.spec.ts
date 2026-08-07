import 'reflect-metadata';
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
});
