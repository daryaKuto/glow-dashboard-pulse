import { create } from 'zustand';
import { fetchRecentSessions } from '@/services/profile';

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

interface SessionsState {
  sessions: Session[];
  isLoading: boolean;
  error: string | null;
  fetchSessions: (userId: string, limit?: number) => Promise<void>;
  clearSessions: () => void;
}

export const useSessions = create<SessionsState>((set, get) => ({
  sessions: [],
  isLoading: false,
  error: null,

  fetchSessions: async (userId: string, limit = 10) => {
    set({ isLoading: true, error: null });
    try {
      console.log('🔄 useSessions: Fetching sessions from Supabase...', { userId, limit });
      const sessions = await fetchRecentSessions(userId, limit);
      console.log('✅ useSessions: Fetched sessions:', sessions.length);
      set({ sessions, isLoading: false });
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
  }
}));
