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
  metrics: (force?: boolean) => [...dashboardKeys.all, 'metrics', force] as const,
};

/**
 * Get dashboard metrics
 */
export function useDashboardMetrics(force = false) {
  return useQuery({
    queryKey: dashboardKeys.metrics(force),
    queryFn: async () => {
      const result = await getDashboardMetricsService(force);
      if (!result.ok) {
        throw new Error(result.error.message);
      }
      return result.data;
    },
    staleTime: 30 * 1000, // 30 seconds
  });
}

