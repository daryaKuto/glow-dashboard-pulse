/**
 * Games Domain Validators
 * 
 * Business validation rules for game operations.
 * Pure functions - no React or Supabase imports.
 */

import { z } from 'zod';
import { validateWithSchema, type ValidationResult, isValidUuid, isNonEmptyString } from '../shared/validation-helpers';

/**
 * Game validation constants
 */
export const GAME_CONSTRAINTS = {
  MIN_TARGETS: 1,
  MAX_TARGETS: 50,
  MIN_SHOTS_PER_TARGET: 1,
  MAX_SHOTS_PER_TARGET: 100,
  MIN_TIME_LIMIT_MS: 5000, // 5 seconds
  MAX_TIME_LIMIT_MS: 3600000, // 1 hour
  MIN_DURATION_MS: 1000, // 1 second
  MAX_DURATION_MS: 7200000, // 2 hours
  NAME_MIN_LENGTH: 1,
  NAME_MAX_LENGTH: 100,
  DESCRIPTION_MAX_LENGTH: 500,
  VALID_DIFFICULTIES: ['easy', 'medium', 'hard', 'expert'] as const,
  VALID_CATEGORIES: ['target_practice', 'speed_drill', 'accuracy', 'endurance', 'custom'] as const,
} as const;

/**
 * Game session status enum
 */
export const GAME_SESSION_STATUS = [
  'idle',
  'configuring',
  'launching',
  'running',
  'stopping',
  'finalizing',
  'completed',
  'error',
] as const;
export type GameSessionStatus = typeof GAME_SESSION_STATUS[number];

/**
 * Game difficulty enum
 */
export type GameDifficulty = typeof GAME_CONSTRAINTS.VALID_DIFFICULTIES[number];

/**
 * Game category enum
 */
export type GameCategory = typeof GAME_CONSTRAINTS.VALID_CATEGORIES[number];

/**
 * Game session status schema
 */
export const gameSessionStatusSchema = z.enum(GAME_SESSION_STATUS);

/**
 * Game difficulty schema
 */
export const gameDifficultySchema = z.enum(GAME_CONSTRAINTS.VALID_DIFFICULTIES);

/**
 * Game category schema
 */
export const gameCategorySchema = z.enum(GAME_CONSTRAINTS.VALID_CATEGORIES);

/**
 * Create game session input schema
 */
export const createGameSessionInputSchema = z.object({
  gameId: z.string().min(1, 'Game ID is required'),
  gameName: z.string()
    .min(GAME_CONSTRAINTS.NAME_MIN_LENGTH, 'Game name is required')
    .max(GAME_CONSTRAINTS.NAME_MAX_LENGTH, 'Game name is too long'),
  roomId: z.string().uuid().nullable(),
  duration: z.number()
    .min(GAME_CONSTRAINTS.MIN_DURATION_MS, 'Duration too short')
    .max(GAME_CONSTRAINTS.MAX_DURATION_MS, 'Duration too long')
    .optional(),
  deviceIds: z.array(z.string())
    .min(GAME_CONSTRAINTS.MIN_TARGETS, `At least ${GAME_CONSTRAINTS.MIN_TARGETS} target is required`)
    .max(GAME_CONSTRAINTS.MAX_TARGETS, `Cannot exceed ${GAME_CONSTRAINTS.MAX_TARGETS} targets`),
});

/**
 * Game template input schema
 */
