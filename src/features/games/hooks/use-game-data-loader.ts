import { useState, useEffect, useRef, useCallback } from 'react';
import type { GameHistory } from '@/features/games/lib/device-game-flow';
import type { LiveSessionSummary } from '@/components/games/types';
import type { NormalizedGameDevice } from '@/features/games/hooks/use-game-devices';
import { convertSessionToHistory } from '@/features/games/lib/session-converter';
import {
  fetchAllGameHistory as fetchPersistedGameHistory,
} from '@/features/games/lib/game-history';
import {
  convertHistoryEntryToLiveSummary,
} from '@/features/games/lib/session-summary-builder';
import { getRecentSessionsService } from '@/features/profile/service';
import type { SessionRegistry } from './use-session-registry';

const RECENT_SESSION_STORAGE_KEY = 'glow-dashboard:last-session';

export interface UseGameDataLoaderOptions {
  userId: string | undefined;
  isRunningLifecycle: boolean;
  availableDevices: NormalizedGameDevice[];
  setAvailableDevices: React.Dispatch<React.SetStateAction<NormalizedGameDevice[]>>;
  setErrorMessage: React.Dispatch<React.SetStateAction<string | null>>;
  registry: SessionRegistry;
  refreshGameDevices: (opts?: { silent?: boolean }) =>
    Promise<{ devices: NormalizedGameDevice[]; fetchedAt: number } | null>;
  refreshTargets: () => Promise<void>;
  targetsSnapshot: unknown[];
  targetsStoreLoading: boolean;
  loadingDevices: boolean;
}

export interface UseGameDataLoaderReturn {
  gameHistory: GameHistory[];
  setGameHistory: React.Dispatch<React.SetStateAction<GameHistory[]>>;
  isHistoryLoading: boolean;
  recentSessionSummary: LiveSessionSummary | null;
  setRecentSessionSummary: React.Dispatch<React.SetStateAction<LiveSessionSummary | null>>;
  loadGameHistory: () => Promise<void>;
  loadLiveDevices: (opts?: { silent?: boolean; showToast?: boolean; reason?: string }) => Promise<void>;
  availableDevicesRef: React.MutableRefObject<NormalizedGameDevice[]>;
  hasLoadedDevicesRef: React.MutableRefObject<boolean>;
}

