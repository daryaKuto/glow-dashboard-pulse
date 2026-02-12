/**
 * React Query hook for game history
 * 
 * Replaces the gameHistory state in useGameFlow Zustand store.
 * Provides caching, automatic refetching, and proper loading states.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchAllGameHistory,
  saveGameHistory,
  type FetchAllGameHistoryOptions,
} from '@/features/games/lib/game-history';
import type { GameHistory } from '@/features/games/lib/device-game-flow';

export const gameHistoryKeys = {
  all: ['games', 'history'] as const,
  list: (options?: FetchAllGameHistoryOptions) => [...gameHistoryKeys.all, 'list', options] as const,
};

/**
 * Hook to fetch game history
 * 
 * Replaces useGameFlow().gameHistory and useGameFlow().loadGameHistory
 */
export function useGameHistory(options?: FetchAllGameHistoryOptions) {
  return useQuery({
    queryKey: gameHistoryKeys.list(options),
    queryFn: async () => {
      const { history } = await fetchAllGameHistory(options);
      return history;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes (formerly cacheTime)
  });
}

/**
 * Hook to save game history and invalidate cache
 * 
 * Replaces useGameFlow().saveGameToHistory
 */
export function useSaveGameHistory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (summary: GameHistory) => {
      const result = await saveGameHistory(summary);
      return { summary, result };
    },
    onSuccess: ({ summary }) => {
      // Optimistically add to cache
      queryClient.setQueryData<GameHistory[]>(
        gameHistoryKeys.list(),
        (old) => {
          if (!old) return [summary];
          // Add to beginning, avoid duplicates
          const filtered = old.filter((h) => h.gameId !== summary.gameId);
          return [summary, ...filtered];
        }
      );
      
      // Also invalidate to ensure fresh data on next fetch
      queryClient.invalidateQueries({ queryKey: gameHistoryKeys.all });
    },
    onError: (error) => {
      console.error('[useGameHistory] Failed to save game history:', error);
    },
  });
}

/**
 * Hook to manually add a game to history (for admin tooling)
 * 
 * Replaces useGameFlow().addGameToHistory
 */
export function useAddGameToHistory() {
  const queryClient = useQueryClient();
  const saveGameHistoryMutation = useSaveGameHistory();

  return useMutation({
    mutationFn: async (historyEntry: GameHistory) => {
      // Save to backend
      await saveGameHistoryMutation.mutateAsync(historyEntry);
      return historyEntry;
    },
    onError: (error) => {
      console.error('[useGameHistory] Failed to add game to history:', error);
    },
  });
}

/**
 * Hook to invalidate game history cache
 * 
 * Useful after game completion to force refetch
 */
export function useInvalidateGameHistory() {
  const queryClient = useQueryClient();

  return () => {
    queryClient.invalidateQueries({ queryKey: gameHistoryKeys.all });
  };
}

