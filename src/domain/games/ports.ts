/**
 * Games Domain Ports
 *
 * Repository interfaces for data access.
 * Pure types - no React or Supabase imports.
 */

import type { ApiResponse } from '@/shared/lib/api-response';

/**
 * Game template record
 */
export type GameTemplateRecord = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  category: string;
  difficulty: string;
  targetCount: number;
  shotsPerTarget: number;
  timeLimitMs: number;
  isActive: boolean;
  isPublic: boolean;
  thingsboardConfig: Record<string, unknown> | null;
  rules: Record<string, unknown> | null;
  createdAt: string | null;
  updatedAt: string | null;
};

/**
 * Game session status
 */
export type GameSessionStatus = 'idle' | 'configuring' | 'ready' | 'running' | 'paused' | 'completed' | 'error';

/**
 * Game start parameters
 */
export type PersistGameStartParams = {
  gameId: string;
  gameName?: string;
  durationMinutes?: number;
  startedAt?: number;
};

/**
 * Game stop parameters
 */
export type PersistGameStopParams = {
  gameId: string;
  stoppedAt?: number;
};

/**
 * Game Repository Interface
 * 
 * Defines the contract for game data access.
 */
export interface GameRepository {
  /**
   * Get all game templates
   */
  getGameTemplates(): Promise<ApiResponse<GameTemplateRecord[]>>;

  /**
   * Persist the start of a game session
   */
  persistGameStart(params: PersistGameStartParams): Promise<ApiResponse<void>>;

  /**
   * Persist the stop of a game session
   */
  persistGameStop(params: PersistGameStopParams): Promise<ApiResponse<void>>;
}

