
import { create } from 'zustand';
import { API } from '@/lib/api';
import type { MockWebSocket } from '@/lib/types';
import { staticDb } from '@/lib/staticDb';
import type { LeaderboardEntry } from '@/lib/types';

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
  initializeWebSocket: (userId: string) => MockWebSocket;
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
      
      await staticDb.ensureInitialized();
      const stats = await API.getStats(token);
      const trend = await API.getTrend7d();
      
      set({ 
        activeTargets: stats.targets.online,
        roomsCreated: stats.rooms.count,
        lastSessionScore: stats.sessions.latest.score,
        pendingInvites: stats.invites?.length || 0,
        hitTrend: trend.map(hit => ({
          date: hit.day,
          hits: hit.hits
        })),
        isLoading: false 
      });

      // Subscribe to hit events to update trend
      const handleHitUpdate = () => {
        const updatedTrend = staticDb.getHits7d();
        set({
          hitTrend: updatedTrend.map(hit => ({
            date: hit.day,
            hits: hit.hits
          }))
        });
      };
      
      // Remove any existing listeners to prevent duplicates
      staticDb.off('hit', handleHitUpdate);
      // Add new listener
      staticDb.on('hit', handleHitUpdate);
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
        const handleHit = (event: { targetId: number, score: number }) => {};
        staticDb.off('hit', handleHit);
        if (socket.onclose) socket.onclose({} as any);
        set({ wsConnected: false });
      }
    };

    // Set up event handlers
    const handleHit = (event: { targetId: number, score: number }) => {
      if (socket.onmessage) {
        socket.onmessage({
          data: JSON.stringify({
            type: 'hit',
            targetId: event.targetId,
            score: event.score
          })
        } as any);
        
        get().updateHit(event.targetId.toString(), event.score);
      }
    };
    
    // Register event handlers
    staticDb.on('hit', handleHit);
    
    // Trigger initial connection
    setTimeout(() => {
      set({ wsConnected: true });
      if (socket.onopen) socket.onopen({} as any);
    }, 100);

    return socket;
  }
}));
