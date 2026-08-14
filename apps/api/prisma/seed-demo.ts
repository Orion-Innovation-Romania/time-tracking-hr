/**
 * Demo dataset: 250 employees, ~6 months of badge activity.
 *
 * Idempotent for demo rows only (notes start with "demo-seed:"). Real employees
 * such as imported people are never deleted.
 *
 * Run inside the API container:
 *   pnpm --filter @ttah/api prisma:seed-demo
 */
import { Prisma, PrismaClient, type DoorRole, type EventType, type LeaveType } from '@prisma/client';
import { computeDay, type ConditionRuleLite, type DayOptions } from '../src/attendance/calculation';
import { dateOnly, dayKey } from '../src/common/time';
import { doorGroupingKey, parseLocation } from '../src/doors/location';

const prisma = new PrismaClient();

const DEMO_PREFIX = 'demo-seed:';
const EMPLOYEE_COUNT = 250;
const RANGE_FROM = '2026-02-16';
const RANGE_TO = '2026-08-14';
const IMPORT_HASH = 'demo-seed-v1-250-employees-6m';

const FIRST_NAMES = [
  'Andrei', 'Mihai', 'Alexandru', 'Ion', 'Cristian', 'Daniel', 'Stefan', 'Adrian', 'Florin', 'Vlad',
  'Radu', 'Gabriel', 'Marian', 'Bogdan', 'Cosmin', 'George', 'Nicolae', 'Vasile', 'Lucian', 'Robert',
  'Ana', 'Maria', 'Elena', 'Ioana', 'Andreea', 'Cristina', 'Alexandra', 'Diana', 'Irina', 'Gabriela',
  'Simona', 'Alina', 'Monica', 'Raluca', 'Carmen', 'Laura', 'Denisa', 'Bianca', 'Teodora', 'Andra',
];

const LAST_NAMES = [
  'Popescu', 'Ionescu', 'Popa', 'Pop', 'Stan', 'Dumitru', 'Stoica', 'Stanciu', 'Dobre', 'Florea',
  'Gheorghe', 'Marin', 'Tudor', 'Dima', 'Barbu', 'Nistor', 'Munteanu', 'Diaconu', 'Serban', 'Neagu',
  'Constantin', 'Moldovan', 'Lupu', 'Radu', 'Ene', 'Oprea', 'Dumitrescu', 'Ilie', 'Petrescu', 'Voicu',
  'Niculae', 'Preda', 'Banu', 'Cristea', 'Mihai', 'Ionita', 'Sava', 'Toma', 'Vasile', 'Ungureanu',
];

const DEPARTMENTS = [
  'Engineering',
  'Drivenets',
  'Product',
  'Finance',
  'HR',
  'Operations',
  'Facilities',
  'Sales',
  'IT Support',
  'Administration',
];

type Archetype =
  | 'solid'
  | 'early'
  | 'overtime'
  | 'late'
  | 'forget-exit'
  | 'forget-entry'
  | 'double-in'
  | 'perfect'
  | 'vacationer'
  | 'sickly'
  | 'chaotic'
  | 'outside-hours'
  | 'new-hire'
  | 'inactive'
  | 'manual'
  | 'denied';

type DoorSeed = {
  rawLocation: string;
  role: DoorRole;
  name: string;
  floor: string;
};

