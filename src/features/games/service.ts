/**
 * Service layer for Games feature
 * 
 * Contains business logic and orchestration.
 * Uses repository functions and domain layer validators/rules/permissions.
 * Returns ApiResponse<T>.
 */

import { gamesRepository } from './repo';
import type { GameRepository } from '@/domain/games/ports';
import type { GameTemplate } from './schema';
import { apiOk, apiErr, type ApiResponse } from '@/shared/lib/api-response';
import { 
  validateGameConfiguration,
  validateGameSessionStatus,
  GAME_CONSTRAINTS,
} from '@/domain/games/validators';
import {
  isValidStateTransition,
  canUseTargetsForGame,
  type GameSessionStatus,
  type TargetReadiness,
} from '@/domain/games/rules';
import {
  canStartGameSession,
  canStopGameSession,
  canViewGameSession,
  canUseTargetForGame,
  canSaveGamePreset,
  canDeleteGamePreset,
  canViewGameHistory,
  canUseTargetCount,
  type UserContext,
  type GameSessionContext,
  type TargetContext,
} from '@/domain/games/permissions';

// Repository injection for testing
let gameRepo: GameRepository = gamesRepository;

/**
 * Set the game repository (for testing/dependency injection)
 */
export const setGameRepository = (repo: GameRepository): void => {
  gameRepo = repo;
};

/**
 * Get all game templates
 */
export async function getGameTemplatesService(): Promise<ApiResponse<GameTemplate[]>> {
  return gameRepo.getGameTemplates();
}

/**
 * Validate game configuration before starting
 */
export function validateGameConfigurationService(
  targetCount: number,
  shotsPerTarget: number,
  timeLimitMs: number | null
): ApiResponse<boolean> {
  // Use domain layer validation
  const validation = validateGameConfiguration(targetCount, shotsPerTarget, timeLimitMs);
  if (!validation.valid) {
    return apiErr('VALIDATION_ERROR', validation.violation);
  }

  return apiOk(true);
}

/**
 * Validate state transition for game session
 */
export function validateStateTransitionService(
  currentStatus: string,
  newStatus: string
): ApiResponse<boolean> {
  // Validate status values using domain layer
  const currentValidation = validateGameSessionStatus(currentStatus);
  if (!currentValidation.success) {
    return apiErr('VALIDATION_ERROR', 'Invalid current status');
  }

  const newValidation = validateGameSessionStatus(newStatus);
  if (!newValidation.success) {
    return apiErr('VALIDATION_ERROR', 'Invalid new status');
  }

  // Check transition validity using domain rules
  const transitionResult = isValidStateTransition(
    currentStatus as GameSessionStatus,
    newStatus as GameSessionStatus
  );
  
  if (!transitionResult.valid) {
    return apiErr('VALIDATION_ERROR', transitionResult.violation);
  }

  return apiOk(true);
}

/**
 * Validate targets are ready for game
 */
export function validateTargetsForGameService(
  targets: TargetReadiness[]
): ApiResponse<boolean> {
  const result = canUseTargetsForGame(targets, GAME_CONSTRAINTS.MIN_TARGETS);
  
  if (!result.valid) {
    return apiErr('VALIDATION_ERROR', result.violation);
  }

  return apiOk(true);
}

// ============================================================================
// Permission-based service functions
// ============================================================================

/**
 * Check if user can start a new game session
 */
export function checkCanStartGameSession(
  user: UserContext,
  activeSessionCount: number
): ApiResponse<boolean> {
  const result = canStartGameSession(user, activeSessionCount);
  
  if (!result.allowed) {
    return apiErr(result.code, result.reason);
  }

  return apiOk(true);
}

/**
 * Check if user can stop a game session
 */
export function checkCanStopGameSession(
  user: UserContext,
  session: GameSessionContext
): ApiResponse<boolean> {
  const result = canStopGameSession(user, session);
  
  if (!result.allowed) {
    return apiErr(result.code, result.reason);
  }

  return apiOk(true);
}

/**
 * Check if user can view a game session
 */
export function checkCanViewGameSession(
  user: UserContext,
  session: GameSessionContext
): ApiResponse<boolean> {
  const result = canViewGameSession(user, session);
  
  if (!result.allowed) {
    return apiErr(result.code, result.reason);
  }

  return apiOk(true);
}

/**
 * Check if user can use a target for a game
 */
export function checkCanUseTargetForGame(
  user: UserContext,
  target: TargetContext
): ApiResponse<boolean> {
  const result = canUseTargetForGame(user, target);
  
  if (!result.allowed) {
    return apiErr(result.code, result.reason);
  }

  return apiOk(true);
}

/**
 * Check if user can save a game preset
 */
export function checkCanSaveGamePreset(
  user: UserContext,
  currentPresetCount: number
): ApiResponse<boolean> {
  const result = canSaveGamePreset(user, currentPresetCount);
  
  if (!result.allowed) {
    return apiErr(result.code, result.reason);
  }

  return apiOk(true);
}

/**
 * Check if user can delete a game preset
 */
export function checkCanDeleteGamePreset(
  user: UserContext,
  presetOwnerId: string
): ApiResponse<boolean> {
  const result = canDeleteGamePreset(user, presetOwnerId);
  
  if (!result.allowed) {
    return apiErr(result.code, result.reason);
  }

  return apiOk(true);
}

/**
 * Check if user can view game history
 */
export function checkCanViewGameHistory(
  user: UserContext,
  historyOwnerId: string
): ApiResponse<boolean> {
  const result = canViewGameHistory(user, historyOwnerId);
  
  if (!result.allowed) {
    return apiErr(result.code, result.reason);
  }

  return apiOk(true);
}

/**
 * Check if user can use a specific number of targets
 */
export function checkCanUseTargetCount(
  user: UserContext,
  targetCount: number
): ApiResponse<boolean> {
  const result = canUseTargetCount(user, targetCount);
  
  if (!result.allowed) {
    return apiErr(result.code, result.reason);
  }

  return apiOk(true);
}

// Re-export types for consumers
export type { UserContext, GameSessionContext, TargetContext } from '@/domain/games/permissions';
