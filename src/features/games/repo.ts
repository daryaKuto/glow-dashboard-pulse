import { supabase } from '@/data/supabase-client';
import { apiOk, apiErr, type ApiResponse } from '@/shared/lib/api-response';
import { mapGameRowToDomain, type GameDbRow } from '@/domain/games/mappers';
import type { GameRepository, PersistGameStartParams, PersistGameStopParams } from '@/domain/games/ports';
import type { GameTemplate } from './schema';

/**
 * Repository layer for Games feature
 *
 * Handles all data access operations (Supabase queries, edge function calls).
 * Returns ApiResponse<T> for consistent error handling.
 */

// Re-export types for backwards compatibility
export type { PersistGameStartParams, PersistGameStopParams };

/**
 * Persist the start of a game session to the database
 */
export async function persistGameStart(params: PersistGameStartParams): Promise<ApiResponse<void>> {
  const { gameId, gameName, durationMinutes, startedAt } = params;
  try {
    // Note: game_sessions table may not be in generated types yet
    const { error } = await (supabase.from('game_sessions') as any).insert({
      game_id: gameId,
      game_name: gameName ?? null,
      duration_minutes: durationMinutes ?? null,
      started_at: new Date(startedAt ?? Date.now()).toISOString(),
    });

    if (error) {
      console.warn('[Games Repo] Failed to persist game start', error);
      return apiErr('PERSIST_GAME_START_ERROR', error.message, error);
    }

    return apiOk(undefined);
  } catch (error) {
    console.warn('[Games Repo] Failed to persist game start', error);
    return apiErr(
      'PERSIST_GAME_START_ERROR',
      error instanceof Error ? error.message : 'Failed to persist game start',
      error
    );
  }
}

/**
 * Persist the stop of a game session to the database
 */
export async function persistGameStop(params: PersistGameStopParams): Promise<ApiResponse<void>> {
  const { gameId, stoppedAt } = params;
  try {
    // Note: game_sessions table may not be in generated types yet
    const { error } = await (supabase.from('game_sessions') as any)
      .update({
        stopped_at: new Date(stoppedAt ?? Date.now()).toISOString(),
      })
      .eq('game_id', gameId);

    if (error) {
      console.warn('[Games Repo] Failed to persist game stop', error);
      return apiErr('PERSIST_GAME_STOP_ERROR', error.message, error);
    }

    return apiOk(undefined);
  } catch (error) {
    console.warn('[Games Repo] Failed to persist game stop', error);
    return apiErr(
      'PERSIST_GAME_STOP_ERROR',
      error instanceof Error ? error.message : 'Failed to persist game stop',
      error
    );
  }
}

/**
 * Get all game templates
 */
export async function getGameTemplates(): Promise<ApiResponse<GameTemplate[]>> {
  try {
    const { data, error } = await supabase
      .from('games')
      .select(
        `
          id,
          slug,
          name,
          description,
          category,
          difficulty,
          target_count,
          shots_per_target,
          time_limit_ms,
          is_active,
          is_public,
          thingsboard_config,
          rules,
          created_at,
          updated_at
        `
      )
      .eq('is_active', true)
      .eq('is_public', true)
      .order('created_at', { ascending: true });

    if (error) {
      return apiErr('FETCH_GAME_TEMPLATES_ERROR', error.message, error);
    }

    const templates: GameTemplate[] = (data ?? []).map((game) =>
      mapGameRowToDomain(game as GameDbRow)
    );

    return apiOk(templates);
  } catch (error) {
    console.error('[Games Repo] Error fetching game templates:', error);
    return apiErr(
      'FETCH_GAME_TEMPLATES_ERROR',
      error instanceof Error ? error.message : 'Failed to fetch game templates',
      error
    );
  }
}

/**
 * Repository adapter (ports & adapters pattern)
 */
export const gamesRepository: GameRepository = {
  getGameTemplates,
  persistGameStart,
  persistGameStop,
};
