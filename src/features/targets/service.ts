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
  sendDeviceCommand,
  setDeviceAttributes,
  getTargetCustomNames,
  setTargetCustomName,
  removeTargetCustomName,
  type TargetsWithSummary,
} from './repo';
import type {
  Target,
  TargetDetail,
  TargetDetailsOptions,
  TargetsSummary,
} from './schema';
import { apiOk, apiErr, type ApiResponse } from '@/shared/lib/api-response';
import {
  validateDeviceId,
  validateDeviceIds,
  validateTargetDetailsOptions,
  validateUpdateCustomNameInput,
} from '@/domain/targets/validators';

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

  const deviceIdsValidation = validateDeviceIds(deviceIds);
  if (!deviceIdsValidation.success) {
    return apiErr('VALIDATION_ERROR', deviceIdsValidation.errors[0]?.message || 'Invalid device IDs');
  }

  let validatedOptions = options;
  if (options) {
    const optionsValidation = validateTargetDetailsOptions(options);
    if (!optionsValidation.success) {
      return apiErr('VALIDATION_ERROR', optionsValidation.errors[0]?.message || 'Invalid target details options');
    }
    validatedOptions = optionsValidation.data;
  }

  return getTargetDetails(deviceIdsValidation.data, validatedOptions);
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
      lastActivityTime: target.lastActivityTime ?? null,
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

/**
 * Send RPC command to devices
 */
export async function sendDeviceCommandService(
  deviceIds: string[],
  method: string,
  params?: Record<string, unknown>
): Promise<ApiResponse<void>> {
  // Validate device IDs using domain layer
  const validation = validateDeviceIds(deviceIds);
  if (!validation.success) {
    return apiErr('VALIDATION_ERROR', validation.errors[0]?.message || 'Invalid device IDs');
  }

  if (!method || typeof method !== 'string') {
    return apiErr('VALIDATION_ERROR', 'Method is required');
  }

  return sendDeviceCommand(deviceIds, method, params);
}

/**
 * Set device attributes (for customization like sound, light color)
 */
export async function setDeviceAttributesService(
  deviceIds: string[],
  attributes: Record<string, unknown>
): Promise<ApiResponse<void>> {
  // Validate device IDs using domain layer
  const validation = validateDeviceIds(deviceIds);
  if (!validation.success) {
    return apiErr('VALIDATION_ERROR', validation.errors[0]?.message || 'Invalid device IDs');
  }

  if (!attributes || typeof attributes !== 'object') {
    return apiErr('VALIDATION_ERROR', 'Attributes object is required');
  }

  return setDeviceAttributes(deviceIds, attributes);
}

/**
 * Get all target custom names for the current user
 */
export async function getTargetCustomNamesService(): Promise<ApiResponse<Map<string, string>>> {
  return getTargetCustomNames();
}

/**
 * Set a custom name for a target
 */
export async function setTargetCustomNameService(
  targetId: string,
  originalName: string,
  customName: string
): Promise<ApiResponse<void>> {
  const validation = validateUpdateCustomNameInput({
    targetId,
    customName,
  });
  if (!validation.success) {
    return apiErr('VALIDATION_ERROR', validation.errors[0]?.message || 'Invalid custom name input');
  }

  if (!originalName || typeof originalName !== 'string') {
    return apiErr('VALIDATION_ERROR', 'Original name is required');
  }

  const trimmedName = customName.trim();
  if (!trimmedName) {
    return apiErr('VALIDATION_ERROR', 'Custom name cannot be empty');
  }

  return setTargetCustomName(targetId, originalName, trimmedName);
}

/**
 * Remove a custom name for a target
 */
export async function removeTargetCustomNameService(targetId: string): Promise<ApiResponse<void>> {
  const validation = validateDeviceId(targetId);
  if (!validation.success) {
    return apiErr('VALIDATION_ERROR', validation.errors[0]?.message || 'Invalid target ID');
  }

  return removeTargetCustomName(validation.data);
}
