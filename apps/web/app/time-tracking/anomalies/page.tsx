'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Loader2, Pencil, Trash2, TriangleAlert } from 'lucide-react';
import type { AnomalyFlag, AttendanceFilter, DailySummaryView } from '@ttah/shared';
import { api } from '@/lib/api';
import { currentMonthRange, formatClock, formatDate, formatMinutes } from '@/lib/utils';
import { FLAG_LABELS, FLAG_DESCRIPTIONS } from '@/lib/labels';
import { DateRangePicker, isIsoDate, type DateRange } from '@/components/date-range-picker';
import { DayInsightDialog, FlagBadgeButton } from '@/components/day-insight-dialog';
import { EmployeeSearchSelect } from '@/components/employee-search-select';
import { useEmployees } from '@/lib/hooks';
import { UserGuide } from '@/components/user-guide';
import { useToast } from '@/components/ui/toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

function defaultRange(): DateRange {
  return currentMonthRange();
}

function CorrectionDialog({
  row,
  onClose,
}: {
  row: DailySummaryView;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [worked, setWorked] = useState(String(row.workedMinutes));
  const [lunch, setLunch] = useState(String(row.lunchMinutes));
  const [reason, setReason] = useState(row.manualReason ?? '');

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['summaries'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  };

  const save = useMutation({
    mutationFn: () =>
      api('/attendance/correction', {
        method: 'POST',
        body: {
          employeeId: row.employeeId,
          date: row.date,
          workedMinutes: Number(worked),
          lunchMinutes: Number(lunch),
          reason,
        },
      }),
    onSuccess: () => {
      toast({ title: 'Correction saved', variant: 'success' });
      invalidate();
      onClose();
    },
    onError: () => toast({ title: 'Could not save correction', variant: 'error' }),
  });

  const clear = useMutation({
    mutationFn: () =>
      api('/attendance/correction', {
        method: 'DELETE',
        query: { employeeId: row.employeeId, date: row.date },
      }),
    onSuccess: () => {
      toast({ title: 'Correction cleared', variant: 'success' });
      invalidate();
      onClose();
    },
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Manual correction</DialogTitle>
          <DialogDescription>
            {row.employeeName ?? `#${row.employeeId}`} · {formatDate(row.date)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="worked" className="text-xs">
                Worked minutes
              </Label>
              <Input
                id="worked"
                type="number"
                min={0}
                max={1440}
                value={worked}
                onChange={(e) => setWorked(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lunch" className="text-xs">
                Lunch minutes
              </Label>
              <Input
                id="lunch"
                type="number"
                min={0}
                max={240}
                value={lunch}
                onChange={(e) => setLunch(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="reason" className="text-xs">
              Reason
            </Label>
            <Input
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Forgot to badge out"
            />
          </div>
        </div>

        <DialogFooter>
          {row.manual && (
            <Button
              variant="destructive"
              onClick={() => clear.mutate()}
              disabled={clear.isPending}
              className="sm:mr-auto"
            >
              {clear.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Clear override
            </Button>
          )}
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => save.mutate()}
            disabled={save.isPending || reason.trim().length < 3}
          >
            {save.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function AnomaliesPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [range, setRange] = useState<DateRange>(defaultRange);
  const [employeeIds, setEmployeeIds] = useState<number[]>([]);
  const [editing, setEditing] = useState<DailySummaryView | null>(null);
  const [insight, setInsight] = useState<{ row: DailySummaryView; flag: AnomalyFlag } | null>(null);
  const [confirmRow, setConfirmRow] = useState<DailySummaryView | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const employees = useEmployees(true);
  const scopedKey = useMemo(
    () => [...employeeIds].sort((a, b) => a - b).join(','),
    [employeeIds],
  );
  const scopedIds = useMemo(
    () => (scopedKey ? scopedKey.split(',').map(Number) : []),
    [scopedKey],
  );

  const deleteDay = useMutation({
    mutationFn: (row: DailySummaryView) =>
      api('/attendance/day', {
        method: 'DELETE',
        query: { employeeId: row.employeeId, date: row.date },
      }),
    onSuccess: () => {
      toast({ title: 'Hours deleted', variant: 'success' });
      queryClient.invalidateQueries({ queryKey: ['summaries'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: () => toast({ title: 'Could not delete hours', variant: 'error' }),
  });

  const filter: AttendanceFilter = {
    from: range.from,
    to: range.to,
    ...(scopedIds.length ? { employeeIds: scopedIds } : {}),
  };
  const summaries = useQuery({
    queryKey: ['summaries', range.from, range.to, scopedKey],
    queryFn: ({ signal }) =>
      api<DailySummaryView[]>('/attendance/summaries', { method: 'POST', body: filter, signal }),
    enabled: isIsoDate(range.from) && isIsoDate(range.to),
    placeholderData: (prev) => prev,
  });

  const flagged = useMemo(
    () =>
      (summaries.data ?? [])
        .filter((r) => r.flags.length > 0)
        .sort((a, b) => b.date.localeCompare(a.date)),
    [summaries.data],
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight">
            <TriangleAlert className="h-7 w-7" /> Anomalies
          </h1>
          <p className="text-muted-foreground">
            Days needing review — click a flag to see the badge timeline and why it was raised.
          </p>
        </div>
        <div className="flex flex-wrap items-start gap-3">
          <UserGuide variant="header" />
          <DateRangePicker value={range} onChange={setRange} />
        </div>
      </div>

      <EmployeeSearchSelect
        employees={employees.data ?? []}
        selectedIds={employeeIds}
        onChange={setEmployeeIds}
        placeholder="Search to filter by person…"
        selectedBadge={(n) => `Filtered to ${n} ${n === 1 ? 'person' : 'people'}`}
      />

      <Card>
        <CardHeader>
          <CardTitle>What the flags mean</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          {(Object.keys(FLAG_LABELS) as (keyof typeof FLAG_LABELS)[]).map((f) => (
            <div key={f} className="flex items-start gap-2">
              <Badge variant="warning" className="mt-0.5 shrink-0">
                {FLAG_LABELS[f]}
              </Badge>
              <span className="text-sm text-muted-foreground">{FLAG_DESCRIPTIONS[f]}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{flagged.length} flagged days</CardTitle>
        </CardHeader>
        <CardContent>
          {summaries.isLoading ? (
            <Skeleton className="h-48 w-full" />
          ) : flagged.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              {employeeIds.length
                ? 'No anomalies for the selected people in this month.'
                : 'No anomalies in this month. 🎉'}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Employee</TableHead>
                  <TableHead>First in</TableHead>
                  <TableHead>Last out</TableHead>
                  <TableHead className="text-right">Worked</TableHead>
                  <TableHead className="text-right">Early</TableHead>
                  <TableHead className="text-right">Overtime</TableHead>
                  <TableHead>Flags</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {flagged.map((row) => (
                  <TableRow key={`${row.employeeId}-${row.date}`}>
                    <TableCell className="font-medium">{formatDate(row.date)}</TableCell>
                    <TableCell>{row.employeeName ?? `#${row.employeeId}`}</TableCell>
                    <TableCell>{formatClock(row.firstIn)}</TableCell>
                    <TableCell>{formatClock(row.lastOut)}</TableCell>
                    <TableCell className="text-right font-medium">
                      {formatMinutes(row.workedMinutes)}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {row.earlyMinutes ? formatMinutes(row.earlyMinutes) : '—'}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {row.overtimeMinutes ? formatMinutes(row.overtimeMinutes) : '—'}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {row.manual && <Badge variant="secondary">manual</Badge>}
                        {row.flags.map((f) => (
                          <FlagBadgeButton
                            key={f}
                            flag={f}
                            onClick={() => setInsight({ row, flag: f })}
                          />
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[16rem] whitespace-normal text-sm text-muted-foreground">
                      {row.manualReason || '—'}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => setEditing(row)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          disabled={deleteDay.isPending}
                          onClick={() => {
                            setConfirmRow(row);
                            setConfirmOpen(true);
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {editing && <CorrectionDialog row={editing} onClose={() => setEditing(null)} />}
      {insight && (
        <DayInsightDialog
          row={insight.row}
          focusFlag={insight.flag}
          onClose={() => setInsight(null)}
        />
      )}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete hours</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete hours for {confirmRow?.employeeName ?? `#${confirmRow?.employeeId}`} on {confirmRow ? formatDate(confirmRow.date) : ''}? This will remove badge events for that day.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" onClick={() => setConfirmOpen(false)}>
                Cancel
              </Button>
            </DialogClose>
            <Button
              variant="destructive"
              onClick={() => {
                if (confirmRow) deleteDay.mutate(confirmRow);
                setConfirmOpen(false);
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
