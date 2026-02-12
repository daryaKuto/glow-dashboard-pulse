import { useQuery } from '@tanstack/react-query';
import { getLeaderboardService } from './service';
import type { LeaderboardEntry, LeaderboardQuery } from '@/domain/leaderboard/ports';

/**
 * React Query hooks for Leaderboard feature
 */

export const leaderboardKeys = {
  all: ['leaderboard'] as const,
  entries: (query: LeaderboardQuery) =>
    [...leaderboardKeys.all, 'entries', query.timeframe, query.sortBy, query.limit] as const,
};

/**
 * Get leaderboard entries
 */
export function useLeaderboardEntries(query: LeaderboardQuery) {
  return useQuery<LeaderboardEntry[]>({
    queryKey: leaderboardKeys.entries(query),
    queryFn: async () => {
      const result = await getLeaderboardService(query);
      if (!result.ok) {
        throw new Error(result.error.message);
      }
      return result.data;
    },
    staleTime: 60 * 1000,
  });
}
