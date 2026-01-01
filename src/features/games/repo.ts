import { supabase } from '@/data/supabase-client';
import { apiOk, apiErr, type ApiResponse } from '@/shared/lib/api-response';
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

    const templates: GameTemplate[] = (data ?? []).map((game) => {
      const thingsboardConfig =
        game.thingsboard_config && typeof game.thingsboard_config === 'object' && !Array.isArray(game.thingsboard_config)
          ? (game.thingsboard_config as Record<string, unknown>)
          : null;
      const rules =
        game.rules && typeof game.rules === 'object' && !Array.isArray(game.rules)
          ? (game.rules as Record<string, unknown>)
          : null;

      return {
        id: game.id,
        slug: game.slug,
        name: game.name,
        description: game.description,
        category: game.category,
        difficulty: game.difficulty,
        targetCount: game.target_count ?? 0,
        shotsPerTarget: game.shots_per_target ?? 0,
        timeLimitMs: game.time_limit_ms ?? 0,
        isActive: game.is_active ?? false,
        isPublic: game.is_public ?? false,
        thingsboardConfig,
        rules,
        createdAt: game.created_at ?? null,
        updatedAt: game.updated_at ?? null,
      };
    });

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

