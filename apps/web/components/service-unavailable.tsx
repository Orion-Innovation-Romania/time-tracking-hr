'use client';

import { Loader2, TriangleAlert } from 'lucide-react';
import { unavailableMessage } from '@/lib/api';
import { OrionMark } from '@/components/brand';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export function ServiceUnavailable({
  error,
  onRetry,
  retrying,
}: {
  error?: unknown;
  onRetry?: () => void;
  retrying?: boolean;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-accent/20 p-6">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="items-center text-center">
          <OrionMark variant="gradient" className="mb-3 w-14" />
          <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <TriangleAlert className="h-6 w-6" />
          </div>
          <CardTitle>Service unavailable</CardTitle>
          <CardDescription>{unavailableMessage(error)}</CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center">
          {onRetry && (
            <Button type="button" onClick={onRetry} disabled={retrying}>
              {retrying && <Loader2 className="h-4 w-4 animate-spin" />}
              Try again
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
