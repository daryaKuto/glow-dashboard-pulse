/**
 * Games Domain Permissions
 * 
 * Permission checks for game operations.
 * Pure functions - no React or Supabase imports.
 */

import { GAME_CONSTRAINTS, type GameSessionStatus } from './validators';

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
 * Game session context for permission checks
 */
export type GameSessionContext = {
  sessionId: string;
  ownerId: string;
  status: GameSessionStatus;
  targetIds: string[];
};

/**
 * Target context for permission checks
 */
export type TargetContext = {
  targetId: string;
  ownerId: string;
  isOnline: boolean;
};

/**
 * Check if user can start a new game session
 */
export function canStartGameSession(
  user: UserContext,
  activeSessionCount: number
): PermissionResult {
  // Admin can always start sessions
  if (user.isAdmin) {
    return { allowed: true };
  }
  
  // Check concurrent session limit based on subscription
  const maxConcurrentSessions = getMaxConcurrentSessions(user.subscriptionTier);
  
  if (activeSessionCount >= maxConcurrentSessions) {
    return {
      allowed: false,
      reason: `You can only have ${maxConcurrentSessions} active game session(s) at a time`,
      code: 'SESSION_LIMIT_REACHED',
    };
  }
  
  return { allowed: true };
}

/**
 * Check if user can stop a game session
 */
export function canStopGameSession(
  user: UserContext,
  session: GameSessionContext
): PermissionResult {
  // Admin can stop any session
  if (user.isAdmin) {
    return { allowed: true };
  }
  
  // Only owner can stop their session
  if (session.ownerId !== user.userId) {
    return {
      allowed: false,
      reason: 'You can only stop your own game sessions',
      code: 'NOT_OWNER',
    };
  }
  
  return { allowed: true };
}

/**
 * Check if user can view a game session
 */
export function canViewGameSession(
  user: UserContext,
  session: GameSessionContext
): PermissionResult {
  // Admin can view any session
  if (user.isAdmin) {
    return { allowed: true };
  }
  
  // Only owner can view their session
  if (session.ownerId !== user.userId) {
    return {
      allowed: false,
      reason: 'You can only view your own game sessions',
      code: 'NOT_OWNER',
    };
  }
  
  return { allowed: true };
}

/**
 * Check if user can use a target for a game
 */
export function canUseTargetForGame(
  user: UserContext,
  target: TargetContext
): PermissionResult {
  // Admin can use any target
  if (user.isAdmin) {
    return { allowed: true };
  }
  
  // Only owner can use their targets
  if (target.ownerId !== user.userId) {
    return {
      allowed: false,
      reason: 'You can only use your own targets',
      code: 'NOT_OWNER',
    };
  }
  
  // Target must be online
  if (!target.isOnline) {
    return {
      allowed: false,
      reason: 'Target must be online to use in a game',
      code: 'TARGET_OFFLINE',
    };
  }
  
  return { allowed: true };
}

/**
 * Check if user can save a game preset
 */
export function canSaveGamePreset(
  user: UserContext,
  currentPresetCount: number
): PermissionResult {
  // Admin can always save presets
  if (user.isAdmin) {
    return { allowed: true };
  }
  
  // Check preset limit based on subscription
  const maxPresets = getMaxGamePresets(user.subscriptionTier);
  
  if (currentPresetCount >= maxPresets) {
    return {
      allowed: false,
      reason: `You can only have ${maxPresets} game preset(s) on your subscription tier`,
      code: 'PRESET_LIMIT_REACHED',
    };
  }
  
  return { allowed: true };
}

/**
 * Check if user can delete a game preset
 */
export function canDeleteGamePreset(
  user: UserContext,
  presetOwnerId: string
): PermissionResult {
  // Admin can delete any preset
  if (user.isAdmin) {
    return { allowed: true };
  }
  
  // Only owner can delete their preset
  if (presetOwnerId !== user.userId) {
    return {
      allowed: false,
      reason: 'You can only delete your own game presets',
      code: 'NOT_OWNER',
    };
  }
  
  return { allowed: true };
}

/**
 * Check if user can view game history
 */
export function canViewGameHistory(
  user: UserContext,
  historyOwnerId: string
): PermissionResult {
  // Admin can view any history
  if (user.isAdmin) {
    return { allowed: true };
  }
  
  // Only owner can view their history
  if (historyOwnerId !== user.userId) {
    return {
      allowed: false,
      reason: 'You can only view your own game history',
      code: 'NOT_OWNER',
    };
  }
  
  return { allowed: true };
}

/**
 * Check if user can use a specific number of targets
 */
export function canUseTargetCount(
  user: UserContext,
  targetCount: number
): PermissionResult {
  // Check minimum targets
  if (targetCount < GAME_CONSTRAINTS.MIN_TARGETS) {
    return {
      allowed: false,
      reason: `At least ${GAME_CONSTRAINTS.MIN_TARGETS} target(s) required`,
      code: 'INSUFFICIENT_TARGETS',
    };
  }
  
  // Check maximum targets based on subscription
  const maxTargets = getMaxTargetsPerGame(user.subscriptionTier);
  
  if (targetCount > maxTargets) {
    return {
      allowed: false,
      reason: `Your subscription allows up to ${maxTargets} targets per game`,
      code: 'TARGET_LIMIT_EXCEEDED',
    };
  }
  
  return { allowed: true };
}

/**
 * Get maximum concurrent sessions for subscription tier
 */
export function getMaxConcurrentSessions(tier?: 'free' | 'pro' | 'enterprise'): number {
  switch (tier) {
    case 'enterprise':
      return 10;
    case 'pro':
      return 3;
    case 'free':
    default:
      return 1;
  }
}

/**
 * Get maximum game presets for subscription tier
 */
export function getMaxGamePresets(tier?: 'free' | 'pro' | 'enterprise'): number {
  switch (tier) {
    case 'enterprise':
      return 100;
    case 'pro':
      return 25;
    case 'free':
    default:
      return 5;
  }
}

/**
 * Get maximum targets per game for subscription tier
 */
export function getMaxTargetsPerGame(tier?: 'free' | 'pro' | 'enterprise'): number {
  switch (tier) {
    case 'enterprise':
      return GAME_CONSTRAINTS.MAX_TARGETS;
    case 'pro':
      return 25;
    case 'free':
    default:
      return 10;
  }
}

/**
 * Get maximum game duration for subscription tier (in milliseconds)
 */
export function getMaxGameDuration(tier?: 'free' | 'pro' | 'enterprise'): number {
  switch (tier) {
    case 'enterprise':
      return GAME_CONSTRAINTS.MAX_TIME_LIMIT_MS;
    case 'pro':
      return 30 * 60 * 1000; // 30 minutes
    case 'free':
    default:
      return 10 * 60 * 1000; // 10 minutes
  }
}

