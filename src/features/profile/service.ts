/**
 * Service layer for Profile feature
 * 
 * Contains business logic and orchestration.
 * Uses repository functions and domain layer validators/permissions.
 * Returns ApiResponse<T>.
 */

import { profileRepository } from './repo';
import type { ProfileRepository } from '@/domain/profile/ports';
import { apiOk, apiErr, type ApiResponse } from '@/shared/lib/api-response';
import type {
  UserProfileData,
  RecentSession,
  UpdateProfile,
  WifiCredentials,
  UpdateWifiCredentials,
} from './schema';
import type { Database } from '@/integrations/supabase/types';
import {
  validateUserId,
  validateUpdateProfileInput,
  validateRecentSessionsQuery,
  validateStatsTrendQuery,
  validateEmail,
} from '@/domain/profile/validators';
import { isNonEmptyString } from '@/domain/shared/validation-helpers';
import {
  canViewProfile,
  canUpdateProfile,
  canViewSessionHistory,
  canViewWifiCredentials,
  canUpdateWifiCredentials,
  canViewAnalytics,
  type UserContext,
  type ProfileContext,
} from '@/domain/profile/permissions';

type UserAnalytics = Database['public']['Tables']['user_analytics']['Row'];

// Repository injection for testing
let profileRepo: ProfileRepository = profileRepository;

/**
 * Set the profile repository (for testing/dependency injection)
 */
export const setProfileRepository = (repo: ProfileRepository): void => {
  profileRepo = repo;
};

/**
 * Get user profile
 */
export async function getProfileService(
  userId: string
): Promise<ApiResponse<UserProfileData | null>> {
  // Validate using domain layer
  const validation = validateUserId(userId);
  if (!validation.success) {
    const firstError = validation.errors[0];
    return apiErr('VALIDATION_ERROR', firstError?.message || 'Invalid user ID');
  }

  return profileRepo.getProfile(userId);
}

/**
 * Get user profile with permission check
 */
export async function getProfileWithPermissionService(
  requestingUser: UserContext,
  targetUserId: string
): Promise<ApiResponse<UserProfileData | null>> {
  // Validate using domain layer
  const validation = validateUserId(targetUserId);
  if (!validation.success) {
    const firstError = validation.errors[0];
    return apiErr('VALIDATION_ERROR', firstError?.message || 'Invalid user ID');
  }

  // Check permission
  const profileContext: ProfileContext = {
    profileId: targetUserId,
    ownerId: targetUserId,
  };
  const permissionResult = canViewProfile(requestingUser, profileContext);
  if (!permissionResult.allowed) {
    return apiErr(permissionResult.code, permissionResult.reason);
  }

  return profileRepo.getProfile(targetUserId);
}

/**
 * Get recent sessions
 */
export async function getRecentSessionsService(
  userId: string,
  limit = 10
): Promise<ApiResponse<RecentSession[]>> {
  // Validate using domain layer
  const validation = validateRecentSessionsQuery({ userId, limit });
  if (!validation.success) {
    const firstError = validation.errors[0];
    return apiErr('VALIDATION_ERROR', firstError?.message || 'Invalid query parameters');
  }

  return profileRepo.getRecentSessions(userId, limit);
}

/**
 * Get recent sessions with permission check
 */
export async function getRecentSessionsWithPermissionService(
  requestingUser: UserContext,
  targetUserId: string,
  limit = 10
): Promise<ApiResponse<RecentSession[]>> {
  // Validate using domain layer
  const validation = validateRecentSessionsQuery({ userId: targetUserId, limit });
  if (!validation.success) {
    const firstError = validation.errors[0];
    return apiErr('VALIDATION_ERROR', firstError?.message || 'Invalid query parameters');
  }

  // Check permission
  const profileContext: ProfileContext = {
    profileId: targetUserId,
    ownerId: targetUserId,
  };
  const permissionResult = canViewSessionHistory(requestingUser, profileContext);
  if (!permissionResult.allowed) {
    return apiErr(permissionResult.code, permissionResult.reason);
  }

  return profileRepo.getRecentSessions(targetUserId, limit);
}

/**
 * Get stats trend
 */
export async function getStatsTrendService(
  userId: string,
  periodType: 'daily' | 'weekly' | 'monthly' = 'daily',
  days = 30
): Promise<ApiResponse<UserAnalytics[]>> {
  // Validate using domain layer
  const validation = validateStatsTrendQuery({ userId, periodType, days });
  if (!validation.success) {
    const firstError = validation.errors[0];
    return apiErr('VALIDATION_ERROR', firstError?.message || 'Invalid query parameters');
  }

  return profileRepo.getStatsTrend(userId, periodType, days);
}

/**
 * Get stats trend with permission check
 */
