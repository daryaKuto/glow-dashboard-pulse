/**
 * Service layer for Leaderboard feature
 *
 * Contains business logic and orchestration.
 * Uses repository functions and domain layer validators.
 * Returns ApiResponse<T>.
 */

import { apiErr, apiOk, type ApiResponse } from '@/shared/lib/api-response';
import type { LeaderboardEntry, LeaderboardQuery, LeaderboardRecord, LeaderboardRepository } from '@/domain/leaderboard/ports';
import { leaderboardRepository } from './repo';

// Repository injection for testing
let leaderboardRepo: LeaderboardRepository = leaderboardRepository;

/**
 * Set the leaderboard repository (for testing/dependency injection)
 */
export const setLeaderboardRepository = (repo: LeaderboardRepository): void => {
  leaderboardRepo = repo;
};

const applyRanking = (records: LeaderboardRecord[]): LeaderboardEntry[] => {
  return records.map((entry, index) => ({
    ...entry,
    rank: index + 1,
  }));
};

/**
 * Get leaderboard entries
 */
export async function getLeaderboardService(
  query: LeaderboardQuery
): Promise<ApiResponse<LeaderboardEntry[]>> {
  const result = await leaderboardRepo.getLeaderboard(query);
  if (!result.ok) {
    return apiErr(result.error.code, result.error.message, result.error.details);
  }

  const ranked = applyRanking(result.data);
  return apiOk(ranked);
}

// Re-export types for consumers
export type { LeaderboardEntry, LeaderboardQuery } from '@/domain/leaderboard/ports';
