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
    const previousPresetCount = get().presets.length;
    const fetchStartedAt = Date.now();
    console.info('[useGamePresets] fetchPresets start', {
      at: new Date().toISOString(),
      previousPresetCount,
    });
    set({ isLoading: true, error: null });
    try {
      const presets = await fetchGamePresets();
      const elapsedMs = Date.now() - fetchStartedAt;
      console.info('[useGamePresets] fetchPresets succeeded', {
        fetchedAt: new Date().toISOString(),
        presetCount: presets.length,
        delta: presets.length - previousPresetCount,
        elapsedMs,
        sampleIds: presets.slice(0, 3).map((preset) => preset.id),
        sampleNames: presets.slice(0, 3).map((preset) => preset.name),
      });
      set({ presets, isLoading: false });
    } catch (error) {
      console.error('[useGamePresets] Failed to fetch presets', error);
      set({
        error: error instanceof Error ? error.message : 'Failed to load presets',
        isLoading: false,
      });
      console.error('[useGamePresets] fetchPresets error persisted to state', {
        at: new Date().toISOString(),
        message: error instanceof Error ? error.message : String(error),
        previousPresetCount,
      });
    }
  },

  savePreset: async (preset: SaveGamePresetInput) => {
    console.info('[useGamePresets] savePreset invoked', {
      name: preset.name,
      targetCount: preset.targetIds.length,
      durationSeconds: preset.durationSeconds ?? null,
      includeRoom: Boolean(preset.roomId),
    });
    set({ isSaving: true, error: null });
    try {
      const saved = await saveGamePreset(preset);
      console.info('[useGamePresets] savePreset resolved', {
        presetId: saved.id,
        name: saved.name,
        targetCount: saved.targetIds.length,
      });
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
      console.error('[useGamePresets] savePreset error persisted to state', {
        at: new Date().toISOString(),
        message: error instanceof Error ? error.message : String(error),
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
