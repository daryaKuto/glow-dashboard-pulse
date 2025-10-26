import { create } from 'zustand';
import { fetchGameHistory, fetchAllGameHistory } from '@/services/game-history';
import { fetchRecentSessions, type RecentSession } from '@/services/profile';
import type { GameHistory } from '@/services/device-game-flow';

/**
 * Session represents a single instance of a game played by a user.
 * Sessions are stored in Supabase with complete analytics.
 */
export interface Session {
  id: string;
  gameId?: string;          // ThingsBoard gameId (e.g., "GM-001")
  gameName: string;          // Renamed from scenarioName
  gameType: string;          // Renamed from scenarioType
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
  thingsboardData: any;
  rawSensorData: any;
  
  // Legacy fields for backward compatibility
  scenarioName?: string;     // Keep for compatibility
  scenarioType?: string;     // Keep for compatibility
}

const toIsoString = (timestamp: number | null | undefined): string => {
  if (typeof timestamp === 'number' && Number.isFinite(timestamp)) {
    return new Date(timestamp).toISOString();
  }
  return new Date().toISOString();
};

export const mapGameHistoryToSession = (entry: GameHistory): Session => {
  const score = typeof entry.score === 'number' && Number.isFinite(entry.score) ? entry.score : 0;
  const accuracy = typeof entry.accuracy === 'number' && Number.isFinite(entry.accuracy) ? entry.accuracy : 0;
  const durationMs = Number.isFinite(entry.actualDuration) ? Math.round(entry.actualDuration * 1000) : 0;
  const totalHits = Number.isFinite(entry.totalHits) ? entry.totalHits : 0;

  return {
    id: entry.gameId,
    gameId: entry.gameId,
    gameName: entry.gameName ?? entry.scenarioName ?? `Game ${new Date(entry.startTime).toLocaleTimeString()}`,
    gameType: entry.scenarioType ?? 'custom',
    roomName: entry.roomName ?? '—',
    score,
    accuracy,
    duration: durationMs,
    hitCount: totalHits,
    totalShots: totalHits,
    missCount: 0,
    avgReactionTime: null,
    bestReactionTime: null,
    worstReactionTime: null,
    startedAt: toIsoString(entry.startTime),
    endedAt: toIsoString(entry.endTime),
    thingsboardData: entry,
    rawSensorData: entry.hitHistory ?? [],
    scenarioName: entry.scenarioName ?? undefined,
    scenarioType: entry.scenarioType ?? undefined,
  };
};

interface SessionsState {
  sessions: Session[];
  isLoading: boolean;
  error: string | null;
  fetchSessions: (userId: string, options?: { limit?: number; includeFullHistory?: boolean }) => Promise<void>;
  clearSessions: () => void;
  setSessions: (sessions: Session[]) => void;
}

const mapRecentSessionToSession = (session: RecentSession): Session => {
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
};

export const useSessions = create<SessionsState>((set, get) => ({
  sessions: [],
  isLoading: false,
  error: null,

  fetchSessions: async (userId: string, options?: { limit?: number; includeFullHistory?: boolean }) => {
    set({ isLoading: true, error: null });
    try {
      const { limit = 10, includeFullHistory = false } = options ?? {};
      if (!userId) {
        set({ sessions: [], isLoading: false });
        return;
      }
      const historyPromise = includeFullHistory
        ? fetchAllGameHistory({ pageSize: 50, maxPages: 20 })
        : fetchGameHistory({ limit });
      const sessionsPromise = fetchRecentSessions(userId, includeFullHistory ? 200 : limit);

      const [{ history }, recentSessions] = await Promise.all([historyPromise, sessionsPromise]);
      const mappedHistory = history.map(mapGameHistoryToSession);
      const mappedRecent = recentSessions.map(mapRecentSessionToSession);

      const merged = [...mappedHistory, ...mappedRecent].reduce<Map<string, Session>>((acc, session) => {
        if (!acc.has(session.id)) {
          acc.set(session.id, session);
        }
        return acc;
      }, new Map());

      const deduped = Array.from(merged.values()).sort((a, b) => {
        const aTs = Date.parse(a.startedAt);
        const bTs = Date.parse(b.startedAt);
        return bTs - aTs;
      });

      const limited = includeFullHistory ? deduped : deduped.slice(0, limit);

      set({ sessions: limited, isLoading: false });
    } catch (error) {
      console.error('❌ useSessions: Error fetching sessions:', error);
      set({ 
        error: error instanceof Error ? error.message : 'Failed to fetch sessions',
        isLoading: false 
      });
    }
  },

  clearSessions: () => {
    set({ sessions: [], error: null });
  },

  setSessions: (sessions: Session[]) => {
    set({ sessions, isLoading: false, error: null });
  }
}));
