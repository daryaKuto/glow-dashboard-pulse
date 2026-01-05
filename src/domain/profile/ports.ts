/**
 * Profile Domain Ports
 *
 * Repository interfaces for data access.
 * Pure types - no React or Supabase imports.
 */

import type { ApiResponse } from '@/shared/lib/api-response';

/**
 * User profile identity
 */
export type UserProfileIdentity = {
  userId: string;
  email: string | null;
  name: string | null;
  avatarUrl: string | null;
};

/**
 * User profile data
 */
export type UserProfileRecord = UserProfileIdentity & {
  totalHits: number;
  totalShots: number;
  bestScore: number;
  totalSessions: number;
  avgAccuracy: number;
  avgReactionTime: number | null;
  bestReactionTime: number | null;
  totalDuration: number;
  scoreImprovement: number;
  accuracyImprovement: number;
};

/**
 * Recent session record
 */
export type RecentSessionRecord = {
  id: string;
  scenarioName: string | null;
  scenarioType: string | null;
  roomName: string | null;
  roomId: string | null;
  score: number;
  accuracyPercentage: number | null;
  durationMs: number;
  hitCount: number;
  totalShots: number | null;
  missCount: number | null;
  avgReactionTimeMs: number | null;
  bestReactionTimeMs: number | null;
  worstReactionTimeMs: number | null;
  startedAt: string;
  endedAt: string | null;
  thingsboardData: Record<string, unknown> | null;
  rawSensorData: Record<string, unknown> | null;
};

/**
 * User analytics record
 */
export type UserAnalyticsRecord = {
  id: string;
  userId: string;
  periodType: string;
  date: string;
  totalSessions: number;
  totalHits: number;
  totalShots: number;
  avgAccuracy: number | null;
  avgReactionTime: number | null;
  bestScore: number | null;
  totalDuration: number;
  createdAt: string;
  updatedAt: string;
};

/**
 * Update profile input
 */
export type UpdateProfileInput = {
  name?: string;
  avatarUrl?: string | null;
};

/**
 * WiFi credentials
 */
export type WifiCredentialsRecord = {
  ssid: string;
  password: string;
};

/**
 * Profile Repository Interface
 * 
 * Defines the contract for profile data access.
 */
export interface ProfileRepository {
  /**
   * Get user profile data
   */
  getProfile(userId: string): Promise<ApiResponse<UserProfileRecord | null>>;

  /**
   * Get recent sessions for a user
   */
  getRecentSessions(userId: string, limit?: number): Promise<ApiResponse<RecentSessionRecord[]>>;

  /**
   * Get user stats trend
   */
  getStatsTrend(
    userId: string,
    periodType?: 'daily' | 'weekly' | 'monthly',
    days?: number
  ): Promise<ApiResponse<UserAnalyticsRecord[]>>;

  /**
   * Update user profile
   */
  updateProfile(updates: UpdateProfileInput): Promise<ApiResponse<boolean>>;

  /**
   * Get WiFi credentials for user
   */
  getWifiCredentials(userId: string): Promise<ApiResponse<WifiCredentialsRecord | null>>;

  /**
   * Save ThingsBoard credentials
   */
  saveThingsBoardCredentials(
    userId: string,
    email: string,
    password: string
  ): Promise<ApiResponse<boolean>>;
}

