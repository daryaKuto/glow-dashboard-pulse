import { create } from 'zustand';
import {
  fetchGamePresets,
  saveGamePreset,
  deleteGamePreset,
  type GamePreset,
  type SaveGamePresetInput,
} from '@/lib/edge';

interface GamePresetsState {
  presets: GamePreset[];
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  fetchPresets: () => Promise<void>;
  savePreset: (preset: SaveGamePresetInput) => Promise<GamePreset>;
  deletePreset: (id: string) => Promise<void>;
}

export const useGamePresets = create<GamePresetsState>((set, get) => ({
  presets: [],
  isLoading: false,
  isSaving: false,
  error: null,

  fetchPresets: async () => {
    set({ isLoading: true, error: null });
    try {
      const presets = await fetchGamePresets();
      set({ presets, isLoading: false });
    } catch (error) {
      console.error('[useGamePresets] Failed to fetch presets', error);
      set({
        error: error instanceof Error ? error.message : 'Failed to load presets',
        isLoading: false,
      });
    }
  },

  savePreset: async (preset: SaveGamePresetInput) => {
    set({ isSaving: true, error: null });
    try {
      const saved = await saveGamePreset(preset);
      set((state) => {
        const existingIndex = state.presets.findIndex((item) => item.id === saved.id);
        if (existingIndex >= 0) {
          const updated = [...state.presets];
          updated[existingIndex] = saved;
          return { presets: updated, isSaving: false };
        }
        return { presets: [saved, ...state.presets], isSaving: false };
      });
      return saved;
    } catch (error) {
      console.error('[useGamePresets] Failed to save preset', error);
      set({
        error: error instanceof Error ? error.message : 'Failed to save preset',
        isSaving: false,
      });
      throw error;
    }
  },

  deletePreset: async (id: string) => {
    try {
      await deleteGamePreset(id);
      set((state) => ({
        presets: state.presets.filter((preset) => preset.id !== id),
      }));
    } catch (error) {
      console.error('[useGamePresets] Failed to delete preset', error);
      set({
        error: error instanceof Error ? error.message : 'Failed to delete preset',
      });
      throw error;
    }
  },
}));