const DOORS: DoorSeed[] = [
  { rawLocation: '1\\Panel 1\\Et. 1 Intrare Orion', role: 'IN', name: 'Orion', floor: 'Et. 1' },
  { rawLocation: '1\\Panel 1\\Et. 1 Iesire Orion', role: 'OUT', name: 'Orion', floor: 'Et. 1' },
  { rawLocation: '2\\Panel 1\\Et. 2 Intrare Drivenets', role: 'IN', name: 'Drivenets', floor: 'Et. 2' },
  { rawLocation: '2\\Panel 1\\Et. 2 Iesire Drivenets', role: 'OUT', name: 'Drivenets', floor: 'Et. 2' },
  { rawLocation: '3\\Panel 1\\Et. 3 Intrare Administrativ', role: 'IN', name: 'Administrativ', floor: 'Et. 3' },
  { rawLocation: '3\\Panel 1\\Et. 3 Iesire Administrativ', role: 'OUT', name: 'Administrativ', floor: 'Et. 3' },
  { rawLocation: '4\\Panel 1\\Et. 4 Intrare fata Drivenets', role: 'IN', name: 'Drivenets', floor: 'Et. 4' },
  { rawLocation: '4\\Panel 1\\Et. 4 Iesire fata Drivenets', role: 'OUT', name: 'Drivenets', floor: 'Et. 4' },
  { rawLocation: '1\\Panel 2\\Parter Cantina', role: 'NEUTRAL', name: 'Cafeteria', floor: 'Parter' },
  { rawLocation: '1\\Panel 2\\Parter Parcare', role: 'NEUTRAL', name: 'Parking', floor: 'Parter' },
];

const HOLIDAYS: { date: string; name: string }[] = [
  { date: '2026-04-13', name: 'Orthodox Easter Monday' },
  { date: '2026-05-01', name: 'Labour Day' },
  { date: '2026-06-01', name: "Children's Day / Whit Monday" },
  { date: '2026-08-15', name: 'Assumption' },
];

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(rng: () => number, items: T[]): T {
  return items[Math.floor(rng() * items.length)];
}

function jitter(rng: () => number, spread: number): number {
  return Math.round((rng() * 2 - 1) * spread);
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function isoWeekday(date: Date): number {
  const dow = date.getUTCDay();
  return dow === 0 ? 7 : dow;
}

function at(day: Date, minutes: number, seconds = 0): Date {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return new Date(
    Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), h, m, seconds),
  );
}

function eachDate(fromKey: string, toKey: string): Date[] {
  const out: Date[] = [];
  let cur = dateOnly(fromKey);
  const end = dateOnly(toKey);
  while (cur.getTime() <= end.getTime()) {
    out.push(cur);
    cur = new Date(cur.getTime() + 86400000);
  }
  return out;
}

function archetypeFor(i: number): Archetype {
  if (i < 2) return 'inactive';
  if (i < 5) return 'new-hire';
  if (i < 8) return 'outside-hours';
  if (i < 10) return 'manual';
  if (i < 14) return 'chaotic';
  if (i < 19) return 'vacationer';
  if (i < 24) return 'sickly';
  if (i < 30) return 'perfect';
  if (i < 38) return 'double-in';
  if (i < 48) return 'forget-entry';
  if (i < 60) return 'forget-exit';
  if (i < 68) return 'denied';
  if (i < 88) return 'late';
  if (i < 113) return 'overtime';
  if (i < 138) return 'early';
  return 'solid';
}

function officePattern(i: number): { days: number[]; label: '2' | '3' | '5' } {
  const r = i % 10;
  if (r === 0) return { days: [2, 4], label: '2' };
  if (r === 1) return { days: [1, 3], label: '2' };
  if (r === 2 || r === 3) return { days: [1, 3, 5], label: '3' };
  if (r === 4) return { days: [2, 3, 4], label: '3' };
  return { days: [1, 2, 3, 4, 5], label: '5' };
}

function zoneForDept(dept: string): string {
  if (dept === 'Drivenets' || dept === 'Engineering' || dept === 'IT Support') return 'Drivenets';
  if (dept === 'HR' || dept === 'Finance' || dept === 'Administration' || dept === 'Facilities') {
    return 'Administrativ';
  }
  return 'Orion';
}

