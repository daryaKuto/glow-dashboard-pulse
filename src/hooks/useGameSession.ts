import { useCallback, useMemo, useRef, useState } from 'react';
import { invokeGameControl } from '@/lib/edge';
import { supabase } from '@/integrations/supabase/client';

interface WarningEntry {
  deviceId: string;
  warning: string;
}

interface UseGameSessionOptions {
  onResetMetrics?: () => void;
  onStop?: () => void;
}

interface StartGameSessionArgs {
  deviceIds: string[];
  gameId?: string;
  gameName?: string;
  durationMinutes?: number;
}

interface StartGameSessionResult {
  ok: boolean;
  gameId: string | null;
  startedAt?: number;
  successfulDeviceIds: string[];
  failedDeviceIds: string[];
  warnings: WarningEntry[];
}

interface StopGameSessionArgs {
  deviceIds?: string[];
  gameId?: string | null;
}

interface StopGameSessionResult {
  ok: boolean;
  gameId: string | null;
  stoppedAt?: number;
  failedDeviceIds: string[];
  warnings: WarningEntry[];
}

// useGameSession coordinates the game RPC lifecycle, normalising ThingsBoard responses and persisting metadata to Supabase so screens only react to the distilled results.
export function useGameSession(options: UseGameSessionOptions = {}) {
  const { onResetMetrics, onStop } = options;

  const [currentGameId, setCurrentGameId] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastWarnings, setLastWarnings] = useState<WarningEntry[]>([]);

  const lastDeviceIdsRef = useRef<string[]>([]);
  const lastStartTimestampRef = useRef<number | null>(null);

  const persistGameStart = useCallback(
    async (gameId: string, gameName: string | undefined, durationMinutes: number | undefined, startedAt?: number) => {
      try {
        await supabase.from<any>('game_sessions').insert({
          game_id: gameId,
          game_name: gameName ?? null,
          duration_minutes: durationMinutes ?? null,
          started_at: new Date(startedAt ?? Date.now()).toISOString(),
        });
      } catch (dbError) {
        console.warn('[useGameSession] Failed to persist game start', dbError);
      }
    },
    [],
  );

  const persistGameStop = useCallback(
    async (gameId: string, stoppedAt?: number) => {
      try {
        await supabase
          .from<any>('game_sessions')
          .update({
            stopped_at: new Date(stoppedAt ?? Date.now()).toISOString(),
          })
          .eq('game_id', gameId);
      } catch (dbError) {
        console.warn('[useGameSession] Failed to persist game stop', dbError);
      }
    },
    [],
  );

  const startGameSession = useCallback(
    async ({
      deviceIds,
      gameId,
      gameName,
      durationMinutes,
    }: StartGameSessionArgs): Promise<StartGameSessionResult> => {
      if (isStarting) {
        return {
          ok: false,
          gameId: currentGameId,
          successfulDeviceIds: [],
          failedDeviceIds: [],
          warnings: [],
        };
      }

      if (!Array.isArray(deviceIds) || deviceIds.length === 0) {
        setError('No devices selected for game start.');
        return {
          ok: false,
          gameId: currentGameId,
          successfulDeviceIds: [],
          failedDeviceIds: [],
          warnings: [],
        };
      }

      const resolvedGameId = gameId && gameId.trim().length > 0 ? gameId : `GM-${Date.now()}`;

      setIsStarting(true);
      setError(null);
      setLastWarnings([]);

      try {
        const response = await invokeGameControl('start', { deviceIds, gameId: resolvedGameId });
        const commandResults = response.results ?? [];

        let successfulDeviceIds: string[] = [];
        let failedDeviceIds: string[] = [];

        if (commandResults.length > 0) {
          successfulDeviceIds = commandResults
            .filter((result) => result.success)
            .map((result) => result.deviceId);
          failedDeviceIds = commandResults
            .filter((result) => !result.success)
            .map((result) => result.deviceId);
        } else if ((response.failureCount ?? 0) > 0) {
          failedDeviceIds = [...deviceIds];
        } else {
          successfulDeviceIds = [...deviceIds];
        }

        const warnings: WarningEntry[] = Array.isArray(response.warnings)
          ? response.warnings.filter((entry): entry is WarningEntry => Boolean(entry?.deviceId && entry.warning))
          : [];

        if (commandResults.length > 0 && warnings.length === 0) {
          warnings.push(
            ...commandResults
              .filter((result) => result.success && result.warning)
              .map((result) => ({ deviceId: result.deviceId, warning: result.warning as string })),
          );
        }

        if (successfulDeviceIds.length === 0) {
          setError('Failed to start game on the selected devices.');
          setLastWarnings(warnings);
          return {
            ok: false,
            gameId: currentGameId,
            successfulDeviceIds: [],
            failedDeviceIds,
            warnings,
          };
        }

        const startedAt = response.startedAt ?? Date.now();
        lastDeviceIdsRef.current = successfulDeviceIds;
        lastStartTimestampRef.current = startedAt;
        setCurrentGameId(resolvedGameId);
        setLastWarnings(warnings);

        if (onResetMetrics) {
          onResetMetrics();
        }

        void persistGameStart(resolvedGameId, gameName, durationMinutes, startedAt);

        return {
          ok: true,
          gameId: resolvedGameId,
          startedAt,
          successfulDeviceIds,
          failedDeviceIds,
          warnings,
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error('[useGameSession] startGameSession failed', err);
        setError(message);
        setLastWarnings([]);
        return {
          ok: false,
          gameId: currentGameId,
          successfulDeviceIds: [],
          failedDeviceIds: [...deviceIds],
          warnings: [],
        };
      } finally {
        setIsStarting(false);
      }
    },
    [currentGameId, isStarting, onResetMetrics, persistGameStart],
  );

  const stopGameSession = useCallback(
    async ({ deviceIds, gameId }: StopGameSessionArgs): Promise<StopGameSessionResult> => {
      if (isStopping) {
        return {
          ok: false,
          gameId: currentGameId,
          failedDeviceIds: [],
          warnings: [],
        };
      }

      const resolvedGameId = gameId ?? currentGameId;
      if (!resolvedGameId) {
        setError('No active game to stop.');
        return {
          ok: false,
          gameId: currentGameId,
          failedDeviceIds: [],
          warnings: [],
        };
      }

      const resolvedDeviceIds = Array.isArray(deviceIds) && deviceIds.length > 0
        ? deviceIds
        : [...lastDeviceIdsRef.current];

      if (resolvedDeviceIds.length === 0) {
        setError('No devices associated with the running game.');
        return {
          ok: false,
          gameId: currentGameId,
          failedDeviceIds: [],
          warnings: [],
        };
      }

      setIsStopping(true);
      setError(null);

      try {
        const response = await invokeGameControl('stop', { deviceIds: resolvedDeviceIds, gameId: resolvedGameId });
        const commandResults = response.results ?? [];

        let failedDeviceIds: string[] = [];
        if (commandResults.length > 0) {
          failedDeviceIds = commandResults.filter((result) => !result.success).map((result) => result.deviceId);
        } else if ((response.failureCount ?? 0) > 0) {
          failedDeviceIds = [...resolvedDeviceIds];
        }

        const warnings: WarningEntry[] = Array.isArray(response.warnings)
          ? response.warnings.filter((entry): entry is WarningEntry => Boolean(entry?.deviceId && entry.warning))
          : [];

        if (commandResults.length > 0 && warnings.length === 0) {
          warnings.push(
            ...commandResults
              .filter((result) => result.success && result.warning)
              .map((result) => ({ deviceId: result.deviceId, warning: result.warning as string })),
          );
        }

        const stoppedAt = response.stoppedAt ?? Date.now();
        setLastWarnings(warnings);

        if (failedDeviceIds.length === resolvedDeviceIds.length) {
          setError('Failed to stop game on the selected devices.');
          return {
            ok: false,
            gameId: resolvedGameId,
            stoppedAt,
            failedDeviceIds,
            warnings,
          };
        }

        if (onStop) {
          onStop();
        }

        lastDeviceIdsRef.current = [];
        lastStartTimestampRef.current = null;
        setCurrentGameId(null);

        void persistGameStop(resolvedGameId, stoppedAt);

        return {
          ok: true,
          gameId: resolvedGameId,
          stoppedAt,
          failedDeviceIds,
          warnings,
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error('[useGameSession] stopGameSession failed', err);
        setError(message);
        return {
          ok: false,
          gameId: resolvedGameId,
          failedDeviceIds: [...resolvedDeviceIds],
          warnings: [],
        };
      } finally {
        setIsStopping(false);
      }
    },
    [currentGameId, isStopping, onStop, persistGameStop],
  );

  const clearWarnings = useCallback(() => {
    setLastWarnings([]);
  }, []);

  return useMemo(
    () => ({
      currentGameId,
      isStarting,
      isStopping,
      error,
      warnings: lastWarnings,
      startGameSession,
      stopGameSession,
      clearWarnings,
    }),
    [clearWarnings, currentGameId, error, isStarting, isStopping, lastWarnings, startGameSession, stopGameSession],
  );
}
