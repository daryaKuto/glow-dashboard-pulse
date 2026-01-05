import { useQuery } from '@tanstack/react-query';
import { getDashboardMetricsService } from './service';
import type { DashboardMetricsData } from './schema';
import type { DashboardMetricsResult } from './repo';

/**
 * React Query hooks for Dashboard feature
 */

// Query keys
export const dashboardKeys = {
  all: ['dashboard'] as const,
  metrics: (force?: boolean, userId?: string) => [...dashboardKeys.all, 'metrics', force, userId] as const,
};

/**
 * Get dashboard metrics
 */
export function useDashboardMetrics(force = false, userId?: string) {
  return useQuery({
    queryKey: dashboardKeys.metrics(force, userId),
    queryFn: async () => {
      const result = await getDashboardMetricsService(force, {}, userId);
      if (!result.ok) {
        throw new Error(result.error.message);
      }
      return result.data;
    },
    staleTime: 60 * 1000, // 60 seconds - increased to reduce refetches
    refetchOnMount: false, // Don't refetch if data exists and is fresh
    enabled: !!userId, // Only fetch when userId is available
  });
}
