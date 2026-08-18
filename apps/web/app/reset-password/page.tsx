'use client';

import { Suspense, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { api, ApiRequestError, isServiceUnavailable, unavailableMessage } from '@/lib/api';
import { OrionMark, OI_TAGLINE } from '@/components/brand';
import { UserGuide } from '@/components/user-guide';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = (searchParams.get('token') ?? '').trim();
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const peek = useQuery({
    queryKey: ['reset-password', token],
    queryFn: () => api<{ ok: true }>('/auth/reset-password', { query: { token } }),
    enabled: token.length > 0,
    retry: false,
  });

  const mutation = useMutation({
    mutationFn: () =>
      api<{ ok: true }>('/auth/reset-password', {
        method: 'POST',
        body: { token, newPassword },
      }),
    onSuccess: () => {
      router.replace('/login?reset=1');
    },
  });

  const unavailable = peek.isError && isServiceUnavailable(peek.error);
  const invalidLink = !token || (peek.isError && !unavailable);

  const errorMessage =
    localError ??
    (mutation.error
      ? isServiceUnavailable(mutation.error)
        ? unavailableMessage(mutation.error)
        : mutation.error instanceof ApiRequestError
          ? mutation.error.message
          : 'Could not update the password.'
      : peek.isError && isServiceUnavailable(peek.error)
        ? unavailableMessage(peek.error)
        : null);

  return (
    <Card className="w-full animate-fade-in shadow-2xl">
      <CardHeader className="items-center text-center">
        <OrionMark variant="gradient" className="mb-3 w-16" />
        <CardTitle className="text-2xl">Choose a new password</CardTitle>
        <CardDescription>
          Minimum 10 characters, with at least one letter and one digit.
        </CardDescription>
        <UserGuide variant="compact" className="mt-1" />
      </CardHeader>
      <CardContent>
        {peek.isLoading ? (
          <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Checking your reset link…
          </p>
        ) : invalidLink ? (
          <div className="space-y-4 text-center">
            <p className="text-sm text-muted-foreground">
              This reset link is invalid or has expired. Request a new one from the sign-in page.
            </p>
            <Button type="button" className="w-full" onClick={() => router.replace('/login')}>
              Back to sign in
            </Button>
          </div>
        ) : unavailable ? (
          <div className="space-y-4 text-center">
            <p className="text-sm font-medium text-destructive">{errorMessage}</p>
            <Button type="button" className="w-full" onClick={() => peek.refetch()}>
              Try again
            </Button>
          </div>
        ) : (
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
              <Label htmlFor="new">New password</Label>
              <Input
                id="new"
                type="password"
                autoComplete="new-password"
                autoFocus
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
              />
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
            </div>
            {errorMessage && (
              <p className="text-sm font-medium text-destructive">{errorMessage}</p>
            )}
            <Button type="submit" className="w-full" disabled={mutation.isPending}>
              {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Save password
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}

function ResetPasswordFallback() {
  return (
    <Card className="w-full shadow-2xl">
      <CardHeader className="items-center text-center">
        <OrionMark variant="gradient" className="mb-3 w-16" />
        <CardTitle className="text-2xl">Choose a new password</CardTitle>
        <CardDescription>Checking your reset link…</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Please wait
        </p>
      </CardContent>
    </Card>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="relative flex min-h-screen items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: 'url(/brand/oi-hero.jpg)' }}
      />
      <div className="absolute inset-0 bg-slate-950/55" />
      <div className="relative flex w-full max-w-sm flex-col items-center gap-6">
        <Suspense fallback={<ResetPasswordFallback />}>
          <ResetPasswordForm />
        </Suspense>
        <p className="max-w-xs text-center text-sm font-medium text-white/80">{OI_TAGLINE}</p>
      </div>
    </div>
  );
}
