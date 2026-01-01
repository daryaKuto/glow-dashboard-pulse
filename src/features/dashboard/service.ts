/**
 * Service layer for Dashboard feature
 * 
 * Contains business logic and orchestration.
 * Uses repository functions and returns ApiResponse<T>.
 */

import { getDashboardMetrics, type DashboardMetricsResult } from './repo';

/**
 * Get dashboard metrics
 */
export async function getDashboardMetricsService(force = false): Promise<import('@/shared/lib/api-response').ApiResponse<DashboardMetricsResult>> {
  return getDashboardMetrics(force);
}

