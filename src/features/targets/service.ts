/**
 * Service layer for Targets feature
 * 
 * Contains business logic and orchestration.
 * Uses repository functions and returns ApiResponse<T>.
 */

import {
  getTargets,
  getTargetDetails,
  getTargetsSummary,
  type TargetsWithSummary,
} from './repo';
import type {
  Target,
  TargetDetail,
  TargetDetailsOptions,
  TargetsSummary,
} from './schema';
import { apiOk, apiErr, type ApiResponse } from '@/shared/lib/api-response';

/**
 * Get all targets with telemetry
 */
export async function getTargetsWithTelemetry(force = false): Promise<ApiResponse<TargetsWithSummary>> {
  return getTargets(force);
}

/**
 * Get target details for specific devices
 */
export async function getTargetDetailsService(
  deviceIds: string[],
  options?: TargetDetailsOptions
): Promise<ApiResponse<TargetDetail[]>> {
  if (!Array.isArray(deviceIds) || deviceIds.length === 0) {
    return apiOk([]);
  }

  // Validate device IDs
  for (const id of deviceIds) {
    if (!id || typeof id !== 'string') {
      return apiErr('VALIDATION_ERROR', 'Invalid device ID provided');
    }
  }

  return getTargetDetails(deviceIds, options);
}

/**
 * Get targets summary
 */
export async function getTargetsSummaryService(force = false): Promise<ApiResponse<TargetsSummary | null>> {
  return getTargetsSummary(force);
}

/**
 * Merge target details into targets
 * This is a helper function for combining base target data with detailed telemetry
 */
export function mergeTargetDetails(
  targets: Target[],
  details: TargetDetail[]
): Target[] {
  const detailMap = new Map(details.map((detail) => [detail.deviceId, detail]));

  return targets.map((target) => {
    const detail = detailMap.get(target.id);
    if (!detail) {
      return target;
    }

    return {
      ...target,
      status: detail.status ?? target.status,
      activityStatus: detail.activityStatus ?? target.activityStatus,
      lastShotTime: detail.lastShotTime ?? target.lastShotTime ?? null,
      lastActivityTime: detail.lastShotTime ?? target.lastActivityTime ?? null,
      totalShots: detail.totalShots ?? target.totalShots ?? null,
      recentShotsCount: detail.recentShotsCount ?? target.recentShotsCount ?? 0,
      telemetry: detail.telemetry && Object.keys(detail.telemetry).length > 0
        ? detail.telemetry
        : target.telemetry,
      telemetryHistory: detail.history ?? target.telemetryHistory,
      battery: detail.battery ?? target.battery ?? null,
      wifiStrength: detail.wifiStrength ?? target.wifiStrength ?? null,
      lastEvent: detail.lastEvent ?? target.lastEvent ?? null,
      gameStatus: detail.gameStatus ?? target.gameStatus ?? null,
      errors: detail.errors ?? target.errors,
    };
  });
}

