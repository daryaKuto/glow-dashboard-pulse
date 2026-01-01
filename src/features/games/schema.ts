import { z } from 'zod';

/**
 * Zod schemas for Games feature
 * 
 * Games feature handles game sessions, scenarios, and game flow.
 */

export const gameSessionSchema = z.object({
  id: z.string(),
  gameId: z.string(),
  gameName: z.string(),
  roomId: z.string().nullable(),
  roomName: z.string().nullable(),
  status: z.enum(['idle', 'configuring', 'launching', 'running', 'stopping', 'finalizing', 'completed', 'error']),
  startTime: z.number().nullable(),
  endTime: z.number().nullable(),
  duration: z.number(),
  score: z.number(),
  hitCount: z.number(),
  missCount: z.number(),
  totalShots: z.number(),
  accuracy: z.number(),
});

export const gameTemplateSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  category: z.string().nullable(),
  difficulty: z.string().nullable(),
  targetCount: z.number(),
  shotsPerTarget: z.number(),
  timeLimitMs: z.number().nullable(),
  isActive: z.boolean(),
  isPublic: z.boolean(),
  thingsboardConfig: z.record(z.unknown()).nullable(),
  rules: z.record(z.unknown()).nullable(),
  createdAt: z.string().nullable(),
  updatedAt: z.string().nullable(),
});

export const createGameSessionSchema = z.object({
  gameId: z.string(),
  gameName: z.string(),
  roomId: z.string().nullable(),
  duration: z.number().optional(),
  deviceIds: z.array(z.string()),
});

// Inferred types
export type GameSession = z.infer<typeof gameSessionSchema>;
export type GameTemplate = z.infer<typeof gameTemplateSchema>;
export type CreateGameSession = z.infer<typeof createGameSessionSchema>;

