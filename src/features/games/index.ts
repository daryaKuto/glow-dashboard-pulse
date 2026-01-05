/**
 * Public API for Games feature
 */

// Hooks
export {
  useGameTemplates,
  // Permission and validation hooks
  useGamePermissions,
  useGameValidation,
  gamesKeys,
} from './hooks';

export {
  useGameHistory,
  useSaveGameHistory,
  useAddGameToHistory,
  useInvalidateGameHistory,
  gameHistoryKeys,
} from './hooks/use-game-history';

// Types
export type {
  GameSession,
  GameTemplate,
  CreateGameSession,
} from './schema';

// Permission types
export type { UserContext, GameSessionContext, TargetContext, TargetReadiness } from './hooks';