export const gameTemplateInputSchema = z.object({
  name: z.string()
    .min(GAME_CONSTRAINTS.NAME_MIN_LENGTH, 'Name is required')
    .max(GAME_CONSTRAINTS.NAME_MAX_LENGTH, 'Name is too long'),
  description: z.string()
    .max(GAME_CONSTRAINTS.DESCRIPTION_MAX_LENGTH, 'Description is too long')
    .nullable()
    .optional(),
  category: gameCategorySchema.nullable().optional(),
  difficulty: gameDifficultySchema.nullable().optional(),
  targetCount: z.number()
    .min(GAME_CONSTRAINTS.MIN_TARGETS)
    .max(GAME_CONSTRAINTS.MAX_TARGETS),
  shotsPerTarget: z.number()
    .min(GAME_CONSTRAINTS.MIN_SHOTS_PER_TARGET)
    .max(GAME_CONSTRAINTS.MAX_SHOTS_PER_TARGET),
  timeLimitMs: z.number()
    .min(GAME_CONSTRAINTS.MIN_TIME_LIMIT_MS)
    .max(GAME_CONSTRAINTS.MAX_TIME_LIMIT_MS)
    .nullable()
    .optional(),
});

/**
 * Game session update schema
 */
export const updateGameSessionSchema = z.object({
  status: gameSessionStatusSchema.optional(),
  score: z.number().min(0).optional(),
  hitCount: z.number().min(0).optional(),
  missCount: z.number().min(0).optional(),
  endTime: z.number().optional(),
});

/**
 * Game results schema
 */
export const gameResultsSchema = z.object({
  sessionId: z.string(),
  score: z.number().min(0),
  hitCount: z.number().min(0),
  missCount: z.number().min(0),
  totalShots: z.number().min(0),
  accuracy: z.number().min(0).max(100),
  duration: z.number().min(0),
  startTime: z.number(),
  endTime: z.number(),
});

// Inferred types
export type CreateGameSessionInput = z.infer<typeof createGameSessionInputSchema>;
export type GameTemplateInput = z.infer<typeof gameTemplateInputSchema>;
export type UpdateGameSession = z.infer<typeof updateGameSessionSchema>;
export type GameResults = z.infer<typeof gameResultsSchema>;

/**
 * Validate create game session input
 */
export function validateCreateGameSessionInput(input: unknown): ValidationResult<CreateGameSessionInput> {
  return validateWithSchema(createGameSessionInputSchema, input);
}

/**
 * Validate game template input
 */
export function validateGameTemplateInput(input: unknown): ValidationResult<GameTemplateInput> {
  return validateWithSchema(gameTemplateInputSchema, input);
}

/**
 * Validate update game session
 */
export function validateUpdateGameSession(input: unknown): ValidationResult<UpdateGameSession> {
  return validateWithSchema(updateGameSessionSchema, input);
}

/**
 * Validate game results
 */
export function validateGameResults(results: unknown): ValidationResult<GameResults> {
  return validateWithSchema(gameResultsSchema, results);
}

/**
 * Validate game session status
 */
export function validateGameSessionStatus(status: unknown): ValidationResult<GameSessionStatus> {
  return validateWithSchema(gameSessionStatusSchema, status);
}

/**
 * Validate game ID
 */
export function validateGameId(gameId: unknown): ValidationResult<string> {
  if (!isNonEmptyString(gameId)) {
    return {
      success: false,
      errors: [{ field: 'gameId', message: 'Game ID is required', code: 'required' }],
    };
  }
  
  return { success: true, data: gameId };
}

/**
 * Validate session ID
 */
export function validateSessionId(sessionId: unknown): ValidationResult<string> {
  if (!isNonEmptyString(sessionId)) {
    return {
      success: false,
      errors: [{ field: 'sessionId', message: 'Session ID is required', code: 'required' }],
    };
  }
  
  return { success: true, data: sessionId };
}

/**
 * Check if game session is in active state
 */
export function isActiveSessionStatus(status: GameSessionStatus): boolean {
  return ['configuring', 'launching', 'running', 'stopping', 'finalizing'].includes(status);
}

/**
 * Check if game session is in terminal state
 */
export function isTerminalSessionStatus(status: GameSessionStatus): boolean {
  return ['completed', 'error'].includes(status);
}

/**
 * Check if game session can be started
 */
export function canStartSession(status: GameSessionStatus): boolean {
  return status === 'idle';
}

/**
 * Check if game session can be stopped
 */
export function canStopSession(status: GameSessionStatus): boolean {
  return ['running', 'launching'].includes(status);
}



