/**
 * Service layer for Dashboard feature
 * 
 * Contains business logic and orchestration.
 * Uses repository functions and domain layer validators/aggregators.
 * Returns ApiResponse<T>.
 */

import { dashboardRepository, type DashboardMetricsResult } from './repo';
import type { DashboardRepository } from '@/domain/dashboard/ports';
import { validateDashboardQueryOptions } from '@/domain/dashboard/validators';
import { canViewDashboard, type UserContext, type DashboardContext } from '@/domain/dashboard/permissions';
import { apiErr, type ApiResponse } from '@/shared/lib/api-response';

// Repository injection for testing
let dashboardRepo: DashboardRepository = dashboardRepository;

/**
 * Set the dashboard repository (for testing/dependency injection)
 */
export const setDashboardRepository = (repo: DashboardRepository): void => {
  dashboardRepo = repo;
};

/**
 * Get dashboard metrics
 */
export async function getDashboardMetricsService(
  force = false,
  options: { includeRecentSessions?: boolean; recentSessionsLimit?: number } = {},
  userId?: string
): Promise<ApiResponse<DashboardMetricsResult>> {
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

  return dashboardRepo.getMetrics(force);
}

// Re-export types for consumers
export type { DashboardMetricsResult } from './repo';
export type { UserContext, DashboardContext } from '@/domain/dashboard/permissions';
