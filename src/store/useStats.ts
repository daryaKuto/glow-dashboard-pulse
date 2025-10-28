
import { create } from 'zustand';
import { fetchDashboardMetrics, type DashboardMetricsData, type DashboardRecentSession } from '@/lib/edge';
import type { MockWebSocket } from '@/lib/types';

export interface StatsState {
  metrics: DashboardMetricsData | null;
  metricsCached: boolean;
  activeTargets: number;
  roomsCreated: number;
  lastScenarioScore: number;
  pendingInvites: number;
  hitTrend: { date: string; hits: number }[];
  isLoading: boolean;
  error: Error | null;
  wsConnected: boolean;
}

interface StatsActions {
  fetchStats: (options?: { force?: boolean }) => Promise<void>;
  updateHit: (targetId: string, score: number) => void;
  setWsConnected: (connected: boolean) => void;
  initializeWebSocket: (userId: string) => MockWebSocket;
  reset: () => void;
}

const buildHitTrend = (sessions: DashboardRecentSession[]): { date: string; hits: number }[] => {
  if (!Array.isArray(sessions) || sessions.length === 0) {
    return [];
  }

  const aggregated = sessions.reduce<Map<string, number>>((acc, session) => {
    const dateKey = (session.started_at ?? new Date().toISOString()).split('T')[0];
    const current = acc.get(dateKey) ?? 0;
    acc.set(dateKey, current + (Number.isFinite(session.hit_count) ? session.hit_count : 0));
    return acc;
  }, new Map());

  return Array.from(aggregated.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, hits]) => ({ date, hits }));
};

const initialState: StatsState = {
  metrics: null,
  metricsCached: false,
  activeTargets: 0,
  roomsCreated: 0,
  lastScenarioScore: 0,
  pendingInvites: 0,
  hitTrend: [], // Empty array - no mock data
  isLoading: true,
  error: null,
  wsConnected: false,
};

export const useStats = create<StatsState & StatsActions>((set, get) => ({
  ...initialState,
  
  fetchStats: async (options?: { force?: boolean }) => {
    try {
      set({ isLoading: true, error: null });
      const { metrics, cached } = await fetchDashboardMetrics(options?.force ?? false);

      if (!metrics) {
        set({
          metrics: null,
          metricsCached: cached,
          activeTargets: 0,
          roomsCreated: 0,
          lastScenarioScore: 0,
          pendingInvites: 0,
          hitTrend: [],
          isLoading: false,
        });
        return;
      }

      const { summary, totals, recentSessions } = metrics;
      const hitTrend = buildHitTrend(recentSessions);
      const lastScenarioScore = recentSessions[0]?.score ?? totals.bestScore ?? 0;

      set({ 
        metrics,
        metricsCached: cached,
        activeTargets: summary.onlineTargets,
        roomsCreated: summary.totalRooms,
        lastScenarioScore,
        pendingInvites: 0,
        hitTrend,
        isLoading: false 
      });
    } catch (error) {
      console.error("Error fetching stats:", error);
      set({ 
        error: error instanceof Error ? error : new Error('Unknown error'), 
        isLoading: false 
      });
    }
  },
  
  updateHit: (targetId: string, score: number) => {
    // Optimistic update for WebSocket hit event
    const hitTrend = [...get().hitTrend];
    const todayKey = new Date().toISOString().split('T')[0];

    if (hitTrend.length === 0) {
      hitTrend.push({ date: todayKey, hits: 0 });
    }

    let today = hitTrend[hitTrend.length - 1];
    if (!today || today.date !== todayKey) {
      today = { date: todayKey, hits: 0 };
      hitTrend.push(today);
    }
    
    // Increment today's hit count
    today.hits += 1;
    
    // Update last scenario score if higher
    const lastScenarioScore = Math.max(get().lastScenarioScore, score);
    
    set({ 
      hitTrend: [...hitTrend], 
      lastScenarioScore
    });
  },
  
  setWsConnected: (connected: boolean) => set({ wsConnected: connected }),
  
  initializeWebSocket: (userId: string) => {
    // Create a mock WebSocket
    const socket: MockWebSocket = {
      onopen: null,
      onclose: null,
      onmessage: null,
      onerror: null,
      
      send: (_data: string) => {
        // no-op mock
      },
      
      close: () => {
        if (socket.onclose) socket.onclose({} as any);
        set({ wsConnected: false });
      }
    };

    // Trigger initial connection
    setTimeout(() => {
      set({ wsConnected: true });
      if (socket.onopen) socket.onopen({} as any);
    }, 100);

    return socket;
  },

  reset: () => {
    set({ ...initialState });
  },
}));
