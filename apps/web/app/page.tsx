'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Clock, LogOut, ShieldCheck, Sparkles } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { OrionMark, OrionLogo, OI_TAGLINE } from '@/components/brand';
import { useLogout, useSession } from '@/lib/session';
import { ServiceUnavailable } from '@/components/service-unavailable';

interface AppCard {
  href: string;
  title: string;
  description: string;
  icon: typeof Clock;
  accent: string;
  available: boolean;
}

const APPS: AppCard[] = [
  {
    href: '/time-tracking/dashboard',
    title: 'Time Tracking',
    description: 'Analyze access-card logs, compute presence and build monthly timesheets.',
    icon: Clock,
    accent: 'from-blue-500/20 to-indigo-500/10',
    available: true,
  },
  {
    href: '#',
    title: 'More coming soon',
    description: 'This portal is built to host additional internal HR & operations apps.',
    icon: Sparkles,
    accent: 'from-slate-400/10 to-slate-500/5',
    available: false,
  },
];

export default function PortalPage() {
  const router = useRouter();
  const { data: session, isLoading, isError, error, refetch, isFetching } = useSession();
  const logout = useLogout();

  useEffect(() => {
    if (!isLoading && !isError && session === null) router.replace('/login');
    if (session?.mustChangePassword) router.replace('/change-password');
  }, [session, isLoading, isError, router]);

  if (isError) {
    return <ServiceUnavailable error={error} onRetry={() => refetch()} retrying={isFetching} />;
  }

  if (isLoading || !session) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-16">
        <Skeleton className="h-10 w-64" />
        <div className="mt-10 grid gap-6 sm:grid-cols-2">
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-accent/30 flex flex-col">
      <header className="border-b bg-card/60 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <OrionMark variant="gradient" className="h-8 w-12" />
            <div className="h-6 w-px bg-border" />
            <span className="text-lg font-bold tracking-tight">TTAH Portal</span>
          </div>
          <div className="flex items-center gap-3">
            {session.role === 'admin' && (
              <span className="hidden items-center gap-1 text-xs font-medium text-muted-foreground sm:flex">
                <ShieldCheck className="h-4 w-4" />
              </span>
            )}
            <span className="text-sm text-muted-foreground">{session.username}</span>
            <Button variant="ghost" size="sm" onClick={logout}>
              <LogOut className="h-4 w-4" /> Sign out
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-16 flex-1">
        <div className="animate-fade-in">
          <p className="text-sm font-semibold uppercase tracking-wide oi-gradient-text">
            {OI_TAGLINE}
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">Welcome back</h1>
          <p className="mt-2 text-muted-foreground">
            Choose an application to get started.
          </p>
        </div>

        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {APPS.map((app) => (
            <Card
              key={app.title}
              className={`group relative overflow-hidden transition-all ${
                app.available ? 'cursor-pointer hover:-translate-y-1 hover:shadow-lg' : 'opacity-70'
              }`}
              onClick={() => app.available && router.push(app.href)}
            >
              <div
                className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${app.accent}`}
              />
              <CardHeader className="relative">
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <app.icon className="h-6 w-6" />
                </div>
                <CardTitle>{app.title}</CardTitle>
                <CardDescription>{app.description}</CardDescription>
              </CardHeader>
              <CardContent className="relative">
                {app.available ? (
                  <span className="text-sm font-medium text-primary group-hover:underline">
                    Open →
                  </span>
                ) : (
                  <span className="text-sm text-muted-foreground">Not available yet</span>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </main>

      <footer className="mt-8 border-t bg-card/60">
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-3 px-6 py-8 text-center sm:flex-row sm:justify-between sm:text-left">
          <OrionLogo className="h-6 w-auto text-foreground" />
          <p className="text-xs text-muted-foreground">
            {OI_TAGLINE} &middot; &copy; {new Date().getFullYear()} Orion Innovation
          </p>
        </div>
      </footer>
    </div>
  );
}
