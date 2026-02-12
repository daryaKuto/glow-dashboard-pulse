/**
 * Leaderboard Domain Ports
 *
 * Repository interfaces for data access.
 * Pure types - no React or Supabase imports.
 */

import type { ApiResponse } from '@/shared/lib/api-response';

/**
 * Leaderboard entry record (data layer)
 */
export type LeaderboardRecord = {
  id: string;
  name: string;
  score: number;
  hits: number;
  accuracy: number;
};

/**
 * Leaderboard entry with ranking applied
 */
export type LeaderboardEntry = LeaderboardRecord & {
  rank: number;
};

/**
 * Leaderboard query options
 */
export type LeaderboardQuery = {
  timeframe: 'day' | 'week' | 'month' | 'all';
  sortBy: 'score' | 'hits' | 'accuracy';
  limit?: number;
};

/**
 * Leaderboard Repository Interface
 *
 * Defines the contract for leaderboard data access.
 */
export interface LeaderboardRepository {
  /**
   * Get leaderboard entries for the given query
   */
  getLeaderboard(query: LeaderboardQuery): Promise<ApiResponse<LeaderboardRecord[]>>;
}
