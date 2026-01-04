import { supabase } from '@/data/supabase-client';
import { apiOk, apiErr, type ApiResponse } from '@/shared/lib/api-response';
import { mapGameRowToDomain, type GameDbRow } from '@/domain/games/mappers';
import type { GameTemplate } from './schema';

/**
 * Repository layer for Games feature
 * 
 * Handles all data access operations (Supabase queries, edge function calls).
 * Returns ApiResponse<T> for consistent error handling.
 */

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
