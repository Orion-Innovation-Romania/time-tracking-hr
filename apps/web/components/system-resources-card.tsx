'use client';

import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { Activity, Cpu, HardDrive, MemoryStick } from 'lucide-react';
import type { ResourceHealth, SystemNowResponse } from '@ttah/shared';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const BADGE: Record<ResourceHealth, { label: string; variant: 'success' | 'warning' | 'destructive' }> = {
  ok: { label: 'OK', variant: 'success' },
  watch: { label: 'Watch', variant: 'warning' },
  critical: { label: 'Critical', variant: 'destructive' },
};

export function SystemResourcesCard() {
  const router = useRouter();
  const q = useQuery({
    queryKey: ['system-now'],
    queryFn: () => api<SystemNowResponse>('/system/now'),
    refetchInterval: 15_000,
  });

  const overall = q.data?.verdict.overall;
  const snap = q.data?.current;

  return (
    <Card
      className="group relative cursor-pointer overflow-hidden transition-all hover:-translate-y-1 hover:shadow-lg"
      onClick={() => router.push('/system')}
    >
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-emerald-500/20 to-sky-500/10" />
      <CardHeader className="relative">
        <div className="mb-3 flex items-start justify-between gap-2">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Activity className="h-6 w-6" />
          </div>
          {overall && <Badge variant={BADGE[overall].variant}>{BADGE[overall].label}</Badge>}
        </div>
        <CardTitle>System Resources</CardTitle>
        <CardDescription>CPU, memory and disk on this machine — live and history. Admin only.</CardDescription>
      </CardHeader>
      <CardContent className="relative space-y-2">
        {snap ? (
          <>
            <MiniBar icon={Cpu} label="CPU" pct={snap.cpuPercent} />
            <MiniBar icon={MemoryStick} label="RAM" pct={pct(snap.memUsedBytes, snap.memTotalBytes)} />
            <MiniBar
              icon={HardDrive}
              label="Disk"
              pct={
                snap.diskUsedBytes != null && snap.diskTotalBytes
                  ? pct(snap.diskUsedBytes, snap.diskTotalBytes)
                  : null
              }
            />
          </>
        ) : (
          <p className="text-sm text-muted-foreground">{q.isError ? 'Metrics unavailable' : 'Reading host…'}</p>
        )}
        <span className="mt-2 inline-block text-sm font-medium text-primary group-hover:underline">Open →</span>
      </CardContent>
    </Card>
  );
}

function MiniBar({ icon: Icon, label, pct: value }: { icon: typeof Cpu; label: string; pct: number | null }) {
  const n = value == null ? null : Math.min(100, Math.max(0, value));
  const tone = n == null ? 'bg-muted' : n >= 90 ? 'bg-destructive' : n >= 75 ? 'bg-warning' : 'bg-primary';
  return (
    <div className="flex items-center gap-2 text-xs">
      <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      <span className="w-10 text-muted-foreground">{label}</span>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
        <div className={cn('h-full rounded-full', tone)} style={{ width: n == null ? '0%' : `${n}%` }} />
      </div>
      <span className="w-8 text-right tabular-nums">{n == null ? '—' : `${n.toFixed(0)}%`}</span>
    </div>
  );
}

function pct(used: number, total: number): number {
  if (!total) return 0;
  return (used / total) * 100;
}
