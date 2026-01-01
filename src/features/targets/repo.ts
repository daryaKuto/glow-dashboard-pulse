import { fetchTargetsWithTelemetry, fetchTargetDetails, type TargetDetailsOptions } from '@/lib/edge';
import { apiOk, apiErr, type ApiResponse } from '@/shared/lib/api-response';
import type { Target, TargetDetail, TargetsSummary } from './schema';

/**
 * Repository layer for Targets feature
 * 
 * Handles all data access operations (edge function calls, ThingsBoard queries).
 * Returns ApiResponse<T> for consistent error handling.
 */

export interface TargetsWithSummary {
  targets: Target[];
  summary: TargetsSummary | null;
  cached: boolean;
}

/**
 * Get all targets with telemetry from edge function
 */
export async function getTargets(force = false): Promise<ApiResponse<TargetsWithSummary>> {
  try {
    const result = await fetchTargetsWithTelemetry(force);
    return apiOk({
      targets: result.targets,
      summary: result.summary,
      cached: result.cached,
    });
  } catch (error) {
    console.error('[Targets Repo] Error fetching targets:', error);
    return apiErr(
      'FETCH_TARGETS_ERROR',
      error instanceof Error ? error.message : 'Failed to fetch targets',
      error
    );
  }
}

/**
 * Get target details (telemetry, history) for specific devices
 */
export async function getTargetDetails(
  deviceIds: string[],
  options?: TargetDetailsOptions
): Promise<ApiResponse<TargetDetail[]>> {
  try {
    if (deviceIds.length === 0) {
      return apiOk([]);
    }

    const { details } = await fetchTargetDetails(deviceIds, options);
    return apiOk(details);
  } catch (error) {
    console.error('[Targets Repo] Error fetching target details:', error);
    return apiErr(
      'FETCH_TARGET_DETAILS_ERROR',
      error instanceof Error ? error.message : 'Failed to fetch target details',
      error
    );
  }
}

/**
 * Get targets summary only
 */
export async function getTargetsSummary(force = false): Promise<ApiResponse<TargetsSummary | null>> {
  try {
    const { fetchTargetsSummary } = await import('@/lib/edge');
    const result = await fetchTargetsSummary(force);
    return apiOk(result.summary);
  } catch (error) {
    console.error('[Targets Repo] Error fetching targets summary:', error);
    return apiErr(
      'FETCH_TARGETS_SUMMARY_ERROR',
      error instanceof Error ? error.message : 'Failed to fetch targets summary',
      error
    );
  }
}

