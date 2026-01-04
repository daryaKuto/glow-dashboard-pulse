/**
 * Service layer for Profile feature
 * 
 * Contains business logic and orchestration.
 * Uses repository functions and domain layer validators.
 * Returns ApiResponse<T>.
 */

import {
  getProfile,
  getRecentSessions,
  getStatsTrend,
  updateProfile as updateProfileRepo,
  getWifiCredentials,
  saveThingsBoardCredentials,
} from './repo';
import { apiErr } from '@/shared/lib/api-response';
import type {
  UserProfileData,
  RecentSession,
  UpdateProfile,
  WifiCredentials,
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

type UserAnalytics = Database['public']['Tables']['user_analytics']['Row'];

/**
 * Get user profile
 */
export async function getProfileService(
  userId: string
): Promise<import('@/shared/lib/api-response').ApiResponse<UserProfileData | null>> {
  // Validate using domain layer
  const validation = validateUserId(userId);
  if (!validation.success) {
    const firstError = validation.errors[0];
    return apiErr('VALIDATION_ERROR', firstError?.message || 'Invalid user ID');
  }

  return getProfile(userId);
}

/**
 * Get recent sessions
 */
export async function getRecentSessionsService(
  userId: string,
  limit = 10
): Promise<import('@/shared/lib/api-response').ApiResponse<RecentSession[]>> {
  // Validate using domain layer
  const validation = validateRecentSessionsQuery({ userId, limit });
  if (!validation.success) {
    const firstError = validation.errors[0];
    return apiErr('VALIDATION_ERROR', firstError?.message || 'Invalid query parameters');
  }

  return getRecentSessions(userId, limit);
}

/**
 * Get stats trend
 */
export async function getStatsTrendService(
  userId: string,
  periodType: 'daily' | 'weekly' | 'monthly' = 'daily',
  days = 30
): Promise<import('@/shared/lib/api-response').ApiResponse<UserAnalytics[]>> {
  // Validate using domain layer
  const validation = validateStatsTrendQuery({ userId, periodType, days });
  if (!validation.success) {
    const firstError = validation.errors[0];
    return apiErr('VALIDATION_ERROR', firstError?.message || 'Invalid query parameters');
  }

  return getStatsTrend(userId, periodType, days);
}

/**
 * Update profile
 */
export async function updateProfileService(
  updates: UpdateProfile
): Promise<import('@/shared/lib/api-response').ApiResponse<boolean>> {
  // Validate using domain layer
  const validation = validateUpdateProfileInput(updates);
  if (!validation.success) {
    const firstError = validation.errors[0];
    return apiErr('VALIDATION_ERROR', firstError?.message || 'Invalid update data');
  }

  return updateProfileRepo(updates);
}

/**
 * Get WiFi credentials for user
 */
export async function getWifiCredentialsService(
  userId: string
): Promise<import('@/shared/lib/api-response').ApiResponse<WifiCredentials | null>> {
  // Validate using domain layer
  const validation = validateUserId(userId);
  if (!validation.success) {
    const firstError = validation.errors[0];
    return apiErr('VALIDATION_ERROR', firstError?.message || 'Invalid user ID');
  }

  return getWifiCredentials(userId);
}

/**
 * Save ThingsBoard credentials for a user
 */
export async function saveThingsBoardCredentialsService(
  userId: string,
  email: string,
  password: string
): Promise<import('@/shared/lib/api-response').ApiResponse<boolean>> {
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

  return saveThingsBoardCredentials(userId, email, password);
}
