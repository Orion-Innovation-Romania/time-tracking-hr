'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { LogOut, ShieldCheck } from 'lucide-react';
import { OrionLogo, OrionMark, OI_TAGLINE } from '@/components/brand';
import { Button } from '@/components/ui/button';
import { useLogout, useSession } from '@/lib/session';

export default function SystemLayout({ children }: { children: ReactNode }) {
  const { data: session } = useSession();
  const logout = useLogout();

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-accent/30 flex flex-col">
      <header className="border-b bg-card/60 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-3">
            <OrionMark variant="gradient" className="h-8 w-12" />
            <div className="h-6 w-px bg-border" />
            <span className="text-lg font-bold tracking-tight">System Resources</span>
          </Link>
          <div className="flex items-center gap-3">
            {session?.role === 'admin' && (
              <span className="hidden items-center gap-1 text-xs font-medium text-muted-foreground sm:flex">
                <ShieldCheck className="h-4 w-4" /> admin
              </span>
            )}
            <span className="text-sm text-muted-foreground">{session?.username}</span>
            <Button variant="ghost" size="sm" onClick={logout}>
              <LogOut className="h-4 w-4" /> Sign out
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">{children}</main>
      <footer className="border-t bg-card/60">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 px-6 py-6 text-center sm:flex-row sm:justify-between sm:text-left">
          <OrionLogo className="h-6 w-auto text-foreground" />
          <p className="text-xs text-muted-foreground">
            {OI_TAGLINE} · admin only
          </p>
        </div>
      </footer>
    </div>
  );
}
