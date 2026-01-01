import { useQuery } from '@tanstack/react-query';
import { getGameTemplatesService } from './service';
import type { GameTemplate } from './schema';

/**
 * React Query hooks for Games feature
 */

// Query keys
export const gamesKeys = {
  all: ['games'] as const,
  templates: () => [...gamesKeys.all, 'templates'] as const,
};

/**
 * Get all game templates
 */
export function useGameTemplates() {
  return useQuery({
    queryKey: gamesKeys.templates(),
    queryFn: async () => {
      const result = await getGameTemplatesService();
      if (!result.ok) {
        throw new Error(result.error.message);
      }
      return result.data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes - templates don't change often
  });
}

