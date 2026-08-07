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

export default function LoginPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

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

  const errorMessage =
    mutation.error instanceof ApiRequestError
      ? mutation.error.message
      : mutation.error
        ? 'Login failed. Please try again.'
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
        </CardContent>
      </Card>
        <p className="max-w-xs text-center text-sm font-medium text-white/80">
          {OI_TAGLINE}
        </p>
      </div>
    </div>
  );
}
