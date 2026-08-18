'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import type { SessionUser } from '@ttah/shared';
import { api, ApiRequestError } from '@/lib/api';
import { OrionMark, OI_TAGLINE } from '@/components/brand';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/toast';

export default function ChangePasswordPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  function isValidPassword(p: string) {
    return p.length >= 10 && /[A-Za-z]/.test(p) && /\d/.test(p) && !/\s/.test(p);
  }

  const mutation = useMutation({
    mutationFn: () =>
      api<SessionUser>('/auth/change-password', {
        method: 'POST',
        body: { currentPassword, newPassword },
      }),
    onSuccess: (user) => {
      queryClient.setQueryData(['session'], { ...user, mustChangePassword: false });
      queryClient.invalidateQueries({ queryKey: ['session'] });
      toast({ title: 'Password updated', variant: 'success' });
      router.replace('/');
    },
  });

  const errorMessage =
    localError ??
    (mutation.error instanceof ApiRequestError ? mutation.error.message : null);

  return (
    <div className="relative flex min-h-screen items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: 'url(/brand/oi-hero.jpg)' }}
      />
      <div className="absolute inset-0 bg-slate-950/55" />
      <div className="relative flex w-full max-w-sm flex-col items-center gap-6">
        <Card className="w-full animate-fade-in shadow-2xl">
          <CardHeader className="items-center text-center">
            <OrionMark variant="gradient" className="mb-3 w-16" />
            <CardTitle className="text-2xl">Set a new password</CardTitle>
          </CardHeader>
        <CardContent>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              setLocalError(null);
              if (newPassword !== confirm) {
                setLocalError('Passwords do not match.');
                return;
              }
              mutation.mutate();
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="current">Current password</Label>
              <Input
                id="current"
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new">New password</Label>
              <Input
                id="new"
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
              />
              <p className={newPassword.includes(' ') ? 'text-xs text-destructive' : 'text-xs text-muted-foreground'}>
                Minimum 10 characters, include a letter and a digit; spaces are not allowed.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm">Confirm new password</Label>
              <Input
                id="confirm"
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
              />
              <p className={confirm && confirm !== newPassword ? 'text-xs text-destructive' : 'hidden'}>
                Passwords do not match.
              </p>
            </div>
            {errorMessage && (
              <p className="text-sm font-medium text-destructive">{errorMessage}</p>
            )}
            <Button
              type="submit"
              className="w-full"
              disabled={
                mutation.isPending || !isValidPassword(newPassword) || newPassword !== confirm
              }
            >
              {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Update password
            </Button>
          </form>
        </CardContent>
      </Card>
        <p className="max-w-xs text-center text-sm font-medium text-white/80">
          {OI_TAGLINE}
        </p>
      </div>
    </div>
  );
}
