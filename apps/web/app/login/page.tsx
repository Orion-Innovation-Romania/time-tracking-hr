'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import type { SessionUser } from '@ttah/shared';
import { api, ApiRequestError, isServiceUnavailable, unavailableMessage } from '@/lib/api';
import { OrionMark, OI_TAGLINE } from '@/components/brand';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function LoginPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotMessage, setForgotMessage] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () =>
      api<SessionUser>('/auth/login', {
        method: 'POST',
        body: { username, password },
      }),
    onSuccess: (user) => {
      queryClient.setQueryData(['session'], user);
      router.replace(user.mustChangePassword ? '/change-password' : '/');
    },
  });

  const forgot = useMutation({
    mutationFn: () =>
      api<{ ok: true }>('/auth/forgot-password', {
        method: 'POST',
        body: { username },
      }),
    onSuccess: () => {
      setForgotMessage(
        'If this username exists, an administrator will receive the request and can reset the password.',
      );
    },
    onError: (err) => {
      const msg = isServiceUnavailable(err)
        ? unavailableMessage(err)
        : err instanceof ApiRequestError
          ? err.message
          : 'Could not request a reset.';
      setForgotMessage(msg);
    },
  });

  const errorMessage = mutation.error
    ? isServiceUnavailable(mutation.error)
      ? unavailableMessage(mutation.error)
      : mutation.error instanceof ApiRequestError
        ? mutation.error.message
        : 'Login failed. Please try again.'
    : null;

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
            <CardTitle className="text-2xl">TTAH Portal</CardTitle>
            <CardDescription>Sign in to continue</CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                mutation.mutate();
              }}
            >
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  autoComplete="username"
                  autoFocus
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value);
                    setForgotMessage(null);
                  }}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              {errorMessage && (
                <p className="text-sm font-medium text-destructive">{errorMessage}</p>
              )}
              <Button type="submit" className="w-full" disabled={mutation.isPending}>
                {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Sign in
              </Button>
            </form>

            <div className="mt-4 border-t pt-4">
              {!forgotOpen ? (
                <button
                  type="button"
                  className="w-full text-center text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                  onClick={() => {
                    setForgotOpen(true);
                    setForgotMessage(null);
                  }}
                >
                  Forgot password?
                </button>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Enter your username above, then request a reset. An admin must approve it.
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    disabled={!username.trim() || forgot.isPending}
                    onClick={() => forgot.mutate()}
                  >
                    {forgot.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                    Request password reset
                  </Button>
                  {forgotMessage && (
                    <p
                      className={`text-sm ${
                        forgot.isSuccess ? 'text-foreground' : 'text-destructive'
                      }`}
                    >
                      {forgotMessage}
                    </p>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
        <p className="max-w-xs text-center text-sm font-medium text-white/80">{OI_TAGLINE}</p>
      </div>
    </div>
  );
}
