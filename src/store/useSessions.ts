import { create } from 'zustand';
import { fetcher } from '@/lib/api';
import { toast } from "@/components/ui/sonner";
import { InviteResponse } from '@/lib/types';

export type Player = {
  userId: string;
  name: string;
  hits: number;
  accuracy: number;
};

export type Session = {
  id: number;
  name: string;
  date: string;
  duration: number;
  score: number;
  accuracy: number;
};

export type Scenario = {
  id: number;
  name: string;
  difficulty: string;
};

interface SessionsState {
  sessions: Session[];
  currentSession: Session | null;
  scenarios: Scenario[];
  players: Player[];
  isLoading: boolean;
  isActive: boolean;
  error: string | null;
  fetchSessions: (token: string) => Promise<void>;
  fetchScenarios: (token: string) => Promise<void>;
  startSession: (scenarioId: number, includedRoomIds: number[], token: string) => Promise<Session | null>;
  endSession: (id: number, token: string) => Promise<void>;
  createInvite: (sessionId: number, token: string) => Promise<string | null>;
  updatePlayerScore: (userId: string, hits: number, accuracy: number) => void;
  setPlayers: (players: Player[]) => void;
  clearSession: () => void;
  setActiveSession: (session: Session | null) => void;
}

export const useSessions = create<SessionsState>((set, get) => ({
  sessions: [],
  currentSession: null,
  scenarios: [],
  players: [],
  isLoading: false,
  isActive: false,
  error: null,
  
  fetchSessions: async (token: string) => {
    set({ isLoading: true, error: null });
    try {
      const sessions = await fetcher('/sessions', {
        headers: { Authorization: `Bearer ${token}` }
      });
      set({ sessions: sessions as Session[], isLoading: false });
    } catch (error) {
      set({ error: 'Failed to fetch sessions', isLoading: false });
      toast.error('Failed to fetch sessions');
    }
  },
  
  fetchScenarios: async (token: string) => {
    try {
      const scenarios = await fetcher('/scenarios', {
        headers: { Authorization: `Bearer ${token}` }
      });
      set({ scenarios: scenarios as Scenario[] });
    } catch (error) {
      toast.error('Failed to fetch scenarios');
    }
  },
  
  startSession: async (scenarioId: number, includedRoomIds: number[], token: string) => {
    try {
      const session = await fetcher('/sessions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({ 
          scenarioId,
          includedRoomIds
        })
      }) as Session;
      
      set({
        currentSession: session,
        isActive: true,
        players: [{ userId: 'current-user', name: 'You', hits: 0, accuracy: 0 }]
      });
      
      toast.success('Session started');
      return session;
    } catch (error) {
      toast.error('Failed to start session');
      return null;
    }
  },
  
  endSession: async (id: number, token: string) => {
    try {
      const finalSession = await fetcher(`/sessions/${id}/end`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      }) as Session;
      
      // Update sessions list
      set(state => ({
        sessions: [finalSession, ...state.sessions.filter(s => s.id !== id)],
        currentSession: null,
        isActive: false
      }));
      
      toast.success(`Session ended with score: ${finalSession.score}`);
    } catch (error) {
      toast.error('Failed to end session');
    }
  },
  
  createInvite: async (sessionId: number, token: string) => {
    try {
      const response = await fetcher('/invites', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({ sessionId })
      }) as InviteResponse;
      
      return response.token;
    } catch (error) {
      toast.error('Failed to create invite');
      return null;
    }
  },
  
  updatePlayerScore: (userId: string, hits: number, accuracy: number) => {
    set(state => {
      const playerExists = state.players.some(p => p.userId === userId);
      
      if (playerExists) {
        return {
          players: state.players.map(player =>
            player.userId === userId ? { ...player, hits, accuracy } : player
          ).sort((a, b) => b.hits - a.hits) // Sort by hits descending
        };
      } else {
        // New player joined
        const newPlayer = { 
          userId, 
          name: userId === 'current-user' ? 'You' : `Player ${state.players.length + 1}`, 
          hits, 
          accuracy 
        };
        return {
          players: [...state.players, newPlayer].sort((a, b) => b.hits - a.hits)
        };
      }
    });
  },
  
  setPlayers: (players: Player[]) => {
    set({ players });
  },
  
  clearSession: () => {
    set({
      currentSession: null,
      players: [],
      isActive: false
    });
  },
  
  setActiveSession: (session: Session | null) => {
    set({
      currentSession: session,
      isActive: !!session
    });
  }
}));
