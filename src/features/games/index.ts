/**
 * Public API for Games feature
 */

// Hooks
export {
  useGameTemplates,
  // Permission and validation hooks
  useGamePermissions,
  useGameValidation,
  // Game presets hooks (replaces Zustand useGamePresets store)
  useGamePresets,
  useSaveGamePreset,
  useDeleteGamePreset,
  gamesKeys,
} from './hooks';

export {
  useGameHistory,
  useSaveGameHistory,
  useAddGameToHistory,
  useInvalidateGameHistory,
  gameHistoryKeys,
} from './hooks/use-game-history';

// State (Zustand store for real-time game flow)
import { useGameFlow as useGameFlowStore } from './state/useGameFlow';
export { useGameFlowStore as useGameFlow };

/**
 * Reset function for logout/cleanup.
 * This provides a clean public API for resetting game flow state
 * without external code needing to know about store internals.
 */
export const resetGameFlowState = (): void => {
  useGameFlowStore.getState().reset();
};

// UI Components
export { GameFlowDashboard } from './ui/game-flow-dashboard';
export { GameHistoryComponent } from './ui/game-history';

// Types
export type {
  GameSession,
  GameTemplate,
  CreateGameSession,
} from './schema';

// Permission types
export type { UserContext, GameSessionContext, TargetContext, TargetReadiness } from './hooks';

// Game presets types
export type { GamePreset, SaveGamePresetInput } from './hooks';

// Device and game flow types
export type {
  DeviceStatus,
  GameHistory,
  DeviceGameEvent,
  GameCommandWarning,
} from './lib/device-game-flow';

