/**
 * Targets Domain Validators
 * 
 * Business validation rules for target operations.
 * Pure functions - no React or Supabase imports.
 */

import { z } from 'zod';
import { validateWithSchema, type ValidationResult, isValidUuid, isNonEmptyString } from '../shared/validation-helpers';

/**
 * Target validation constants
 */
export const TARGET_CONSTRAINTS = {
  CUSTOM_NAME_MAX_LENGTH: 100,
  DEVICE_ID_MIN_LENGTH: 1,
  MAX_TARGETS_PER_BATCH: 50,
  TELEMETRY_KEYS_MAX: 20,
  HISTORY_RANGE_MAX_MS: 24 * 60 * 60 * 1000, // 24 hours
  HISTORY_LIMIT_MAX: 1000,
  RECENT_WINDOW_MAX_MS: 60 * 60 * 1000, // 1 hour
} as const;

/**
 * Target status enum
 */
export const TARGET_STATUS = ['online', 'offline', 'standby'] as const;
export type TargetStatus = typeof TARGET_STATUS[number];

/**
 * Activity status enum
 */
export const ACTIVITY_STATUS = ['active', 'recent', 'standby'] as const;
export type ActivityStatus = typeof ACTIVITY_STATUS[number];

/**
 * Target status schema
 */
export const targetStatusSchema = z.enum(TARGET_STATUS);

/**
 * Activity status schema
 */
export const activityStatusSchema = z.enum(ACTIVITY_STATUS);

/**
 * Device ID validation schema
 */
export const deviceIdSchema = z.string().min(TARGET_CONSTRAINTS.DEVICE_ID_MIN_LENGTH, 'Device ID is required');

/**
 * Device IDs array schema
 */
export const deviceIdsArraySchema = z.array(deviceIdSchema)
  .min(1, 'At least one device ID is required')
  .max(TARGET_CONSTRAINTS.MAX_TARGETS_PER_BATCH, `Cannot request more than ${TARGET_CONSTRAINTS.MAX_TARGETS_PER_BATCH} targets at once`);

/**
 * Custom name schema
 */
export const customNameSchema = z.string()
  .max(TARGET_CONSTRAINTS.CUSTOM_NAME_MAX_LENGTH, 'Custom name is too long')
  .transform((val) => val.trim())
  .nullable();

/**
 * Target details options schema
 */
export const targetDetailsOptionsSchema = z.object({
  force: z.boolean().optional(),
  includeHistory: z.boolean().optional(),
  historyRangeMs: z.number()
    .min(0)
    .max(TARGET_CONSTRAINTS.HISTORY_RANGE_MAX_MS, 'History range too large')
    .optional(),
  historyLimit: z.number()
    .min(1)
    .max(TARGET_CONSTRAINTS.HISTORY_LIMIT_MAX, 'History limit too large')
    .optional(),
  telemetryKeys: z.array(z.string())
    .max(TARGET_CONSTRAINTS.TELEMETRY_KEYS_MAX, 'Too many telemetry keys')
    .optional(),
  historyKeys: z.array(z.string())
    .max(TARGET_CONSTRAINTS.TELEMETRY_KEYS_MAX, 'Too many history keys')
    .optional(),
  recentWindowMs: z.number()
    .min(0)
    .max(TARGET_CONSTRAINTS.RECENT_WINDOW_MAX_MS, 'Recent window too large')
    .optional(),
});

/**
 * Update custom name input schema
 */
export const updateCustomNameInputSchema = z.object({
  targetId: deviceIdSchema,
  customName: customNameSchema,
});

// Inferred types
export type DeviceId = z.infer<typeof deviceIdSchema>;
export type TargetDetailsOptions = z.infer<typeof targetDetailsOptionsSchema>;
export type UpdateCustomNameInput = z.infer<typeof updateCustomNameInputSchema>;

/**
 * Validate device ID
 */
export function validateDeviceId(deviceId: unknown): ValidationResult<string> {
  if (!isNonEmptyString(deviceId)) {
    return {
      success: false,
      errors: [{ field: 'deviceId', message: 'Device ID is required', code: 'required' }],
    };
  }
  
  return { success: true, data: deviceId };
}

/**
 * Validate device IDs array
 */
export function validateDeviceIds(deviceIds: unknown): ValidationResult<string[]> {
  return validateWithSchema(deviceIdsArraySchema, deviceIds);
}

/**
 * Validate target details options
 */
export function validateTargetDetailsOptions(options: unknown): ValidationResult<TargetDetailsOptions> {
  return validateWithSchema(targetDetailsOptionsSchema, options);
}

/**
 * Validate update custom name input
 */
export function validateUpdateCustomNameInput(input: unknown): ValidationResult<UpdateCustomNameInput> {
  return validateWithSchema(updateCustomNameInputSchema, input);
}

/**
 * Validate target status
 */
export function validateTargetStatus(status: unknown): ValidationResult<TargetStatus> {
  return validateWithSchema(targetStatusSchema, status);
}

/**
 * Validate activity status
 */
export function validateActivityStatus(status: unknown): ValidationResult<ActivityStatus> {
  return validateWithSchema(activityStatusSchema, status);
}

/**
 * Check if status is online
 */
export function isOnlineStatus(status: TargetStatus): boolean {
  return status === 'online';
}

/**
 * Check if status is active
 */
export function isActiveStatus(activityStatus: ActivityStatus): boolean {
  return activityStatus === 'active';
}

/**
 * Validate telemetry timestamp
 */
export function isValidTelemetryTimestamp(timestamp: unknown): timestamp is number {
  if (typeof timestamp !== 'number') {
    return false;
  }
  
  // Must be a positive number representing milliseconds since epoch
  // And not in the future (with some tolerance)
  const now = Date.now();
  const tolerance = 60 * 1000; // 1 minute tolerance
  
  return timestamp > 0 && timestamp <= now + tolerance;
}

