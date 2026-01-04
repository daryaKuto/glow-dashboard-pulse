/**
 * Service layer for Games feature
 * 
 * Contains business logic and orchestration.
 * Uses repository functions and domain layer validators/rules.
 * Returns ApiResponse<T>.
 */

import { getGameTemplates } from './repo';
import type { GameTemplate } from './schema';
import { apiErr } from '@/shared/lib/api-response';
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

/**
 * Get all game templates
 */
export async function getGameTemplatesService(): Promise<import('@/shared/lib/api-response').ApiResponse<GameTemplate[]>> {
  return getGameTemplates();
}

/**
 * Validate game configuration before starting
 */
export function validateGameConfigurationService(
  targetCount: number,
  shotsPerTarget: number,
  timeLimitMs: number | null
): import('@/shared/lib/api-response').ApiResponse<boolean> {
  // Use domain layer validation
  const validation = validateGameConfiguration(targetCount, shotsPerTarget, timeLimitMs);
  if (!validation.valid) {
    return apiErr('VALIDATION_ERROR', validation.violation);
  }

  return { ok: true, data: true };
}

/**
 * Validate state transition for game session
 */
export function validateStateTransitionService(
  currentStatus: string,
  newStatus: string
): import('@/shared/lib/api-response').ApiResponse<boolean> {
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

  return { ok: true, data: true };
}

/**
 * Validate targets are ready for game
 */
export function validateTargetsForGameService(
  targets: TargetReadiness[]
): import('@/shared/lib/api-response').ApiResponse<boolean> {
  const result = canUseTargetsForGame(targets, GAME_CONSTRAINTS.MIN_TARGETS);
  
  if (!result.valid) {
    return apiErr('VALIDATION_ERROR', result.violation);
  }

  return { ok: true, data: true };
}

