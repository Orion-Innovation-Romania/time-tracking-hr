import 'reflect-metadata';
import {
  computeDay,
  type DayOptions,
  type EngineEvent,
} from '../src/attendance/calculation';

const DAY = '2026-06-04';

function ev(time: string, role: EngineEvent['role'], zone: string | null = 'Drivenets'): EngineEvent {
  const [h, m, s] = time.split(':').map(Number);
  return {
    occurredAt: new Date(Date.UTC(2026, 5, 4, h, m, s)),
    role,
    zone,
    eventType: 'ACCESS_GRANTED',
  };
}

const baseOptions: Omit<DayOptions, 'conditions'> = {
  dayKey: DAY,
  schedule: { startTime: '08:00', endTime: '18:00' },
  lunch: { windowStart: '12:00', windowEnd: '14:00', capMinutes: 30, forceMinimum: false },
  thresholds: { shortExitMinutes: 10, roundingMinutes: 0, overtimeThresholdMinutes: 15 },
};

function options(overrides: Partial<DayOptions> = {}): DayOptions {
  return { ...baseOptions, conditions: [], ...overrides };
}

describe('computeDay', () => {
  it('merges short exits and measures lunch for the real VASILE Drivenets day', () => {
    const events: EngineEvent[] = [
      ev('08:59:10', 'IN'),
      ev('09:01:59', 'OUT'),
      ev('09:02:57', 'IN'),
      ev('09:25:01', 'OUT'),
      ev('09:25:58', 'IN'),
      ev('13:03:22', 'OUT'),
      ev('13:03:58', 'IN'),
      ev('15:40:14', 'OUT'),
    ];

    const result = computeDay(events, options());

    // Two short pre-lunch exits (<10 min) merge; the 13:03 gap is inside the
    // lunch window and is NOT merged.
    expect(result.workedMinutes).toBe(400);
    expect(result.lunchMinutes).toBeLessThanOrEqual(1);
    expect(result.firstIn?.toISOString()).toContain('08:59:10');
    expect(result.lastOut?.toISOString()).toContain('15:40:14');
    expect(result.flags).toHaveLength(0);
    expect(result.perZone.Drivenets).toBeGreaterThan(390);
  });

  it('counts a straight 09:00-17:00 day minus a real 30 min lunch break', () => {
    const events: EngineEvent[] = [
      ev('09:00:00', 'IN'),
      ev('12:30:00', 'OUT'),
      ev('13:00:00', 'IN'),
      ev('17:00:00', 'OUT'),
    ];

    const result = computeDay(events, options());
    // 3.5h + 4h inside = 450 min; lunch gap 12:30-13:00 excluded automatically.
    expect(result.workedMinutes).toBe(450);
    expect(result.lunchMinutes).toBe(30);
  });

  it('flags a missing exit and closes at schedule end', () => {
    const events: EngineEvent[] = [ev('08:30:00', 'IN')];
    const result = computeDay(events, options());
    expect(result.flags).toContain('MISSING_EXIT');
    // From 08:00 (clamped) .. 18:00 minus nothing; lunch window fully outside? No,
    // employee is inside all day so lunch stays 0 under measured policy.
    expect(result.workedMinutes).toBeGreaterThan(0);
  });

  it('does not merge a long exit above the short-exit threshold', () => {
    const events: EngineEvent[] = [
      ev('08:00:00', 'IN'),
      ev('10:00:00', 'OUT'),
      ev('10:30:00', 'IN'), // 30 min gap > 10 min threshold
      ev('16:00:00', 'OUT'),
    ];
    const result = computeDay(events, options());
    // 2h + 5.5h = 7.5h = 450 min, gap excluded.
    expect(result.workedMinutes).toBe(450);
  });

  it('applies a forced minimum lunch when the employee never steps out', () => {
    const events: EngineEvent[] = [ev('08:00:00', 'IN'), ev('16:00:00', 'OUT')];
    const result = computeDay(
      events,
      options({
        lunch: { windowStart: '12:00', windowEnd: '14:00', capMinutes: 30, forceMinimum: true },
      }),
    );
    // 8h present (480) minus forced 30 min lunch = 450.
    expect(result.workedMinutes).toBe(450);
    expect(result.lunchMinutes).toBe(30);
  });

  it('honours an IGNORE_ZONE condition', () => {
    const events: EngineEvent[] = [
      ev('08:00:00', 'IN', 'Cafeteria'),
      ev('09:00:00', 'OUT', 'Cafeteria'),
      ev('09:00:00', 'IN', 'Orion'),
      ev('12:00:00', 'OUT', 'Orion'),
    ];
    const result = computeDay(
      events,
      options({ conditions: [{ type: 'IGNORE_ZONE', params: { zones: ['Cafeteria'] } }] }),
    );
    // Only the 3h Orion interval counts.
    expect(result.workedMinutes).toBe(180);
    expect(result.perZone.Cafeteria).toBeUndefined();
  });
});
