'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { ChevronRight, DoorOpen, Loader2, Plus, Trash2 } from 'lucide-react';
import { DOOR_ROLES, type DoorRole, type DoorView, type OfficeView, type ReaderView } from '@ttah/shared';
import { api } from '@/lib/api';
import { useSession } from '@/lib/session';
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
import { cn } from '@/lib/utils';

const NONE = '__none__';
const ROLE_BADGE: Record<DoorRole, 'success' | 'warning' | 'secondary'> = {
  IN: 'success',
  OUT: 'warning',
  NEUTRAL: 'secondary',
};

function invalidateDoors(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ['doors'] });
  queryClient.invalidateQueries({ queryKey: ['offices'] });
}

function DoorNameCell({ door, canEdit }: { door: DoorView; canEdit: boolean }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [name, setName] = useState(door.name);
  useEffect(() => setName(door.name), [door.name]);

  const save = useMutation({
    mutationFn: (next: string) => api(`/doors/${door.id}`, { method: 'PATCH', body: { name: next } }),
    onSuccess: () => invalidateDoors(queryClient),
    onError: () => toast({ title: 'Could not save name', variant: 'error' }),
  });

  const commit = () => {
    const next = name.trim();
    if (!next) {
      setName(door.name);
      return;
    }
    if (next !== door.name) save.mutate(next);
  };

  if (!canEdit) return <span className="font-medium">{door.name}</span>;

  return (
    <Input
      className="h-8 w-44"
      value={name}
      onChange={(e) => setName(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
    />
  );
}

function DoorFloorCell({ door, canEdit }: { door: DoorView; canEdit: boolean }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [floor, setFloor] = useState(door.floor ?? '');
  useEffect(() => setFloor(door.floor ?? ''), [door.floor]);

  const save = useMutation({
    mutationFn: (next: string | null) =>
      api(`/doors/${door.id}`, { method: 'PATCH', body: { floor: next } }),
    onSuccess: () => invalidateDoors(queryClient),
    onError: () => toast({ title: 'Could not save floor', variant: 'error' }),
  });

  const commit = () => {
    const next = floor.trim() || null;
    if (next !== (door.floor ?? null)) save.mutate(next);
  };

  if (!canEdit) return <span>{door.floor ?? '—'}</span>;

  return (
    <Input
      className="h-8 w-28"
      placeholder="Et. 4"
      value={floor}
      onChange={(e) => setFloor(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
    />
  );
}

function DoorOfficeCell({
  door,
  offices,
  canEdit,
}: {
  door: DoorView;
  offices: OfficeView[];
  canEdit: boolean;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');

  const save = useMutation({
    mutationFn: (officeId: number | null) =>
      api(`/doors/${door.id}`, { method: 'PATCH', body: { officeId } }),
    onSuccess: () => invalidateDoors(queryClient),
    onError: () => toast({ title: 'Could not save location', variant: 'error' }),
  });

  const create = useMutation({
    mutationFn: async (name: string) => {
      const office = await api<OfficeView>('/offices', { method: 'POST', body: { name } });
      await api(`/doors/${door.id}`, { method: 'PATCH', body: { officeId: office.id } });
    },
    onSuccess: () => {
      setAdding(false);
      setNewName('');
      invalidateDoors(queryClient);
    },
    onError: () => toast({ title: 'Could not add office', variant: 'error' }),
  });

  if (!canEdit) return <span>{door.officeName ?? '—'}</span>;

  if (adding) {
    return (
      <div className="flex items-center gap-1">
        <Input
          className="h-8 w-36"
          autoFocus
          placeholder="Office name"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && newName.trim()) create.mutate(newName.trim());
            if (e.key === 'Escape') setAdding(false);
          }}
        />
        <Button
          size="sm"
          className="h-8"
          disabled={!newName.trim() || create.isPending}
          onClick={() => create.mutate(newName.trim())}
        >
          {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Add'}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <Select
        value={door.officeId != null ? String(door.officeId) : NONE}
        onValueChange={(v) => save.mutate(v === NONE ? null : Number(v))}
      >
        <SelectTrigger className="h-8 w-40">
          <SelectValue placeholder="—" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE}>—</SelectItem>
          {offices.map((o) => (
            <SelectItem key={o.id} value={String(o.id)}>
              {o.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        title="Add office"
        onClick={() => setAdding(true)}
      >
        <Plus className="h-4 w-4" />
      </Button>
      {save.isPending && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
    </div>
  );
}

function ReaderRoleCell({
  doorId,
  reader,
  canEdit,
}: {
  doorId: number;
  reader: ReaderView;
  canEdit: boolean;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const save = useMutation({
    mutationFn: (role: DoorRole) =>
      api(`/doors/${doorId}/readers/${reader.id}`, { method: 'PATCH', body: { role } }),
    onSuccess: () => {
      toast({ title: 'Reader role updated', variant: 'success' });
      invalidateDoors(queryClient);
    },
    onError: () => toast({ title: 'Update failed', variant: 'error' }),
  });

  if (!canEdit) {
    return (
      <Badge variant={ROLE_BADGE[reader.role]} className="w-16 justify-center">
        {DOOR_ROLE_LABELS[reader.role]}
      </Badge>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Select value={reader.role} onValueChange={(v) => save.mutate(v as DoorRole)}>
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

function ReaderTags({ readers }: { readers: ReaderView[] }) {
  const roles = DOOR_ROLES.filter((role) => readers.some((r) => r.role === role));
  if (roles.length === 0) return <span className="text-muted-foreground">—</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {roles.map((role) => (
        <Badge key={role} variant={ROLE_BADGE[role]} className="w-16 justify-center">
          {DOOR_ROLE_LABELS[role]}
        </Badge>
      ))}
    </div>
  );
}

export default function DoorsPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: session } = useSession();
  const canEdit = session?.role === 'admin';
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [query, setQuery] = useState('');
  const [officeFilter, setOfficeFilter] = useState<string>(NONE);
  const [floorFilter, setFloorFilter] = useState<string>(NONE);

  const doors = useQuery({
    queryKey: ['doors'],
    queryFn: () => api<DoorView[]>('/doors'),
  });
  const offices = useQuery({
    queryKey: ['offices'],
    queryFn: () => api<OfficeView[]>('/offices'),
  });

  const removeDoor = useMutation({
    mutationFn: (id: number) => api(`/doors/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast({ title: 'Door deleted', variant: 'success' });
      invalidateDoors(queryClient);
      queryClient.invalidateQueries({ queryKey: ['summaries'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: () => toast({ title: 'Could not delete door', variant: 'error' }),
  });

  const removeReader = useMutation({
    mutationFn: ({ doorId, readerId }: { doorId: number; readerId: number }) =>
      api(`/doors/${doorId}/readers/${readerId}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast({ title: 'Reader deleted', variant: 'success' });
      invalidateDoors(queryClient);
      queryClient.invalidateQueries({ queryKey: ['summaries'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: () => toast({ title: 'Could not delete reader', variant: 'error' }),
  });

  const purgeInvalid = useMutation({
    mutationFn: () =>
      api<{ deleted: number; eventsDeleted: number }>('/doors/invalid-readers', { method: 'DELETE' }),
    onSuccess: (res) => {
      toast({
        title: `Removed ${res.deleted} invalid reader${res.deleted === 1 ? '' : 's'}`,
        variant: 'success',
      });
      invalidateDoors(queryClient);
      queryClient.invalidateQueries({ queryKey: ['summaries'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: () => toast({ title: 'Could not purge invalid readers', variant: 'error' }),
  });

  const floors = useMemo(() => {
    const set = new Set<string>();
    for (const d of doors.data ?? []) if (d.floor) set.add(d.floor);
    return [...set].sort();
  }, [doors.data]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (doors.data ?? []).filter((d) => {
      if (officeFilter !== NONE && String(d.officeId ?? '') !== officeFilter) return false;
      if (floorFilter !== NONE && (d.floor ?? '') !== floorFilter) return false;
      if (!q) return true;
      const hay = [
        d.name,
        d.floor ?? '',
        d.officeName ?? '',
        ...d.readers.map((r) => r.rawLocation),
      ]
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [doors.data, query, officeFilter, floorFilter]);

  const stats = useMemo(() => {
    const rows = doors.data ?? [];
    const readers = rows.flatMap((d) => d.readers);
    return {
      doors: rows.length,
      readers: readers.length,
      invalid: readers.filter((r) => r.valid === false).length,
    };
  }, [doors.data]);

  const toggle = (id: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight">
          <DoorOpen className="h-7 w-7" /> Doors
        </h1>
        <p className="text-muted-foreground">
          {canEdit
            ? 'Every door from imported reports. Set name, office and floor here — readers belong to a door and can be edited from the expanded row.'
            : 'Every door from imported reports. Expand a row to see its readers.'}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>How reader roles work</CardTitle>
          <CardDescription>
            Entry / Exit is a tag on the reader, not the door name.
            {canEdit
              ? ' Roles are auto-detected from the PDF text; override them on the reader.'
              : ' Roles are auto-detected from the PDF text.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          <div className="flex items-start gap-2">
            <Badge variant="success" className="mt-0.5 shrink-0">
              Entry
            </Badge>
            <span className="text-sm text-muted-foreground">
              A read here starts a presence session (badge in).
            </span>
          </div>
          <div className="flex items-start gap-2">
            <Badge variant="warning" className="mt-0.5 shrink-0">
              Exit
            </Badge>
            <span className="text-sm text-muted-foreground">
              A read here closes the open session (badge out).
            </span>
          </div>
          <div className="flex items-start gap-2">
            <Badge variant="secondary" className="mt-0.5 shrink-0">
              Neutral
            </Badge>
            <span className="text-sm text-muted-foreground">
              Ignored for presence (internal door, no direction).
            </span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle>Doors</CardTitle>
            {doors.data && (
              <CardDescription>
                {stats.doors} door{stats.doors === 1 ? '' : 's'} · {stats.readers} reader
                {stats.readers === 1 ? '' : 's'}
                {stats.invalid ? ` · ${stats.invalid} invalid` : ''}
              </CardDescription>
            )}
          </div>
          {canEdit && stats.invalid > 0 && (
            <Button
              variant="destructive"
              size="sm"
              disabled={purgeInvalid.isPending}
              onClick={() => {
                if (
                  confirm(
                    `Delete ${stats.invalid} invalid reader(s)? These are PDF header leftovers, not real doors. Their badge events (if any) are removed too.`,
                  )
                ) {
                  purgeInvalid.mutate();
                }
              }}
            >
              {purgeInvalid.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              Delete invalid readers
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Search</Label>
              <Input
                className="w-56"
                placeholder="Name, office, floor…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Office</Label>
              <Select value={officeFilter} onValueChange={setOfficeFilter}>
                <SelectTrigger className="h-10 w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>All offices</SelectItem>
                  {(offices.data ?? []).map((o) => (
                    <SelectItem key={o.id} value={String(o.id)}>
                      {o.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Floor</Label>
              <Select value={floorFilter} onValueChange={setFloorFilter}>
                <SelectTrigger className="h-10 w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>All floors</SelectItem>
                  {floors.map((f) => (
                    <SelectItem key={f} value={f}>
                      {f}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {doors.isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : filtered.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              {doors.data?.length
                ? 'No doors match these filters.'
                : 'No doors yet. Import a report to discover readers.'}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8" />
                  <TableHead>Name</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Floor</TableHead>
                  <TableHead>Readers</TableHead>
                  <TableHead>Reads</TableHead>
                  {canEdit && <TableHead />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((door) => {
                  const open = expanded.has(door.id);
                  const invalid = door.readers.some((r) => r.valid === false);
                  return (
                    <DoorRows
                      key={door.id}
                      door={door}
                      offices={offices.data ?? []}
                      open={open}
                      invalid={invalid}
                      canEdit={canEdit}
                      onToggle={() => toggle(door.id)}
                      onDeleteDoor={() => {
                        const extra =
                          door.eventCount > 0
                            ? ` ${door.eventCount} badge event(s) on this door will also be deleted.`
                            : '';
                        if (confirm(`Delete door “${door.name}”?${extra}`)) {
                          removeDoor.mutate(door.id);
                        }
                      }}
                      onDeleteReader={(reader) => {
                        const extra =
                          reader.eventCount > 0
                            ? ` ${reader.eventCount} badge event(s) on this reader will also be deleted.`
                            : '';
                        if (confirm(`Delete reader “${reader.rawLocation}”?${extra}`)) {
                          removeReader.mutate({ doorId: door.id, readerId: reader.id });
                        }
                      }}
                      deletingDoor={removeDoor.isPending}
                      deletingReader={removeReader.isPending}
                    />
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function DoorRows({
  door,
  offices,
  open,
  invalid,
  canEdit,
  onToggle,
  onDeleteDoor,
  onDeleteReader,
  deletingDoor,
  deletingReader,
}: {
  door: DoorView;
  offices: OfficeView[];
  open: boolean;
  invalid: boolean;
  canEdit: boolean;
  onToggle: () => void;
  onDeleteDoor: () => void;
  onDeleteReader: (reader: ReaderView) => void;
  deletingDoor: boolean;
  deletingReader: boolean;
}) {
  return (
    <>
      <TableRow className={cn(invalid && 'bg-destructive/5')}>
        <TableCell className="w-8 pr-0">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onToggle}>
            <ChevronRight className={cn('h-4 w-4 transition-transform', open && 'rotate-90')} />
          </Button>
        </TableCell>
        <TableCell>
          <DoorNameCell door={door} canEdit={canEdit} />
        </TableCell>
        <TableCell>
          <DoorOfficeCell door={door} offices={offices} canEdit={canEdit} />
        </TableCell>
        <TableCell>
          <DoorFloorCell door={door} canEdit={canEdit} />
        </TableCell>
        <TableCell>
          <ReaderTags readers={door.readers} />
        </TableCell>
        <TableCell className="text-right tabular-nums">{door.eventCount}</TableCell>
        {canEdit && (
          <TableCell>
            <Button variant="ghost" size="icon" disabled={deletingDoor} onClick={onDeleteDoor}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </TableCell>
        )}
      </TableRow>
      {open && (
        <TableRow className="hover:bg-transparent">
          <TableCell colSpan={canEdit ? 7 : 6} className="bg-muted/40 p-4">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Readers
            </p>
            {door.readers.length === 0 ? (
              <p className="text-sm text-muted-foreground">No readers on this door.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>AxTrax location</TableHead>
                    <TableHead>Panel</TableHead>
                    <TableHead className="text-right">Reader</TableHead>
                    <TableHead className="text-right">Events</TableHead>
                    <TableHead>Detection</TableHead>
                    <TableHead>Role</TableHead>
                    {canEdit && <TableHead />}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {door.readers.map((reader) => (
                    <TableRow
                      key={reader.id}
                      className={reader.valid === false ? 'bg-destructive/5' : undefined}
                    >
                      <TableCell className="max-w-xs font-mono text-xs break-all">
                        {reader.rawLocation}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{reader.panel ?? '—'}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {reader.readerNo ?? '—'}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{reader.eventCount}</TableCell>
                      <TableCell>
                        <Badge variant={reader.autoDetected ? 'secondary' : 'outline'}>
                          {reader.autoDetected ? 'Auto' : 'Manual'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <ReaderRoleCell doorId={door.id} reader={reader} canEdit={canEdit} />
                      </TableCell>
                      {canEdit && (
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            disabled={deletingReader}
                            onClick={() => onDeleteReader(reader)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </TableCell>
        </TableRow>
      )}
    </>
  );
}
