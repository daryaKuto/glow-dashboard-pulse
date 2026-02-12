import { fetchDashboardMetrics } from '@/lib/edge';
import { apiOk, apiErr, type ApiResponse } from '@/shared/lib/api-response';
import { mapDashboardMetricsPayload } from '@/domain/dashboard/mappers';
import type { DashboardRepository, DashboardMetricsResult } from '@/domain/dashboard/ports';
import type { DashboardMetricsData } from './schema';

/**
 * Repository layer for Dashboard feature
 * 
 * Handles all data access operations (edge function calls).
 * Returns ApiResponse<T> for consistent error handling.
 */

// Re-export types for backward compatibility
export type { DashboardMetricsResult } from '@/domain/dashboard/ports';

/**
 * Get dashboard metrics from edge function
 */
export async function getDashboardMetrics(force = false): Promise<ApiResponse<DashboardMetricsResult>> {
  try {
    const result = await fetchDashboardMetrics(force);
    return apiOk({
      ...result,
      metrics: mapDashboardMetricsPayload(result.metrics),
    });
  } catch (error) {
    console.error('[Dashboard Repo] Error fetching dashboard metrics:', error);
    return apiErr(
      'FETCH_DASHBOARD_METRICS_ERROR',
      error instanceof Error ? error.message : 'Failed to fetch dashboard metrics',
      error
    );
  }
}

/**
 * Repository adapter (ports & adapters pattern)
 */
export const dashboardRepository: DashboardRepository = {
  getMetrics: getDashboardMetrics,
};
