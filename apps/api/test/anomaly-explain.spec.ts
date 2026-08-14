import 'reflect-metadata';
import { annotateDayEvents } from '../src/attendance/anomaly-explain';
import type { AnnotatableEvent } from '../src/attendance/anomaly-explain';

function ev(
  time: string,
  role: AnnotatableEvent['role'],
  extra: Partial<AnnotatableEvent> = {},
): AnnotatableEvent {
  const [h, m, s] = time.split(':').map(Number);
  return {
    occurredAt: new Date(Date.UTC(2026, 5, 25, h, m, s)),
    role,
    eventType: 'ACCESS_GRANTED',
    doorLabel: extra.doorLabel ?? `${role} door`,
    zone: extra.zone ?? 'Office',
    ...extra,
  };
}

describe('annotateDayEvents', () => {
  it('tags an unmatched exit before the first counted entry', () => {
    const out = annotateDayEvents([
      ev('09:40:00', 'OUT', { doorLabel: 'Admin exit' }),
      ev('10:02:00', 'IN', { doorLabel: 'Admin entry' }),
      ev('18:52:00', 'OUT', { doorLabel: 'Admin exit' }),
    ]);
    expect(out[0].issue).toBe('unmatched-exit');
    expect(out[0].insideAfter).toBe(false);
    expect(out[1].issue).toBeNull();
    expect(out[1].insideAfter).toBe(true);
    expect(out[2].issue).toBeNull();
    expect(out[2].insideAfter).toBe(false);
  });

  it('tags a second exit while already outside', () => {
    const out = annotateDayEvents([
      ev('09:51:00', 'IN'),
      ev('12:00:00', 'OUT'),
      ev('12:01:00', 'OUT'),
      ev('13:00:00', 'IN'),
      ev('18:18:00', 'OUT'),
    ]);
    expect(out[2].issue).toBe('unmatched-exit');
    expect(out.filter((e) => e.issue === 'unmatched-exit')).toHaveLength(1);
  });

  it('tags the last entry when the day never closes', () => {
    const out = annotateDayEvents([
      ev('09:51:00', 'IN'),
      ev('18:18:00', 'OUT'),
      ev('18:45:00', 'IN'),
    ]);
    expect(out[2].issue).toBe('unclosed-entry');
    expect(out[2].insideAfter).toBe(true);
    expect(out[1].issue).toBeNull();
  });

  it('ignores extra entries while already inside', () => {
    const out = annotateDayEvents([ev('09:00:00', 'IN'), ev('09:05:00', 'IN'), ev('17:00:00', 'OUT')]);
    expect(out[1].issue).toBe('already-inside');
    expect(out[1].insideAfter).toBe(true);
  });

  it('does not change presence for NEUTRAL or denied reads', () => {
    const out = annotateDayEvents([
      ev('09:00:00', 'NEUTRAL'),
      ev('09:01:00', 'IN'),
      { ...ev('09:02:00', 'OUT'), eventType: 'ACCESS_DENIED' },
      ev('17:00:00', 'OUT'),
    ]);
    expect(out[0].issue).toBe('neutral');
    expect(out[0].insideAfter).toBe(false);
    expect(out[2].issue).toBe('not-granted');
    expect(out[2].insideAfter).toBe(true);
    expect(out[3].insideAfter).toBe(false);
  });
});
