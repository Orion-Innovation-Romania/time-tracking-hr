'use client';

import { useQuery } from '@tanstack/react-query';
import type { EmployeeView } from '@ttah/shared';
import { api } from './api';

export function useEmployees(includeInactive = false) {
  return useQuery<EmployeeView[]>({
    queryKey: ['employees', { includeInactive }],
    queryFn: () =>
      api<EmployeeView[]>('/employees', {
        query: includeInactive ? { includeInactive: 'true' } : undefined,
      }),
  });
}

export function useDepartments() {
  return useQuery<string[]>({
    queryKey: ['departments'],
    queryFn: () => api<string[]>('/employees/departments'),
  });
}
