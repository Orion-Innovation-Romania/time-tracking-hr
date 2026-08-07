'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Download, FileSpreadsheet, Loader2, Plus, Star, Trash2 } from 'lucide-react';
import {
  EXPORT_FORMATS,
  EXPORT_KINDS,
  METRIC_KEYS,
  type ExportFormat,
  type ExportKind,
  type ExportTemplateInput,
  type MetricKey,
} from '@ttah/shared';
import { api, apiDownload } from '@/lib/api';
import { monthRange } from '@/lib/utils';
import { METRIC_LABELS } from '@/lib/labels';
import { DateRangePicker, type DateRange } from '@/components/date-range-picker';
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
  const now = new Date();
  return monthRange(now.getFullYear(), now.getMonth() + 1);
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
              <Label className="text-xs">Kind</Label>
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
                      {k}
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
              Default for this kind
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
  const [templateId, setTemplateId] = useState<string>('');
  const [kind, setKind] = useState<ExportKind>('summary');
  const [format, setFormat] = useState<ExportFormat>('xlsx');
  const [dialog, setDialog] = useState<{ initial: ExportTemplateInput; id: number | null } | null>(
    null,
  );

  const templates = useQuery({
    queryKey: ['export-templates'],
    queryFn: () => api<TemplateRecord[]>('/exports/templates'),
  });

  const generate = useMutation({
    mutationFn: () =>
      apiDownload(
        '/exports/generate',
        {
          templateId: templateId ? Number(templateId) : null,
          kind,
          format,
          filter: { from: range.from, to: range.to },
        },
        `export.${format}`,
      ),
    onSuccess: () => toast({ title: 'Export downloaded', variant: 'success' }),
    onError: () => toast({ title: 'Export failed', variant: 'error' }),
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
          <CardDescription>Pick a range and template, then download.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <DateRangePicker value={range} onChange={setRange} />
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Template</Label>
              <Select value={templateId} onValueChange={setTemplateId}>
                <SelectTrigger>
                  <SelectValue placeholder="None (default layout)" />
                </SelectTrigger>
                <SelectContent>
                  {templates.data?.map((t) => (
                    <SelectItem key={t.id} value={String(t.id)}>
                      {t.name} ({t.kind})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Kind</Label>
              <Select value={kind} onValueChange={(v) => setKind(v as ExportKind)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EXPORT_KINDS.map((k) => (
                    <SelectItem key={k} value={k}>
                      {k}
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
          <Button onClick={() => generate.mutate()} disabled={generate.isPending}>
            {generate.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            Download export
          </Button>
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
                      <Badge variant="secondary">{t.kind}</Badge>
                      {t.kind === 'summary' && (
                        <Badge variant="outline">{t.layout.columns.length} columns</Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
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
                      Edit
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
