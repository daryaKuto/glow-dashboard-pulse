import { create } from 'zustand';
import API from '@/lib/api';
import type { GameTemplate } from '@/features/games/schema';

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
  scenarios: GameTemplate[];
  scenarioHistory: ScenarioHistory[];
  currentScenario: ScenarioHistory | null;
  players: Player[];
  isLoading: boolean;
  isActive: boolean;
  error: string | null;
  fetchScenarios: () => Promise<void>;
  selectScenario: (scenarioId: string, includedRoomIds: string[]) => Promise<ScenarioHistory | null>;
  endScenario: (id: number) => Promise<void>;
  createInvite: (scenarioId: string) => Promise<string | null>;
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

  fetchScenarios: async () => {
    set({ isLoading: true, error: null });
    try {
      const scenarios = await API.listScenarios();
      set({
        scenarios,
        isLoading: false,
        error: null,
      });
    } catch (error) {
      console.error('Error fetching scenarios:', error);
      set({
        scenarios: [],
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to fetch scenarios',
      });
    }
  },

  selectScenario: async (_scenarioId: string, _includedRoomIds: string[]) => {
    // TODO: Implement scenario selection logic
    return null;
  },

  endScenario: async (id: number) => {
    // TODO: Implement scenario end logic
  },

  createInvite: async (scenarioId: number) => {
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