export async function getStatsTrendWithPermissionService(
  requestingUser: UserContext,
  targetUserId: string,
  periodType: 'daily' | 'weekly' | 'monthly' = 'daily',
  days = 30
): Promise<ApiResponse<UserAnalytics[]>> {
  // Validate using domain layer
  const validation = validateStatsTrendQuery({ userId: targetUserId, periodType, days });
  if (!validation.success) {
    const firstError = validation.errors[0];
    return apiErr('VALIDATION_ERROR', firstError?.message || 'Invalid query parameters');
  }

  // Check permission
  const profileContext: ProfileContext = {
    profileId: targetUserId,
    ownerId: targetUserId,
  };
  const permissionResult = canViewAnalytics(requestingUser, profileContext);
  if (!permissionResult.allowed) {
    return apiErr(permissionResult.code, permissionResult.reason);
  }

  return profileRepo.getStatsTrend(targetUserId, periodType, days);
}

/**
 * Update profile
 */
export async function updateProfileService(
  updates: UpdateProfile
): Promise<ApiResponse<boolean>> {
  // Validate using domain layer
  const validation = validateUpdateProfileInput(updates);
  if (!validation.success) {
    const firstError = validation.errors[0];
    return apiErr('VALIDATION_ERROR', firstError?.message || 'Invalid update data');
  }

  return profileRepo.updateProfile(updates);
}

/**
 * Update profile with permission check
 */
export async function updateProfileWithPermissionService(
  requestingUser: UserContext,
  targetUserId: string,
  updates: UpdateProfile
): Promise<ApiResponse<boolean>> {
  // Validate using domain layer
  const validation = validateUpdateProfileInput(updates);
  if (!validation.success) {
    const firstError = validation.errors[0];
    return apiErr('VALIDATION_ERROR', firstError?.message || 'Invalid update data');
  }

  // Check permission
  const profileContext: ProfileContext = {
    profileId: targetUserId,
    ownerId: targetUserId,
  };
  const permissionResult = canUpdateProfile(requestingUser, profileContext);
  if (!permissionResult.allowed) {
    return apiErr(permissionResult.code, permissionResult.reason);
  }

  return profileRepo.updateProfile(updates);
}

/**
 * Get WiFi credentials for user
 */
export async function getWifiCredentialsService(
  userId: string
): Promise<ApiResponse<WifiCredentials | null>> {
  // Validate using domain layer
  const validation = validateUserId(userId);
  if (!validation.success) {
    const firstError = validation.errors[0];
    return apiErr('VALIDATION_ERROR', firstError?.message || 'Invalid user ID');
  }

  return profileRepo.getWifiCredentials(userId);
}

/**
 * Get WiFi credentials with permission check
 */
export async function getWifiCredentialsWithPermissionService(
  requestingUser: UserContext,
  targetUserId: string
): Promise<ApiResponse<WifiCredentials | null>> {
  // Validate using domain layer
  const validation = validateUserId(targetUserId);
  if (!validation.success) {
    const firstError = validation.errors[0];
    return apiErr('VALIDATION_ERROR', firstError?.message || 'Invalid user ID');
  }

  // Check permission
  const profileContext: ProfileContext = {
    profileId: targetUserId,
    ownerId: targetUserId,
  };
  const permissionResult = canViewWifiCredentials(requestingUser, profileContext);
  if (!permissionResult.allowed) {
    return apiErr(permissionResult.code, permissionResult.reason);
  }

  return profileRepo.getWifiCredentials(targetUserId);
}

/**
 * Save ThingsBoard credentials for a user
 */
export async function saveThingsBoardCredentialsService(
  userId: string,
  email: string,
  password: string
): Promise<ApiResponse<boolean>> {
  const userIdValidation = validateUserId(userId);
  if (!userIdValidation.success) {
    const firstError = userIdValidation.errors[0];
    return apiErr('VALIDATION_ERROR', firstError?.message || 'Invalid user ID');
  }

  const emailValidation = validateEmail(email);
  if (!emailValidation.success) {
    const firstError = emailValidation.errors[0];
    return apiErr('VALIDATION_ERROR', firstError?.message || 'Invalid email');
  }

  if (!isNonEmptyString(password)) {
    return apiErr('VALIDATION_ERROR', 'Password is required');
  }

  return profileRepo.saveThingsBoardCredentials(userId, email, password);
}

/**
 * Save ThingsBoard credentials with permission check
 */
