import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/components/ui/sonner';
import { useAuth } from '@/shared/hooks';
import {
  fetchGamePresets,
  saveGamePreset,
  deleteGamePreset,
  type GamePreset,
  type SaveGamePresetInput,
} from '@/lib/edge';
import {
  getGameTemplatesService,
  checkCanStartGameSession,
  checkCanStopGameSession,
  checkCanViewGameSession,
  checkCanUseTargetForGame,
  checkCanSaveGamePreset,
  checkCanDeleteGamePreset,
  checkCanViewGameHistory,
  checkCanUseTargetCount,
  validateGameConfigurationService,
  validateStateTransitionService,
  validateTargetsForGameService,
  type UserContext,
  type GameSessionContext,
  type TargetContext,
} from './service';
import type { GameTemplate } from './schema';
import type { TargetReadiness } from '@/domain/games/rules';

/**
 * React Query hooks for Games feature
 */

// Query keys
export const gamesKeys = {
  all: ['games'] as const,
  templates: () => [...gamesKeys.all, 'templates'] as const,
  presets: () => [...gamesKeys.all, 'presets'] as const,
};

/**
 * Helper to build UserContext from auth user
 */
function buildUserContext(userId: string | undefined): UserContext | null {
  if (!userId) return null;
  return {
    userId,
    // subscriptionTier could be fetched from user profile if needed
  };
}

/**
 * Get all game templates
 */
