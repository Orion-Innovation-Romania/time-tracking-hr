'use client';

import { useId } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  currentYearMonth,
  isCurrentMonth,
  monthRange,
  parseYm,
  shiftMonth,
  ymKey,
} from '@/lib/utils';

export interface DateRange {
  from: string;
  to: string;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  return Number.isFinite(Date.parse(`${value}T00:00:00Z`));
}

function ymOf(range: DateRange): { year: number; month: number } {
  return parseYm(range.from) ?? currentYearMonth();
}

export function DateRangePicker({
  value,
  onChange,
}: {
  value: DateRange;
  onChange: (range: DateRange) => void;
}) {
  const monthId = useId();
  const { year, month } = ymOf(value);
  const inProgress = isCurrentMonth(year, month);
  const now = currentYearMonth();
  const maxYm = ymKey(now.year, now.month);

  const apply = (next: { year: number; month: number }) => {
    const clamped =
      next.year > now.year || (next.year === now.year && next.month > now.month) ? now : next;
    const range = monthRange(clamped.year, clamped.month);
    if (range.from === value.from && range.to === value.to) return;
    onChange(range);
  };

  return (
    <div className="relative">
      <Label htmlFor={monthId} className="sr-only">
        Month
      </Label>
      <div className="flex h-14 items-center gap-1">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-14 w-11"
          aria-label="Previous month"
          onClick={() => apply(shiftMonth(year, month, -1))}
        >
          <ChevronLeft />
        </Button>
        <Input
          id={monthId}
          type="month"
          className="h-14 w-44"
          value={ymKey(year, month)}
          max={maxYm}
          onChange={(e) => {
            const parsed = parseYm(e.target.value);
            if (parsed) apply(parsed);
          }}
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-14 w-11"
          aria-label="Next month"
          disabled={inProgress}
          onClick={() => apply(shiftMonth(year, month, 1))}
        >
          <ChevronRight />
        </Button>
      </div>
      {inProgress ? (
        <Badge
          variant="secondary"
          className="pointer-events-none absolute left-1/2 top-full z-10 mt-1 -translate-x-1/2"
        >
          Month in progress
        </Badge>
      ) : null}
    </div>
  );
}
