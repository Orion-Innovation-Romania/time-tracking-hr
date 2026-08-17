'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Loader2, Plus, RefreshCw, Save, Settings, Trash2 } from 'lucide-react';
import {
  CONDITION_TYPES,
  LEAVE_TYPES,
  type ConditionRuleInput,
  type ConditionType,
  type EmployeeView,
  type HolidayView,
  type LeaveType,
  type LeaveView,
  type LunchConfig,
  type ScheduleConfig,
  type ThresholdConfig,
} from '@ttah/shared';
import { api } from '@/lib/api';
import { currentMonthRange, formatDate } from '@/lib/utils';
import { CONDITION_LABELS, LEAVE_LABELS } from '@/lib/labels';
import { DateRangePicker, type DateRange } from '@/components/date-range-picker';
import DateField from '@/components/date-field';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from '@/components/ui/dialog';
import { useEmployees } from '@/lib/hooks';
import { useToast } from '@/components/ui/toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

const WEEKDAYS = [
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
  { value: 7, label: 'Sun' },
];

function ScheduleLunchTab() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const schedule = useQuery({
    queryKey: ['config', 'schedule'],
    queryFn: () => api<ScheduleConfig>('/config/schedule'),
  });
  const lunch = useQuery({
    queryKey: ['config', 'lunch'],
    queryFn: () => api<LunchConfig>('/config/lunch'),
  });

  const [sched, setSched] = useState<ScheduleConfig | null>(null);
  const [lunchCfg, setLunchCfg] = useState<LunchConfig | null>(null);
  useEffect(() => {
    if (schedule.data) setSched(schedule.data);
  }, [schedule.data]);
  useEffect(() => {
    if (lunch.data) setLunchCfg(lunch.data);
  }, [lunch.data]);

  const save = useMutation({
    mutationFn: async () => {
      await api('/config/schedule', { method: 'PUT', body: sched });
      await api('/config/lunch', { method: 'PUT', body: lunchCfg });
    },
    onSuccess: () => {
      toast({ title: 'Saved', variant: 'success' });
      queryClient.invalidateQueries({ queryKey: ['config'] });
    },
    onError: () => toast({ title: 'Save failed', variant: 'error' }),
  });

  if (!sched || !lunchCfg) return <Skeleton className="h-64 w-full" />;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Global work schedule</CardTitle>
          <CardDescription>Default hours; overridable per employee.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:max-w-sm">
            <div className="space-y-1.5">
              <Label className="text-xs">Start</Label>
              <Input
                type="time"
                value={sched.startTime}
                onChange={(e) => setSched({ ...sched, startTime: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">End</Label>
              <Input
                type="time"
                value={sched.endTime}
                onChange={(e) => setSched({ ...sched, endTime: e.target.value })}
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {WEEKDAYS.map((d) => {
              const on = sched.workingDays.includes(d.value);
              return (
                <button
                  key={d.value}
                  type="button"
                  onClick={() =>
                    setSched({
                      ...sched,
                      workingDays: on
                        ? sched.workingDays.filter((x) => x !== d.value)
                        : [...sched.workingDays, d.value].sort(),
                    })
                  }
                  className={`rounded-md border px-3 py-1 text-xs font-medium transition-colors ${
                    on ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-accent'
                  }`}
                >
                  {d.label}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Lunch policy</CardTitle>
          <CardDescription>
            Lunch is measured from real time spent outside within the window, capped.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 sm:max-w-lg">
            <div className="space-y-1.5">
              <Label className="text-xs">Window start</Label>
              <Input
                type="time"
                value={lunchCfg.windowStart}
                onChange={(e) => setLunchCfg({ ...lunchCfg, windowStart: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Window end</Label>
              <Input
                type="time"
                value={lunchCfg.windowEnd}
                onChange={(e) => setLunchCfg({ ...lunchCfg, windowEnd: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Cap (minutes)</Label>
              <Input
                type="number"
                min={0}
                max={240}
                value={lunchCfg.capMinutes}
                onChange={(e) =>
                  setLunchCfg({ ...lunchCfg, capMinutes: Number(e.target.value) })
                }
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="h-4 w-4"
              checked={lunchCfg.forceMinimum}
              onChange={(e) => setLunchCfg({ ...lunchCfg, forceMinimum: e.target.checked })}
            />
            Always deduct the full cap, even if the employee stayed inside
          </label>
        </CardContent>
      </Card>

      <Button onClick={() => save.mutate()} disabled={save.isPending}>
        {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        Save schedule &amp; lunch
      </Button>
    </div>
  );
}

function ThresholdsTab() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const thresholds = useQuery({
    queryKey: ['config', 'thresholds'],
    queryFn: () => api<ThresholdConfig>('/config/thresholds'),
  });
  const retention = useQuery({
    queryKey: ['config', 'retention'],
    queryFn: () => api<{ months: number }>('/config/retention'),
  });
  const conditions = useQuery({
    queryKey: ['config', 'conditions'],
    queryFn: () => api<ConditionRuleInput[]>('/config/conditions'),
  });

  const [thr, setThr] = useState<ThresholdConfig | null>(null);
  const [months, setMonths] = useState<number>(24);
  const [rules, setRules] = useState<ConditionRuleInput[]>([]);
  useEffect(() => {
    if (thresholds.data) setThr(thresholds.data);
  }, [thresholds.data]);
  useEffect(() => {
    if (retention.data) setMonths(retention.data.months);
  }, [retention.data]);
  useEffect(() => {
    if (conditions.data) setRules(conditions.data);
  }, [conditions.data]);

  const save = useMutation({
    mutationFn: async () => {
      await api('/config/thresholds', { method: 'PUT', body: thr });
      await api('/config/retention', { method: 'PUT', body: { months } });
      await api('/config/conditions', { method: 'PUT', body: rules });
    },
    onSuccess: () => {
      toast({ title: 'Saved', variant: 'success' });
      queryClient.invalidateQueries({ queryKey: ['config'] });
    },
    onError: () => toast({ title: 'Save failed', variant: 'error' }),
  });

  if (!thr) return <Skeleton className="h-64 w-full" />;

  const addRule = (type: ConditionType) => {
    if (rules.some((r) => r.type === type)) return;
    setRules([
      ...rules,
      {
        type,
        enabled: true,
        order: rules.length,
        params: type === 'IGNORE_ZONE' ? { zones: [] } : { minutes: 0 },
      },
    ]);
  };

  const updateRule = (type: ConditionType, params: Record<string, unknown>) =>
    setRules(rules.map((r) => (r.type === type ? { ...r, params } : r)));

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Thresholds &amp; rounding</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 sm:max-w-lg">
          <div className="space-y-1.5">
            <Label className="text-xs">Short-exit merge (minutes)</Label>
            <Input
              type="number"
              min={0}
              value={thr.shortExitMinutes}
              onChange={(e) => setThr({ ...thr, shortExitMinutes: Number(e.target.value) })}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Round daily total (minutes)</Label>
            <Input
              type="number"
              min={0}
              value={thr.roundingMinutes}
              onChange={(e) => setThr({ ...thr, roundingMinutes: Number(e.target.value) })}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Early / overtime threshold (minutes)</Label>
            <Input
              type="number"
              min={0}
              value={thr.overtimeThresholdMinutes}
              onChange={(e) =>
                setThr({ ...thr, overtimeThresholdMinutes: Number(e.target.value) })
              }
            />
            <p className="text-[11px] text-muted-foreground">
              Flag &amp; count time before start / after end once it reaches this many minutes.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Data retention (months)</Label>
            <Input
              type="number"
              min={1}
              value={months}
              onChange={(e) => setMonths(Number(e.target.value))}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>Special conditions</CardTitle>
            <CardDescription>Optional rules applied after the core calculation.</CardDescription>
          </div>
          <Select onValueChange={(v) => addRule(v as ConditionType)}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Add condition" />
            </SelectTrigger>
            <SelectContent>
              {CONDITION_TYPES.filter((t) => !rules.some((r) => r.type === t)).map((t) => (
                <SelectItem key={t} value={t}>
                  {CONDITION_LABELS[t]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent className="space-y-3">
          {rules.length === 0 && (
            <p className="text-sm text-muted-foreground">No special conditions configured.</p>
          )}
          {rules.map((rule) => (
            <div key={rule.type} className="flex items-center gap-3 rounded-lg border p-3">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={rule.enabled}
                  onChange={(e) =>
                    setRules(
                      rules.map((r) =>
                        r.type === rule.type ? { ...r, enabled: e.target.checked } : r,
                      ),
                    )
                  }
                />
              </label>
              <span className="flex-1 text-sm font-medium">{CONDITION_LABELS[rule.type]}</span>
              {rule.type === 'IGNORE_ZONE' ? (
                <Input
                  className="w-56"
                  placeholder="zone1, zone2"
                  value={((rule.params.zones as string[]) ?? []).join(', ')}
                  onChange={(e) =>
                    updateRule(rule.type, {
                      zones: e.target.value
                        .split(',')
                        .map((z) => z.trim())
                        .filter(Boolean),
                    })
                  }
                />
              ) : (
                <Input
                  type="number"
                  className="w-28"
                  value={Number(rule.params.minutes ?? 0)}
                  onChange={(e) => updateRule(rule.type, { minutes: Number(e.target.value) })}
                />
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setRules(rules.filter((r) => r.type !== rule.type))}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <Button onClick={() => save.mutate()} disabled={save.isPending}>
        {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        Save thresholds &amp; conditions
      </Button>
    </div>
  );
}

function HolidaysTab() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const year = new Date().getFullYear();
  const holidays = useQuery({
    queryKey: ['holidays', year],
    queryFn: () => api<HolidayView[]>('/config/holidays', { query: { year } }),
  });
  const [date, setDate] = useState('');
  const [name, setName] = useState('');
  const [confirmHoliday, setConfirmHoliday] = useState<HolidayView | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const toIso = (d: string) => {
    const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(d);
    if (m) return `${m[3]}-${m[2]}-${m[1]}`;
    // If already in YYYY-MM-DD, return as-is
    if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
    return d;
  };

  const add = useMutation({
    mutationFn: () => api('/config/holidays', { method: 'POST', body: { date: toIso(date), name } }),
    onSuccess: () => {
      toast({ title: 'Holiday added', variant: 'success' });
      setDate('');
      setName('');
      queryClient.invalidateQueries({ queryKey: ['holidays'] });
    },
    onError: () => toast({ title: 'Could not add holiday', variant: 'error' }),
  });

  const remove = useMutation({
    mutationFn: (id: number) => api(`/config/holidays/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['holidays'] }),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Public holidays ({year})</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Date</Label>
            <DateField className="w-40" value={date} onChange={setDate} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Name</Label>
            <Input
              className="w-56"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="National day"
            />
          </div>
          <Button onClick={() => add.mutate()} disabled={add.isPending || !date || !name}>
            <Plus className="h-4 w-4" /> Add
          </Button>
        </div>

        {holidays.isLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : (holidays.data?.length ?? 0) === 0 ? (
          <p className="text-sm text-muted-foreground">No holidays defined.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Name</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {holidays.data?.map((h) => (
                <TableRow key={h.id}>
                  <TableCell className="font-medium">{formatDate(h.date)}</TableCell>
                  <TableCell>{h.name}</TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setConfirmHoliday(h);
                        setConfirmOpen(true);
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete holiday</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete the holiday "{confirmHoliday?.name}" on{' '}
                {confirmHoliday ? formatDate(confirmHoliday.date) : '—'}? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="ghost" onClick={() => setConfirmOpen(false)}>
                  Cancel
                </Button>
              </DialogClose>
              <Button
                variant="destructive"
                onClick={() => {
                  if (confirmHoliday) remove.mutate(confirmHoliday.id);
                  setConfirmOpen(false);
                }}
                disabled={remove.isPending}
              >
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

function LeavesTab() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const employees = useEmployees();
  const [range, setRange] = useState<DateRange>(currentMonthRange);

  const leaves = useQuery({
    queryKey: ['leaves', range.from, range.to],
    queryFn: () =>
      api<LeaveView[]>('/config/leaves', { query: { from: range.from, to: range.to } }),
  });

  const [employeeId, setEmployeeId] = useState('');
  const [date, setDate] = useState('');
  const [type, setType] = useState<LeaveType>('vacation');
  const [note, setNote] = useState('');

  const toIso = (d: string) => {
    const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(d);
    if (m) return `${m[3]}-${m[2]}-${m[1]}`;
    if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
    return d;
  };

  const add = useMutation({
    mutationFn: () =>
      api('/config/leaves', {
        method: 'POST',
        body: { employeeId: Number(employeeId), date: toIso(date), type, note: note || null },
      }),
    onSuccess: () => {
      toast({ title: 'Leave added', variant: 'success' });
      setDate('');
      setNote('');
      queryClient.invalidateQueries({ queryKey: ['leaves'] });
    },
    onError: () => toast({ title: 'Could not add leave', variant: 'error' }),
  });

  const remove = useMutation({
    mutationFn: (id: number) => api(`/config/leaves/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['leaves'] }),
  });

  const nameOf = (id: number) =>
    employees.data?.find((e: EmployeeView) => e.id === id)?.displayName ?? `#${id}`;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Leaves</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <DateRangePicker value={range} onChange={setRange} />
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Employee</Label>
            <Select value={employeeId} onValueChange={setEmployeeId}>
              <SelectTrigger className="w-52">
                <SelectValue placeholder="Select…" />
              </SelectTrigger>
              <SelectContent>
                {employees.data?.map((e: EmployeeView) => (
                  <SelectItem key={e.id} value={String(e.id)}>
                    {e.displayName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Date</Label>
            <DateField className="w-40" value={date} onChange={setDate} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Type</Label>
            <Select value={type} onValueChange={(v) => setType(v as LeaveType)}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LEAVE_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {LEAVE_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Note</Label>
            <Input className="w-48" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          <Button
            onClick={() => add.mutate()}
            disabled={add.isPending || !employeeId || !date}
          >
            <Plus className="h-4 w-4" /> Add
          </Button>
        </div>

        {leaves.isLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : (leaves.data?.length ?? 0) === 0 ? (
          <p className="text-sm text-muted-foreground">No leaves recorded this month.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Employee</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Note</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {leaves.data?.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="font-medium">{formatDate(l.date)}</TableCell>
                  <TableCell>{nameOf(l.employeeId)}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{LEAVE_LABELS[l.type]}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{l.note ?? '—'}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" onClick={() => remove.mutate(l.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function RecomputeCard() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [range, setRange] = useState<DateRange>(currentMonthRange);

  const recompute = useMutation({
    mutationFn: () =>
      api('/attendance/recompute', { method: 'POST', body: { from: range.from, to: range.to } }),
    onSuccess: () => {
      toast({ title: 'Recompute complete', variant: 'success' });
      queryClient.invalidateQueries({ queryKey: ['summaries'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: () => toast({ title: 'Recompute failed', variant: 'error' }),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recompute</CardTitle>
        <CardDescription>
          Re-run the calculation engine after changing settings or door roles.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap items-end gap-3">
        <DateRangePicker value={range} onChange={setRange} />
        <Button onClick={() => recompute.mutate()} disabled={recompute.isPending}>
          {recompute.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          Recompute month
        </Button>
      </CardContent>
    </Card>
  );
}

export default function ConfigPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight">
          <Settings className="h-7 w-7" /> Configuration
        </h1>
        <p className="text-muted-foreground">Schedules, policies, holidays and leaves.</p>
      </div>

      <Tabs defaultValue="schedule">
        <TabsList>
          <TabsTrigger value="schedule">Schedule &amp; lunch</TabsTrigger>
          <TabsTrigger value="thresholds">Thresholds</TabsTrigger>
          <TabsTrigger value="holidays">Holidays</TabsTrigger>
          <TabsTrigger value="leaves">Leaves</TabsTrigger>
          <TabsTrigger value="recompute">Recompute</TabsTrigger>
        </TabsList>
        <TabsContent value="schedule">
          <ScheduleLunchTab />
        </TabsContent>
        <TabsContent value="thresholds">
          <ThresholdsTab />
        </TabsContent>
        <TabsContent value="holidays">
          <HolidaysTab />
        </TabsContent>
        <TabsContent value="leaves">
          <LeavesTab />
        </TabsContent>
        <TabsContent value="recompute">
          <RecomputeCard />
        </TabsContent>
      </Tabs>
    </div>
  );
}
