'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import type { SessionUser } from '@ttah/shared';
import { api, ApiRequestError, isServiceUnavailable, unavailableMessage } from '@/lib/api';
import { OrionMark, OI_TAGLINE } from '@/components/brand';
import { UserGuide } from '@/components/user-guide';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const GENERIC_RESET_SENT =
  'If an account exists for this email, we sent a reset link. Check your inbox and spam folder.';

export default function LoginPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotMessage, setForgotMessage] = useState<string | null>(null);
  const [resetDone, setResetDone] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('reset') === '1') setResetDone(true);
  }, []);

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
        body: { email: forgotEmail.trim() },
      }),
    onSuccess: () => {
      setForgotMessage(GENERIC_RESET_SENT);
    },
    onError: (err) => {
      if (err instanceof ApiRequestError && err.statusCode > 0) {
        setForgotMessage(err.message);
        return;
      }
      setForgotMessage(
        isServiceUnavailable(err) ? unavailableMessage(err) : 'Could not request a reset.',
      );
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
            <UserGuide variant="compact" className="mt-1" />
          </CardHeader>
          <CardContent>
            {resetDone && (
              <p className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
                Password updated. Sign in with your new password.
              </p>
            )}
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
                  onChange={(e) => setUsername(e.target.value)}
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
                <form
                  className="space-y-3"
                  onSubmit={(e) => {
                    e.preventDefault();
                    setForgotMessage(null);
                    forgot.mutate();
                  }}
                >
                  <p className="text-sm text-muted-foreground">
                    Enter the email on your TTAH account. We will send a link to set a new
                    password. No admin approval is needed.
                  </p>
                  <div className="space-y-2">
                    <Label htmlFor="forgot-email">Email</Label>
                    <Input
                      id="forgot-email"
                      type="email"
                      autoComplete="email"
                      autoFocus
                      value={forgotEmail}
                      onChange={(e) => {
                        setForgotEmail(e.target.value);
                        setForgotMessage(null);
                      }}
                      required
                    />
                  </div>
                  <Button
                    type="submit"
                    variant="outline"
                    className="w-full"
                    disabled={!forgotEmail.trim() || forgot.isPending}
                  >
                    {forgot.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                    Send reset link
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
                  <button
                    type="button"
                    className="w-full text-center text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                    onClick={() => {
                      setForgotOpen(false);
                      setForgotMessage(null);
                    }}
                  >
                    Back to sign in
                  </button>
                </form>
              )}
            </div>
          </CardContent>
        </Card>
        <p className="max-w-xs text-center text-sm font-medium text-white/80">{OI_TAGLINE}</p>
      </div>
    </div>
  );
}
