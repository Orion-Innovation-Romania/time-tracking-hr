import type { DayEventIssue, DoorRole, EventType } from '@ttah/shared';

/**
 * Read-only walk of a day's badge events using the same presence rules as
 * computeDay. Does not change hours — it only tags which reads caused
 * MISSING_ENTRY / MISSING_EXIT so the UI can explain them.
 */

export interface AnnotatableEvent {
  occurredAt: Date;
  role: DoorRole;
  eventType: EventType;
  doorLabel: string;
  zone: string | null;
}

export interface AnnotatedDayEvent {
  occurredAt: Date;
  role: DoorRole;
  eventType: EventType;
  doorLabel: string;
  zone: string | null;
  issue: DayEventIssue | null;
  insideAfter: boolean;
}

export function annotateDayEvents(events: AnnotatableEvent[]): AnnotatedDayEvent[] {
  const sorted = [...events].sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());
  const out: AnnotatedDayEvent[] = [];
  let inside = false;
  let openIndex: number | null = null;

  for (const ev of sorted) {
    let issue: DayEventIssue | null = null;
    if (ev.eventType !== 'ACCESS_GRANTED') {
      out.push({ ...ev, issue: 'not-granted', insideAfter: inside });
      continue;
    }
    if (ev.role === 'IN') {
      if (!inside) {
        inside = true;
        openIndex = out.length;
      } else {
        issue = 'already-inside';
      }
    } else if (ev.role === 'OUT') {
      if (inside) {
        inside = false;
        openIndex = null;
      } else {
        issue = 'unmatched-exit';
      }
    } else {
      issue = 'neutral';
    }
    out.push({ ...ev, issue, insideAfter: inside });
  }

  if (inside && openIndex != null && out[openIndex]) {
    out[openIndex] = { ...out[openIndex], issue: 'unclosed-entry' };
  }

  return out;
}