export async function saveThingsBoardCredentialsWithPermissionService(
  requestingUser: UserContext,
  targetUserId: string,
  email: string,
  password: string
): Promise<ApiResponse<boolean>> {
  const userIdValidation = validateUserId(targetUserId);
  if (!userIdValidation.success) {
    const firstError = userIdValidation.errors[0];
    return apiErr('VALIDATION_ERROR', firstError?.message || 'Invalid user ID');
  }

  const emailValidation = validateEmail(email);
  if (!emailValidation.success) {
    const firstError = emailValidation.errors[0];
    return apiErr('VALIDATION_ERROR', firstError?.message || 'Invalid email');
  }

  if (!isNonEmptyString(password)) {
    return apiErr('VALIDATION_ERROR', 'Password is required');
  }

  // Check permission
  const profileContext: ProfileContext = {
    profileId: targetUserId,
    ownerId: targetUserId,
  };
  const permissionResult = canUpdateWifiCredentials(requestingUser, profileContext);
  if (!permissionResult.allowed) {
    return apiErr(permissionResult.code, permissionResult.reason);
  }

  return profileRepo.saveThingsBoardCredentials(targetUserId, email, password);
}

/**
 * Save WiFi credentials for a user
 */
export async function saveWifiCredentialsService(
  userId: string,
  credentials: UpdateWifiCredentials
): Promise<ApiResponse<boolean>> {
  const userIdValidation = validateUserId(userId);
  if (!userIdValidation.success) {
    const firstError = userIdValidation.errors[0];
    return apiErr('VALIDATION_ERROR', firstError?.message || 'Invalid user ID');
  }

  if (!isNonEmptyString(credentials.ssid)) {
    return apiErr('VALIDATION_ERROR', 'WiFi network name is required');
  }

  if (!isNonEmptyString(credentials.password) || credentials.password.length < 8) {
    return apiErr('VALIDATION_ERROR', 'Password must be at least 8 characters');
  }

  return profileRepo.saveWifiCredentials(userId, credentials.ssid, credentials.password);
}

/**
 * Save WiFi credentials with permission check
 */
export async function saveWifiCredentialsWithPermissionService(
  requestingUser: UserContext,
  targetUserId: string,
  credentials: UpdateWifiCredentials
): Promise<ApiResponse<boolean>> {
  const userIdValidation = validateUserId(targetUserId);
  if (!userIdValidation.success) {
    const firstError = userIdValidation.errors[0];
    return apiErr('VALIDATION_ERROR', firstError?.message || 'Invalid user ID');
  }

  if (!isNonEmptyString(credentials.ssid)) {
    return apiErr('VALIDATION_ERROR', 'WiFi network name is required');
  }

  if (!isNonEmptyString(credentials.password) || credentials.password.length < 8) {
    return apiErr('VALIDATION_ERROR', 'Password must be at least 8 characters');
  }

  // Check permission
  const profileContext: ProfileContext = {
    profileId: targetUserId,
    ownerId: targetUserId,
  };
  const permissionResult = canUpdateWifiCredentials(requestingUser, profileContext);
  if (!permissionResult.allowed) {
    return apiErr(permissionResult.code, permissionResult.reason);
  }

  return profileRepo.saveWifiCredentials(targetUserId, credentials.ssid, credentials.password);
}

// ============================================================================
// Permission check helpers
// ============================================================================

/**
 * Check if user can view a profile
 */
export function checkCanViewProfile(
  user: UserContext,
  profile: ProfileContext
): ApiResponse<boolean> {
  const result = canViewProfile(user, profile);
  
  if (!result.allowed) {
    return apiErr(result.code, result.reason);
  }

  return apiOk(true);
}

/**
 * Check if user can update a profile
 */
export function checkCanUpdateProfile(
  user: UserContext,
  profile: ProfileContext
): ApiResponse<boolean> {
  const result = canUpdateProfile(user, profile);
  
  if (!result.allowed) {
    return apiErr(result.code, result.reason);
  }

  return apiOk(true);
}

/**
 * Check if user can view session history
 */
export function checkCanViewSessionHistory(
  user: UserContext,
  profile: ProfileContext
): ApiResponse<boolean> {
  const result = canViewSessionHistory(user, profile);
  
  if (!result.allowed) {
    return apiErr(result.code, result.reason);
  }

  return apiOk(true);
}

/**
 * Check if user can view WiFi credentials
 */
export function checkCanViewWifiCredentials(
  user: UserContext,
  profile: ProfileContext
): ApiResponse<boolean> {
  const result = canViewWifiCredentials(user, profile);
  
  if (!result.allowed) {
    return apiErr(result.code, result.reason);
  }

  return apiOk(true);
}

/**
 * Check if user can view analytics
 */
export function checkCanViewAnalytics(
  user: UserContext,
  profile: ProfileContext
): ApiResponse<boolean> {
  const result = canViewAnalytics(user, profile);
  
  if (!result.allowed) {
    return apiErr(result.code, result.reason);
  }

  return apiOk(true);
}

// Re-export types for consumers
export type { UserContext, ProfileContext } from '@/domain/profile/permissions';
