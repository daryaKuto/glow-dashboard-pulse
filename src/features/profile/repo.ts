import { supabase } from '@/data/supabase-client';
import { apiOk, apiErr, type ApiResponse } from '@/shared/lib/api-response';
import {
  fetchUserProfileData,
  fetchRecentSessions,
  updateUserProfile,
  getUserStatsTrend,
} from '@/services/profile';
import type {
  UserProfileData,
  RecentSession,
  UpdateProfile,
} from './schema';
import type { Database } from '@/integrations/supabase/types';

type UserAnalytics = Database['public']['Tables']['user_analytics']['Row'];

/**
 * Repository layer for Profile feature
 * 
 * Handles all data access operations (Supabase queries).
 * Returns ApiResponse<T> for consistent error handling.
 */

/**
 * Get user profile data
 */
export async function getProfile(userId: string): Promise<ApiResponse<UserProfileData | null>> {
  try {
    const profileData = await fetchUserProfileData(userId);
    return apiOk(profileData);
  } catch (error) {
    console.error('[Profile Repo] Error fetching profile:', error);
    return apiErr(
      'FETCH_PROFILE_ERROR',
      error instanceof Error ? error.message : 'Failed to fetch profile',
      error
    );
  }
}

/**
 * Get recent sessions for a user
 */
export async function getRecentSessions(
  userId: string,
  limit = 10
): Promise<ApiResponse<RecentSession[]>> {
  try {
    const sessions = await fetchRecentSessions(userId, limit);
    return apiOk(sessions);
  } catch (error) {
    console.error('[Profile Repo] Error fetching recent sessions:', error);
    return apiErr(
      'FETCH_SESSIONS_ERROR',
      error instanceof Error ? error.message : 'Failed to fetch recent sessions',
      error
    );
  }
}

/**
 * Get user stats trend
 */
export async function getStatsTrend(
  userId: string,
  periodType: 'daily' | 'weekly' | 'monthly' = 'daily',
  days = 30
): Promise<ApiResponse<UserAnalytics[]>> {
  try {
    const trend = await getUserStatsTrend(userId, periodType, days);
    return apiOk(trend);
  } catch (error) {
    console.error('[Profile Repo] Error fetching stats trend:', error);
    return apiErr(
      'FETCH_STATS_TREND_ERROR',
      error instanceof Error ? error.message : 'Failed to fetch stats trend',
      error
    );
  }
}

/**
 * Update user profile
 */
export async function updateProfile(
  updates: UpdateProfile
): Promise<ApiResponse<boolean>> {
  try {
    const success = await updateUserProfile(updates);
    return apiOk(success);
  } catch (error) {
    console.error('[Profile Repo] Error updating profile:', error);
    return apiErr(
      'UPDATE_PROFILE_ERROR',
      error instanceof Error ? error.message : 'Failed to update profile',
      error
    );
  }
}

