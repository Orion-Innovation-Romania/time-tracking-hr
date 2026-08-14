import type { AnomalyFlag, DayAccessEventView, DayDetailView } from '@ttah/shared';
import { FLAG_DESCRIPTIONS } from './labels';
import { formatClock, formatMinutes } from './utils';

function doorAt(ev: DayAccessEventView): string {
  const door = ev.doorLabel.trim() || 'unknown door';
  if (ev.zone && ev.zone !== door) return `${door} (${ev.zone})`;
  return door;
}

/** Concrete bullets for the selected flag, derived from the day's annotated events. */
export function insightBullets(flag: AnomalyFlag, detail: DayDetailView): string[] {
  const unmatched = detail.events.filter((e) => e.issue === 'unmatched-exit');
  const unclosed = detail.events.filter((e) => e.issue === 'unclosed-entry');
  const extraIn = detail.events.filter((e) => e.issue === 'already-inside');
  const firstCountedIn = detail.events.find(
    (e) => e.role === 'IN' && (e.issue === null || e.issue === 'unclosed-entry'),
  );
  const bullets: string[] = [];

  switch (flag) {
    case 'MISSING_ENTRY': {
      bullets.push(
        `First in ${formatClock(detail.firstIn)} is the first counted entry. Missing entry is a separate problem: an Exit while they were not already inside.`,
      );
      if (unmatched.length === 0) {
        bullets.push('No unmatched exit is visible in the timeline — the flag was stored on this day; recompute if the events have changed.');
        break;
      }
      for (const ev of unmatched) {
        if (firstCountedIn && ev.occurredAt < firstCountedIn.occurredAt) {
          bullets.push(
            `At ${ev.time} they badged Exit at ${doorAt(ev)} before the first counted entry (${formatClock(detail.firstIn)}). That usually means the real entry was missed, or that door is classified as Exit instead of Entry.`,
          );
        } else if (detail.firstIn) {
          bullets.push(
            `At ${ev.time} they badged Exit at ${doorAt(ev)} while already outside — an extra exit after leaving, or a door marked Exit used as Entry.`,
          );
        } else {
          bullets.push(`At ${ev.time} they badged Exit at ${doorAt(ev)} with no matching entry that day.`);
        }
      }
      break;
    }
    case 'MISSING_EXIT': {
      if (unclosed.length === 0) {
        bullets.push(
          'The day ended still inside according to the engine. Presence for the open session was closed at the scheduled end.',
        );
      } else {
        for (const ev of unclosed) {
          bullets.push(
            `Entered at ${ev.time} at ${doorAt(ev)} and never badged out. That session was closed at the scheduled end (${detail.schedule.endTime}).`,
          );
        }
      }
      if (detail.lastOut) {
        bullets.push(
          `Last out ${formatClock(detail.lastOut)} is the last confirmed exit from a completed session. They may have entered again after that.`,
        );
      }
      bullets.push('Worked hours for the open session are an estimate until a matching exit exists (or the day is corrected by hand).');
      break;
    }
    case 'OVERTIME':
      bullets.push(
        `Stayed ${formatMinutes(detail.overtimeMinutes)} past the scheduled end (${detail.schedule.endTime}). Last confirmed exit: ${formatClock(detail.lastOut)}.`,
      );
      if (detail.flags.includes('MISSING_EXIT')) {
        bullets.push(
          'An open session is closed at schedule end, so it does not inflate overtime. Overtime comes from completed presence that actually ran past the end.',
        );
      }
      break;
    case 'EARLY_START':
      bullets.push(
        `Arrived ${formatMinutes(detail.earlyMinutes)} before the scheduled start (${detail.schedule.startTime}). First in: ${formatClock(detail.firstIn)}.`,
      );
      break;
    case 'ZERO_DURATION':
      bullets.push(
        extraIn.length
          ? 'Badge reads exist, but no valid entry→exit pair could be built (for example only exits, or only extra entries while already treated as inside).'
          : 'Badge reads exist, but no valid entry→exit interval could be built, so worked time is zero.',
      );
      break;
    case 'ONLY_OUTSIDE_SCHEDULE':
      bullets.push(
        `All counted presence fell outside ${detail.schedule.startTime}–${detail.schedule.endTime}, so worked time for the day is zero.`,
      );
      break;
    case 'MANUAL_OVERRIDE':
      bullets.push('A person saved a manual correction for this day. The numbers are not from the badge engine.');
      break;
    case 'OVERNIGHT':
      bullets.push('Presence appears to continue past midnight. Review the last events of this day and the first events of the next.');
      break;
    default:
      break;
  }

  return bullets;
}

export function insightSummary(flag: AnomalyFlag): string {
  return FLAG_DESCRIPTIONS[flag];
}

export function eventIssueLabel(ev: DayAccessEventView): string | null {
  switch (ev.issue) {
    case 'unmatched-exit':
      return 'Unmatched exit — not inside';
    case 'unclosed-entry':
      return 'No matching exit';
    case 'already-inside':
      return 'Already inside — extra entry ignored';
    case 'neutral':
      return 'Neutral door — does not change presence';
    case 'not-granted':
      return 'Not granted — ignored for hours';
    default:
      return null;
  }
}
