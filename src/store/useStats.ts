import { create } from 'zustand';
import { API } from '@/lib/api';
import { createMockWebSocket } from '@/mocks/mockSocket';

export interface StatsState {
  activeTargets: number;
  roomsCreated: number;
  lastSessionScore: number;
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
  initializeWebSocket: (userId: string) => WebSocket;
}

const initialState: StatsState = {
  activeTargets: 0,
  roomsCreated: 0,
  lastSessionScore: 0,
  pendingInvites: 0,
  hitTrend: Array.from({ length: 7 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - i));
    return { 
      date: date.toISOString().split('T')[0], 
      hits: Math.floor(Math.random() * 100) 
    };
  }),
  isLoading: true,
  error: null,
  wsConnected: false,
};

export const useStats = create<StatsState & StatsActions>((set, get) => ({
  ...initialState,
  
  fetchStats: async (token: string) => {
    try {
      set({ isLoading: true, error: null });
      
      const stats = await API.getStats(token);
      const hits = await API.getHitStats(token);
      
      set({ 
        activeTargets: stats.targets.online,
        roomsCreated: stats.rooms.count,
        lastSessionScore: stats.sessions.latest.score,
        pendingInvites: stats.invites.length,
        hitTrend: hits.map((hit: any) => ({
          date: hit.date,
          hits: hit.hits
        })),
        isLoading: false 
      });
    } catch (error) {
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
    
    // Update last session score if higher
    const lastSessionScore = Math.max(get().lastSessionScore, score);
    
    set({ 
      hitTrend, 
      lastSessionScore
    });
  },
  
  setWsConnected: (connected: boolean) => set({ wsConnected: connected }),
  
  initializeWebSocket: (userId: string) => {
    const socket = useMocks ? 
      createMockWebSocket(userId) : 
      new WebSocket(`wss://api.fungun.dev/hits/${userId}`);

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'hit') {
          get().updateHit(data.targetId, data.score);
        }
      } catch (error) {
        console.error('WebSocket message parse error:', error);
      }
    };

    socket.onopen = () => set({ wsConnected: true });
    socket.onclose = () => set({ wsConnected: false });

    return socket;
  }
}));
