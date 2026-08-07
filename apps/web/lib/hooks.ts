'use client';

import { useQuery } from '@tanstack/react-query';
import type { EmployeeView } from '@ttah/shared';
import { api } from './api';

export function useEmployees() {
  return useQuery<EmployeeView[]>({
    queryKey: ['employees'],
    queryFn: () => api<EmployeeView[]>('/employees'),
  });
}

export function useDepartments() {
  return useQuery<string[]>({
    queryKey: ['departments'],
    queryFn: () => api<string[]>('/employees/departments'),
  });
}
