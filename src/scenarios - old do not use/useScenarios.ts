import { create } from 'zustand';
import API from '@/lib/api';
import { toast } from "@/components/ui/sonner";
import type { Scenario } from '@/types/game';

export type Player = {
  userId: string;
  name: string;
  hits: number;
  accuracy: number;
};

export type ScenarioHistory = {
  id: number;
  name: string;
  date: string;
  duration: number;
  score: number;
  accuracy: number;
};

interface ScenariosState {
  scenarios: Scenario[];
  scenarioHistory: ScenarioHistory[];
  currentScenario: ScenarioHistory | null;
  players: Player[];
  isLoading: boolean;
  isActive: boolean;
  error: string | null;
  fetchScenarios: (token: string) => Promise<void>;
  selectScenario: (scenarioId: number, includedRoomIds: number[], token: string) => Promise<ScenarioHistory | null>;
  endScenario: (id: number, token: string) => Promise<void>;
  createInvite: (scenarioId: number, token: string) => Promise<string | null>;
  updatePlayerScore: (userId: string, hits: number, accuracy: number) => void;
  setPlayers: (players: Player[]) => void;
  clearScenario: () => void;
  setActiveScenario: (scenario: ScenarioHistory | null) => void;
}

export const useScenarios = create<ScenariosState>((set, get) => ({
  scenarios: [],
  scenarioHistory: [],
  currentScenario: null,
  players: [],
  isLoading: false,
  isActive: false,
  error: null,

  fetchScenarios: async (token: string) => {
    try {
      console.log('Fetching scenarios with token:', token);
      const scenarios = await API.listScenarios();
      console.log('Scenarios received:', scenarios);
      set({ 
        scenarios: scenarios.map(s => ({
          id: parseInt(s.id),
          name: s.name,
          targetCount: s.targetCount,
        })) as Scenario[] 
      });
    } catch (error) {
      console.error('Error fetching scenarios:', error);
      // toast.error('Failed to fetch scenarios'); // Disabled notifications
    }
  },

  selectScenario: async (scenarioId: number, includedRoomIds: number[], token: string) => {
    // TODO: Implement scenario selection logic
    return null;
  },

  endScenario: async (id: number, token: string) => {
    // TODO: Implement scenario end logic
  },

  createInvite: async (scenarioId: number, token: string) => {
    // TODO: Implement invite creation for scenarios
    return null;
  },

  updatePlayerScore: (userId: string, hits: number, accuracy: number) => {
    set(state => {
      const playerExists = state.players.some(p => p.userId === userId);
      if (playerExists) {
        return {
          players: state.players.map(player =>
            player.userId === userId ? { ...player, hits, accuracy } : player
          ).sort((a, b) => b.hits - a.hits)
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

  clearScenario: () => {
    set({
      currentScenario: null,
      players: [],
      isActive: false
    });
  },

  setActiveScenario: (scenario: ScenarioHistory | null) => {
    set({
      currentScenario: scenario,
      isActive: !!scenario
    });
  }
})); 