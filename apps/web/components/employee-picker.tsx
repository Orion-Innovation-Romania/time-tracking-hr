'use client';

import { useMemo, useState } from 'react';
import { ChevronDown, Search, X } from 'lucide-react';
import type { EmployeeView } from '@ttah/shared';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export function EmployeePicker({
  employees,
  selectedIds,
  onChange,
}: {
  employees: EmployeeView[];
  selectedIds: number[];
  onChange: (ids: number[]) => void;
}) {
  const [query, setQuery] = useState('');
  const [department, setDepartment] = useState('all');
  const [activeOnly, setActiveOnly] = useState(true);
  const [listOpen, setListOpen] = useState(false);

  const selected = useMemo(() => new Set(selectedIds), [selectedIds]);
  const departments = useMemo(() => {
    const set = new Set<string>();
    for (const e of employees) for (const d of e.departments) set.add(d);
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [employees]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return employees.filter((e) => {
      if (activeOnly && !e.active) return false;
      if (department !== 'all' && !e.departments.includes(department)) return false;
      if (!q) return true;
      const hay = `${e.displayName} ${e.canonicalName} ${e.departments.join(' ')}`.toLowerCase();
      return hay.includes(q);
    });
  }, [employees, query, department, activeOnly]);

  const selectedPeople = useMemo(
    () => employees.filter((e) => selected.has(e.id)),
    [employees, selected],
  );

  const allVisibleSelected =
    filtered.length > 0 && filtered.every((e) => selected.has(e.id));
  const someVisibleSelected = filtered.some((e) => selected.has(e.id));

  function toggle(id: number) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange([...next]);
  }

  function selectVisible() {
    const next = new Set(selected);
    for (const e of filtered) next.add(e.id);
    onChange([...next]);
  }

  function clearVisible() {
    const visible = new Set(filtered.map((e) => e.id));
    onChange(selectedIds.filter((id) => !visible.has(id)));
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-xs font-medium text-muted-foreground">Employees</p>
          <p className="text-sm">
            {selectedIds.length === 0 ? (
              <span className="text-muted-foreground">
                None selected — export includes <span className="font-medium text-foreground">everyone</span>
              </span>
            ) : (
              <span>
                <span className="font-medium">{selectedIds.length}</span> selected
                <span className="text-muted-foreground"> of {employees.length}</span>
              </span>
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={selectVisible} disabled={filtered.length === 0}>
            Select visible ({filtered.length})
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onChange([])}
            disabled={selectedIds.length === 0}
          >
            Clear all
          </Button>
        </div>
      </div>

      {selectedPeople.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedPeople.slice(0, 8).map((e) => (
            <Badge key={e.id} variant="secondary" className="gap-1 pr-1">
              {e.displayName}
              <button
                type="button"
                className="rounded-full p-0.5 hover:bg-background/80"
                onClick={() => toggle(e.id)}
                aria-label={`Remove ${e.displayName}`}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
          {selectedPeople.length > 8 && (
            <Badge variant="outline">+{selectedPeople.length - 8} more</Badge>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-[16rem] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name or department…"
            className="pl-9"
          />
        </div>
        <select
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          value={department}
          onChange={(e) => setDepartment(e.target.value)}
        >
          <option value="all">All departments</option>
          {departments.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
        <label className="flex h-10 items-center gap-2 rounded-md border border-input px-3 text-sm">
          <input
            type="checkbox"
            className="h-4 w-4 accent-primary"
            checked={activeOnly}
            onChange={(e) => setActiveOnly(e.target.checked)}
          />
          Active only
        </label>
      </div>

      <div className="overflow-hidden rounded-lg border">
        <div
          className={cn(
            'flex items-center gap-3 bg-muted/40 px-3 py-2 text-xs text-muted-foreground',
            listOpen && 'border-b',
          )}
        >
          <input
            type="checkbox"
            className="h-4 w-4 accent-primary"
            checked={allVisibleSelected}
            ref={(el) => {
              if (el) el.indeterminate = someVisibleSelected && !allVisibleSelected;
            }}
            onChange={() => (allVisibleSelected ? clearVisible() : selectVisible())}
            aria-label="Select all visible"
          />
          <button
            type="button"
            className="flex min-w-0 flex-1 items-center gap-2 text-left"
            aria-expanded={listOpen}
            onClick={() => setListOpen((open) => !open)}
          >
            <span className="flex-1">
              {filtered.length} shown
              {query || department !== 'all' ? ' (filtered)' : ''}
            </span>
            <ChevronDown
              className={cn('h-4 w-4 shrink-0 transition-transform', listOpen && 'rotate-180')}
            />
          </button>
        </div>
        {listOpen ? (
          <ul className="thin-scrollbar max-h-72 overflow-y-auto">
            {filtered.length === 0 ? (
              <li className="px-3 py-8 text-center text-sm text-muted-foreground">No matching employees.</li>
            ) : (
              filtered.map((e) => {
                const on = selected.has(e.id);
                return (
                  <li key={e.id}>
                    <label
                      className={cn(
                        'flex cursor-pointer items-center gap-3 px-3 py-2 text-sm hover:bg-accent/60',
                        on && 'bg-primary/5',
                      )}
                    >
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-primary"
                        checked={on}
                        onChange={() => toggle(e.id)}
                      />
                      <span className="min-w-0 flex-1 truncate font-medium">{e.displayName}</span>
                      <span className="hidden truncate text-xs text-muted-foreground sm:block">
                        {e.departments.join(', ') || '—'}
                      </span>
                      {!e.active && (
                        <Badge variant="outline" className="shrink-0 text-[10px]">
                          inactive
                        </Badge>
                      )}
                    </label>
                  </li>
                );
              })
            )}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
