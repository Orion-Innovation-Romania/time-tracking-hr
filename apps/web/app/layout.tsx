import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { QueryProvider } from '@/lib/query';
import { ToastProvider } from '@/components/ui/toast';
import './globals.css';

export const metadata: Metadata = {
  title: 'TTAH Platform · Orion Innovation',
  description: 'HR time tracking & internal app portal',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen antialiased">
        <QueryProvider>
          <ToastProvider>{children}</ToastProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
