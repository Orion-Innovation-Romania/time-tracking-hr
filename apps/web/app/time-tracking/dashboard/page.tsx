'use client';

import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  AlarmClock,
  CalendarCheck,
  CalendarDays,
  Clock,
  Coffee,
  DoorOpen,
  TriangleAlert,
  Users,
} from 'lucide-react';
import type {
  AttendanceFilter,
  DailySummaryView,
  DashboardKpis,
  ScheduleConfig,
} from '@ttah/shared';
import { api } from '@/lib/api';
import { formatClock, formatDate, formatMinutes, monthRange } from '@/lib/utils';
import { FLAG_LABELS } from '@/lib/labels';
import { DateRangePicker, type DateRange } from '@/components/date-range-picker';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface DashboardResponse {
  kpis: DashboardKpis;
}

/** A full working day for the "did they work 8h?" metric. */
const FULL_DAY_MINUTES = 8 * 60;

interface WeekStat {
  key: string;
  weekNo: number;
  weekStart: string; // YYYY-MM-DD (Monday)
  people: number; // distinct employees present that week
  personDays: number; // total present employee-days
  avgDaysPerPerson: number;
  avgWorkedMinutes: number; // averaged over present days
  fullDays: number; // present days reaching 8h
  fullDayPct: number; // 0-100
}

