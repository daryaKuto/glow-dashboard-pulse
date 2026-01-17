import { QueryClient } from '@tanstack/react-query';
import { RateLimitError } from '@/shared/lib/rate-limiter';

/**
 * React Query client configuration
 * 
 * Provides sensible defaults for caching, retries, and stale time.
 * Used throughout the application for server state management.
 */
const parseRetryAfterHeader = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.max(0, value * 1000);
  }

  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const numeric = Number(trimmed);
  if (!Number.isNaN(numeric)) {
    return Math.max(0, numeric * 1000);
  }

  const dateMs = Date.parse(trimmed);
  if (!Number.isNaN(dateMs)) {
    return Math.max(0, dateMs - Date.now());
  }

  return null;
};

const getRetryAfterMs = (error: unknown): number | null => {
  if (error instanceof RateLimitError) {
    return error.retryAfterMs;
  }

  if (!error || typeof error !== 'object') {
    return null;
  }

  const errorWithRetry = error as { retryAfterMs?: unknown };
  if (typeof errorWithRetry.retryAfterMs === 'number') {
    return errorWithRetry.retryAfterMs;
  }

  const response = (error as { response?: { status?: unknown; headers?: unknown; data?: unknown } }).response;
  if (!response || response.status !== 429) {
    return null;
  }

  const dataRetry = (response.data as { retryAfterMs?: unknown } | undefined)?.retryAfterMs;
  if (typeof dataRetry === 'number') {
    return dataRetry;
  }

  const headers = response.headers;
  if (!headers || typeof headers !== 'object') {
    return null;
  }

  const headerValue = (headers as Record<string, unknown>)['retry-after']
    ?? (headers as Record<string, unknown>)['Retry-After'];
  return parseRetryAfterHeader(headerValue);
};

const defaultRetryDelay = (attemptIndex: number) => Math.min(1000 * 2 ** attemptIndex, 30000);

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
      retryDelay: (attemptIndex, error) => getRetryAfterMs(error) ?? defaultRetryDelay(attemptIndex),
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
      retryDelay: (attemptIndex, error) => getRetryAfterMs(error) ?? 1000,
    },
  },
});


