/**
 * Profile Domain Permissions
 * 
 * Permission checks for profile operations.
 * Pure functions - no React or Supabase imports.
 */

import { PROFILE_CONSTRAINTS } from './validators';

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
  isOwner?: boolean;
};

/**
 * Profile context for permission checks
 */
export type ProfileContext = {
  profileId: string;
  ownerId: string;
};

/**
 * Check if user can view a profile
 */
export function canViewProfile(
  user: UserContext,
  profile: ProfileContext
): PermissionResult {
  // Admin can view any profile
  if (user.isAdmin) {
    return { allowed: true };
  }
  
  // Users can view their own profile
  if (user.userId === profile.ownerId) {
    return { allowed: true };
  }
  
  // For now, profiles are private
  return {
    allowed: false,
    reason: 'You do not have permission to view this profile',
    code: 'NOT_AUTHORIZED',
  };
}

/**
 * Check if user can update a profile
 */
export function canUpdateProfile(
  user: UserContext,
  profile: ProfileContext
): PermissionResult {
  // Admin can update any profile
  if (user.isAdmin) {
    return { allowed: true };
  }
  
  // Only owner can update their profile
  if (user.userId !== profile.ownerId) {
    return {
      allowed: false,
      reason: 'You can only update your own profile',
      code: 'NOT_OWNER',
    };
  }
  
  return { allowed: true };
}

/**
 * Check if user can delete a profile
 */
export function canDeleteProfile(
  user: UserContext,
  profile: ProfileContext
): PermissionResult {
  // Admin can delete any profile
  if (user.isAdmin) {
    return { allowed: true };
  }
  
  // Only owner can delete their profile
  if (user.userId !== profile.ownerId) {
    return {
      allowed: false,
      reason: 'You can only delete your own profile',
      code: 'NOT_OWNER',
    };
  }
  
  return { allowed: true };
}

/**
 * Check if user can view session history
 */
export function canViewSessionHistory(
  user: UserContext,
  profile: ProfileContext
): PermissionResult {
  // Admin can view any session history
  if (user.isAdmin) {
    return { allowed: true };
  }
  
  // Users can only view their own session history
  if (user.userId !== profile.ownerId) {
    return {
      allowed: false,
      reason: 'You can only view your own session history',
      code: 'NOT_OWNER',
    };
  }
  
  return { allowed: true };
}

/**
 * Check if user can view WiFi credentials
 */
export function canViewWifiCredentials(
  user: UserContext,
  profile: ProfileContext
): PermissionResult {
  // Admin can view any WiFi credentials
  if (user.isAdmin) {
    return { allowed: true };
  }
  
  // Only owner can view their WiFi credentials
  if (user.userId !== profile.ownerId) {
    return {
      allowed: false,
      reason: 'You can only view your own WiFi credentials',
      code: 'NOT_OWNER',
    };
  }
  
  return { allowed: true };
}

/**
 * Check if user can update WiFi credentials
 */
export function canUpdateWifiCredentials(
  user: UserContext,
  profile: ProfileContext
): PermissionResult {
  // Admin can update any WiFi credentials
  if (user.isAdmin) {
    return { allowed: true };
  }
  
  // Only owner can update their WiFi credentials
  if (user.userId !== profile.ownerId) {
    return {
      allowed: false,
      reason: 'You can only update your own WiFi credentials',
      code: 'NOT_OWNER',
    };
  }
  
  return { allowed: true };
}

/**
 * Check if user can view analytics
 */
export function canViewAnalytics(
  user: UserContext,
  profile: ProfileContext
): PermissionResult {
  // Admin can view any analytics
  if (user.isAdmin) {
    return { allowed: true };
  }
  
  // Users can only view their own analytics
  if (user.userId !== profile.ownerId) {
    return {
      allowed: false,
      reason: 'You can only view your own analytics',
      code: 'NOT_OWNER',
    };
  }
  
  return { allowed: true };
}



