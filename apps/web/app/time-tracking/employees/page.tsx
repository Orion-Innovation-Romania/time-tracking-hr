'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Loader2, Pencil, Search, Trash2, Users } from 'lucide-react';
import type { EmployeeView } from '@ttah/shared';
import { api } from '@/lib/api';
import { useEmployees } from '@/lib/hooks';
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

const WEEKDAYS = [
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
  { value: 7, label: 'Sun' },
];

interface ScheduleRecord {
  employeeId: number;
  startTime: string | null;
  endTime: string | null;
  workingDays: number[] | null;
}

function EmployeeDialog({
  employee,
  onClose,
}: {
  employee: EmployeeView;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [displayName, setDisplayName] = useState(employee.displayName);
  const [active, setActive] = useState(employee.active);

  const schedule = useQuery({
    queryKey: ['schedule', employee.id],
    queryFn: () => api<ScheduleRecord | null>(`/employees/${employee.id}/schedule`),
  });

  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [days, setDays] = useState<number[]>([]);
  const [loadedFor, setLoadedFor] = useState<number | null>(null);

  if (schedule.data !== undefined && loadedFor !== employee.id) {
    setStartTime(schedule.data?.startTime ?? '');
    setEndTime(schedule.data?.endTime ?? '');
    setDays(schedule.data?.workingDays ?? []);
    setLoadedFor(employee.id);
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      await api(`/employees/${employee.id}`, {
        method: 'PATCH',
        body: { displayName, active },
      });
      await api(`/employees/${employee.id}/schedule`, {
        method: 'PUT',
        body: {
          startTime: startTime || null,
          endTime: endTime || null,
          workingDays: days.length ? days : null,
        },
      });
    },
    onSuccess: () => {
      toast({ title: 'Employee updated', variant: 'success' });
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      queryClient.invalidateQueries({ queryKey: ['schedule', employee.id] });
      onClose();
    },
    onError: () => toast({ title: 'Update failed', variant: 'error' }),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit employee</DialogTitle>
          <DialogDescription>
            Canonical name: {employee.canonicalName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="displayName">Display name</Label>
            <Input
              id="displayName"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
              className="h-4 w-4"
            />
            Active
          </label>

          <div className="border-t pt-4">
            <p className="mb-2 text-sm font-medium">Schedule override</p>
            <p className="mb-3 text-xs text-muted-foreground">
              Leave fields empty to use the global default schedule.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="start" className="text-xs">
                  Start time
                </Label>
                <Input
                  id="start"
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="end" className="text-xs">
                  End time
                </Label>
                <Input
                  id="end"
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                />
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {WEEKDAYS.map((d) => {
                const on = days.includes(d.value);
                return (
                  <button
                    key={d.value}
                    type="button"
                    onClick={() =>
                      setDays((prev) =>
                        on ? prev.filter((x) => x !== d.value) : [...prev, d.value].sort(),
                      )
                    }
                    className={`rounded-md border px-3 py-1 text-xs font-medium transition-colors ${
                      on
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'hover:bg-accent'
                    }`}
                  >
                    {d.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            {saveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function EmployeesPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const employees = useEmployees();
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<EmployeeView | null>(null);
  const [confirmEmployee, setConfirmEmployee] = useState<EmployeeView | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const remove = useMutation({
    mutationFn: (id: number) => api(`/employees/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast({ title: 'Employee deleted', variant: 'success' });
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      queryClient.invalidateQueries({ queryKey: ['summaries'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: () => toast({ title: 'Could not delete employee', variant: 'error' }),
  });

  const filtered = useMemo(() => {
    const list = employees.data ?? [];
    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter(
      (e) =>
        e.displayName.toLowerCase().includes(q) ||
        e.departments.some((d) => d.toLowerCase().includes(q)),
    );
  }, [employees.data, search]);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight">
            <Users className="h-7 w-7" /> Employees
          </h1>
          <p className="text-muted-foreground">
            Manage display names and work schedules. Delete removes the person and all their hours.
          </p>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="w-64 pl-9"
            placeholder="Search employees…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{filtered.length} employees</CardTitle>
        </CardHeader>
        <CardContent>
          {employees.isLoading ? (
            <Skeleton className="h-48 w-full" />
          ) : filtered.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No employees found.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Departments</TableHead>
                  <TableHead>Aliases</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="font-medium">{e.displayName}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {e.departments.length === 0 ? (
                          <span className="text-muted-foreground">—</span>
                        ) : (
                          e.departments.map((d) => (
                            <Badge key={d} variant="secondary">
                              {d}
                            </Badge>
                          ))
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {e.aliases?.length ? e.aliases.join(', ') : '—'}
                    </TableCell>
                    <TableCell>
                      {e.active ? (
                        <Badge variant="success">Active</Badge>
                      ) : (
                        <Badge variant="secondary">Inactive</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => setEditing(e)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          disabled={remove.isPending}
                          onClick={() => {
                            setConfirmEmployee(e);
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

      {editing && <EmployeeDialog employee={editing} onClose={() => setEditing(null)} />}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete employee</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {confirmEmployee?.displayName}? This removes their badge events, hours and leaves. A later import with the same name will recreate them.
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
                if (confirmEmployee) remove.mutate(confirmEmployee.id);
                setConfirmOpen(false);
              }}
              disabled={remove.isPending}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