/** ISO-8601 week (Mon-based) for a "YYYY-MM-DD" wall-clock date. */
function isoWeek(dateStr: string): { key: string; weekNo: number; weekStart: string } {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const dow = date.getUTCDay() || 7; // Mon=1..Sun=7
  const monday = new Date(date);
  monday.setUTCDate(date.getUTCDate() - (dow - 1));
  const target = new Date(date);
  target.setUTCDate(target.getUTCDate() + 4 - dow);
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((target.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return {
    key: `${target.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`,
    weekNo,
    weekStart: monday.toISOString().slice(0, 10),
  };
}

function computeWeekStats(rows: DailySummaryView[]): WeekStat[] {
  const byWeek = new Map<
    string,
    { weekNo: number; weekStart: string; employees: Set<number>; workedTotal: number; fullDays: number; personDays: number }
  >();
  for (const row of rows) {
    // A summary row means the employee badged in; count it as a present day.
    const { key, weekNo, weekStart } = isoWeek(row.date);
    let bucket = byWeek.get(key);
    if (!bucket) {
      bucket = { weekNo, weekStart, employees: new Set(), workedTotal: 0, fullDays: 0, personDays: 0 };
      byWeek.set(key, bucket);
    }
    bucket.employees.add(row.employeeId);
    bucket.personDays += 1;
    bucket.workedTotal += row.workedMinutes;
    if (row.workedMinutes >= FULL_DAY_MINUTES) bucket.fullDays += 1;
  }
  return [...byWeek.entries()]
    .map(([key, b]) => ({
      key,
      weekNo: b.weekNo,
      weekStart: b.weekStart,
      people: b.employees.size,
      personDays: b.personDays,
      avgDaysPerPerson: b.employees.size ? b.personDays / b.employees.size : 0,
      avgWorkedMinutes: b.personDays ? Math.round(b.workedTotal / b.personDays) : 0,
      fullDays: b.fullDays,
      fullDayPct: b.personDays ? Math.round((b.fullDays / b.personDays) * 100) : 0,
    }))
    .sort((a, b) => b.weekStart.localeCompare(a.weekStart));
}

interface EmpStat {
  employeeId: number;
  name: string;
  presentDays: number;
  totalWorkedMinutes: number;
  avgWorkedMinutes: number;
  avgOutsideMinutes: number; // averaged over days with a known first-in AND last-out
  spanDays: number;
  fullDays: number;
  fullDayPct: number;
}

/** Parse an "HH:mm" clock string to minutes-since-midnight, or null. */
function hmToMin(s: string | null): number | null {
  if (!s || !/^\d{2}:\d{2}$/.test(s)) return null;
  const [h, m] = s.split(':').map(Number);
  return h * 60 + m;
}

function computeEmployeeStats(rows: DailySummaryView[]): EmpStat[] {
  const byEmp = new Map<
    number,
    { name: string; presentDays: number; workedTotal: number; outsideTotal: number; spanDays: number; fullDays: number }
  >();
  for (const row of rows) {
    let b = byEmp.get(row.employeeId);
    if (!b) {
      b = { name: row.employeeName ?? `#${row.employeeId}`, presentDays: 0, workedTotal: 0, outsideTotal: 0, spanDays: 0, fullDays: 0 };
      byEmp.set(row.employeeId, b);
    }
    b.presentDays += 1;
    b.workedTotal += row.workedMinutes;
    if (row.workedMinutes >= FULL_DAY_MINUTES) b.fullDays += 1;
    // "Outside" = time inside their first-in..last-out span that was NOT counted as worked
    // (breaks / stepped out). Only measurable when a real exit exists.
    const inMin = hmToMin(row.firstIn);
    const outMin = hmToMin(row.lastOut);
    if (inMin != null && outMin != null && outMin > inMin) {
      b.outsideTotal += Math.max(0, outMin - inMin - row.workedMinutes);
      b.spanDays += 1;
    }
  }
  return [...byEmp.entries()]
    .map(([employeeId, b]) => ({
      employeeId,
      name: b.name,
      presentDays: b.presentDays,
      totalWorkedMinutes: b.workedTotal,
      avgWorkedMinutes: b.presentDays ? Math.round(b.workedTotal / b.presentDays) : 0,
      avgOutsideMinutes: b.spanDays ? Math.round(b.outsideTotal / b.spanDays) : 0,
      spanDays: b.spanDays,
      fullDays: b.fullDays,
      fullDayPct: b.presentDays ? Math.round((b.fullDays / b.presentDays) * 100) : 0,
    }))
    .sort((a, b) => b.avgWorkedMinutes - a.avgWorkedMinutes);
}

/** Format minutes-since-midnight as "HH:mm". */
function minToHm(min: number): string {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

interface PunctStat {
  employeeId: number;
  name: string;
  days: number;
  avgArrivalMin: number;
  avgLateMin: number; // averaged over arrival days, early counts as 0
  onTimePct: number; // arrived at or before schedule start
}

function computePunctuality(rows: DailySummaryView[], startMin: number): PunctStat[] {
  const byEmp = new Map<
    number,
    { name: string; days: number; arrivalTotal: number; lateTotal: number; onTime: number }
  >();
  for (const r of rows) {
    const inMin = hmToMin(r.firstIn);
    if (inMin == null) continue;
    let b = byEmp.get(r.employeeId);
    if (!b) {
      b = { name: r.employeeName ?? `#${r.employeeId}`, days: 0, arrivalTotal: 0, lateTotal: 0, onTime: 0 };
      byEmp.set(r.employeeId, b);
    }
    b.days += 1;
    b.arrivalTotal += inMin;
    b.lateTotal += Math.max(0, inMin - startMin);
    if (inMin <= startMin) b.onTime += 1;
  }
  return [...byEmp.entries()]
    .map(([employeeId, b]) => ({
      employeeId,
      name: b.name,
      days: b.days,
      avgArrivalMin: b.days ? Math.round(b.arrivalTotal / b.days) : 0,
      avgLateMin: b.days ? Math.round(b.lateTotal / b.days) : 0,
      onTimePct: b.days ? Math.round((b.onTime / b.days) * 100) : 0,
    }))
    .sort((a, b) => b.avgLateMin - a.avgLateMin);
}

function defaultRange(): DateRange {
  const now = new Date();
  return monthRange(now.getFullYear(), now.getMonth() + 1);
}

function KpiCard({
  title,
  value,
  icon: Icon,
  hint,
}: {
  title: string;
  value: string;
  icon: typeof Clock;
  hint?: string;
}) {
  return (
    <Card className="animate-fade-in">
      <CardContent className="flex items-center gap-4 p-5">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {title}
          </p>
          <p className="text-2xl font-bold">{value}</p>
          {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const [range, setRange] = useState<DateRange>(defaultRange);

  const filter: AttendanceFilter = { from: range.from, to: range.to };

  const dashboard = useQuery({
    queryKey: ['dashboard', range.from, range.to],
    queryFn: () =>
      api<DashboardResponse>('/attendance/dashboard', { method: 'POST', body: filter }),
  });

  const summaries = useQuery({
    queryKey: ['summaries', range.from, range.to],
    queryFn: () =>
      api<DailySummaryView[]>('/attendance/summaries', { method: 'POST', body: filter }),
  });

  const schedule = useQuery({
    queryKey: ['config', 'schedule'],
    queryFn: () => api<ScheduleConfig>('/config/schedule'),
  });
  const startMin = hmToMin(schedule.data?.startTime ?? null) ?? 9 * 60;

  const kpis = dashboard.data?.kpis;

  const sortedSummaries = useMemo(
    () =>
      [...(summaries.data ?? [])].sort(
        (a, b) => b.date.localeCompare(a.date) || (a.employeeName ?? '').localeCompare(b.employeeName ?? ''),
      ),
    [summaries.data],
  );

  const weekStats = useMemo(() => computeWeekStats(summaries.data ?? []), [summaries.data]);
  const empStats = useMemo(() => computeEmployeeStats(summaries.data ?? []), [summaries.data]);

  // Average break/day across all present days that have a real first-in and last-out.
  const avgBreakMinutes = useMemo(() => {
    let total = 0;
    let days = 0;
    for (const r of summaries.data ?? []) {
      const inMin = hmToMin(r.firstIn);
      const outMin = hmToMin(r.lastOut);
      if (inMin != null && outMin != null && outMin > inMin) {
        total += Math.max(0, outMin - inMin - r.workedMinutes);
        days += 1;
      }
    }
    return days ? Math.round(total / days) : 0;
  }, [summaries.data]);

  const punctuality = useMemo(
    () => computePunctuality(summaries.data ?? [], startMin),
    [summaries.data, startMin],
  );

  const weekChart = useMemo(
    () =>
      [...weekStats].reverse().map((w) => ({
        week: formatDate(w.weekStart).slice(0, 5),
        workedHours: Math.round((w.avgWorkedMinutes / 60) * 10) / 10,
        people: w.people,
        avgDays: Math.round(w.avgDaysPerPerson * 10) / 10,
        fullDayPct: w.fullDayPct,
      })),
    [weekStats],
  );

  const empChart = useMemo(
    () =>
      empStats.map((e) => ({
        name: e.name,
        worked: Math.round((e.avgWorkedMinutes / 60) * 10) / 10,
        outside: Math.round((e.avgOutsideMinutes / 60) * 10) / 10,
      })),
    [empStats],
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">Office presence overview</p>
        </div>
        <DateRangePicker value={range} onChange={setRange} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {dashboard.isLoading || !kpis ? (
          Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-24" />)
        ) : (
          <>
            <KpiCard title="Employees present" value={String(kpis.employees)} icon={Users} />
            <KpiCard title="Days present" value={String(kpis.daysPresent)} icon={CalendarDays} />
            <KpiCard
              title="Total worked"
              value={formatMinutes(kpis.totalWorkedMinutes)}
              icon={Clock}
              hint={`avg ${formatMinutes(kpis.avgWorkedMinutesPerDay)}/day`}
            />
            <KpiCard
              title="Avg break / day"
              value={formatMinutes(avgBreakMinutes)}
              icon={Coffee}
              hint="present but not working"
            />
            <KpiCard title="Anomalies" value={String(kpis.anomalies)} icon={TriangleAlert} />
          </>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarCheck className="h-5 w-5" /> Weekly attendance
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            How many people came in each week, how many days they came, and whether they reached 8h/day.
          </p>
        </CardHeader>
        <CardContent>
          {summaries.isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : weekChart.length === 0 ? (
            <p className="py-16 text-center text-sm text-muted-foreground">No data in range.</p>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={weekChart} margin={{ left: -12, right: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis
                    dataKey="week"
                    fontSize={12}
                    stroke="currentColor"
                    className="text-muted-foreground"
                  />
                  <YAxis
                    tickFormatter={(v) => `${v}h`}
                    fontSize={12}
                    stroke="currentColor"
                    className="text-muted-foreground"
                  />
                  <Tooltip
                    formatter={(v: number, name) =>
                      name === 'workedHours' ? [`${v}h`, 'Avg worked/day'] : [v, name]
                    }
                    labelFormatter={(l) => `Week of ${l}`}
                  />
                  <ReferenceLine
                    y={8}
                    stroke="#10b981"
                    strokeDasharray="4 4"
                    label={{ value: '8h target', position: 'right', fontSize: 11, fill: '#10b981' }}
                  />
                  <Bar dataKey="workedHours" name="Avg worked/day" fill="#3b82f6" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>

              <div className="mt-4 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Week of</TableHead>
                      <TableHead className="text-right">People present</TableHead>
                      <TableHead className="text-right">Avg days / person</TableHead>
                      <TableHead className="text-right">Avg worked / day</TableHead>
                      <TableHead className="text-right">Full 8h days</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {weekStats.map((w) => (
                      <TableRow key={w.key}>
                        <TableCell className="font-medium">{formatDate(w.weekStart)}</TableCell>
                        <TableCell className="text-right">{w.people}</TableCell>
                        <TableCell className="text-right">{w.avgDaysPerPerson.toFixed(1)}</TableCell>
                        <TableCell className="text-right">{formatMinutes(w.avgWorkedMinutes)}</TableCell>
                        <TableCell className="text-right">
                          <Badge variant={w.fullDayPct >= 50 ? 'success' : 'warning'}>
                            {w.fullDays}/{w.personDays} · {w.fullDayPct}%
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DoorOpen className="h-5 w-5" /> Worked vs break time — per employee
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Average per office day: blue = hours actually worked inside; amber = break time
            (breaks / stepped out) between their first entry and last exit.
          </p>
        </CardHeader>
        <CardContent>
          {summaries.isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : empChart.length === 0 ? (
            <p className="py-16 text-center text-sm text-muted-foreground">No data in range.</p>
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(200, empChart.length * 46 + 40)}>
              <BarChart data={empChart} layout="vertical" margin={{ left: 20, right: 16 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" horizontal={false} />
                <XAxis
                  type="number"
                  tickFormatter={(v) => `${v}h`}
                  fontSize={12}
                  stroke="currentColor"
                  className="text-muted-foreground"
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={110}
                  fontSize={12}
                  stroke="currentColor"
                  className="text-muted-foreground"
                />
                <Tooltip
                  formatter={(v: number, name) => [
                    `${v}h`,
                    name === 'worked' ? 'Worked / day' : 'Break / day',
                  ]}
                />
                <Legend
                  formatter={(v) => (v === 'worked' ? 'Worked / day' : 'Break / day')}
                />
                <ReferenceLine
                  x={8}
                  stroke="#10b981"
                  strokeDasharray="4 4"
                  label={{ value: '8h', position: 'top', fontSize: 11, fill: '#10b981' }}
                />
                <Bar dataKey="worked" name="worked" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                <Bar dataKey="outside" name="outside" fill="#f59e0b" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlarmClock className="h-5 w-5" /> Punctuality
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Arrival vs the {minToHm(startMin)} scheduled start. Sorted by worst average lateness.
          </p>
        </CardHeader>
        <CardContent>
          {summaries.isLoading ? (
            <Skeleton className="h-48 w-full" />
          ) : punctuality.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">No arrivals in range.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead className="text-right">Days</TableHead>
                  <TableHead className="text-right">Avg arrival</TableHead>
                  <TableHead className="text-right">Avg late</TableHead>
                  <TableHead className="text-right">On-time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {punctuality.map((p) => (
                  <TableRow key={p.employeeId}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell className="text-right tabular-nums">{p.days}</TableCell>
                    <TableCell className="text-right tabular-nums">{minToHm(p.avgArrivalMin)}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {p.avgLateMin > 0 ? `+${formatMinutes(p.avgLateMin)}` : 'on time'}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge
                        variant={
                          p.onTimePct >= 90 ? 'success' : p.onTimePct >= 70 ? 'warning' : 'destructive'
                        }
                      >
                        {p.onTimePct}%
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Daily summaries</CardTitle>
        </CardHeader>
        <CardContent>
          {summaries.isLoading ? (
            <Skeleton className="h-48 w-full" />
          ) : sortedSummaries.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              No summaries. Import an access report to get started.
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
                  <TableHead className="text-right">Break</TableHead>
                  <TableHead className="text-right">Lunch</TableHead>
                  <TableHead>Flags</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedSummaries.slice(0, 200).map((row) => (
                  <TableRow key={`${row.employeeId}-${row.date}`}>
                    <TableCell className="font-medium">{formatDate(row.date)}</TableCell>
                    <TableCell>{row.employeeName ?? `#${row.employeeId}`}</TableCell>
                    <TableCell>{formatClock(row.firstIn)}</TableCell>
                    <TableCell>{formatClock(row.lastOut)}</TableCell>
                    <TableCell className="text-right font-medium">
                      {formatMinutes(row.workedMinutes)}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {(() => {
                        const inMin = hmToMin(row.firstIn);
                        const outMin = hmToMin(row.lastOut);
                        return inMin != null && outMin != null && outMin > inMin
                          ? formatMinutes(Math.max(0, outMin - inMin - row.workedMinutes))
                          : '—';
                      })()}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {formatMinutes(row.lunchMinutes)}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {row.manual && <Badge variant="secondary">manual</Badge>}
                        {row.flags.map((f) => (
                          <Badge key={f} variant="warning">
                            {FLAG_LABELS[f]}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
