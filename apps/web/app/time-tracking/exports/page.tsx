'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Download, FileSpreadsheet, Loader2, Pencil, Plus, Star, Trash2, TriangleAlert } from 'lucide-react';
import {
  EXPORT_FORMATS,
  EXPORT_KINDS,
  METRIC_KEYS,
  type ExportAvailability,
  type ExportFormat,
  type ExportKind,
  type ExportTemplateInput,
  type MailReportPolicy,
  type MetricKey,
} from '@ttah/shared';
import { api, apiDownload, ApiRequestError } from '@/lib/api';
import { currentMonthRange } from '@/lib/utils';
import { METRIC_LABELS, KIND_LABELS } from '@/lib/labels';
import { useEmployees } from '@/lib/hooks';
import { DateRangePicker, isIsoDate, type DateRange } from '@/components/date-range-picker';
import { EmployeePicker } from '@/components/employee-picker';
import { useToast } from '@/components/ui/toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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

interface TemplateRecord {
  id: number;
  name: string;
  kind: ExportKind;
  isDefault: boolean;
  layout: {
    title?: string;
    columns: { key: MetricKey; header: string }[];
    includeTotals: boolean;
    matrixMetric: 'workedHours' | 'workedMinutes';
  };
}

function defaultRange(): DateRange {
  return currentMonthRange();
}

function builtinValue(kind: ExportKind) {
  return `builtin:${kind}`;
}

function parseTemplateSelection(value: string): { templateId: number | null; kind: ExportKind } {
  if (value.startsWith('builtin:')) {
    const kind = value.slice('builtin:'.length) as ExportKind;
    return { templateId: null, kind: EXPORT_KINDS.includes(kind) ? kind : 'summary' };
  }
  const id = Number(value);
  return { templateId: Number.isFinite(id) ? id : null, kind: 'summary' };
}

function emptyTemplate(): ExportTemplateInput {
  return {
    name: '',
    kind: 'summary',
    isDefault: false,
    layout: {
      title: '',
      columns: [
        { key: 'employeeName', header: 'Employee' },
        { key: 'daysPresent', header: 'Days' },
        { key: 'workedHours', header: 'Worked (h)' },
      ],
      includeTotals: true,
      matrixMetric: 'workedHours',
    },
  };
}

