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
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/833eaf25-0547-420d-a570-1d7cab6b5873',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'dashboard/hooks.ts:22',message:'useDashboardMetrics queryFn start',data:{force,userId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H2'})}).catch(()=>{});
      // #endregion
      const result = await getDashboardMetricsService(force, {}, userId);
      if (!result.ok) {
        throw new Error(result.error.message);
      }
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/833eaf25-0547-420d-a570-1d7cab6b5873',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'dashboard/hooks.ts:27',message:'useDashboardMetrics queryFn complete',data:{force,userId,hasData:!!result.data},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H2'})}).catch(()=>{});
      // #endregion
      return result.data;
    },
    staleTime: 60 * 1000, // 60 seconds - increased to reduce refetches
    refetchOnMount: false, // Don't refetch if data exists and is fresh
    enabled: !!userId, // Only fetch when userId is available
  });
}
