import { CsvParserService, parseCsvLine } from '../src/imports/csv-parser.service';

const parser = new CsvParserService();

const COMPACT = [
  'AxTraxNG 27.7.1.18',
  ',,,,test raport csv,,,,,,Print date:,,,,,,18/08/2026 11:41:31',
  'Orion Innovation,,,,,From:,,16/08/2026 00:00:00,,,To:,,,22/08/2026 23:59:59',
  'Maria Rosetti 6',
  'Department:,,ADMIN + CAM TEHNICE',
  'User Name:,,"Marinescu, Dragos"',
  'User Id:',
  'User Credentials:,,"Card 201, 000000000062567"',
  'Date,Location,Event',
  '17/08/2026 10:00:06,1\\Panel 1\\Et. 1 Intrare Administrativ,Access Granted',
  '17/08/2026 10:08:43,1\\Panel 1\\Et. 1 Iesire Administrativ,Access Granted',
  'User Name:,,"Sacarea, Adrian"',
  'User Id:',
  'User Credentials:,,"Card 90, 000000000033975"',
  'Date,Location,Event',
  '18/08/2026 07:26:21,1\\Panel 1\\Et. 1 Intrare Administrativ,Access Granted',
  '18/08/2026 10:50:37,1\\Panel 1\\Et. 1 Intrare Orion,Access Recorded',
  'Department:,,"Tarya, Orpak, Luminar"',
  'User Name:,,"Tudora, Gabriela"',
  'Date,Location,Event',
  '18/08/2026 09:00:00,1\\Panel 1\\Et. 1 Iesire Administrativ,Access Granted',
].join('\n');

describe('parseCsvLine', () => {
  it('keeps quoted commas inside names', () => {
    expect(parseCsvLine('User Name:,,"Marinescu, Dragos",')).toEqual([
      'User Name:',
      '',
      'Marinescu, Dragos',
      '',
    ]);
  });
});

describe('CsvParserService.parseText', () => {
  it('parses a multi-employee AxTraxNG CSV and inherits department', () => {
    const report = parser.parseText(COMPACT);

    expect(report.kind).toBe('multi');
    expect(report.rawUserName).toBeNull();
    expect(report.employees).toHaveLength(3);
    expect(report.employees.map((e) => e.rawUserName)).toEqual([
      'Marinescu, Dragos',
      'Sacarea, Adrian',
      'Tudora, Gabriela',
    ]);
    expect(report.employees[0].department).toBe('ADMIN + CAM TEHNICE');
    expect(report.employees[1].department).toBe('ADMIN + CAM TEHNICE');
    expect(report.employees[2].department).toBe('Tarya, Orpak, Luminar');
    expect(report.records).toHaveLength(5);
    expect(report.records[0].rawUserName).toBe('Marinescu, Dragos');
    expect(report.records[0].direction).toBe('IN');
    expect(report.records[1].direction).toBe('OUT');
    expect(report.records[3].eventType).toBe('ACCESS_GRANTED');
    expect(report.records[3].rawLocation).toBe('1\\Panel 1\\Et. 1 Intrare Orion');
    expect(report.rangeFrom?.toISOString()).toBe('2026-08-16T00:00:00.000Z');
    expect(report.rangeTo?.toISOString()).toBe('2026-08-22T23:59:59.000Z');
    expect(report.warnings.some((w) => /Access Recorded/.test(w))).toBe(true);
  });

  it('parses sparse Date/Location/Event columns like the real export', () => {
    const sparse = [
      'AxTraxNG 27.7.1.18,,,,,,,,,,,,,,,,,,',
      'Department:,,Administrativ,,,,,,,,,,,,,,',
      'User Name:,,"Ene, Daniela",,,,,,,,,,,,,,',
      'Date,,,,,,,,Location,,,,,,,Event,,,,',
      '17/08/2026 08:00:00,,,,,,,,1\\Panel 1\\Et. 1 Intrare Administrativ,,,,,,,Access Granted,,,,',
      '17/08/2026 17:00:00,,,,,,,,1\\Panel 1\\Et. 1 Iesire Administrativ,,,,,,,Access Denied,,,,',
    ].join('\n');

    const report = parser.parseText(sparse);
    expect(report.records).toHaveLength(2);
    expect(report.records[0].rawUserName).toBe('Ene, Daniela');
    expect(report.records[1].eventType).toBe('ACCESS_DENIED');
    expect(report.records[1].rawLocation).toBe('1\\Panel 1\\Et. 1 Iesire Administrativ');
  });

  it('accepts semicolon-delimited European CSV', () => {
    const text = [
      'AxTraxNG 27.7.1.18',
      'User Name:;;POMPIERI',
      'Date;Location;Event',
      '18/08/2026 09:00:00;1\\Panel 1\\Et. 1 Intrare Administrativ;Access Granted',
    ].join('\n');
    const report = parser.parseText(text);
    expect(report.employees[0].rawUserName).toBe('POMPIERI');
    expect(report.records).toHaveLength(1);
  });

  it('strips a UTF-8 BOM', () => {
    const report = parser.parseBuffer(Buffer.from(`\uFEFF${COMPACT}`, 'utf8'));
    expect(report.employees).toHaveLength(3);
    expect(report.records.length).toBeGreaterThan(0);
  });

  it('rejects unrelated CSV', () => {
    expect(() => parser.parseText('name,age\nAda,36')).toThrow(/AxTraxNG/i);
  });
});