function TemplateDialog({
  initial,
  editingId,
  onClose,
}: {
  initial: ExportTemplateInput;
  editingId: number | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [tpl, setTpl] = useState<ExportTemplateInput>(initial);

  const save = useMutation({
    mutationFn: () =>
      editingId
        ? api(`/exports/templates/${editingId}`, { method: 'PUT', body: tpl })
        : api('/exports/templates', { method: 'POST', body: tpl }),
    onSuccess: () => {
      toast({ title: 'Template saved', variant: 'success' });
      queryClient.invalidateQueries({ queryKey: ['export-templates'] });
      onClose();
    },
    onError: () => toast({ title: 'Could not save template', variant: 'error' }),
  });

  const toggleColumn = (key: MetricKey) => {
    setTpl((prev) => {
      const exists = prev.layout.columns.some((c) => c.key === key);
      const columns = exists
        ? prev.layout.columns.filter((c) => c.key !== key)
        : [...prev.layout.columns, { key, header: METRIC_LABELS[key] }];
      return { ...prev, layout: { ...prev.layout, columns } };
    });
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{editingId ? 'Edit template' : 'New template'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Name</Label>
              <Input
                value={tpl.name}
                onChange={(e) => setTpl({ ...tpl, name: e.target.value })}
                placeholder="Monthly summary"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Type</Label>
              <Select
                value={tpl.kind}
                onValueChange={(v) => setTpl({ ...tpl, kind: v as ExportKind })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EXPORT_KINDS.map((k) => (
                    <SelectItem key={k} value={k}>
                      {KIND_LABELS[k]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Sheet title (optional)</Label>
            <Input
              value={tpl.layout.title ?? ''}
              onChange={(e) =>
                setTpl({ ...tpl, layout: { ...tpl.layout, title: e.target.value } })
              }
            />
          </div>

          {tpl.kind === 'summary' && (
            <div>
              <Label className="text-xs">Columns</Label>
              <div className="mt-2 flex flex-wrap gap-2">
                {METRIC_KEYS.map((key) => {
                  const on = tpl.layout.columns.some((c) => c.key === key);
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => toggleColumn(key)}
                      className={`rounded-md border px-3 py-1 text-xs font-medium transition-colors ${
                        on ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-accent'
                      }`}
                    >
                      {METRIC_LABELS[key]}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {tpl.kind === 'pontaj' && (
            <div className="space-y-1.5">
              <Label className="text-xs">Matrix cell metric</Label>
              <Select
                value={tpl.layout.matrixMetric}
                onValueChange={(v) =>
                  setTpl({
                    ...tpl,
                    layout: { ...tpl.layout, matrixMetric: v as 'workedHours' | 'workedMinutes' },
                  })
                }
              >
                <SelectTrigger className="w-56">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="workedHours">Worked hours</SelectItem>
                  <SelectItem value="workedMinutes">Worked minutes</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={tpl.layout.includeTotals}
                onChange={(e) =>
                  setTpl({
                    ...tpl,
                    layout: { ...tpl.layout, includeTotals: e.target.checked },
                  })
                }
              />
              Include totals row
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={tpl.isDefault}
                onChange={(e) => setTpl({ ...tpl, isDefault: e.target.checked })}
              />
              Default for this layout
            </label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => save.mutate()}
            disabled={save.isPending || !tpl.name.trim()}
          >
            {save.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Save template
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function ExportsPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [range, setRange] = useState<DateRange>(defaultRange);
  const [templateSelection, setTemplateSelection] = useState(builtinValue('summary'));
  const [format, setFormat] = useState<ExportFormat>('xlsx');
  const [employeeIds, setEmployeeIds] = useState<number[]>([]);
  const [dialog, setDialog] = useState<{ initial: ExportTemplateInput; id: number | null } | null>(
    null,
  );

  const templates = useQuery({
    queryKey: ['export-templates'],
    queryFn: () => api<TemplateRecord[]>('/exports/templates'),
  });

  const employees = useEmployees(true);

  const mailPolicy = useQuery({
    queryKey: ['mail', 'report-policy'],
    queryFn: () => api<MailReportPolicy>('/mail/report-policy'),
  });

  const exportFilter = {
    from: range.from,
    to: range.to,
    ...(employeeIds.length ? { employeeIds: [...employeeIds].sort((a, b) => a - b) } : {}),
  };

  const availability = useQuery({
    queryKey: ['export-availability', range.from, range.to, employeeIds.slice().sort((a, b) => a - b).join(',')],
    queryFn: ({ signal }) =>
      api<ExportAvailability>('/exports/availability', {
        method: 'POST',
        body: { filter: exportFilter },
        signal,
      }),
    enabled: isIsoDate(range.from) && isIsoDate(range.to),
    placeholderData: (prev) => prev,
  });

  const noData = availability.data?.hasData === false;
  const exportBlocked = noData || availability.isFetching;

  const generate = useMutation({
    mutationFn: () => {
      const { templateId, kind } = parseTemplateSelection(templateSelection);
      const saved = templateId
        ? templates.data?.find((t) => t.id === templateId)
        : undefined;
      return apiDownload(
        '/exports/generate',
        {
          templateId,
          kind: saved?.kind ?? kind,
          format,
          filter: exportFilter,
        },
        `export.${format}`,
      );
    },
    onSuccess: (result) => {
      if (result.emailed === 'sent') {
        toast({
          title: 'Export downloaded and emailed',
          description: result.emailTo ? `Sent to ${result.emailTo}` : undefined,
          variant: 'success',
        });
        return;
      }
      if (result.emailed === 'failed') {
        toast({
          title: 'Export downloaded, email failed',
          description: result.emailError ?? 'Could not send the report by email.',
          variant: 'error',
        });
        return;
      }
      toast({ title: 'Export downloaded', variant: 'success' });
    },
    onError: (err) =>
      toast({
        title: 'Export failed',
        description: err instanceof ApiRequestError ? err.message : 'Unknown error',
        variant: 'error',
      }),
  });

  const remove = useMutation({
    mutationFn: (id: number) => api(`/exports/templates/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast({ title: 'Template deleted', variant: 'success' });
      queryClient.invalidateQueries({ queryKey: ['export-templates'] });
    },
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight">
          <FileSpreadsheet className="h-7 w-7" /> Exports
        </h1>
        <p className="text-muted-foreground">Generate timesheets and configure export templates.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Generate export</CardTitle>
          <CardDescription>Pick a month, people and template, then download.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <DateRangePicker value={range} onChange={setRange} />
          {employees.isLoading ? (
            <Skeleton className="h-48 w-full" />
          ) : (
            <EmployeePicker
              employees={employees.data ?? []}
              selectedIds={employeeIds}
              onChange={setEmployeeIds}
            />
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Template</Label>
              <Select value={templateSelection} onValueChange={setTemplateSelection}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EXPORT_KINDS.map((k) => (
                    <SelectItem key={builtinValue(k)} value={builtinValue(k)}>
                      {KIND_LABELS[k]} (built-in)
                    </SelectItem>
                  ))}
                  {templates.data?.map((t) => (
                    <SelectItem key={t.id} value={String(t.id)}>
                      {t.name} · {KIND_LABELS[t.kind]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Format</Label>
              <Select value={format} onValueChange={(v) => setFormat(v as ExportFormat)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EXPORT_FORMATS.map((f) => (
                    <SelectItem key={f} value={f}>
                      {f}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {noData && (
            <div className="flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950">
              <TriangleAlert className="h-4 w-4 shrink-0" />
              No data in this month.
            </div>
          )}
          {mailPolicy.data?.sendByDefault && mailPolicy.data.canSend && !noData && (
            <p className="text-sm text-muted-foreground">
              A copy will be emailed to {mailPolicy.data.recipient}.
            </p>
          )}
          <span
            className="inline-flex"
            title={noData ? 'No data in this month' : undefined}
          >
            <Button
              onClick={() => generate.mutate()}
              disabled={generate.isPending || exportBlocked}
            >
              {generate.isPending || availability.isFetching ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              Download export
            </Button>
          </span>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle>Templates</CardTitle>
          <Button
            size="sm"
            onClick={() => setDialog({ initial: emptyTemplate(), id: null })}
          >
            <Plus className="h-4 w-4" /> New template
          </Button>
        </CardHeader>
        <CardContent>
          {templates.isLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : (templates.data?.length ?? 0) === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No templates yet.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {templates.data?.map((t) => (
                <div
                  key={t.id}
                  className="flex items-start justify-between rounded-lg border p-4"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{t.name}</p>
                      {t.isDefault && (
                        <Star className="h-4 w-4 fill-warning text-warning" />
                      )}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      <Badge variant="secondary">{KIND_LABELS[t.kind]}</Badge>
                      {t.kind === 'summary' && (
                        <Badge variant="outline">{t.layout.columns.length} columns</Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() =>
                        setDialog({
                          id: t.id,
                          initial: {
                            name: t.name,
                            kind: t.kind,
                            isDefault: t.isDefault,
                            layout: {
                              title: t.layout.title ?? '',
                              columns: t.layout.columns,
                              includeTotals: t.layout.includeTotals,
                              matrixMetric: t.layout.matrixMetric,
                            },
                          },
                        })
                      }
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => remove.mutate(t.id)}
                      disabled={remove.isPending}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {dialog && (
        <TemplateDialog
          initial={dialog.initial}
          editingId={dialog.id}
          onClose={() => setDialog(null)}
        />
      )}
    </div>
  );
}
