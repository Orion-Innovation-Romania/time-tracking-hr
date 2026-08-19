'use client';

import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Activity,
  ArrowLeft,
  Cpu,
  Database,
  HardDrive,
  MemoryStick,
  Server,
} from 'lucide-react';
import type { ResourceHealth, SystemHistoryResponse, SystemNowResponse } from '@ttah/shared';
import { api } from '@/lib/api';
import { useSession } from '@/lib/session';
import { cn } from '@/lib/utils';
import { UserGuide } from '@/components/user-guide';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ServiceUnavailable } from '@/components/service-unavailable';

const RANGES = [
  { hours: 1, label: '1h' },
  { hours: 6, label: '6h' },
  { hours: 24, label: '24h' },
  { hours: 24 * 7, label: '7d' },
  { hours: 24 * 30, label: '30d' },
] as const;

const HEALTH_BADGE: Record<ResourceHealth, { label: string; variant: 'success' | 'warning' | 'destructive' }> = {
  ok: { label: 'OK', variant: 'success' },
  watch: { label: 'Watch', variant: 'warning' },
  critical: { label: 'Critical', variant: 'destructive' },
};

export default function SystemResourcesPage() {
  const router = useRouter();
  const { data: session, isLoading, isError, error, refetch, isFetching } = useSession();
  const [hours, setHours] = useState(24);

  useEffect(() => {
    if (!isLoading && !isError && session === null) router.replace('/login');
    if (session?.mustChangePassword) router.replace('/change-password');
    if (session && session.role !== 'admin') router.replace('/');
  }, [session, isLoading, isError, router]);

  const now = useQuery({
    queryKey: ['system-now'],
    queryFn: () => api<SystemNowResponse>('/system/now'),
    refetchInterval: 5_000,
    enabled: session?.role === 'admin',
  });

  const history = useQuery({
    queryKey: ['system-history', hours],
    queryFn: () => api<SystemHistoryResponse>('/system/history', { query: { hours } }),
    refetchInterval: 60_000,
    enabled: session?.role === 'admin',
  });

  if (isError) {
    return <ServiceUnavailable error={error} onRetry={() => refetch()} retrying={isFetching} />;
  }

  if (isLoading || !session || session.role !== 'admin') {
    return (
      <div className="mx-auto max-w-6xl px-6 py-10">
        <Skeleton className="h-8 w-64" />
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
        </div>
      </div>
    );
  }

  const snap = now.data?.current;
  const host = now.data?.host;
  const verdict = now.data?.verdict;
  const overall = verdict ? HEALTH_BADGE[verdict.overall] : null;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Button variant="ghost" size="sm" className="-ml-2 mb-2" onClick={() => router.push('/')}>
            <ArrowLeft className="h-4 w-4" /> Portal home
          </Button>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">System Resources</h1>
            {overall && <Badge variant={overall.variant}>{overall.label}</Badge>}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Live host metrics for this TTAH API, plus history sampled every minute (kept 90 days).
          </p>
        </div>
        <UserGuide variant="header" />
      </div>

      {now.isError && (
        <p className="text-sm text-destructive">Could not load live metrics. Check that the API is running.</p>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard
          icon={Cpu}
          title="CPU"
          health={verdict?.cpu}
          value={snap ? `${snap.cpuPercent.toFixed(0)}%` : '—'}
          detail={host ? `${host.cpuCount} cores · ${host.cpuModel}` : undefined}
          percent={snap?.cpuPercent}
        />
        <MetricCard
          icon={MemoryStick}
          title="Memory"
          health={verdict?.memory}
          value={snap ? `${pct(snap.memUsedBytes, snap.memTotalBytes).toFixed(0)}%` : '—'}
          detail={snap ? `${fmtBytes(snap.memUsedBytes)} / ${fmtBytes(snap.memTotalBytes)}` : undefined}
          percent={snap ? pct(snap.memUsedBytes, snap.memTotalBytes) : undefined}
        />
        <MetricCard
          icon={HardDrive}
          title="Disk"
          health={verdict?.disk}
          value={
            snap?.diskUsedBytes != null && snap.diskTotalBytes
              ? `${pct(snap.diskUsedBytes, snap.diskTotalBytes).toFixed(0)}%`
              : '—'
          }
          detail={
            snap?.diskUsedBytes != null && snap.diskTotalBytes
              ? `${fmtBytes(snap.diskUsedBytes)} / ${fmtBytes(snap.diskTotalBytes)}${snap.diskPath ? ` · ${snap.diskPath}` : ''}`
              : 'Not available'
          }
          percent={
            snap?.diskUsedBytes != null && snap.diskTotalBytes
              ? pct(snap.diskUsedBytes, snap.diskTotalBytes)
              : undefined
          }
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Server className="h-4 w-4" /> Machine
            </CardTitle>
            <CardDescription>What this API process can see of the host.</CardDescription>
          </CardHeader>
          <CardContent>
            {host && snap ? (
              <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
                <Fact label="Hostname" value={host.hostname} />
                <Fact label="OS" value={`${prettyPlatform(host.platform)} ${host.release} (${host.arch})`} />
                <Fact label="Runtime" value={`Node ${host.nodeVersion}`} />
                <Fact label="Environment" value={host.inContainer ? 'Container (Docker / k8s)' : 'Bare metal / VM'} />
                <Fact label="Memory source" value={host.memSource === 'cgroup' ? 'cgroup limit' : 'OS total'} />
                <Fact label="OS uptime" value={fmtDuration(snap.osUptimeSec)} />
                <Fact label="API uptime" value={fmtDuration(snap.processUptimeSec)} />
                <Fact
                  label="API process"
                  value={`${fmtBytes(snap.processRssBytes)} RSS · heap ${fmtBytes(snap.processHeapBytes)}${
                    snap.processCpuPercent != null ? ` · CPU ${snap.processCpuPercent.toFixed(0)}%` : ''
                  }`}
                />
                {snap.load1 > 0 && (
                  <Fact label="Load average" value={`${snap.load1.toFixed(2)} / ${snap.load5.toFixed(2)} / ${snap.load15.toFixed(2)}`} />
                )}
              </dl>
            ) : (
              <Skeleton className="h-32" />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="h-4 w-4" /> Capacity read
            </CardTitle>
            <CardDescription>Is this machine enough for TTAH?</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            {(verdict?.notes ?? ['Collecting the first sample…']).map((note) => (
              <p key={note}>{note}</p>
            ))}
            <p className="pt-2 text-xs">
              Watch = 75%+, Critical = 90%+. History tells you if a spike is a one-off or the new baseline.
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Database className="h-4 w-4" /> Utilization over time
            </CardTitle>
            <CardDescription>
              {history.data
                ? `Avg CPU ${history.data.summary.cpuAvg}% (peak ${history.data.summary.cpuMax}%) · avg RAM ${history.data.summary.memAvgPct}% (peak ${history.data.summary.memMaxPct}%) · ${history.data.summary.samples} points`
                : 'Samples are stored every minute.'}
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-1">
            {RANGES.map((r) => (
              <Button
                key={r.hours}
                size="sm"
                variant={hours === r.hours ? 'default' : 'outline'}
                onClick={() => setHours(r.hours)}
              >
                {r.label}
              </Button>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          {history.isLoading ? (
            <Skeleton className="h-72" />
          ) : !history.data?.points.length ? (
            <p className="py-16 text-center text-sm text-muted-foreground">
              No history yet. Leave the API running — the first points appear within a minute.
            </p>
          ) : (
            <HistoryChart data={history.data} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function HistoryChart({ data }: { data: SystemHistoryResponse }) {
  const rows = useMemo(
    () =>
      data.points.map((p) => ({
        t: p.at,
        CPU: round1(p.cpuPercent),
        RAM: round1(p.memUsedPct),
        Disk: p.diskUsedPct == null ? null : round1(p.diskUsedPct),
      })),
    [data.points],
  );
  const tick = data.rangeHours <= 6 ? hourMin : data.rangeHours <= 24 ? hourMin : dayHour;

  return (
    <div className="h-80 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={rows} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="sysCpu" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(221 83% 53%)" stopOpacity={0.35} />
              <stop offset="100%" stopColor="hsl(221 83% 53%)" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="sysRam" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(172 66% 38%)" stopOpacity={0.35} />
              <stop offset="100%" stopColor="hsl(172 66% 38%)" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="sysDisk" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(32 95% 44%)" stopOpacity={0.3} />
              <stop offset="100%" stopColor="hsl(32 95% 44%)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
          <XAxis dataKey="t" tickFormatter={tick} minTickGap={28} tick={{ fontSize: 11 }} />
          <YAxis domain={[0, 100]} unit="%" width={40} tick={{ fontSize: 11 }} />
          <Tooltip
            labelFormatter={(v) => new Date(String(v)).toLocaleString()}
            formatter={(value: number, name: string) => [`${Number(value).toFixed(1)}%`, name]}
          />
          <Area type="monotone" dataKey="CPU" stroke="hsl(221 83% 53%)" fill="url(#sysCpu)" strokeWidth={2} />
          <Area type="monotone" dataKey="RAM" stroke="hsl(172 66% 38%)" fill="url(#sysRam)" strokeWidth={2} />
          <Area type="monotone" dataKey="Disk" stroke="hsl(32 95% 44%)" fill="url(#sysDisk)" strokeWidth={2} connectNulls />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function MetricCard({
  icon: Icon,
  title,
  value,
  detail,
  percent,
  health,
}: {
  icon: typeof Cpu;
  title: string;
  value: string;
  detail?: string;
  percent?: number;
  health?: ResourceHealth;
}) {
  const tone =
    health === 'critical' ? 'bg-destructive' : health === 'watch' ? 'bg-warning' : 'bg-primary';
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardDescription className="flex items-center justify-between">
          <span className="inline-flex items-center gap-2">
            <Icon className="h-4 w-4" /> {title}
          </span>
          {health && <Badge variant={HEALTH_BADGE[health].variant}>{HEALTH_BADGE[health].label}</Badge>}
        </CardDescription>
        <CardTitle className="text-3xl tabular-nums">{value}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="mb-2 h-2 overflow-hidden rounded-full bg-muted">
          <div
            className={cn('h-full rounded-full transition-all', tone)}
            style={{ width: `${clamp(percent ?? 0, 0, 100)}%` }}
          />
        </div>
        {detail && <p className="truncate text-xs text-muted-foreground">{detail}</p>}
      </CardContent>
    </Card>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 font-medium text-foreground">{value}</dd>
    </div>
  );
}

function pct(used: number, total: number): number {
  if (!total) return 0;
  return (used / total) * 100;
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function fmtBytes(n: number): string {
  if (!Number.isFinite(n) || n < 0) return '—';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let v = n;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i += 1;
  }
  return `${v >= 10 || i === 0 ? v.toFixed(0) : v.toFixed(1)} ${units[i]}`;
}

function fmtDuration(sec: number): string {
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function prettyPlatform(p: string): string {
  if (p === 'win32') return 'Windows';
  if (p === 'linux') return 'Linux';
  if (p === 'darwin') return 'macOS';
  return p;
}

function hourMin(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function dayHour(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()}/${d.getMonth() + 1} ${String(d.getHours()).padStart(2, '0')}h`;
}
