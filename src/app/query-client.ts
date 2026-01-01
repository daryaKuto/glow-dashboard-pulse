import { QueryClient } from '@tanstack/react-query';

/**
 * React Query client configuration
 * 
 * Provides sensible defaults for caching, retries, and stale time.
 * Used throughout the application for server state management.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Data is considered stale after 30 seconds
      staleTime: 30 * 1000,
      // Cache data for 5 minutes
      gcTime: 5 * 60 * 1000, // Previously cacheTime
      // Retry failed requests up to 3 times
      retry: 3,
      // Retry delay increases exponentially
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      // Refetch on window focus in production, but not in development
      refetchOnWindowFocus: import.meta.env.PROD,
      // Don't refetch on reconnect automatically (can be overridden per query)
      refetchOnReconnect: true,
      // Don't refetch on mount if data exists (can be overridden per query)
      refetchOnMount: true,
    },
    mutations: {
      // Retry mutations once on failure
      retry: 1,
      // Retry delay for mutations
      retryDelay: 1000,
    },
  },
});

