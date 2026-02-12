import { useQuery } from '@tanstack/react-query';
import { getDashboardMetricsService } from './service';
import { getRecentSessionsService } from '@/features/profile/service';
import type { DashboardMetricsData } from './schema';
import type { DashboardMetricsResult } from './repo';
import type { RecentSession } from '@/features/profile';

/**
 * React Query hooks for Dashboard feature
 */

/**
 * Session represents a single instance of a game played by a user.
 * This is the dashboard-specific session format with complete analytics.
 */
export interface DashboardSession {
  id: string;
  gameId?: string;
  gameName: string;
  gameType: string;
  roomName: string;
  score: number;
  accuracy: number;
  duration: number;
  hitCount: number;
  totalShots: number;
  missCount: number;
  avgReactionTime: number | null;
  bestReactionTime: number | null;
  worstReactionTime: number | null;
  startedAt: string;
  endedAt: string;
  thingsboardData: unknown;
  rawSensorData: unknown;
  // Legacy fields for backward compatibility
  scenarioName?: string;
  scenarioType?: string;
}

/**
 * Maps RecentSession from profile service to DashboardSession format
 */
function mapRecentSessionToDashboardSession(session: RecentSession): DashboardSession {
  const score = typeof session.score === 'number' && Number.isFinite(session.score) ? session.score : 0;
  const accuracy = typeof session.accuracy === 'number' && Number.isFinite(session.accuracy) ? session.accuracy : 0;
  const durationMs = typeof session.duration === 'number' && Number.isFinite(session.duration) ? session.duration : 0;
  const hitCount = typeof session.hitCount === 'number' && Number.isFinite(session.hitCount) ? session.hitCount : 0;
  const totalShots = typeof session.totalShots === 'number' && Number.isFinite(session.totalShots)
    ? session.totalShots
    : hitCount;
  const missCount = typeof session.missCount === 'number' && Number.isFinite(session.missCount)
    ? session.missCount
    : Math.max(totalShots - hitCount, 0);

  return {
    id: session.id,
    gameId: session.id,
    gameName: session.scenarioName ?? session.scenarioType ?? 'Game Session',
    gameType: session.scenarioType ?? 'custom',
    roomName: session.roomName ?? '—',
    score,
    accuracy,
    duration: durationMs,
    hitCount,
    totalShots,
    missCount,
    avgReactionTime: session.avgReactionTime ?? null,
    bestReactionTime: session.bestReactionTime ?? null,
    worstReactionTime: session.worstReactionTime ?? null,
    startedAt: session.startedAt ?? new Date().toISOString(),
    endedAt: session.endedAt ?? session.startedAt ?? new Date().toISOString(),
    thingsboardData: session.thingsboardData,
    rawSensorData: session.rawSensorData,
    scenarioName: session.scenarioName ?? undefined,
    scenarioType: session.scenarioType ?? undefined,
  };
}

// Query keys
export const dashboardKeys = {
  all: ['dashboard'] as const,
  metrics: (force?: boolean, userId?: string) => [...dashboardKeys.all, 'metrics', force, userId] as const,
  sessions: (userId: string, limit?: number) => [...dashboardKeys.all, 'sessions', userId, limit] as const,
};

/**
 * Get dashboard metrics
 */
export function useDashboardMetrics(force = false, userId?: string) {
  return useQuery({
    queryKey: dashboardKeys.metrics(force, userId),
    queryFn: async () => {
      const result = await getDashboardMetricsService(force, {}, userId);
      if (!result.ok) {
        throw new Error(result.error.message);
      }
      return result.data;
    },
    staleTime: 60 * 1000, // 60 seconds - increased to reduce refetches
    refetchOnMount: false, // Don't refetch if data exists and is fresh
    enabled: !!userId, // Only fetch when userId is available
  });
}

/**
 * Get dashboard sessions (game session history)
 * Replaces the Zustand useSessions store for dashboard usage.
 *
 * @param userId - The user ID to fetch sessions for
 * @param limit - Maximum number of sessions to fetch (default 100, max 100 due to API constraint)
 */
export function useDashboardSessions(
  userId: string | null | undefined,
  limit = 100
) {
  return useQuery({
    queryKey: dashboardKeys.sessions(userId || '', limit),
    queryFn: async () => {
      if (!userId) throw new Error('User ID is required');
      // Cap limit at 100 (API maximum)
      const fetchLimit = Math.min(limit, 100);
      const result = await getRecentSessionsService(userId, fetchLimit);
      if (!result.ok) {
        throw new Error(result.error.message);
      }
      // Map to dashboard session format and sort by startedAt descending
      const sessions = result.data
        .map(mapRecentSessionToDashboardSession)
        .sort((a, b) => {
          const aTs = Date.parse(a.startedAt);
          const bTs = Date.parse(b.startedAt);
          return bTs - aTs;
        });
      return sessions;
    },
    enabled: !!userId,
    staleTime: 30 * 1000, // 30 seconds
    refetchOnMount: false,
  });
}