function uniqueNames(count: number): { first: string; last: string; display: string }[] {
  const rng = mulberry32(20260814);
  const used = new Set<string>();
  const out: { first: string; last: string; display: string }[] = [];
  let guard = 0;
  while (out.length < count && guard < count * 20) {
    guard += 1;
    const first = pick(rng, FIRST_NAMES);
    const last = pick(rng, LAST_NAMES);
    const display = `${first} ${last}`;
    if (used.has(display)) continue;
    used.add(display);
    out.push({ first, last, display });
  }
  if (out.length < count) {
    throw new Error(`Could not generate ${count} unique names`);
  }
  return out;
}

type DoorRow = { id: number; role: DoorRole; zone: string | null };

function pairForZone(doors: DoorRow[], zone: string): { inn: DoorRow; out: DoorRow } {
  const inn = doors.find((d) => d.role === 'IN' && d.zone === zone);
  const out = doors.find((d) => d.role === 'OUT' && d.zone === zone);
  if (!inn || !out) throw new Error(`Missing IN/OUT doors for zone ${zone}`);
  return { inn, out };
}

type PlannedEvent = {
  employeeId: number;
  readerId: number;
  occurredAt: Date;
  direction: DoorRole;
  eventType: EventType;
  importBatchId: number;
};

function pushEv(
  events: PlannedEvent[],
  employeeId: number,
  door: DoorRow,
  occurredAt: Date,
  importBatchId: number,
  eventType: EventType = 'ACCESS_GRANTED',
) {
  events.push({
    employeeId,
    readerId: door.id,
    occurredAt,
    direction: door.role,
    eventType,
    importBatchId,
  });
}

function buildDayEvents(opts: {
  employeeId: number;
  day: Date;
  archetype: Archetype;
  inn: DoorRow;
  out: DoorRow;
  cafeteria: DoorRow | undefined;
  rng: () => number;
  importBatchId: number;
}): PlannedEvent[] {
  const { employeeId, day, archetype, inn, out, cafeteria, rng, importBatchId } = opts;
  const events: PlannedEvent[] = [];
  const add = (door: DoorRow, minutes: number, extraSec = 0, type: EventType = 'ACCESS_GRANTED') =>
    pushEv(events, employeeId, door, at(day, minutes, extraSec), importBatchId, type);

  if (archetype === 'outside-hours') {
    add(inn, 18 * 60 + 10 + jitter(rng, 20), Math.floor(rng() * 40));
    add(out, 21 * 60 + jitter(rng, 40), Math.floor(rng() * 40));
    return events;
  }

  if (archetype === 'perfect') {
    add(inn, 9 * 60, 0);
    add(out, 12 * 60 + 30, 0);
    add(inn, 13 * 60, 0);
    add(out, 17 * 60 + 30, 0);
    return events;
  }

  let arrival = 9 * 60 + jitter(rng, 12);
  let lunchOut = 12 * 60 + 15 + jitter(rng, 25);
  let lunchIn = lunchOut + 32 + Math.floor(rng() * 12);
  let leave = 17 * 60 + 32 + jitter(rng, 12);

  if (archetype === 'early') arrival = 8 * 60 + 8 + Math.floor(rng() * 18);
  if (archetype === 'late' || (archetype === 'solid' && rng() < 0.08)) {
    arrival = 9 * 60 + 40 + Math.floor(rng() * 50);
  }
  if (archetype === 'overtime' || (archetype === 'solid' && rng() < 0.06)) {
    leave = 18 * 60 + 40 + Math.floor(rng() * 110);
  }
  if (archetype === 'chaotic') {
    arrival = 8 * 60 + Math.floor(rng() * 180);
    leave = 16 * 60 + Math.floor(rng() * 280);
    lunchOut = 11 * 60 + 30 + Math.floor(rng() * 90);
    lunchIn = lunchOut + 10 + Math.floor(rng() * 80);
  }

  arrival = clamp(arrival, 7 * 60, 12 * 60);
  leave = clamp(leave, arrival + 90, 22 * 60);
  if (lunchOut <= arrival + 40) lunchOut = arrival + 90;
  if (lunchIn <= lunchOut + 10) lunchIn = lunchOut + 30;
  if (lunchIn >= leave - 20) {
    lunchOut = Math.floor((arrival + leave) / 2);
    lunchIn = lunchOut + 35;
  }

  if (archetype === 'denied' && rng() < 0.35) {
    add(inn, arrival - 1, 5, 'ACCESS_DENIED');
  }

  if (archetype === 'forget-entry' && rng() < 0.35) {
    add(out, arrival - 12, Math.floor(rng() * 20));
  }

  add(inn, arrival, Math.floor(rng() * 50));

  if (archetype === 'double-in' || (archetype === 'chaotic' && rng() < 0.4)) {
    add(inn, arrival + 4, 10 + Math.floor(rng() * 20));
  }

  if (rng() < 0.22) {
    const coffee = arrival + 80 + Math.floor(rng() * 40);
    add(out, coffee, 2);
    add(inn, coffee + 4 + Math.floor(rng() * 4), 8);
  }

  add(out, lunchOut, Math.floor(rng() * 40));
  if (cafeteria && rng() < 0.15) {
    add(cafeteria, lunchOut + 8, Math.floor(rng() * 20));
  }
  if (archetype === 'forget-entry' && rng() < 0.15) {
    add(out, lunchOut + 2, 15);
  }
  add(inn, lunchIn, Math.floor(rng() * 40));

  const skipExit =
    archetype === 'forget-exit'
      ? rng() < 0.28
      : archetype === 'chaotic'
        ? rng() < 0.2
        : rng() < 0.015;

  if (!skipExit) {
    add(out, leave, Math.floor(rng() * 50));
  }

  if (archetype === 'forget-exit' && !skipExit && rng() < 0.12) {
    add(inn, leave + 25, 10);
  }

  return events;
}

