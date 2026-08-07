'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { DoorOpen, Loader2, RefreshCw } from 'lucide-react';
import { DOOR_ROLES, type DoorHealthView, type DoorRole, type DoorView } from '@ttah/shared';
import { api } from '@/lib/api';
import { monthRange } from '@/lib/utils';
import { DOOR_ROLE_LABELS } from '@/lib/labels';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

const ROLE_BADGE: Record<DoorRole, 'success' | 'warning' | 'secondary'> = {
  IN: 'success',
  OUT: 'warning',
  NEUTRAL: 'secondary',
};

function RecomputeCard() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const range = monthRange(new Date().getFullYear(), new Date().getMonth() + 1);
  const [from, setFrom] = useState(range.from);
  const [to, setTo] = useState(range.to);

  const recompute = useMutation({
    mutationFn: () => api('/attendance/recompute', { method: 'POST', body: { from, to } }),
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
        <CardTitle>Apply changes</CardTitle>
        <CardDescription>
          After fixing door roles, re-run the engine to update presence, worked hours and anomalies.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">From</Label>
          <Input type="date" className="w-40" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">To</Label>
          <Input type="date" className="w-40" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <Button onClick={() => recompute.mutate()} disabled={recompute.isPending}>
          {recompute.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          Recompute range
        </Button>
      </CardContent>
    </Card>
  );
}

function DoorNameCell({ door }: { door: DoorView }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [name, setName] = useState(door.displayName ?? '');
  useEffect(() => setName(door.displayName ?? ''), [door.displayName]);

  const save = useMutation({
    mutationFn: (displayName: string | null) =>
      api(`/doors/${door.id}`, { method: 'PATCH', body: { displayName } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['doors'] }),
    onError: () => toast({ title: 'Could not save name', variant: 'error' }),
  });

  const commit = () => {
    const next = name.trim() || null;
    if (next !== (door.displayName ?? null)) save.mutate(next);
  };

  return (
    <Input
      className="h-8 w-44"
      placeholder="—"
      value={name}
      onChange={(e) => setName(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
    />
  );
}

function DoorRoleCell({ door }: { door: DoorView }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const save = useMutation({
    mutationFn: (role: DoorRole) => api(`/doors/${door.id}`, { method: 'PATCH', body: { role } }),
    onSuccess: () => {
      toast({ title: 'Door role updated', variant: 'success' });
      queryClient.invalidateQueries({ queryKey: ['doors'] });
    },
    onError: () => toast({ title: 'Update failed', variant: 'error' }),
  });

  return (
    <div className="flex items-center gap-2">
      <Select value={door.role} onValueChange={(v) => save.mutate(v as DoorRole)}>
        <SelectTrigger className="h-8 w-32">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {DOOR_ROLES.map((r) => (
            <SelectItem key={r} value={r}>
              {DOOR_ROLE_LABELS[r]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {save.isPending && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
    </div>
  );
}

function DoorHealthCard() {
  const range = monthRange(new Date().getFullYear(), new Date().getMonth() + 1);
  const [from, setFrom] = useState(range.from);
  const [to, setTo] = useState(range.to);

  const health = useQuery({
    queryKey: ['door-health', from, to],
    queryFn: () => api<DoorHealthView[]>('/attendance/door-health', { query: { from, to } }),
  });

  const rateBadge = (pct: number): 'destructive' | 'warning' | 'success' =>
    pct >= 50 ? 'destructive' : pct >= 20 ? 'warning' : 'success';

  return (
    <Card>
      <CardHeader>
        <CardTitle>Door health</CardTitle>
        <CardDescription>
          Which readers cause unpaired badges (missing entry/exit). A high rate usually means the
          role is wrong — fix it above, then Recompute.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">From</Label>
            <Input type="date" className="w-40" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">To</Label>
            <Input type="date" className="w-40" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </div>

        {health.isLoading ? (
          <Skeleton className="h-48 w-full" />
        ) : (health.data?.length ?? 0) === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No reader activity in this range.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Location</TableHead>
                <TableHead>Role</TableHead>
                <TableHead className="text-right">Reads</TableHead>
                <TableHead className="text-right">Days used</TableHead>
                <TableHead className="text-right">Problem days</TableHead>
                <TableHead className="text-right">Anomaly rate</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {health.data!.map((d) => (
                <TableRow key={d.doorId}>
                  <TableCell className="font-medium">{d.displayName ?? d.rawLocation}</TableCell>
                  <TableCell>
                    <Badge variant={ROLE_BADGE[d.role]} className="w-16 justify-center">
                      {DOOR_ROLE_LABELS[d.role]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{d.events}</TableCell>
                  <TableCell className="text-right tabular-nums">{d.activeDays}</TableCell>
                  <TableCell className="text-right tabular-nums">{d.problems}</TableCell>
                  <TableCell className="text-right">
                    <Badge variant={rateBadge(d.anomalyRatePct)}>{d.anomalyRatePct}%</Badge>
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

export default function DoorsPage() {
  const doors = useQuery({
    queryKey: ['doors'],
    queryFn: () => api<DoorView[]>('/doors'),
  });

  const stats = useMemo(() => {
    const rows = doors.data ?? [];
    return {
      total: rows.length,
      neutral: rows.filter((d) => d.role === 'NEUTRAL').length,
      auto: rows.filter((d) => d.autoDetected).length,
    };
  }, [doors.data]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight">
          <DoorOpen className="h-7 w-7" /> Doors
        </h1>
        <p className="text-muted-foreground">
          Classify each reader so the engine can pair entries with exits.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>How door roles work</CardTitle>
          <CardDescription>Roles are auto-detected from the location text, but you can override them.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          <div className="flex items-start gap-2">
            <Badge variant="success" className="mt-0.5 shrink-0">Entry</Badge>
            <span className="text-sm text-muted-foreground">A read here starts a presence session (badge in).</span>
          </div>
          <div className="flex items-start gap-2">
            <Badge variant="warning" className="mt-0.5 shrink-0">Exit</Badge>
            <span className="text-sm text-muted-foreground">A read here closes the open session (badge out).</span>
          </div>
          <div className="flex items-start gap-2">
            <Badge variant="secondary" className="mt-0.5 shrink-0">Neutral</Badge>
            <span className="text-sm text-muted-foreground">Ignored for presence (internal door, no direction).</span>
          </div>
        </CardContent>
      </Card>

      <RecomputeCard />

      <DoorHealthCard />

      <Card>
        <CardHeader>
          <CardTitle>
            Readers{' '}
            {doors.data && (
              <span className="text-sm font-normal text-muted-foreground">
                ({stats.total} total · {stats.neutral} neutral · {stats.auto} auto-detected)
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {doors.isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : (doors.data?.length ?? 0) === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              No doors yet. Import a report to discover readers.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Location</TableHead>
                  <TableHead>Display name</TableHead>
                  <TableHead>Zone</TableHead>
                  <TableHead className="text-right">Events</TableHead>
                  <TableHead>Detection</TableHead>
                  <TableHead>Role</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {doors.data!.map((door) => (
                  <TableRow key={door.id}>
                    <TableCell className="font-medium">{door.rawLocation}</TableCell>
                    <TableCell>
                      <DoorNameCell door={door} />
                    </TableCell>
                    <TableCell className="text-muted-foreground">{door.zone ?? '—'}</TableCell>
                    <TableCell className="text-right tabular-nums">{door.eventCount ?? 0}</TableCell>
                    <TableCell>
                      <Badge variant={door.autoDetected ? 'secondary' : 'outline'}>
                        {door.autoDetected ? 'Auto' : 'Manual'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Badge variant={ROLE_BADGE[door.role]} className="w-16 justify-center">
                          {DOOR_ROLE_LABELS[door.role]}
                        </Badge>
                        <DoorRoleCell door={door} />
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
