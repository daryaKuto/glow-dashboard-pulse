import { supabase } from '@/data/supabase-client';
import { apiOk, apiErr, type ApiResponse } from '@/shared/lib/api-response';
import { getWifiFromSupabase } from '@/features/profile/lib/wifi-credentials';
import { encryptPassword } from '@/shared/lib/credentials';
import { buildProfileStats, type SessionSummary } from '@/domain/profile/rules';
import {
  mapSessionRowToRecentSession,
  mapUserAnalyticsRowToMetrics,
  mapUserProfileRowToIdentity,
  type SessionDbRow,
  type UserAnalyticsDbRow,
  type UserProfileDbRow,
} from '@/domain/profile/mappers';
import type { ProfileRepository } from '@/domain/profile/ports';
import type {
  UserProfileData,
  RecentSession,
  UpdateProfile,
  WifiCredentials,
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
    const { data: userProfile, error: profileError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (profileError || !userProfile) {
      return apiOk(null);
    }

    const identity = mapUserProfileRowToIdentity(userProfile as UserProfileDbRow);

    const { data: analytics, error: analyticsError } = await supabase
      .from('user_analytics')
      .select('*')
      .eq('user_id', userId)
      .eq('period_type', 'all_time')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (analyticsError && analyticsError.code !== 'PGRST116') {
      throw analyticsError;
    }

    if (analytics) {
      const metrics = mapUserAnalyticsRowToMetrics(analytics as UserAnalyticsDbRow);
      return apiOk({ ...identity, ...metrics });
    }

    const { data: sessions, error: sessionsError } = await supabase
      .from('sessions')
      .select(`
        id,
        score,
        hit_count,
        total_shots,
        accuracy_percentage,
        duration_ms,
        avg_reaction_time_ms,
        best_reaction_time_ms,
        started_at
      `)
      .eq('user_id', userId);

    if (sessionsError) {
      throw sessionsError;
    }

    if (!sessions || sessions.length === 0) {
      return apiOk(null);
    }

    const summaries: SessionSummary[] = sessions.map((session) => ({
      id: session.id,
      score: session.score ?? 0,
      hitCount: session.hit_count ?? 0,
      durationMs: session.duration_ms ?? 0,
      accuracyPercentage: session.accuracy_percentage ?? null,
      startedAt: session.started_at,
    }));
    const stats = buildProfileStats(summaries);
    const totalShots = sessions.reduce((sum, s) => sum + (s.total_shots || 0), 0);
    const reactionTimes = sessions
      .map((s) => s.avg_reaction_time_ms)
      .filter((rt) => rt !== null) as number[];
    const avgReactionTime =
      reactionTimes.length > 0
        ? reactionTimes.reduce((sum, rt) => sum + rt, 0) / reactionTimes.length
        : null;
    const bestReactionTimes = sessions
      .map((s) => s.best_reaction_time_ms)
      .filter((rt) => rt !== null) as number[];
    const bestReactionTime = bestReactionTimes.length > 0 ? Math.min(...bestReactionTimes) : null;

    return apiOk({
      userId: identity.userId,
      email: identity.email,
      name: identity.name,
      avatarUrl: identity.avatarUrl,
      totalHits: stats.totalHits,
      totalShots,
      bestScore: stats.bestScore ?? 0,
      totalSessions: stats.totalSessions,
      avgAccuracy: Math.round((stats.averageAccuracy ?? 0) * 100) / 100,
      avgReactionTime,
      bestReactionTime,
      totalDuration: stats.totalPracticeTimeMs,
      scoreImprovement: 0,
      accuracyImprovement: 0,
    });
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
    const { data: sessions, error } = await supabase
      .from('sessions')
      .select(`
        id,
        scenario_name,
        scenario_type,
        room_name,
        room_id,
        score,
        accuracy_percentage,
        duration_ms,
        hit_count,
        total_shots,
        miss_count,
        avg_reaction_time_ms,
        best_reaction_time_ms,
        worst_reaction_time_ms,
        started_at,
        ended_at,
        thingsboard_data,
        raw_sensor_data
      `)
      .eq('user_id', userId)
      .order('started_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw error;
    }

    return apiOk(sessions?.map((session) => mapSessionRowToRecentSession(session as SessionDbRow)) || []);
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
    const { data: analytics, error } = await supabase
      .from('user_analytics')
      .select('*')
      .eq('user_id', userId)
      .eq('period_type', periodType)
      .gte('date', new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
      .order('date', { ascending: true });

    if (error) {
      throw error;
    }

    return apiOk(analytics || []);
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
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return apiOk(false);
    }

    const { error } = await supabase
      .from('user_profiles')
      .upsert({
        id: user.id,
        name: updates.name,
        display_name: updates.name,
        avatar_url: updates.avatarUrl,
        updated_at: new Date().toISOString(),
      });

    if (error) {
      throw error;
    }

    return apiOk(true);
  } catch (error) {
    console.error('[Profile Repo] Error updating profile:', error);
    return apiErr(
      'UPDATE_PROFILE_ERROR',
      error instanceof Error ? error.message : 'Failed to update profile',
      error
    );
  }
}

/**
 * Get WiFi credentials for user
 */
export async function getWifiCredentials(
  userId: string
): Promise<ApiResponse<WifiCredentials | null>> {
  try {
    const credentials = await getWifiFromSupabase(userId);
    return apiOk(credentials);
  } catch (error) {
    console.error('[Profile Repo] Error fetching WiFi credentials:', error);
    return apiErr(
      'FETCH_WIFI_CREDENTIALS_ERROR',
      error instanceof Error ? error.message : 'Failed to fetch WiFi credentials',
      error
    );
  }
}

/**
 * Save ThingsBoard credentials for a user
 */
export async function saveThingsBoardCredentials(
  userId: string,
  email: string,
  password: string
): Promise<ApiResponse<boolean>> {
  try {
    const encryptedPassword = encryptPassword(password);

    const { error } = await supabase
      .from('user_profiles')
      .update({
        thingsboard_email: email,
        thingsboard_password_encrypted: encryptedPassword,
        thingsboard_last_sync: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);

    if (error) {
      throw error;
    }

    return apiOk(true);
  } catch (error) {
    console.error('[Profile Repo] Error saving ThingsBoard credentials:', error);
    return apiErr(
      'SAVE_THINGSBOARD_CREDENTIALS_ERROR',
      error instanceof Error ? error.message : 'Failed to save ThingsBoard credentials',
      error
    );
  }
}

/**
 * Save WiFi credentials for a user
 */
export async function saveWifiCredentials(
  userId: string,
  ssid: string,
  password: string
): Promise<ApiResponse<boolean>> {
  try {
    const encryptedPassword = encryptPassword(password);

    const { error } = await supabase
      .from('user_profiles')
      .update({
        wifi_ssid_encrypted: ssid,
        wifi_password_encrypted: encryptedPassword,
        wifi_last_sync: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);

    if (error) {
      throw error;
    }

    return apiOk(true);
  } catch (error) {
    console.error('[Profile Repo] Error saving WiFi credentials:', error);
    return apiErr(
      'SAVE_WIFI_CREDENTIALS_ERROR',
      error instanceof Error ? error.message : 'Failed to save WiFi credentials',
      error
    );
  }
}

/**
 * Repository adapter (ports & adapters pattern)
 */
export const profileRepository: ProfileRepository = {
  getProfile,
  getRecentSessions,
  getStatsTrend,
  updateProfile,
  getWifiCredentials,
  saveThingsBoardCredentials,
  saveWifiCredentials,
};