async function chunkedCreate<T>(label: string, rows: T[], insert: (slice: T[]) => Promise<unknown>, size = 1500) {
  for (let i = 0; i < rows.length; i += size) {
    await insert(rows.slice(i, i + size));
    if (i === 0 || (i / size) % 8 === 0) {
      // eslint-disable-next-line no-console
      console.log(`  ${label}: ${Math.min(i + size, rows.length)}/${rows.length}`);
    }
  }
}

async function main() {
  const names = uniqueNames(EMPLOYEE_COUNT);
  const days = eachDate(RANGE_FROM, RANGE_TO);
  const holidaySet = new Set(HOLIDAYS.map((h) => h.date));

  // eslint-disable-next-line no-console
  console.log('Removing previous demo-seed employees (real data is kept)…');
  const deleted = await prisma.employee.deleteMany({ where: { notes: { startsWith: DEMO_PREFIX } } });
  // eslint-disable-next-line no-console
  console.log(`  removed ${deleted.count} demo employees`);
  await prisma.importBatch.deleteMany({ where: { fileHash: IMPORT_HASH } });

  for (const h of HOLIDAYS) {
    await prisma.holiday.upsert({
      where: { date: dateOnly(h.date) },
      create: { date: dateOnly(h.date), name: h.name },
      update: { name: h.name },
    });
  }

  const office = await prisma.office.upsert({
    where: { name: 'HQ' },
    create: { name: 'HQ' },
    update: {},
  });

  for (const d of DOORS) {
    const parsed = parseLocation(d.rawLocation);
    const groupingKey = doorGroupingKey(d.name, d.floor);
    const door = await prisma.door.upsert({
      where: { groupingKey },
      create: {
        name: d.name,
        floor: d.floor,
        groupingKey,
        officeId: office.id,
      },
      update: { name: d.name, floor: d.floor, officeId: office.id },
    });
    await prisma.reader.upsert({
      where: { rawLocation: d.rawLocation },
      create: {
        rawLocation: d.rawLocation,
        role: d.role,
        autoDetected: false,
        readerNo: parsed.readerNo,
        panel: parsed.panel,
        doorId: door.id,
      },
      update: { role: d.role, doorId: door.id },
    });
  }
  const doorRows = (
    await prisma.reader.findMany({
      where: { rawLocation: { in: DOORS.map((d) => d.rawLocation) } },
      include: { door: true },
    })
  ).map((r) => ({ id: r.id, role: r.role, zone: r.door.name }));
  const cafeteria = doorRows.find((d) => d.role === 'NEUTRAL' && d.zone === 'Cafeteria');

  const batch = await prisma.importBatch.create({
    data: {
      fileName: 'demo-seed-250-employees.pdf',
      fileHash: IMPORT_HASH,
      department: 'Demo',
      rangeFrom: dateOnly(RANGE_FROM),
      rangeTo: dateOnly(RANGE_TO),
      status: 'COMMITTED',
      rowsTotal: 0,
      rowsNew: 0,
    },
  });

  // eslint-disable-next-line no-console
  console.log('Creating 250 employees…');
  const employeeMeta: {
    index: number;
    archetype: Archetype;
    workingDays: number[];
    officeLabel: '2' | '3' | '5';
    department: string;
    zone: string;
    active: boolean;
    startDay: Date;
    endDay: Date;
  }[] = [];

  const employeeData = names.map((n, i) => {
    const archetype = archetypeFor(i);
    const office = officePattern(i);
    const department = DEPARTMENTS[i % DEPARTMENTS.length];
    const active = archetype !== 'inactive';
    employeeMeta.push({
      index: i,
      archetype,
      workingDays: office.days,
      officeLabel: office.label,
      department,
      zone: zoneForDept(department),
      active,
      startDay: dateOnly(archetype === 'new-hire' ? '2026-06-15' : RANGE_FROM),
      endDay: dateOnly(archetype === 'inactive' ? '2026-06-12' : RANGE_TO),
    });
    return {
      canonicalName: `DEMO/${String(i + 1).padStart(3, '0')} ${n.last} ${n.first}`.toUpperCase(),
      displayName: n.display,
      active,
      notes: `${DEMO_PREFIX}v1 archetype=${archetype} office=${office.label}d dept=${department}`,
    };
  });

  await prisma.employee.createMany({ data: employeeData });
  const created = await prisma.employee.findMany({
    where: { notes: { startsWith: DEMO_PREFIX } },
    orderBy: { canonicalName: 'asc' },
    select: { id: true, canonicalName: true },
  });
  if (created.length !== EMPLOYEE_COUNT) {
    throw new Error(`Expected ${EMPLOYEE_COUNT} demo employees, found ${created.length}`);
  }

  await prisma.employeeDepartment.createMany({
    data: created.map((e, i) => ({
      employeeId: e.id,
      department: employeeMeta[i].department,
      fromDate: employeeMeta[i].startDay,
    })),
  });
  await prisma.employeeAlias.createMany({
    data: created.map((e) => ({ employeeId: e.id, rawUserName: e.canonicalName })),
  });
  await prisma.employeeSchedule.createMany({
    data: created.map((e, i) => ({
      employeeId: e.id,
      startTime: employeeMeta[i].archetype === 'early' ? '08:00' : null,
      endTime: employeeMeta[i].archetype === 'overtime' ? '19:00' : null,
      workingDays: employeeMeta[i].workingDays,
    })),
  });

  const events: PlannedEvent[] = [];
  const leaves: { employeeId: number; date: Date; type: LeaveType; note: string }[] = [];
  const manualDays: { employeeId: number; date: Date }[] = [];

  for (let i = 0; i < created.length; i++) {
    const emp = created[i];
    const meta = employeeMeta[i];
    const rng = mulberry32(1000 + i * 97);
    const { inn, out } = pairForZone(doorRows, meta.zone);

    const leaveDates = new Set<string>();
    if (meta.archetype === 'vacationer') {
      for (const d of eachDate('2026-07-06', '2026-07-24')) {
        if (isoWeekday(d) <= 5) {
          leaveDates.add(dayKey(d));
          leaves.push({ employeeId: emp.id, date: d, type: 'vacation', note: 'Summer leave' });
        }
      }
      for (const d of days) {
        if (isoWeekday(d) <= 5 && meta.workingDays.includes(isoWeekday(d)) && rng() < 0.04) {
          const key = dayKey(d);
          if (leaveDates.has(key) || holidaySet.has(key)) continue;
          leaveDates.add(key);
          leaves.push({ employeeId: emp.id, date: d, type: 'remote', note: 'WFH' });
        }
      }
    }
    if (meta.archetype === 'sickly') {
      for (const d of days) {
        if (isoWeekday(d) <= 5 && rng() < 0.07) {
          const key = dayKey(d);
          if (leaveDates.has(key) || holidaySet.has(key)) continue;
          leaveDates.add(key);
          leaves.push({ employeeId: emp.id, date: d, type: 'sick', note: 'Medical leave' });
        }
      }
    }
    if (meta.archetype === 'solid' && rng() < 0.35) {
      const start = pick(rng, days.filter((d) => isoWeekday(d) === 1 && d.getUTCMonth() >= 4));
      if (start) {
        for (let k = 0; k < 5; k++) {
          const d = new Date(start.getTime() + k * 86400000);
          const key = dayKey(d);
          if (isoWeekday(d) > 5 || holidaySet.has(key) || leaveDates.has(key)) continue;
          leaveDates.add(key);
          leaves.push({ employeeId: emp.id, date: d, type: 'vacation', note: 'Short leave' });
        }
      }
    }

    for (const day of days) {
      const key = dayKey(day);
      const wd = isoWeekday(day);
      if (wd > 5) continue;
      if (holidaySet.has(key)) continue;
      if (day < meta.startDay || day > meta.endDay) continue;
      if (leaveDates.has(key)) continue;

      const scheduled = meta.workingDays.includes(wd);
      const extraDay = !scheduled && (meta.officeLabel !== '5' && rng() < 0.04);
      if (!scheduled && !extraDay) continue;

      const skipNoShow =
        meta.archetype === 'chaotic' ? rng() < 0.12 : meta.archetype === 'late' ? rng() < 0.06 : rng() < 0.02;
      if (skipNoShow) continue;

      events.push(
        ...buildDayEvents({
          employeeId: emp.id,
          day,
          archetype: meta.archetype,
          inn,
          out,
          cafeteria,
          rng,
          importBatchId: batch.id,
        }),
      );

      if (meta.archetype === 'manual' && rng() < 0.08) {
        manualDays.push({ employeeId: emp.id, date: day });
      }
    }
  }

  // eslint-disable-next-line no-console
  console.log(`Inserting ${events.length} access events…`);
  await chunkedCreate('events', events, (slice) => prisma.accessEvent.createMany({ data: slice, skipDuplicates: true }));

  // eslint-disable-next-line no-console
  console.log(`Inserting ${leaves.length} leave days…`);
  await chunkedCreate('leaves', leaves, (slice) => prisma.leave.createMany({ data: slice, skipDuplicates: true }));

  const scheduleSetting = await prisma.setting.findUnique({ where: { key: 'schedule.global' } });
  const lunchSetting = await prisma.setting.findUnique({ where: { key: 'lunch' } });
  const thresholdSetting = await prisma.setting.findUnique({ where: { key: 'thresholds' } });
  const sched = (scheduleSetting?.value as { startTime?: string; endTime?: string }) ?? {};
  const lunch = (lunchSetting?.value as {
    windowStart?: string;
    windowEnd?: string;
    capMinutes?: number;
    forceMinimum?: boolean;
  }) ?? {};
  const thr = (thresholdSetting?.value as {
    shortExitMinutes?: number;
    roundingMinutes?: number;
    overtimeThresholdMinutes?: number;
  }) ?? {};
  const conditions = await prisma.conditionRule.findMany({ where: { enabled: true } });

  const dayOptionsBase: Omit<DayOptions, 'dayKey'> = {
    schedule: { startTime: sched.startTime ?? '09:00', endTime: sched.endTime ?? '17:30' },
    lunch: {
      windowStart: lunch.windowStart ?? '12:00',
      windowEnd: lunch.windowEnd ?? '14:00',
      capMinutes: lunch.capMinutes ?? 30,
      forceMinimum: lunch.forceMinimum ?? false,
    },
    thresholds: {
      shortExitMinutes: thr.shortExitMinutes ?? 10,
      roundingMinutes: thr.roundingMinutes ?? 0,
      overtimeThresholdMinutes: thr.overtimeThresholdMinutes ?? 15,
    },
    conditions: conditions.map((c) => ({
      type: c.type,
      params: (c.params ?? {}) as Record<string, unknown>,
    })) as ConditionRuleLite[],
  };

  // eslint-disable-next-line no-console
  console.log('Computing daily summaries…');
  const byEmpDay = new Map<string, PlannedEvent[]>();
  for (const ev of events) {
    const key = `${ev.employeeId}|${dayKey(ev.occurredAt)}`;
    const list = byEmpDay.get(key) ?? [];
    list.push(ev);
    byEmpDay.set(key, list);
  }
  const doorById = new Map(doorRows.map((d) => [d.id, d]));
  const summaries: Prisma.DailySummaryCreateManyInput[] = [];
  const manualSet = new Set(manualDays.map((m) => `${m.employeeId}|${dayKey(m.date)}`));

  for (const [key, dayEvents] of byEmpDay) {
    const [empIdStr, dateKey] = key.split('|');
    const employeeId = Number(empIdStr);
    const result = computeDay(
      dayEvents.map((ev) => {
        const door = doorById.get(ev.readerId)!;
        return {
          occurredAt: ev.occurredAt,
          role: door.role,
          zone: door.zone,
          eventType: ev.eventType,
          doorId: door.id,
        };
      }),
      { ...dayOptionsBase, dayKey: dateKey },
    );
    const isManual = manualSet.has(key);
    summaries.push({
      employeeId,
      date: dateOnly(dateKey),
      workedMinutes: isManual ? Math.max(result.workedMinutes, 480) : result.workedMinutes,
      lunchMinutes: result.lunchMinutes,
      earlyMinutes: result.earlyMinutes,
      overtimeMinutes: result.overtimeMinutes,
      firstIn: result.firstIn,
      lastOut: result.lastOut,
      perZone: result.perZone as Prisma.InputJsonValue,
      flags: isManual ? ['MANUAL_OVERRIDE', ...result.flags] : result.flags,
      intervals: result.intervals.map((iv) => ({
        start: iv.start.toISOString(),
        end: iv.end.toISOString(),
        source: iv.source,
        zone: iv.zone,
      })) as unknown as Prisma.InputJsonValue,
      manual: isManual,
      manualReason: isManual ? 'HR correction after incomplete badge reads' : null,
      computedAt: new Date(),
    });
  }

  await chunkedCreate('summaries', summaries, (slice) =>
    prisma.dailySummary.createMany({ data: slice, skipDuplicates: true }),
  );

  await prisma.importBatch.update({
    where: { id: batch.id },
    data: { rowsTotal: events.length, rowsNew: events.length },
  });

  const counts = {
    employees: created.length,
    events: events.length,
    summaries: summaries.length,
    leaves: leaves.length,
    office2: employeeMeta.filter((m) => m.officeLabel === '2').length,
    office3: employeeMeta.filter((m) => m.officeLabel === '3').length,
    office5: employeeMeta.filter((m) => m.officeLabel === '5').length,
  };
  // eslint-disable-next-line no-console
  console.log('Demo seed complete:', counts);
}

main()
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
