/**
 * Targets Domain Permissions
 * 
 * Permission checks for target operations.
 * Pure functions - no React or Supabase imports.
 */

import { TARGET_CONSTRAINTS } from './validators';

/**
 * Permission check result
 */
export type PermissionResult = 
  | { allowed: true }
  | { allowed: false; reason: string; code: string };

/**
 * User context for permission checks
 */
export type UserContext = {
  userId: string;
  isAdmin?: boolean;
  subscriptionTier?: 'free' | 'pro' | 'enterprise';
};

/**
 * Target context for permission checks
 */
export type TargetContext = {
  deviceId: string;
  ownerId: string;
  roomId?: string | null;
};

/**
 * Check if user can view a target
 */
export function canViewTarget(
  user: UserContext,
  target: TargetContext
): PermissionResult {
  // Admin can view any target
  if (user.isAdmin) {
    return { allowed: true };
  }
  
  // Only owner can view their target
  if (target.ownerId !== user.userId) {
    return {
      allowed: false,
      reason: 'You do not have permission to view this target',
      code: 'NOT_OWNER',
    };
  }
  
  return { allowed: true };
}

/**
 * Check if user can update a target (e.g., rename)
 */
export function canUpdateTarget(
  user: UserContext,
  target: TargetContext
): PermissionResult {
  // Admin can update any target
  if (user.isAdmin) {
    return { allowed: true };
  }
  
  // Only owner can update their target
  if (target.ownerId !== user.userId) {
    return {
      allowed: false,
      reason: 'You do not have permission to update this target',
      code: 'NOT_OWNER',
    };
  }
  
  return { allowed: true };
}

/**
 * Check if user can send commands to a target
 */
export function canSendTargetCommand(
  user: UserContext,
  target: TargetContext
): PermissionResult {
  // Admin can send commands to any target
  if (user.isAdmin) {
    return { allowed: true };
  }
  
  // Only owner can send commands to their target
  if (target.ownerId !== user.userId) {
    return {
      allowed: false,
      reason: 'You do not have permission to control this target',
      code: 'NOT_OWNER',
    };
  }
  
  return { allowed: true };
}

/**
 * Check if user can assign a target to a room
 */
export function canAssignTarget(
  user: UserContext,
  target: TargetContext,
  roomOwnerId: string
): PermissionResult {
  // Admin can assign any target
  if (user.isAdmin) {
    return { allowed: true };
  }
  
  // User must own both the target and the room
  if (target.ownerId !== user.userId) {
    return {
      allowed: false,
      reason: 'You do not own this target',
      code: 'NOT_TARGET_OWNER',
    };
  }
  
  if (roomOwnerId !== user.userId) {
    return {
      allowed: false,
      reason: 'You do not own the destination room',
      code: 'NOT_ROOM_OWNER',
    };
  }
  
  return { allowed: true };
}

/**
 * Check if user can view target telemetry
 */
export function canViewTargetTelemetry(
  user: UserContext,
  target: TargetContext
): PermissionResult {
  // Same as view permission
  return canViewTarget(user, target);
}

/**
 * Check if user can request batch target details
 */
export function canRequestBatchDetails(
  user: UserContext,
  targetCount: number
): PermissionResult {
  // Admin has no limits
  if (user.isAdmin) {
    return { allowed: true };
  }
  
  // Check batch size limit
  const maxBatchSize = getMaxBatchSizeForTier(user.subscriptionTier);
  
  if (targetCount > maxBatchSize) {
    return {
      allowed: false,
      reason: `Cannot request more than ${maxBatchSize} targets at once`,
      code: 'BATCH_SIZE_EXCEEDED',
    };
  }
  
  return { allowed: true };
}

/**
 * Get maximum batch size for subscription tier
 */
export function getMaxBatchSizeForTier(tier?: 'free' | 'pro' | 'enterprise'): number {
  switch (tier) {
    case 'enterprise':
      return 200;
    case 'pro':
      return 100;
    case 'free':
    default:
      return TARGET_CONSTRAINTS.MAX_TARGETS_PER_BATCH;
  }
}

/**
 * Get maximum telemetry history range for subscription tier
 */
export function getMaxHistoryRangeForTier(tier?: 'free' | 'pro' | 'enterprise'): number {
  switch (tier) {
    case 'enterprise':
      return 7 * 24 * 60 * 60 * 1000; // 7 days
    case 'pro':
      return 3 * 24 * 60 * 60 * 1000; // 3 days
    case 'free':
    default:
      return TARGET_CONSTRAINTS.HISTORY_RANGE_MAX_MS; // 24 hours
  }
}

