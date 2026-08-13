'use client';

import { ServiceUnavailable } from '@/components/service-unavailable';

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ServiceUnavailable error={error} onRetry={reset} />;
}
