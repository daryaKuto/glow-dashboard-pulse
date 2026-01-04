/**
 * Service layer for Dashboard feature
 * 
 * Contains business logic and orchestration.
 * Uses repository functions and domain layer validators/aggregators.
 * Returns ApiResponse<T>.
 */

import { getDashboardMetrics, type DashboardMetricsResult } from './repo';
import { validateDashboardQueryOptions } from '@/domain/dashboard/validators';
import { canViewDashboard } from '@/domain/dashboard/permissions';
import { apiErr } from '@/shared/lib/api-response';

/**
 * Get dashboard metrics
 */
export async function getDashboardMetricsService(
  force = false,
  options: { includeRecentSessions?: boolean; recentSessionsLimit?: number } = {},
  userId?: string
): Promise<import('@/shared/lib/api-response').ApiResponse<DashboardMetricsResult>> {
  if (userId) {
    const permission = canViewDashboard({ userId }, { ownerId: userId });
    if (!permission.allowed) {
      return apiErr('FORBIDDEN', permission.reason);
    }
  }

  // Validate query options using domain layer
  const validation = validateDashboardQueryOptions(options);
  if (!validation.success) {
    const firstError = validation.errors[0];
    return apiErr('VALIDATION_ERROR', firstError?.message || 'Invalid query options');
  }

  return getDashboardMetrics(force);
}
