import { useCallback, useEffect, useState } from 'react';
import { ensureThingsboardSession, type ThingsboardSession } from '@/lib/edge';

interface UseThingsboardTokenOptions {
  /** Whether the hook should attempt to fetch a token immediately. Defaults to true. */
  immediate?: boolean;
  /** Milliseconds before expiry to refresh the token. Defaults to 60s. */
  refreshBufferMs?: number;
}

interface UseThingsboardTokenResult {
  token: string | null;
  session: ThingsboardSession | null;
  isLoading: boolean;
  error: Error | null;
  refresh: (options?: { force?: boolean }) => Promise<ThingsboardSession | null>;
}

/**
 * Manages a short-lived ThingsBoard session token, automatically refreshing it before expiry
 * and exposing a manual refresh helper for callers who detect authentication failures.
 */
export function useThingsboardToken(options: UseThingsboardTokenOptions = {}): UseThingsboardTokenResult {
  const { immediate = true, refreshBufferMs = 60_000 } = options;

  const [session, setSession] = useState<ThingsboardSession | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(
    async (refreshOptions: { force?: boolean } = {}): Promise<ThingsboardSession | null> => {
      try {
        setIsLoading(true);
        const nextSession = await ensureThingsboardSession({ force: refreshOptions.force });
        setSession(nextSession);
        setError(null);
        return nextSession;
      } catch (err) {
        const instance = err instanceof Error ? err : new Error(String(err));
        setError(instance);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (!immediate) {
      return;
    }
    let cancelled = false;
    void refresh().then((result) => {
      if (!cancelled && !result) {
        // Opportunistically retry once if the initial fetch fails.
        window.setTimeout(() => {
          if (!cancelled) {
            void refresh({ force: true });
          }
        }, 5_000);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [immediate, refresh]);

  useEffect(() => {
    if (!session) {
      return;
    }

    const now = Date.now();
    const refreshIn = Math.max(30_000, session.expiresAt - refreshBufferMs - now);
    const timer = window.setTimeout(() => {
      void refresh({ force: true });
    }, refreshIn);

    return () => window.clearTimeout(timer);
  }, [session, refresh, refreshBufferMs]);

  return {
    token: session?.token ?? null,
    session,
    isLoading,
    error,
    refresh,
  };
}

export default useThingsboardToken;
