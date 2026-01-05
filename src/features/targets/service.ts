/**
 * Service layer for Targets feature
 * 
 * Contains business logic and orchestration.
 * Uses repository functions and domain layer validators/permissions.
 * Returns ApiResponse<T>.
 */

import {
  targetsRepository,
  type TargetsWithSummary,
} from './repo';
import type { TargetRepository } from '@/domain/targets/ports';
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
import {
  canViewTarget,
  canUpdateTarget,
  canSendTargetCommand,
  canAssignTarget,
  canViewTargetTelemetry,
  canRequestBatchDetails,
  type UserContext,
  type TargetContext,
} from '@/domain/targets/permissions';

// Repository injection for testing
let targetRepo: TargetRepository = targetsRepository;

/**
 * Set the target repository (for testing/dependency injection)
 */
export const setTargetRepository = (repo: TargetRepository): void => {
  targetRepo = repo;
};

/**
 * Get all targets with telemetry
 */
export async function getTargetsWithTelemetry(force = false): Promise<ApiResponse<TargetsWithSummary>> {
  return targetRepo.getTargets(force);
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

  return targetRepo.getTargetDetails(deviceIdsValidation.data, validatedOptions);
}

/**
 * Get target details with permission check
 */
export async function getTargetDetailsWithPermissionService(
  user: UserContext,
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

  // Check batch size permission
  const batchPermission = canRequestBatchDetails(user, deviceIds.length);
  if (!batchPermission.allowed) {
    return apiErr(batchPermission.code, batchPermission.reason);
  }

  let validatedOptions = options;
  if (options) {
    const optionsValidation = validateTargetDetailsOptions(options);
    if (!optionsValidation.success) {
      return apiErr('VALIDATION_ERROR', optionsValidation.errors[0]?.message || 'Invalid target details options');
    }
    validatedOptions = optionsValidation.data;
  }

  return targetRepo.getTargetDetails(deviceIdsValidation.data, validatedOptions);
}

/**
 * Get targets summary
 */
export async function getTargetsSummaryService(force = false): Promise<ApiResponse<TargetsSummary | null>> {
  return targetRepo.getTargetsSummary(force);
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

  return targetRepo.sendDeviceCommand(deviceIds, method, params);
}

/**
 * Send RPC command with permission check
 */
export async function sendDeviceCommandWithPermissionService(
  user: UserContext,
  targets: TargetContext[],
  method: string,
  params?: Record<string, unknown>
): Promise<ApiResponse<void>> {
  const deviceIds = targets.map(t => t.deviceId);
  
  // Validate device IDs using domain layer
  const validation = validateDeviceIds(deviceIds);
  if (!validation.success) {
    return apiErr('VALIDATION_ERROR', validation.errors[0]?.message || 'Invalid device IDs');
  }

  if (!method || typeof method !== 'string') {
    return apiErr('VALIDATION_ERROR', 'Method is required');
  }

  // Check permission for each target
  for (const target of targets) {
    const permissionResult = canSendTargetCommand(user, target);
    if (!permissionResult.allowed) {
      return apiErr(permissionResult.code, `${permissionResult.reason} (target: ${target.deviceId})`);
    }
  }

  return targetRepo.sendDeviceCommand(deviceIds, method, params);
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

  return targetRepo.setDeviceAttributes(deviceIds, attributes);
}

/**
 * Set device attributes with permission check
 */
export async function setDeviceAttributesWithPermissionService(
  user: UserContext,
  targets: TargetContext[],
  attributes: Record<string, unknown>
): Promise<ApiResponse<void>> {
  const deviceIds = targets.map(t => t.deviceId);
  
  // Validate device IDs using domain layer
  const validation = validateDeviceIds(deviceIds);
  if (!validation.success) {
    return apiErr('VALIDATION_ERROR', validation.errors[0]?.message || 'Invalid device IDs');
  }

  if (!attributes || typeof attributes !== 'object') {
    return apiErr('VALIDATION_ERROR', 'Attributes object is required');
  }

  // Check permission for each target
  for (const target of targets) {
    const permissionResult = canUpdateTarget(user, target);
    if (!permissionResult.allowed) {
      return apiErr(permissionResult.code, `${permissionResult.reason} (target: ${target.deviceId})`);
    }
  }

  return targetRepo.setDeviceAttributes(deviceIds, attributes);
}

