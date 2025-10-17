
import { create } from 'zustand';
import { API } from '@/lib/api';
import type { MockWebSocket } from '@/lib/types';

export interface StatsState {
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
  fetchStats: (token: string) => Promise<void>;
  updateHit: (targetId: string, score: number) => void;
  setWsConnected: (connected: boolean) => void;
  initializeWebSocket: (userId: string) => MockWebSocket;
}

const initialState: StatsState = {
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
  
  fetchStats: async (token: string) => {
    try {
      set({ isLoading: true, error: null });
      
      console.log("Fetching stats from API");
      const stats = await API.getStats(token);
      console.log("Stats received:", stats);
      const trend = await API.getTrend7d();
      console.log("Trend received:", trend);
      
      set({ 
        activeTargets: stats.targets.online,
        roomsCreated: stats.rooms.count,
        lastScenarioScore: stats.scenarios?.latest?.score ?? 0,
        pendingInvites: stats.invites?.length || 0,
        hitTrend: trend.map(hit => ({
          date: hit.day,
          hits: hit.hits
        })),
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
    const today = hitTrend[hitTrend.length - 1];
    
    // Increment today's hit count
    today.hits += 1;
    
    // Update last scenario score if higher
    const lastScenarioScore = Math.max(get().lastScenarioScore, score);
    
    set({ 
      hitTrend, 
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
      
      send: (data: string) => {
        console.log('WebSocket message sent:', data);
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
  }
}));
