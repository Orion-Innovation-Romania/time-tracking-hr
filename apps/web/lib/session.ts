'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useCallback } from 'react';
import type { SessionUser } from '@ttah/shared';
import { api, ApiRequestError, isServiceUnavailable } from './api';

export function useSession(options?: { enabled?: boolean }) {
  return useQuery<SessionUser | null>({
    queryKey: ['session'],
    queryFn: async () => {
      try {
        return await api<SessionUser>('/auth/me');
      } catch (err) {
        if (err instanceof ApiRequestError && err.statusCode === 401) return null;
        throw err;
      }
    },
    staleTime: 60_000,
    retry: (count, err) => isServiceUnavailable(err) && count < 2,
    enabled: options?.enabled ?? true,
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  const router = useRouter();
  return useCallback(async () => {
    try {
      await api('/auth/logout', { method: 'POST' });
    } finally {
      queryClient.setQueryData(['session'], null);
      queryClient.clear();
      router.replace('/login');
    }
  }, [queryClient, router]);
}
