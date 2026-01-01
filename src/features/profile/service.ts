/**
 * Service layer for Profile feature
 * 
 * Contains business logic and orchestration.
 * Uses repository functions and returns ApiResponse<T>.
 */

import {
  getProfile,
  getRecentSessions,
  getStatsTrend,
  updateProfile as updateProfileRepo,
} from './repo';
import type {
  UserProfileData,
  RecentSession,
  UpdateProfile,
} from './schema';
import type { Database } from '@/integrations/supabase/types';

type UserAnalytics = Database['public']['Tables']['user_analytics']['Row'];

/**
 * Get user profile
 */
export async function getProfileService(
  userId: string
): Promise<import('@/shared/lib/api-response').ApiResponse<UserProfileData | null>> {
  if (!userId) {
    return import('@/shared/lib/api-response').then(({ apiErr }) =>
      apiErr('VALIDATION_ERROR', 'User ID is required')
    );
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
  if (!userId) {
    return import('@/shared/lib/api-response').then(({ apiErr }) =>
      apiErr('VALIDATION_ERROR', 'User ID is required')
    );
  }

  if (limit < 1 || limit > 100) {
    return import('@/shared/lib/api-response').then(({ apiErr }) =>
      apiErr('VALIDATION_ERROR', 'Limit must be between 1 and 100')
    );
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
  if (!userId) {
    return import('@/shared/lib/api-response').then(({ apiErr }) =>
      apiErr('VALIDATION_ERROR', 'User ID is required')
    );
  }

  if (!['daily', 'weekly', 'monthly'].includes(periodType)) {
    return import('@/shared/lib/api-response').then(({ apiErr }) =>
      apiErr('VALIDATION_ERROR', 'Invalid period type')
    );
  }

  return getStatsTrend(userId, periodType, days);
}

/**
 * Update profile
 */
export async function updateProfileService(
  updates: UpdateProfile
): Promise<import('@/shared/lib/api-response').ApiResponse<boolean>> {
  // Validate updates
  if (updates.name !== undefined && (!updates.name || updates.name.trim().length === 0)) {
    return import('@/shared/lib/api-response').then(({ apiErr }) =>
      apiErr('VALIDATION_ERROR', 'Name cannot be empty')
    );
  }

  if (updates.name !== undefined && updates.name.length > 100) {
    return import('@/shared/lib/api-response').then(({ apiErr }) =>
      apiErr('VALIDATION_ERROR', 'Name is too long')
    );
  }

  return updateProfileRepo(updates);
}