export function useGameTemplates() {
  return useQuery({
    queryKey: gamesKeys.templates(),
    queryFn: async () => {
      const result = await getGameTemplatesService();
      if (!result.ok) {
        throw new Error(result.error.message);
      }
      return result.data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes - templates don't change often
  });
}

// ============================================================================
// Permission Check Hooks
// These hooks provide permission validation for game operations.
// They return functions that check permissions synchronously.
// ============================================================================

/**
 * Hook to get game permission checkers
 * Returns functions to check various game-related permissions.
 */
export function useGamePermissions() {
  const { user } = useAuth();
  const userContext = buildUserContext(user?.id);

  return {
    /**
     * Check if user can start a new game session
     */
    canStartSession: (activeSessionCount: number): { allowed: boolean; error?: string } => {
      if (!userContext) {
        return { allowed: false, error: 'User must be authenticated' };
      }
      const result = checkCanStartGameSession(userContext, activeSessionCount);
      if (!result.ok) {
        return { allowed: false, error: result.error.message };
      }
      return { allowed: true };
    },

    /**
     * Check if user can stop a game session
     */
    canStopSession: (session: GameSessionContext): { allowed: boolean; error?: string } => {
      if (!userContext) {
        return { allowed: false, error: 'User must be authenticated' };
      }
      const result = checkCanStopGameSession(userContext, session);
      if (!result.ok) {
        return { allowed: false, error: result.error.message };
      }
      return { allowed: true };
    },

    /**
     * Check if user can view a game session
     */
    canViewSession: (session: GameSessionContext): { allowed: boolean; error?: string } => {
      if (!userContext) {
        return { allowed: false, error: 'User must be authenticated' };
      }
      const result = checkCanViewGameSession(userContext, session);
      if (!result.ok) {
        return { allowed: false, error: result.error.message };
      }
      return { allowed: true };
    },

    /**
     * Check if user can use a target for a game
     */
    canUseTarget: (target: TargetContext): { allowed: boolean; error?: string } => {
      if (!userContext) {
        return { allowed: false, error: 'User must be authenticated' };
      }
      const result = checkCanUseTargetForGame(userContext, target);
      if (!result.ok) {
        return { allowed: false, error: result.error.message };
      }
      return { allowed: true };
    },

    /**
     * Check if user can save a game preset
     */
    canSavePreset: (currentPresetCount: number): { allowed: boolean; error?: string } => {
      if (!userContext) {
        return { allowed: false, error: 'User must be authenticated' };
      }
      const result = checkCanSaveGamePreset(userContext, currentPresetCount);
      if (!result.ok) {
        return { allowed: false, error: result.error.message };
      }
      return { allowed: true };
    },

    /**
     * Check if user can delete a game preset
     */
    canDeletePreset: (presetOwnerId: string): { allowed: boolean; error?: string } => {
      if (!userContext) {
        return { allowed: false, error: 'User must be authenticated' };
      }
      const result = checkCanDeleteGamePreset(userContext, presetOwnerId);
      if (!result.ok) {
        return { allowed: false, error: result.error.message };
      }
      return { allowed: true };
    },

    /**
     * Check if user can view game history
     */
    canViewHistory: (historyOwnerId: string): { allowed: boolean; error?: string } => {
      if (!userContext) {
        return { allowed: false, error: 'User must be authenticated' };
      }
      const result = checkCanViewGameHistory(userContext, historyOwnerId);
      if (!result.ok) {
        return { allowed: false, error: result.error.message };
      }
      return { allowed: true };
    },

    /**
     * Check if user can use a specific number of targets
     */
    canUseTargetCount: (targetCount: number): { allowed: boolean; error?: string } => {
      if (!userContext) {
        return { allowed: false, error: 'User must be authenticated' };
      }
      const result = checkCanUseTargetCount(userContext, targetCount);
      if (!result.ok) {
        return { allowed: false, error: result.error.message };
      }
      return { allowed: true };
    },
  };
}

// ============================================================================
// Validation Hooks
// These hooks provide game configuration validation.
// ============================================================================

/**
 * Hook to get game validators
 * Returns functions to validate game configurations.
 */
export function useGameValidation() {
  return {
    /**
     * Validate game configuration before starting
     */
    validateConfiguration: (
      targetCount: number,
      shotsPerTarget: number,
      timeLimitMs: number | null
    ): { valid: boolean; error?: string } => {
      const result = validateGameConfigurationService(targetCount, shotsPerTarget, timeLimitMs);
      if (!result.ok) {
        return { valid: false, error: result.error.message };
      }
      return { valid: true };
    },

    /**
     * Validate state transition for game session
     */
    validateStateTransition: (
      currentStatus: string,
      newStatus: string
    ): { valid: boolean; error?: string } => {
      const result = validateStateTransitionService(currentStatus, newStatus);
      if (!result.ok) {
        return { valid: false, error: result.error.message };
      }
      return { valid: true };
    },

    /**
     * Validate targets are ready for game
     */
    validateTargetsReady: (targets: TargetReadiness[]): { valid: boolean; error?: string } => {
      const result = validateTargetsForGameService(targets);
      if (!result.ok) {
        return { valid: false, error: result.error.message };
      }
      return { valid: true };
    },
  };
}

// ============================================================================
// Game Presets Hooks
// These hooks replace the Zustand useGamePresets store with React Query.
// ============================================================================

/**
 * Get all game presets
 * Replaces Zustand useGamePresets.presets and fetchPresets
 */
export function useGamePresets() {
  return useQuery({
    queryKey: gamesKeys.presets(),
    queryFn: async () => {
      const presets = await fetchGamePresets();
      return presets;
    },
    staleTime: 60 * 1000, // 1 minute
  });
}

/**
 * Save a game preset (create or update)
 * Replaces Zustand useGamePresets.savePreset
 */
export function useSaveGamePreset() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (preset: SaveGamePresetInput) => {
      const saved = await saveGamePreset(preset);
      return saved;
    },
    onSuccess: (savedPreset) => {
      // Update the presets cache optimistically
      queryClient.setQueryData<GamePreset[]>(gamesKeys.presets(), (oldPresets = []) => {
        const existingIndex = oldPresets.findIndex((p) => p.id === savedPreset.id);
        if (existingIndex >= 0) {
          const updated = [...oldPresets];
          updated[existingIndex] = savedPreset;
          return updated;
        }
        return [savedPreset, ...oldPresets];
      });
      toast.success('Preset saved successfully');
    },
    onError: (error: Error) => {
      toast.error(`Failed to save preset: ${error.message}`);
    },
  });
}

/**
 * Delete a game preset
 * Replaces Zustand useGamePresets.deletePreset
 */
export function useDeleteGamePreset() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await deleteGamePreset(id);
      return id;
    },
    onSuccess: (deletedId) => {
      // Remove from cache
      queryClient.setQueryData<GamePreset[]>(gamesKeys.presets(), (oldPresets = []) => {
        return oldPresets.filter((preset) => preset.id !== deletedId);
      });
      toast.success('Preset deleted');
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete preset: ${error.message}`);
    },
  });
}

// Re-export types for consumers
export type { UserContext, GameSessionContext, TargetContext } from './service';
export type { TargetReadiness } from '@/domain/games/rules';
export type { GamePreset, SaveGamePresetInput } from '@/lib/edge';

