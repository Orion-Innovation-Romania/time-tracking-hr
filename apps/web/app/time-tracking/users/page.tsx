'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { KeyRound, Loader2, Plus, Shield, Trash2, UserRound } from 'lucide-react';
import type { Role, UserAccountView } from '@ttah/shared';
import { api, ApiRequestError } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { useSession } from '@/lib/session';
import { useToast } from '@/components/ui/toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from '@/components/ui/dialog';
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

function formatWhen(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return formatDate(iso.slice(0, 10));
  }
}

export default function UsersAdminPage() {
  const router = useRouter();
  const { data: session, isLoading: sessionLoading } = useSession();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [username, setUsername] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('user');
  const [initialPassword, setInitialPassword] = useState('');
  const [editing, setEditing] = useState<UserAccountView | null>(null);
  const [confirmResetUser, setConfirmResetUser] = useState<UserAccountView | null>(null);
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);
  const [confirmDeleteUser, setConfirmDeleteUser] = useState<UserAccountView | null>(null);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [setInitialUser, setSetInitialUser] = useState<UserAccountView | null>(null);
  const [setInitialOpen, setSetInitialOpen] = useState(false);
  const [setInitialPwd, setSetInitialPwd] = useState('');
  const [editFirstName, setEditFirstName] = useState('');
  const [editLastName, setEditLastName] = useState('');
  const [editEmail, setEditEmail] = useState('');

  useEffect(() => {
    if (!sessionLoading && session && session.role !== 'admin') {
      router.replace('/time-tracking/dashboard');
    }
  }, [session, sessionLoading, router]);

  const users = useQuery({
    queryKey: ['users'],
    queryFn: () => api<UserAccountView[]>('/users'),
    enabled: session?.role === 'admin',
  });

  const create = useMutation({
    mutationFn: () =>
      api<UserAccountView>('/users', {
        method: 'POST',
        body: { username, firstName, lastName, email, role, initialPassword },
      }),
    onSuccess: (user) => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setUsername('');
      setFirstName('');
      setLastName('');
      setEmail('');
      setInitialPassword('');
      setRole('user');
      toast({
        title: 'User created',
        description: `${user.username} must change password on first login.`,
      });
    },
    onError: (err) => {
      toast({
        title: 'Create failed',
        description: err instanceof ApiRequestError ? err.message : 'Unknown error',
        variant: 'error',
      });
    },
  });

  const resetPassword = useMutation({
    mutationFn: (id: number) =>
      api<{ ok: true }>(`/users/${id}/reset-password`, { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast({
        title: 'Password reset',
        description: 'User must sign in with the initial password and set a new one.',
      });
    },
    onError: (err) => {
      toast({
        title: 'Reset failed',
        description: err instanceof ApiRequestError ? err.message : 'Unknown error',
        variant: 'error',
      });
    },
  });

  const saveProfile = useMutation({
    mutationFn: () =>
      api<UserAccountView>(`/users/${editing!.id}`, {
        method: 'PATCH',
        body: {
          firstName: editFirstName,
          lastName: editLastName,
          email: editEmail,
        },
      }),
    onSuccess: (user) => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setEditing(null);
      toast({ title: 'Profile updated', description: user.username });
    },
    onError: (err) => {
      toast({
        title: 'Update failed',
        description: err instanceof ApiRequestError ? err.message : 'Unknown error',
        variant: 'error',
      });
    },
  });

  const setInitial = useMutation({
    mutationFn: ({ id, initialPassword }: { id: number; initialPassword: string }) =>
      api<UserAccountView>(`/users/${id}`, {
        method: 'PATCH',
        body: { initialPassword },
      }),
    onSuccess: (user) => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast({
        title: 'Initial password updated',
        description: `${user.username} must sign in with the new initial password and change it.`,
      });
    },
    onError: (err) => {
      toast({
        title: 'Update failed',
        description: err instanceof ApiRequestError ? err.message : 'Unknown error',
        variant: 'error',
      });
    },
  });

  const toggleActive = useMutation({
    mutationFn: (user: UserAccountView) =>
      api<UserAccountView>(`/users/${user.id}`, {
        method: 'PATCH',
        body: { isActive: !user.isActive },
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
    onError: (err) => {
      toast({
        title: 'Update failed',
        description: err instanceof ApiRequestError ? err.message : 'Unknown error',
        variant: 'error',
      });
    },
  });

  const removeUser = useMutation({
    mutationFn: (id: number) => api<{ ok: true }>(`/users/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast({ title: 'User deleted', description: 'Removed from users.yml and deactivated.' });
    },
    onError: (err) => {
      toast({
        title: 'Delete failed',
        description: err instanceof ApiRequestError ? err.message : 'Unknown error',
        variant: 'error',
      });
    },
  });

  if (sessionLoading || session?.role !== 'admin') {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const rows = users.data ?? [];
  const pending = rows.filter((u) => u.passwordResetRequestedAt);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Users</h1>
        <p className="text-sm text-muted-foreground">
          Create, edit or delete accounts. Changes are written to <code>config/users.yml</code>.
        </p>
      </div>

      {pending.length > 0 && (
        <Card className="border-amber-300 bg-amber-50/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Pending password reset requests</CardTitle>
            <CardDescription>
              These users asked for a reset from the login page. Reset to initial password, then
              tell them the initial password so they can set a new one.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {pending.map((u) => (
              <div
                key={u.id}
                className="flex items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm"
              >
                <span className="font-medium">{u.username}</span>
                <span className="text-muted-foreground">{formatWhen(u.passwordResetRequestedAt)}</span>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={resetPassword.isPending}
                  onClick={() => {
                    setConfirmResetUser(u);
                    setConfirmResetOpen(true);
                  }}
                >
                  <KeyRound className="h-3.5 w-3.5" /> Reset
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Plus className="h-4 w-4" /> Create user
          </CardTitle>
          <CardDescription>
            Initial password must be at least 10 characters, with a letter and a digit. The user
            must change it on first login.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
            onSubmit={(e) => {
              e.preventDefault();
              create.mutate();
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="new-first-name">First name</Label>
              <Input
                id="new-first-name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
                autoComplete="off"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-last-name">Last name</Label>
              <Input
                id="new-last-name"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                required
                autoComplete="off"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-email">Email</Label>
              <Input
                id="new-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="off"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-username">Username</Label>
              <Input
                id="new-username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoComplete="off"
              />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={role} onValueChange={(v) => setRole(v as Role)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">user (HR)</SelectItem>
                  <SelectItem value="admin">admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-password">Initial password</Label>
              <Input
                id="new-password"
                type="password"
                value={initialPassword}
                onChange={(e) => setInitialPassword(e.target.value)}
                required
                autoComplete="new-password"
              />
            </div>
            <div className="flex items-end sm:col-span-2 lg:col-span-3">
              <Button type="submit" disabled={create.isPending}>
                {create.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Create
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {editing && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Edit {editing.username}</CardTitle>
            <CardDescription>
              Name and email are stored so we can send messages to this user.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="grid gap-4 sm:grid-cols-3"
              onSubmit={(e) => {
                e.preventDefault();
                saveProfile.mutate();
              }}
            >
              <div className="space-y-2">
                <Label htmlFor="edit-first-name">First name</Label>
                <Input
                  id="edit-first-name"
                  value={editFirstName}
                  onChange={(e) => setEditFirstName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-last-name">Last name</Label>
                <Input
                  id="edit-last-name"
                  value={editLastName}
                  onChange={(e) => setEditLastName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-email">Email</Label>
                <Input
                  id="edit-email"
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  required
                />
              </div>
              <div className="flex gap-2 sm:col-span-3">
                <Button type="submit" disabled={saveProfile.isPending}>
                  {saveProfile.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                  Save
                </Button>
                <Button type="button" variant="outline" onClick={() => setEditing(null)}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}
      <Dialog open={confirmResetOpen} onOpenChange={setConfirmResetOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset password</DialogTitle>
            <DialogDescription>
              Reset password for {confirmResetUser?.username}? They will be set to the initial password and must change it on next login.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" onClick={() => setConfirmResetOpen(false)}>
                Cancel
              </Button>
            </DialogClose>
            <Button
              onClick={() => {
                if (confirmResetUser) resetPassword.mutate(confirmResetUser.id);
                setConfirmResetOpen(false);
              }}
            >
              Reset
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete user</DialogTitle>
            <DialogDescription>
              Delete {confirmDeleteUser?.username}? They will be removed from users.yml and will no longer be able to log in.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" onClick={() => setConfirmDeleteOpen(false)}>
                Cancel
              </Button>
            </DialogClose>
            <Button
              variant="destructive"
              onClick={() => {
                if (confirmDeleteUser) removeUser.mutate(confirmDeleteUser.id);
                setConfirmDeleteOpen(false);
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={setInitialOpen} onOpenChange={setSetInitialOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set initial password</DialogTitle>
            <DialogDescription>
              Set a new initial password for {setInitialUser?.username}. The user must change it at next login.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="initial-pwd">Initial password</Label>
              <Input
                id="initial-pwd"
                type="password"
                value={setInitialPwd}
                onChange={(e) => setSetInitialPwd(e.target.value)}
                autoComplete="new-password"
              />
              <p className="text-xs text-muted-foreground">Minimum 10 characters, include a letter and a digit.</p>
            </div>
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" onClick={() => setSetInitialOpen(false)}>
                Cancel
              </Button>
            </DialogClose>
            <Button
              onClick={() => {
                if (!setInitialUser) return;
                setInitial.mutate({ id: setInitialUser.id, initialPassword: setInitialPwd });
                setSetInitialOpen(false);
              }}
              disabled={setInitial.isPending || !(setInitialPwd.length >= 10 && /[A-Za-z]/.test(setInitialPwd) && /\d/.test(setInitialPwd))}
            >
              Set
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">All users</CardTitle>
        </CardHeader>
        <CardContent>
          {users.isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last login</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">
                      <span className="inline-flex items-center gap-2">
                        {u.role === 'admin' ? (
                          <Shield className="h-3.5 w-3.5 text-muted-foreground" />
                        ) : (
                          <UserRound className="h-3.5 w-3.5 text-muted-foreground" />
                        )}
                        <span>
                          <span className="block">
                            {[u.firstName, u.lastName].filter(Boolean).join(' ') || u.username}
                          </span>
                          <span className="block text-xs font-normal text-muted-foreground">
                            {u.username}
                          </span>
                        </span>
                      </span>
                    </TableCell>
                    <TableCell className="text-sm">{u.email ?? '—'}</TableCell>
                    <TableCell>{u.role}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        <Badge variant={u.isActive ? 'default' : 'secondary'}>
                          {u.isActive ? 'active' : 'inactive'}
                        </Badge>
                        {u.mustChangePassword && <Badge variant="outline">must change</Badge>}
                        {u.passwordResetRequestedAt && (
                          <Badge variant="destructive">reset requested</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatWhen(u.lastLoginAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setEditing(u);
                            setEditFirstName(u.firstName ?? '');
                            setEditLastName(u.lastName ?? '');
                            setEditEmail(u.email ?? '');
                          }}
                        >
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={setInitial.isPending}
                          onClick={() => {
                            setSetInitialUser(u);
                            setSetInitialPwd('');
                            setSetInitialOpen(true);
                          }}
                        >
                          Set initial
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={toggleActive.isPending}
                          onClick={() => toggleActive.mutate(u)}
                        >
                          {u.isActive ? 'Deactivate' : 'Activate'}
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={resetPassword.isPending}
                          onClick={() => {
                            setConfirmResetUser(u);
                            setConfirmResetOpen(true);
                          }}
                        >
                          <KeyRound className="h-3.5 w-3.5" /> Reset password
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={removeUser.isPending || u.id === session.id}
                          onClick={() => {
                            setConfirmDeleteUser(u);
                            setConfirmDeleteOpen(true);
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" /> Delete
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
    </div>
  );
}
