import { supabase } from '@/data/supabase-client';
import { apiOk, apiErr, type ApiResponse } from '@/shared/lib/api-response';
import type { LeaderboardRepository, LeaderboardQuery, LeaderboardRecord } from '@/domain/leaderboard/ports';

/**
 * Repository layer for Leaderboard feature
 *
 * Handles data access operations (Supabase queries).
 * Returns ApiResponse<T> for consistent error handling.
 */

type LeaderboardDbRow = {
  id: string | number;
  name: string | null;
  score: number | null;
  hits: number | null;
  accuracy: number | null;
};

const mapLeaderboardRow = (row: LeaderboardDbRow): LeaderboardRecord => ({
  id: String(row.id),
  name: row.name ?? 'Unknown Player',
  score: Number(row.score ?? 0),
  hits: Number(row.hits ?? 0),
  accuracy: Number(row.accuracy ?? 0),
});

const isMissingTimeframeColumn = (error: { message?: string; code?: string } | null) => {
  if (!error) return false;
  const message = error.message?.toLowerCase() ?? '';
  return message.includes('timeframe') && message.includes('column');
};

const buildLeaderboardQuery = (
  query: LeaderboardQuery,
  includeTimeframeFilter: boolean
) => {
  const { timeframe, sortBy, limit } = query;
  let request = (supabase.from('leaderboards') as any)
    .select('id, name, score, hits, accuracy')
    .order(sortBy, { ascending: false });

  if (includeTimeframeFilter && timeframe !== 'all') {
    request = request.eq('timeframe', timeframe);
  }

  if (limit) {
    request = request.limit(limit);
  }

  return request;
};

/**
 * Get leaderboard entries
 */
export async function getLeaderboard(query: LeaderboardQuery): Promise<ApiResponse<LeaderboardRecord[]>> {
  try {
    let { data, error } = await buildLeaderboardQuery(query, true);

    if (error && isMissingTimeframeColumn(error) && query.timeframe !== 'all') {
      ({ data, error } = await buildLeaderboardQuery(query, false));
    }

    if (error) {
      return apiErr('FETCH_LEADERBOARD_ERROR', error.message, error);
    }

    const records = (data ?? []).map(mapLeaderboardRow);
    return apiOk(records);
  } catch (error) {
    console.error('[Leaderboard Repo] Error fetching leaderboard entries:', error);
    return apiErr(
      'FETCH_LEADERBOARD_ERROR',
      error instanceof Error ? error.message : 'Failed to fetch leaderboard entries',
      error
    );
  }
}

/**
 * Repository adapter (ports & adapters pattern)
 */
export const leaderboardRepository: LeaderboardRepository = {
  getLeaderboard,
};
