'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import {
  CheckCircle2,
  FileText,
  Loader2,
  Trash2,
  TriangleAlert,
  Upload,
  UserCheck,
} from 'lucide-react';
import type {
  EmployeeView,
  ImportBatchView,
  ImportPreview,
  ImportResult,
} from '@ttah/shared';
import { api, apiUpload, ApiRequestError } from '@/lib/api';
import { formatClock, formatDate } from '@/lib/utils';
import { useEmployees } from '@/lib/hooks';
import { useToast } from '@/components/ui/toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
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

export default function ImportPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const fileInput = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [overrideEmployee, setOverrideEmployee] = useState<string>('');
  const [manualName, setManualName] = useState<string>('');

  const employees = useEmployees();
  const batches = useQuery({
    queryKey: ['import-batches'],
    queryFn: () => api<ImportBatchView[]>('/imports'),
  });

  const previewMutation = useMutation({
    mutationFn: (file: File) => {
      const form = new FormData();
      form.append('file', file);
      return apiUpload<ImportPreview>('/imports/preview', form);
    },
    onSuccess: (data) => {
      setPreview(data);
      setOverrideEmployee(data.matchedEmployeeId ? String(data.matchedEmployeeId) : '');
      setManualName(data.rawUserName ?? '');
    },
    onError: (err) =>
      toast({
        title: 'Preview failed',
        description: err instanceof ApiRequestError ? err.message : 'Could not parse file.',
        variant: 'error',
      }),
  });

  const commitMutation = useMutation({
    mutationFn: () =>
      api<ImportResult>('/imports/commit', {
        method: 'POST',
        body: {
          previewId: preview!.previewId,
          employeeId: overrideEmployee ? Number(overrideEmployee) : null,
          employeeName: overrideEmployee ? null : manualName.trim() || null,
        },
      }),
    onSuccess: (result) => {
      toast({
        title: 'Import committed',
        description: `${result.rowsNew} new rows, ${result.rowsDuplicate} duplicates.`,
        variant: 'success',
      });
      setPreview(null);
      queryClient.invalidateQueries({ queryKey: ['import-batches'] });
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['summaries'] });
    },
    onError: (err) =>
      toast({
        title: 'Commit failed',
        description: err instanceof ApiRequestError ? err.message : 'Could not commit import.',
        variant: 'error',
      }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api(`/imports/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast({ title: 'Batch deleted', variant: 'success' });
      queryClient.invalidateQueries({ queryKey: ['import-batches'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['summaries'] });
    },
  });

  const employeeName = (id: number | null) =>
    employees.data?.find((e: EmployeeView) => e.id === id)?.displayName;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Import access report</h1>
        <p className="text-muted-foreground">
          Upload an AxTraxNG PDF.
        </p>
      </div>

      <Card
        className="border-dashed"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const file = e.dataTransfer.files?.[0];
          if (file) previewMutation.mutate(file);
        }}
      >
        <CardContent className="flex flex-col items-center justify-center gap-3 py-12 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Upload className="h-7 w-7" />
          </div>
          <p className="text-sm text-muted-foreground">
            Drag &amp; drop a PDF here, or
          </p>
          <input
            ref={fileInput}
            type="file"
            accept="application/pdf,.pdf"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) previewMutation.mutate(file);
              e.target.value = '';
            }}
          />
          <Button onClick={() => fileInput.current?.click()} disabled={previewMutation.isPending}>
            {previewMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileText className="h-4 w-4" />
            )}
            Choose PDF
          </Button>
        </CardContent>
      </Card>

      {preview && (
        <Card className="animate-fade-in">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserCheck className="h-5 w-5" /> Preview: {preview.fileName}
            </CardTitle>
            <CardDescription>
              {preview.rawUserName ? (
                <>
                  Detected user <strong>{preview.rawUserName}</strong>
                </>
              ) : (
                'No employee name detected in the report header'
              )}
              {preview.department ? ` · ${preview.department}` : ''}
              {preview.rangeFrom && preview.rangeTo
                ? ` · ${formatDate(preview.rangeFrom.slice(0, 10))} → ${formatDate(
                    preview.rangeTo.slice(0, 10),
                  )}`
                : ''}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-lg border p-4">
                <p className="text-xs text-muted-foreground">Rows parsed</p>
                <p className="text-2xl font-bold">
                  {preview.rowsParsed}
                  <span className="text-base font-normal text-muted-foreground">
                    /{preview.rowsTotal}
                  </span>
                </p>
              </div>
              <div className="rounded-lg border p-4">
                <p className="text-xs text-muted-foreground">New readers</p>
                <p className="text-2xl font-bold">{preview.newDoors.length}</p>
              </div>
              <div className="rounded-lg border p-4">
                <p className="text-xs text-muted-foreground">Status</p>
                {preview.duplicateOfBatchId ? (
                  <Badge variant="warning">Already imported</Badge>
                ) : (
                  <Badge variant="success">Ready</Badge>
                )}
              </div>
            </div>

            {preview.warnings.length > 0 && (
              <div className="rounded-lg border border-warning/40 bg-warning/10 p-4">
                <p className="mb-1 flex items-center gap-2 text-sm font-medium">
                  <TriangleAlert className="h-4 w-4" /> Warnings
                </p>
                <ul className="list-inside list-disc text-sm text-muted-foreground">
                  {preview.warnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="max-w-md space-y-2">
              <label className="text-sm font-medium">Assign to employee</label>
              <Select value={overrideEmployee} onValueChange={setOverrideEmployee}>
                <SelectTrigger>
                  <SelectValue placeholder="Auto-create from report name" />
                </SelectTrigger>
                <SelectContent>
                  {employees.data?.map((e: EmployeeView) => (
                    <SelectItem key={e.id} value={String(e.id)}>
                      {e.displayName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {preview.matchedEmployeeId
                  ? `Matched existing employee${
                      employeeName(preview.matchedEmployeeId)
                        ? `: ${employeeName(preview.matchedEmployeeId)}`
                        : ''
                    }.`
                  : 'No match found — pick an existing employee above, or type a name below to create a new one.'}
              </p>
            </div>

            {!overrideEmployee && (
              <div className="max-w-md space-y-2">
                <label className="text-sm font-medium">
                  New employee name{' '}
                  {!preview.rawUserName && <span className="text-destructive">*</span>}
                </label>
                <Input
                  value={manualName}
                  onChange={(e) => setManualName(e.target.value)}
                  placeholder="e.g. Popescu, Ion"
                />
                <p className="text-xs text-muted-foreground">
                  {preview.rawUserName
                    ? 'Pre-filled from the report. Edit it if it looks wrong.'
                    : "The report header didn't contain a usable name — enter one manually."}
                </p>
              </div>
            )}

            {preview.newDoors.length > 0 && (
              <div>
                <p className="mb-2 text-sm font-medium">Newly discovered readers</p>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Door</TableHead>
                      <TableHead>Floor</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>AxTrax location</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.newDoors.map((d) => (
                      <TableRow key={d.rawLocation}>
                        <TableCell className="font-medium">{d.suggestedName}</TableCell>
                        <TableCell>{d.floor ?? '—'}</TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              d.suggestedRole === 'IN'
                                ? 'success'
                                : d.suggestedRole === 'OUT'
                                  ? 'warning'
                                  : 'secondary'
                            }
                          >
                            {d.suggestedRole === 'IN'
                              ? 'Entry'
                              : d.suggestedRole === 'OUT'
                                ? 'Exit'
                                : 'Neutral'}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs">{d.rawLocation}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setPreview(null)}>
                Cancel
              </Button>
              <Button
                onClick={() => commitMutation.mutate()}
                disabled={
                  commitMutation.isPending ||
                  !!preview.duplicateOfBatchId ||
                  (!overrideEmployee && !manualName.trim())
                }
              >
                {commitMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                Commit import
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Import history</CardTitle>
        </CardHeader>
        <CardContent>
          {batches.isLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : (batches.data?.length ?? 0) === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No imports yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>File</TableHead>
                  <TableHead>Employee</TableHead>
                  <TableHead>Range</TableHead>
                  <TableHead className="text-right">New</TableHead>
                  <TableHead className="text-right">Dup</TableHead>
                  <TableHead>Imported</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {batches.data?.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell className="max-w-[200px] truncate font-medium">
                      {b.fileName}
                    </TableCell>
                    <TableCell>{b.employeeName}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {b.rangeFrom && b.rangeTo
                        ? `${formatDate(b.rangeFrom.slice(0, 10))} → ${formatDate(
                            b.rangeTo.slice(0, 10),
                          )}`
                        : '—'}
                    </TableCell>
                    <TableCell className="text-right">{b.rowsNew}</TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {b.rowsDuplicate}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(b.createdAt.slice(0, 10))} {formatClock(b.createdAt)}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteMutation.mutate(b.id)}
                        disabled={deleteMutation.isPending}
                      >
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
    </div>
  );
}