/**
 * Get all target custom names for the current user
 */
export async function getTargetCustomNamesService(): Promise<ApiResponse<Map<string, string>>> {
  return targetRepo.getTargetCustomNames();
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

  return targetRepo.setTargetCustomName(targetId, originalName, trimmedName);
}

/**
 * Set a custom name with permission check
 */
export async function setTargetCustomNameWithPermissionService(
  user: UserContext,
  target: TargetContext,
  originalName: string,
  customName: string
): Promise<ApiResponse<void>> {
  const validation = validateUpdateCustomNameInput({
    targetId: target.deviceId,
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

  // Check permission
  const permissionResult = canUpdateTarget(user, target);
  if (!permissionResult.allowed) {
    return apiErr(permissionResult.code, permissionResult.reason);
  }

  return targetRepo.setTargetCustomName(target.deviceId, originalName, trimmedName);
}

/**
 * Remove a custom name for a target
 */
export async function removeTargetCustomNameService(targetId: string): Promise<ApiResponse<void>> {
  const validation = validateDeviceId(targetId);
  if (!validation.success) {
    return apiErr('VALIDATION_ERROR', validation.errors[0]?.message || 'Invalid target ID');
  }

  return targetRepo.removeTargetCustomName(validation.data);
}

/**
 * Remove a custom name with permission check
 */
export async function removeTargetCustomNameWithPermissionService(
  user: UserContext,
  target: TargetContext
): Promise<ApiResponse<void>> {
  const validation = validateDeviceId(target.deviceId);
  if (!validation.success) {
    return apiErr('VALIDATION_ERROR', validation.errors[0]?.message || 'Invalid target ID');
  }

  // Check permission
  const permissionResult = canUpdateTarget(user, target);
  if (!permissionResult.allowed) {
    return apiErr(permissionResult.code, permissionResult.reason);
  }

  return targetRepo.removeTargetCustomName(validation.data);
}

// ============================================================================
// Permission check helpers
// ============================================================================

/**
 * Check if user can view a target
 */
export function checkCanViewTarget(
  user: UserContext,
  target: TargetContext
): ApiResponse<boolean> {
  const result = canViewTarget(user, target);
  
  if (!result.allowed) {
    return apiErr(result.code, result.reason);
  }

  return apiOk(true);
}

/**
 * Check if user can update a target
 */
export function checkCanUpdateTarget(
  user: UserContext,
  target: TargetContext
): ApiResponse<boolean> {
  const result = canUpdateTarget(user, target);
  
  if (!result.allowed) {
    return apiErr(result.code, result.reason);
  }

  return apiOk(true);
}

/**
 * Check if user can send commands to a target
 */
export function checkCanSendTargetCommand(
  user: UserContext,
  target: TargetContext
): ApiResponse<boolean> {
  const result = canSendTargetCommand(user, target);
  
  if (!result.allowed) {
    return apiErr(result.code, result.reason);
  }

  return apiOk(true);
}

/**
 * Check if user can assign a target to a room
 */
export function checkCanAssignTarget(
  user: UserContext,
  target: TargetContext,
  roomOwnerId: string
): ApiResponse<boolean> {
  const result = canAssignTarget(user, target, roomOwnerId);
  
  if (!result.allowed) {
    return apiErr(result.code, result.reason);
  }

  return apiOk(true);
}

/**
 * Check if user can view target telemetry
 */
export function checkCanViewTargetTelemetry(
  user: UserContext,
  target: TargetContext
): ApiResponse<boolean> {
  const result = canViewTargetTelemetry(user, target);
  
  if (!result.allowed) {
    return apiErr(result.code, result.reason);
  }

  return apiOk(true);
}

/**
 * Check if user can request batch target details
 */
export function checkCanRequestBatchDetails(
  user: UserContext,
  targetCount: number
): ApiResponse<boolean> {
  const result = canRequestBatchDetails(user, targetCount);
  
  if (!result.allowed) {
    return apiErr(result.code, result.reason);
  }

  return apiOk(true);
}

// Re-export types for consumers
export type { UserContext, TargetContext } from '@/domain/targets/permissions';