export function useGameDataLoader(options: UseGameDataLoaderOptions): UseGameDataLoaderReturn {
  const {
    userId,
    isRunningLifecycle,
    availableDevices,
    setAvailableDevices,
    setErrorMessage,
    registry,
    refreshGameDevices,
    refreshTargets,
    targetsSnapshot,
    targetsStoreLoading,
    loadingDevices,
  } = options;

  const [gameHistory, setGameHistory] = useState<GameHistory[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(true);
  const [recentSessionSummary, setRecentSessionSummary] = useState<LiveSessionSummary | null>(null);

  const isLoadingHistoryRef = useRef(false);
  const hasLoadedHistoryRef = useRef(false);
  const availableDevicesRef = useRef<NormalizedGameDevice[]>([]);
  const hasLoadedDevicesRef = useRef(false);

  // --- loadGameHistory ---
  const loadGameHistory = useCallback(async () => {
    if (!userId) {
      return;
    }
    if (isLoadingHistoryRef.current) {
      return;
    }

    isLoadingHistoryRef.current = true;
    setIsHistoryLoading(true);
    try {
      const [historyResult, sessionsResult] = await Promise.allSettled([
        fetchPersistedGameHistory(),
        getRecentSessionsService(userId, 20),
      ]);

      const persistedHistory =
        historyResult.status === 'fulfilled' ? historyResult.value.history ?? [] : [];
      if (historyResult.status === 'rejected') {
        console.warn('[Games] Failed to load persisted game history', historyResult.reason);
      }

      const sessionHistory =
        sessionsResult.status === 'fulfilled' && sessionsResult.value.ok
          ? sessionsResult.value.data.map(convertSessionToHistory)
          : [];
      if (sessionsResult.status === 'rejected' || (sessionsResult.status === 'fulfilled' && !sessionsResult.value.ok)) {
        const reason = sessionsResult.status === 'rejected'
          ? sessionsResult.reason
          : (sessionsResult.value as { error?: unknown }).error;
        console.warn('[Games] Failed to load session history', reason);
      }

      const historyMap = new Map<string, GameHistory>();
      persistedHistory.forEach((entry) => {
        historyMap.set(entry.gameId, {
          ...entry,
          score: entry.score ?? entry.totalHits ?? 0,
        });
      });
      sessionHistory.forEach((entry) => {
        const existing = historyMap.get(entry.gameId);
        if (!existing || (existing.totalHits ?? 0) === 0) {
          historyMap.set(entry.gameId, entry);
        }
      });

      const combinedHistory = Array.from(historyMap.values()).sort(
        (a, b) => (b.startTime ?? 0) - (a.startTime ?? 0),
      );

      setGameHistory(combinedHistory);

      if (combinedHistory.length > 0) {
        const newSummary = convertHistoryEntryToLiveSummary(combinedHistory[0]);
        setRecentSessionSummary((prev) => {
          if (!prev || prev.gameId !== newSummary.gameId || prev.startedAt !== newSummary.startedAt) {
            return newSummary;
          }
          return prev;
        });
      } else {
        setRecentSessionSummary(null);
      }
    } catch (error) {
      console.warn('[Games] Failed to load game history', error);
      setGameHistory([]);
    } finally {
      setIsHistoryLoading(false);
      isLoadingHistoryRef.current = false;
    }
  }, [userId]);

  // --- loadLiveDevices ---
  const loadLiveDevices = useCallback(
    async ({
      silent = false,
      showToast = false,
      reason = 'manual',
    }: { silent?: boolean; showToast?: boolean; reason?: string } = {}) => {
      try {
        const result = await refreshGameDevices({ silent });
        if (!result) {
          return;
        }
        const mapped = result.devices;

        setAvailableDevices(mapped);
        availableDevicesRef.current = mapped;
        setErrorMessage(null);

        const setHitCounts = registry.current.setHitCounts;
        if (setHitCounts) {
          if (!isRunningLifecycle) {
            const baseline: Record<string, number> = {};
            mapped.forEach((device) => {
              baseline[device.deviceId] = device.hitCount ?? 0;
            });
            setHitCounts(baseline);
          } else {
            setHitCounts((prev) => {
              const next = { ...prev };
              mapped.forEach((device) => {
                if (!(device.deviceId in next)) {
                  next[device.deviceId] = device.hitCount ?? 0;
                }
              });
              return next;
            });
          }
        }

        hasLoadedDevicesRef.current = true;
      } catch (error) {
        console.error('❌ Failed to load live device data:', error);
        if (!silent) {
          setErrorMessage('Failed to load live device data. Please try again.');
        }
        setAvailableDevices([]);
        availableDevicesRef.current = [];
      }
    },
    [isRunningLifecycle, refreshGameDevices, refreshTargets, setAvailableDevices, setErrorMessage, registry],
  );

  // --- Effects ---

  // Restore cached session summary from localStorage on mount
  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    try {
      const storedValue = window.localStorage.getItem(RECENT_SESSION_STORAGE_KEY);
      if (!storedValue) {
        return;
      }
      const parsedSummary = JSON.parse(storedValue) as LiveSessionSummary;
      setRecentSessionSummary((previous) => previous ?? parsedSummary);
    } catch (storageError) {
      console.warn('[Games] Failed to restore cached session summary', storageError);
    }
  }, []);

  // Persist session summary to localStorage
  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    if (!recentSessionSummary) {
      window.localStorage.removeItem(RECENT_SESSION_STORAGE_KEY);
      return;
    }
    try {
      window.localStorage.setItem(RECENT_SESSION_STORAGE_KEY, JSON.stringify(recentSessionSummary));
    } catch (storageError) {
      console.warn('[Games] Failed to persist session summary cache', storageError);
    }
  }, [recentSessionSummary]);

  // Load history on mount or user change
  useEffect(() => {
    if (!userId) {
      setGameHistory([]);
      setIsHistoryLoading(false);
      setRecentSessionSummary(null);
      hasLoadedHistoryRef.current = false;
      return;
    }
    if (hasLoadedHistoryRef.current || isLoadingHistoryRef.current) {
      return;
    }
    hasLoadedHistoryRef.current = true;
    void loadGameHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // Sync availableDevicesRef
  useEffect(() => {
    availableDevicesRef.current = availableDevices;
  }, [availableDevices]);

  // Load devices once on mount
  useEffect(() => {
    if (hasLoadedDevicesRef.current) {
      return;
    }
    hasLoadedDevicesRef.current = true;
    void loadLiveDevices({ showToast: true, reason: 'initial' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Refresh targets if empty
  useEffect(() => {
    if (targetsSnapshot.length === 0 && !targetsStoreLoading && !loadingDevices && hasLoadedDevicesRef.current) {
      void refreshTargets().catch((err) => {
        console.warn('[Games] Failed to refresh targets snapshot for status sync', err);
      });
    }
  }, [targetsSnapshot.length, targetsStoreLoading, refreshTargets, loadingDevices]);

  return {
    gameHistory,
    setGameHistory,
    isHistoryLoading,
    recentSessionSummary,
    setRecentSessionSummary,
    loadGameHistory,
    loadLiveDevices,
    availableDevicesRef,
    hasLoadedDevicesRef,
  };
}
