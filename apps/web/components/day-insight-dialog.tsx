'use client';

import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import type { AnomalyFlag, DailySummaryView, DayAccessEventView, DayDetailView } from '@ttah/shared';
import { api } from '@/lib/api';
import { eventIssueLabel, insightBullets, insightSummary } from '@/lib/anomaly-insights';
import { DOOR_ROLE_LABELS, FLAG_LABELS } from '@/lib/labels';
import { cn, formatClock, formatDate, formatMinutes } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export function FlagBadgeButton({
  flag,
  onClick,
}: {
  flag: AnomalyFlag;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={`${FLAG_LABELS[flag]} — click to see why`}
      className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Badge variant="warning" className="cursor-pointer hover:brightness-95">
        {FLAG_LABELS[flag]}
      </Badge>
    </button>
  );
}

function roleDotClass(ev: DayAccessEventView): string {
  if (ev.issue === 'unmatched-exit' || ev.issue === 'unclosed-entry') {
    return 'bg-warning ring-2 ring-warning/40';
  }
  if (ev.role === 'IN') return 'bg-emerald-500';
  if (ev.role === 'OUT') return 'bg-orange-500';
  return 'bg-muted-foreground/40';
}

function presenceIntervals(detail: DayDetailView) {
  return (detail.intervals ?? []).map((iv) => ({
    start: formatClock(iv.start),
    end: formatClock(iv.end),
    zone: iv.zone,
    source: iv.source,
  }));
}

export function DayInsightDialog({
  row,
  focusFlag,
  onClose,
}: {
  row: DailySummaryView;
  focusFlag?: AnomalyFlag | null;
  onClose: () => void;
}) {
  const [selected, setSelected] = useState<AnomalyFlag | null>(focusFlag ?? row.flags[0] ?? null);

  useEffect(() => {
    setSelected(focusFlag ?? row.flags[0] ?? null);
  }, [focusFlag, row.employeeId, row.date]);

  const detailQuery = useQuery({
    queryKey: ['attendance-day', row.employeeId, row.date],
    queryFn: () =>
      api<DayDetailView>('/attendance/day', {
        query: { employeeId: row.employeeId, date: row.date },
      }),
  });

  const detail = detailQuery.data;
  const flags = row.flags;
  const bullets = selected && detail ? insightBullets(selected, detail) : [];

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex max-h-[90vh] max-w-2xl flex-col gap-0 overflow-hidden p-0">
        <div className="shrink-0 space-y-4 p-6 pb-3 pr-12">
          <DialogHeader>
            <DialogTitle>{row.employeeName ?? `Employee #${row.employeeId}`}</DialogTitle>
            <DialogDescription>
              {formatDate(row.date)}
              {' · '}
              First in {formatClock(row.firstIn)}
              {' · '}
              Last out {formatClock(row.lastOut)}
              {' · '}
              Worked {formatMinutes(row.workedMinutes)}
              {detail?.schedule
                ? ` · Schedule ${detail.schedule.startTime}–${detail.schedule.endTime}`
                : null}
            </DialogDescription>
          </DialogHeader>

          {flags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {flags.map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setSelected(f)}
                  className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Badge
                    variant="warning"
                    className={cn(
                      'cursor-pointer',
                      selected === f ? 'ring-2 ring-warning ring-offset-2 ring-offset-card' : 'opacity-70 hover:opacity-100',
                    )}
                  >
                    {FLAG_LABELS[f]}
                  </Badge>
                </button>
              ))}
            </div>
          )}

          {selected && (
            <div className="rounded-lg border border-warning/40 bg-warning/5 p-4 space-y-2">
              <p className="text-sm font-semibold">{FLAG_LABELS[selected]}</p>
              <p className="text-sm text-muted-foreground">{insightSummary(selected)}</p>
              {detailQuery.isLoading ? (
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading this day’s badges…
                </p>
              ) : (
                <ul className="list-disc space-y-1.5 pl-4 text-sm">
                  {bullets.map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        <div className="thin-scrollbar min-h-0 flex-1 space-y-4 overflow-y-auto px-6 pb-6">
          <div>
            <h4 className="mb-2 text-sm font-semibold">Badge timeline</h4>
            {detailQuery.isLoading ? (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading…
              </p>
            ) : !detail?.events.length ? (
              <p className="text-sm text-muted-foreground">No badge events stored for this day.</p>
            ) : (
              <ol className="space-y-0">
                {detail.events.map((ev, i) => {
                  const note = eventIssueLabel(ev);
                  const highlight = ev.issue === 'unmatched-exit' || ev.issue === 'unclosed-entry';
                  return (
                    <li
                      key={`${ev.occurredAt}-${i}`}
                      className={cn(
                        'relative flex gap-3 py-2 pl-1',
                        highlight && 'rounded-md bg-warning/10 -mx-1 px-2',
                      )}
                    >
                      <div className="flex w-8 shrink-0 flex-col items-center">
                        <span className={cn('mt-1.5 h-2.5 w-2.5 rounded-full', roleDotClass(ev))} />
                        {i < detail.events.length - 1 && (
                          <span className="mt-1 w-px flex-1 bg-border" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1 pb-1">
                        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                          <span className="font-mono text-sm tabular-nums">{ev.time}</span>
                          <span className="truncate text-sm font-medium">{ev.doorLabel}</span>
                          <Badge
                            variant={
                              ev.role === 'IN' ? 'success' : ev.role === 'OUT' ? 'warning' : 'secondary'
                            }
                            className="h-5 justify-center px-1.5 text-[10px]"
                          >
                            {DOOR_ROLE_LABELS[ev.role]}
                          </Badge>
                          {ev.zone ? (
                            <span className="text-xs text-muted-foreground">{ev.zone}</span>
                          ) : null}
                          <span className="text-xs text-muted-foreground">
                            → {ev.insideAfter ? 'inside' : 'outside'}
                          </span>
                        </div>
                        {note && (
                          <p className={cn('mt-0.5 text-xs', highlight ? 'font-medium text-warning-foreground' : 'text-muted-foreground')}>
                            {note}
                          </p>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </div>

          {detail && presenceIntervals(detail).length > 0 && (
            <div>
              <h4 className="mb-2 text-sm font-semibold">Counted presence</h4>
              <ul className="space-y-1 text-sm text-muted-foreground">
                {presenceIntervals(detail).map((iv, i) => (
                  <li key={`${iv.start}-${iv.end}-${i}`}>
                    {iv.start} – {iv.end}
                    {iv.zone ? ` · ${iv.zone}` : ''}
                    {iv.source === 'merged-short-exit' ? ' · short exit merged' : ''}
                    {iv.source === 'grace' ? ' · grace' : ''}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            This view only explains the flags. Worked hours are not changed.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
