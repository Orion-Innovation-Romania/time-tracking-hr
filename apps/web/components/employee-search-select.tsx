'use client';

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { Search, Users, X } from 'lucide-react';
import type { EmployeeView } from '@ttah/shared';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export function EmployeeSearchSelect({
  employees,
  selectedIds,
  onChange,
  placeholder = 'Search to compare people…',
  selectedBadge,
}: {
  employees: EmployeeView[];
  selectedIds: number[];
  onChange: (ids: number[]) => void;
  placeholder?: string;
  selectedBadge?: (count: number) => string;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = useMemo(() => new Set(selectedIds), [selectedIds]);
  const selectedPeople = useMemo(
    () => selectedIds.map((id) => employees.find((e) => e.id === id)).filter(Boolean) as EmployeeView[],
    [employees, selectedIds],
  );

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    const pool = employees.filter((e) => !selected.has(e.id) && e.active);
    if (!q) return pool.slice(0, 30);
    return pool
      .filter((e) => {
        const hay = `${e.displayName} ${e.canonicalName} ${e.departments.join(' ')}`.toLowerCase();
        return hay.includes(q);
      })
      .slice(0, 40);
  }, [employees, query, selected]);

  useEffect(() => {
    setActive(0);
  }, [query, open]);

  useEffect(() => {
    function onDoc(ev: MouseEvent) {
      if (!rootRef.current?.contains(ev.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  function add(id: number) {
    if (selected.has(id)) return;
    onChange([...selectedIds, id]);
    setQuery('');
    setOpen(true);
    inputRef.current?.focus();
  }

  function remove(id: number) {
    onChange(selectedIds.filter((x) => x !== id));
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setActive((i) => Math.min(i + 1, Math.max(matches.length - 1, 0)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && open && matches[active]) {
      e.preventDefault();
      add(matches[active].id);
    } else if (e.key === 'Backspace' && !query && selectedIds.length) {
      remove(selectedIds[selectedIds.length - 1]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  const everyone = selectedIds.length === 0;
  const badgeText = everyone
    ? 'All employees'
    : (selectedBadge ?? ((n) => `Comparing ${n}`))(selectedIds.length);

  return (
    <div ref={rootRef} className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={everyone ? 'default' : 'secondary'} className="gap-1">
          <Users className="h-3 w-3" />
          {badgeText}
        </Badge>
        {!everyone && (
          <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => onChange([])}>
            Back to everyone
          </Button>
        )}
      </div>

      <div
        className={cn(
          'flex min-h-11 flex-wrap items-center gap-1.5 rounded-lg border bg-card px-2 py-1.5 transition-shadow',
          open && 'ring-2 ring-ring',
        )}
        onClick={() => inputRef.current?.focus()}
      >
        {selectedPeople.map((e) => (
          <span
            key={e.id}
            className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-sm text-primary"
          >
            {e.displayName}
            <button
              type="button"
              className="rounded-full p-0.5 hover:bg-primary/15"
              onClick={(ev) => {
                ev.stopPropagation();
                remove(e.id);
              }}
              aria-label={`Remove ${e.displayName}`}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <div className="relative min-w-[12rem] flex-1">
          <Search className="pointer-events-none absolute left-1 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={onKeyDown}
            placeholder={everyone ? placeholder : 'Add another…'}
            className="h-8 w-full bg-transparent pl-7 pr-2 text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
      </div>

      {open && (
        <div className="relative z-50">
          <ul className="thin-scrollbar absolute inset-x-0 top-1 max-h-72 overflow-y-auto rounded-lg border bg-card py-1 shadow-lg">
            {matches.length === 0 ? (
              <li className="px-3 py-6 text-center text-sm text-muted-foreground">No matching people.</li>
            ) : (
              matches.map((e, i) => (
                <li key={e.id}>
                  <button
                    type="button"
                    className={cn(
                      'flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-accent',
                      i === active && 'bg-accent',
                    )}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => add(e.id)}
                  >
                    <span className="font-medium">{e.displayName}</span>
                    <span className="truncate text-xs text-muted-foreground">
                      {e.departments.join(', ') || '—'}
                    </span>
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
