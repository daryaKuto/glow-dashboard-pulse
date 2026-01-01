import { fetchDashboardMetrics } from '@/lib/edge';
import { apiOk, apiErr, type ApiResponse } from '@/shared/lib/api-response';
import type { DashboardMetricsData } from './schema';

/**
 * Repository layer for Dashboard feature
 * 
 * Handles all data access operations (edge function calls).
 * Returns ApiResponse<T> for consistent error handling.
 */

export interface DashboardMetricsResult {
  metrics: DashboardMetricsData | null;
  cached: boolean;
  source?: string;
}

/**
 * Get dashboard metrics from edge function
 */
export async function getDashboardMetrics(force = false): Promise<ApiResponse<DashboardMetricsResult>> {
  try {
    const result = await fetchDashboardMetrics(force);
    return apiOk(result);
  } catch (error) {
    console.error('[Dashboard Repo] Error fetching dashboard metrics:', error);
    return apiErr(
      'FETCH_DASHBOARD_METRICS_ERROR',
      error instanceof Error ? error.message : 'Failed to fetch dashboard metrics',
      error
    );
  }
}

