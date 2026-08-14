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
  AnomalyFlag,
  AttendanceFilter,
  DailySummaryView,
  DashboardKpis,
  ScheduleConfig,
  ThresholdConfig,
} from '@ttah/shared';
import { api } from '@/lib/api';
import { formatClock, formatDate, formatMinutes, monthRange } from '@/lib/utils';
import { DateRangePicker, type DateRange } from '@/components/date-range-picker';
import { DayInsightDialog, FlagBadgeButton } from '@/components/day-insight-dialog';
import { EmployeeSearchSelect } from '@/components/employee-search-select';
import { useEmployees } from '@/lib/hooks';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
  peopleAt8h: number; // people whose avg worked time that week was >= 8h
  peopleAt8hPct: number; // 0-100
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
    {
      weekNo: number;
      weekStart: string;
      perEmp: Map<number, { days: number; worked: number }>;
    }
  >();
  for (const row of rows) {
    const { key, weekNo, weekStart } = isoWeek(row.date);
    let bucket = byWeek.get(key);
    if (!bucket) {
      bucket = { weekNo, weekStart, perEmp: new Map() };
      byWeek.set(key, bucket);
    }
    const emp = bucket.perEmp.get(row.employeeId) ?? { days: 0, worked: 0 };
    emp.days += 1;
    emp.worked += row.workedMinutes;
    bucket.perEmp.set(row.employeeId, emp);
  }
  return [...byWeek.entries()]
    .map(([key, b]) => {
      const people = b.perEmp.size;
      let personDays = 0;
      let workedTotal = 0;
      let peopleAt8h = 0;
      for (const emp of b.perEmp.values()) {
        personDays += emp.days;
        workedTotal += emp.worked;
        if (emp.days > 0 && emp.worked / emp.days >= FULL_DAY_MINUTES) peopleAt8h += 1;
      }
      return {
        key,
        weekNo: b.weekNo,
        weekStart: b.weekStart,
        people,
        personDays,
        avgDaysPerPerson: people ? personDays / people : 0,
        avgWorkedMinutes: personDays ? Math.round(workedTotal / personDays) : 0,
        peopleAt8h,
        peopleAt8hPct: people ? Math.round((peopleAt8h / people) * 100) : 0,
      };
    })
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
  avgLateMin: number; // minutes past start+grace; within grace counts as 0
  onTimePct: number; // arrived by start + grace
}

