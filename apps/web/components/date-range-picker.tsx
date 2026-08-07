'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export interface DateRange {
  from: string;
  to: string;
}

export function DateRangePicker({
  value,
  onChange,
}: {
  value: DateRange;
  onChange: (range: DateRange) => void;
}) {
  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="space-y-1.5">
        <Label htmlFor="from" className="text-xs text-muted-foreground">
          From
        </Label>
        <Input
          id="from"
          type="date"
          className="w-40"
          value={value.from}
          onChange={(e) => onChange({ ...value, from: e.target.value })}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="to" className="text-xs text-muted-foreground">
          To
        </Label>
        <Input
          id="to"
          type="date"
          className="w-40"
          value={value.to}
          onChange={(e) => onChange({ ...value, to: e.target.value })}
        />
      </div>
    </div>
  );
}
