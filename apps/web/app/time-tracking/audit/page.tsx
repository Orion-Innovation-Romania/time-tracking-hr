'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { ScrollText } from 'lucide-react';
import type { AuditLogView } from '@ttah/shared';
import { api } from '@/lib/api';
import { useSession } from '@/lib/session';
import { UserGuide } from '@/components/user-guide';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface AuditResponse {
  items: AuditLogView[];
  total: number;
}

interface UserOption {
  id: number;
  username: string;
  role: string;
}

const ALL = 'all';

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

/** Pretty-print an audit before/after payload, hiding empty values. */
function renderPayload(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'object' && Object.keys(value as object).length === 0) return null;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export default function AuditPage() {
  const { data: session } = useSession();
  const isAdmin = session?.role === 'admin';
  const [userFilter, setUserFilter] = useState<string>(ALL);

  const users = useQuery<UserOption[]>({
    queryKey: ['users'],
    queryFn: () => api<UserOption[]>('/users'),
    enabled: !!isAdmin,
  });

  const scopedUserId = isAdmin && userFilter !== ALL ? Number(userFilter) : undefined;

  const audit = useQuery<AuditResponse>({
    queryKey: ['audit', scopedUserId ?? 'me'],
    queryFn: () =>
      api<AuditResponse>('/audit', { query: { limit: 300, userId: scopedUserId } }),
  });

  const items = audit.data?.items ?? [];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight">
            <ScrollText className="h-7 w-7" /> Audit log
          </h1>
          <p className="text-muted-foreground">
            {isAdmin
              ? 'Every action performed in the portal. Filter by user to focus on one person.'
              : 'A history of every action you have performed in the portal.'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <UserGuide variant="header" />
          {isAdmin && (
            <div className="w-56">
              <Select value={userFilter} onValueChange={setUserFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All users" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All users</SelectItem>
                  {users.data?.map((u) => (
                    <SelectItem key={u.id} value={String(u.id)}>
                      {u.username}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            {audit.data ? `${audit.data.total} recorded action${audit.data.total === 1 ? '' : 's'}` : 'Actions'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {audit.isLoading ? (
            <Skeleton className="h-48 w-full" />
          ) : items.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              No actions recorded yet.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-52">When</TableHead>
                  {isAdmin && <TableHead>User</TableHead>}
                  <TableHead>Action</TableHead>
                  <TableHead>Entity</TableHead>
                  <TableHead>Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((row) => {
                  const before = renderPayload(row.before);
                  const after = renderPayload(row.after);
                  return (
                    <TableRow key={row.id}>
                      <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                        {formatWhen(row.at)}
                      </TableCell>
                      {isAdmin && (
                        <TableCell className="font-medium">
                          {row.username ?? <span className="text-muted-foreground">—</span>}
                        </TableCell>
                      )}
                      <TableCell>
                        <Badge variant="secondary">{row.action}</Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {row.entity}
                        {row.entityId ? (
                          <span className="text-muted-foreground"> #{row.entityId}</span>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        {before || after ? (
                          <details className="text-xs">
                            <summary className="cursor-pointer select-none text-primary">
                              View changes
                            </summary>
                            <div className="mt-2 grid gap-2 sm:grid-cols-2">
                              {before && (
                                <div>
                                  <p className="mb-1 font-medium text-muted-foreground">Before</p>
                                  <pre className="max-h-48 overflow-auto rounded bg-muted p-2">
                                    {before}
                                  </pre>
                                </div>
                              )}
                              {after && (
                                <div>
                                  <p className="mb-1 font-medium text-muted-foreground">After</p>
                                  <pre className="max-h-48 overflow-auto rounded bg-muted p-2">
                                    {after}
                                  </pre>
                                </div>
                              )}
                            </div>
                          </details>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
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
