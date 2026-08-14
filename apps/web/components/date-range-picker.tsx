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
    <div className="space-y-1.5">
      <Label htmlFor={monthId} className="text-xs text-muted-foreground">
        Month
      </Label>
      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="Previous month"
          onClick={() => apply(shiftMonth(year, month, -1))}
        >
          <ChevronLeft />
        </Button>
        <Input
          id={monthId}
          type="month"
          className="w-44"
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
          aria-label="Next month"
          disabled={inProgress}
          onClick={() => apply(shiftMonth(year, month, 1))}
        >
          <ChevronRight />
        </Button>
      </div>
      {inProgress && <Badge variant="secondary">Month in progress</Badge>}
    </div>
  );
}