function computePunctuality(
  rows: DailySummaryView[],
  startMin: number,
  graceMin: number,
): PunctStat[] {
  const lateAfter = startMin + Math.max(0, graceMin);
  const byEmp = new Map<
    number,
    { name: string; days: number; arrivalTotal: number; onTime: number }
  >();
  for (const r of rows) {
    const inMin = hmToMin(r.firstIn);
    if (inMin == null) continue;
    let b = byEmp.get(r.employeeId);
    if (!b) {
      b = { name: r.employeeName ?? `#${r.employeeId}`, days: 0, arrivalTotal: 0, onTime: 0 };
      byEmp.set(r.employeeId, b);
    }
    b.days += 1;
    b.arrivalTotal += inMin;
    if (inMin <= lateAfter) b.onTime += 1;
  }
  return [...byEmp.entries()]
    .map(([employeeId, b]) => {
      const avgArrivalMin = b.days ? Math.round(b.arrivalTotal / b.days) : 0;
      return {
        employeeId,
        name: b.name,
        days: b.days,
        avgArrivalMin,
        avgLateMin: Math.max(0, avgArrivalMin - lateAfter),
        onTimePct: b.days ? Math.round((b.onTime / b.days) * 100) : 0,
      };
    })
    .sort((a, b) => b.avgLateMin - a.avgLateMin || a.onTimePct - b.onTimePct);
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
  const [employeeIds, setEmployeeIds] = useState<number[]>([]);
  const [insight, setInsight] = useState<{ row: DailySummaryView; flag: AnomalyFlag } | null>(null);

  const employees = useEmployees(true);
  const comparing = employeeIds.length > 0;
  const scopedIds = [...employeeIds].sort((a, b) => a - b);

  const filter: AttendanceFilter = {
    from: range.from,
    to: range.to,
    ...(comparing ? { employeeIds: scopedIds } : {}),
  };

  const dashboard = useQuery({
    queryKey: ['dashboard', range.from, range.to, scopedIds],
    queryFn: () =>
      api<DashboardResponse>('/attendance/dashboard', { method: 'POST', body: filter }),
  });

  const summaries = useQuery({
    queryKey: ['summaries', range.from, range.to, scopedIds],
    queryFn: () =>
      api<DailySummaryView[]>('/attendance/summaries', { method: 'POST', body: filter }),
  });

  const schedule = useQuery({
    queryKey: ['config', 'schedule'],
    queryFn: () => api<ScheduleConfig>('/config/schedule'),
  });
  const thresholds = useQuery({
    queryKey: ['config', 'thresholds'],
    queryFn: () => api<ThresholdConfig>('/config/thresholds'),
  });
  const startMin = hmToMin(schedule.data?.startTime ?? null) ?? 9 * 60;
  const graceMin = thresholds.data?.overtimeThresholdMinutes ?? 15;

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
    () => computePunctuality(summaries.data ?? [], startMin, graceMin),
    [summaries.data, startMin, graceMin],
  );

  const weekChart = useMemo(
    () =>
      [...weekStats].reverse().map((w) => ({
        week: formatDate(w.weekStart).slice(0, 5),
        workedHours: Math.round((w.avgWorkedMinutes / 60) * 10) / 10,
        people: w.people,
        avgDays: Math.round(w.avgDaysPerPerson * 10) / 10,
        fullDayPct: w.peopleAt8hPct,
      })),
    [weekStats],
  );

  const EMP_CHART_CAP = 12;
  const empChart = useMemo(() => {
    const rows = comparing ? empStats : empStats.slice(0, EMP_CHART_CAP);
    return rows.map((e) => ({
      name: e.name,
      worked: Math.round((e.avgWorkedMinutes / 60) * 10) / 10,
      outside: Math.round((e.avgOutsideMinutes / 60) * 10) / 10,
    }));
  }, [empStats, comparing]);

  const punctualityRows = comparing ? punctuality : punctuality.slice(0, 20);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            {comparing
              ? `Comparing ${employeeIds.length} ${employeeIds.length === 1 ? 'person' : 'people'}`
              : 'Overview · all employees'}
          </p>
        </div>
        <DateRangePicker value={range} onChange={setRange} />
      </div>

      <EmployeeSearchSelect
        employees={employees.data ?? []}
        selectedIds={employeeIds}
        onChange={setEmployeeIds}
      />

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
            Who came that week, how often, how long they worked on those days, and how many of
            the people who came averaged at least 8 hours per office day.
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
                      <TableHead className="text-right">Did ≥8h / who came</TableHead>
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
                          <Badge
                            variant={w.peopleAt8hPct >= 50 ? 'success' : 'warning'}
                            title={`${w.peopleAt8h} of ${w.people} people who came this week averaged at least 8h on the days they were in.`}
                          >
                            {w.peopleAt8h} of {w.people} · {w.peopleAt8hPct}%
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
            {!comparing && empStats.length > EMP_CHART_CAP
              ? ` Showing the ${EMP_CHART_CAP} longest days — search above to compare specific people.`
              : null}
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
            Arrival vs {minToHm(startMin)}. Avg late is taken from avg arrival after a {graceMin} min
            grace. On-time is the share of days they arrived by {minToHm(startMin + graceMin)}.
            {!comparing && punctuality.length > 20
              ? ' Showing the 20 latest arrivals — search to compare specific people.'
              : ''}
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
                {punctualityRows.map((p) => (
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
          <CardDescription>Click a flag to see why it was raised for that person and day.</CardDescription>
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
                          <FlagBadgeButton
                            key={f}
                            flag={f}
                            onClick={() => setInsight({ row, flag: f })}
                          />
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

      {insight && (
        <DayInsightDialog
          row={insight.row}
          focusFlag={insight.flag}
          onClose={() => setInsight(null)}
        />
      )}
    </div>
  );
}
