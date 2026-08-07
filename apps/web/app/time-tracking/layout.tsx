'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import {
  BarChart3,
  DoorOpen,
  FileSpreadsheet,
  Home,
  LogOut,
  ScrollText,
  Settings,
  TriangleAlert,
  Upload,
  Users,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLogout, useSession } from '@/lib/session';
import { OrionMark } from '@/components/brand';
import { Skeleton } from '@/components/ui/skeleton';

const NAV = [
  { href: '/time-tracking/dashboard', label: 'Dashboard', icon: BarChart3 },
  { href: '/time-tracking/import', label: 'Import', icon: Upload },
  { href: '/time-tracking/employees', label: 'Employees', icon: Users },
  { href: '/time-tracking/anomalies', label: 'Anomalies', icon: TriangleAlert },
  { href: '/time-tracking/doors', label: 'Doors', icon: DoorOpen },
  { href: '/time-tracking/exports', label: 'Exports', icon: FileSpreadsheet },
  { href: '/time-tracking/audit', label: 'Audit log', icon: ScrollText },
  { href: '/time-tracking/config', label: 'Configuration', icon: Settings },
];

export default function TimeTrackingLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session, isLoading } = useSession();
  const logout = useLogout();

  useEffect(() => {
    if (!isLoading && session === null) router.replace('/login');
    if (session?.mustChangePassword) router.replace('/change-password');
  }, [session, isLoading, router]);

  if (isLoading || !session) {
    return (
      <div className="flex min-h-screen">
        <Skeleton className="h-screen w-64" />
        <div className="flex-1 p-8">
          <Skeleton className="h-8 w-48" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-accent/20">
      <aside className="sticky top-0 flex h-screen w-64 flex-col border-r bg-card">
        <div className="flex items-center gap-3 border-b px-5 py-4">
          <OrionMark variant="gradient" className="h-7 w-11" />
          <div>
            <p className="text-sm font-bold leading-tight">Time Tracking</p>
            <p className="text-xs text-muted-foreground">TTAH Portal</p>
          </div>
        </div>

        <nav className="flex-1 space-y-1 p-3">
          <Link
            href="/"
            className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <Home className="h-4 w-4" /> Portal home
          </Link>
          <div className="my-2 h-px bg-border" />
          {NAV.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  active
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                )}
              >
                <item.icon className="h-4 w-4" /> {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t p-3">
          <div className="mb-2 px-3 text-xs text-muted-foreground">
            {session.username}
            {session.role === 'admin' && ' · admin'}
          </div>
          <button
            onClick={logout}
            className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-x-hidden">
        <div className="mx-auto max-w-7xl p-8">{children}</div>
      </main>
    </div>
  );
}
