import { useCallback, useEffect, useRef } from 'react';
import { toast } from '@/components/ui/sonner';
import type { SessionHitRecord } from '@/features/games/lib/device-game-flow';
import type { SplitRecord, TransitionRecord, FinalizeSessionArgs } from '@/features/games/lib/telemetry-types';
import type { LiveSessionSummary } from '@/components/games/types';
import type { GameHistory } from '@/features/games/lib/device-game-flow';
import type { SessionLifecycle } from '@/components/game-session/sessionState';
import {
  buildLiveSessionSummary,
} from '@/features/games/lib/session-summary-builder';
import {
  saveGameHistory,
} from '@/features/games/lib/game-history';
import type { SessionCallbacks } from './use-session-registry';

export type { FinalizeSessionArgs };

export interface UseSessionFinalizerOptions {
  // Lifecycle
  sessionLifecycle: SessionLifecycle;
  isRunningLifecycle: boolean;
  isLaunchingLifecycle: boolean;
  setSessionLifecycle: React.Dispatch<React.SetStateAction<SessionLifecycle>>;

  // Session activation
  sessionConfirmed: boolean;
  telemetryConfirmedAt: number | null;
  startTriggeredAt: number | null;

  // Timer
  sessionTimerSeconds: number;
  startSessionTimer: (anchor: number) => void;

  // Session state
  activeDeviceIds: string[];
  goalShotsPerTarget: Record<string, number>;
  sessionDurationSeconds: number | null;

  // Telemetry data (from useSessionTelemetrySync)
  hitHistory: SessionHitRecord[];
  stoppedTargets: Set<string>;
  telemetryState: { splits: SplitRecord[]; transitions: TransitionRecord[] };

  // State setters for persisting finalized session
  setRecentSessionSummary: React.Dispatch<React.SetStateAction<LiveSessionSummary | null>>;
  setGameHistory: React.Dispatch<React.SetStateAction<GameHistory[]>>;

  // Registry
  register: <K extends keyof SessionCallbacks>(key: K, fn: SessionCallbacks[K]) => void;

  // Refs (shared with orchestration-level callers)
  sessionConfirmedRef: React.MutableRefObject<boolean>;
  hasMarkedTelemetryConfirmedRef: React.MutableRefObject<boolean>;

  // Stop callback (from C.3 — the finalizer triggers stop, C.3 executes it)
  handleStopGame: () => Promise<void>;
}

export interface UseSessionFinalizerReturn {
  splitRecords: SplitRecord[];
  transitionRecords: TransitionRecord[];
}

export function useSessionFinalizer(options: UseSessionFinalizerOptions): UseSessionFinalizerReturn {
  const {
    sessionLifecycle,
    isRunningLifecycle,
    isLaunchingLifecycle,
    setSessionLifecycle,
    sessionConfirmed,
    telemetryConfirmedAt,
    startTriggeredAt,
    sessionTimerSeconds,
    startSessionTimer,
    activeDeviceIds,
    goalShotsPerTarget,
    sessionDurationSeconds,
    hitHistory,
    stoppedTargets,
    telemetryState,
    setRecentSessionSummary,
    setGameHistory,
    register,
    sessionConfirmedRef,
    hasMarkedTelemetryConfirmedRef,
    handleStopGame,
  } = options;

  // --- Owned refs ---
  const autoStopTriggeredRef = useRef(false);
  const goalTerminationTriggeredRef = useRef(false);

  // --- Computed telemetry slices ---
  const splitRecords =
    isRunningLifecycle || sessionLifecycle === 'stopping' || sessionLifecycle === 'finalizing'
      ? telemetryState.splits
      : [];

  const transitionRecords =
    isRunningLifecycle || sessionLifecycle === 'stopping' || sessionLifecycle === 'finalizing'
      ? telemetryState.transitions
      : [];

  // --- Callbacks ---

  const finalizeSession = useCallback(
    async ({
      resolvedGameId,
      sessionLabel,
      startTimestamp,
      stopTimestamp,
      targetDevices,
      hitHistorySnapshot,
      splitRecordsSnapshot,
      transitionRecordsSnapshot,
      roomId,
      roomName,
      desiredDurationSeconds,
      presetId,
      goalShotsPerTarget: goalShots,
    }: FinalizeSessionArgs) => {
      const sessionSummary = buildLiveSessionSummary({
        gameId: resolvedGameId,
        gameName: sessionLabel,
        startTime: startTimestamp,
        stopTime: stopTimestamp,
        hitHistory: hitHistorySnapshot,
        splitRecords: splitRecordsSnapshot,
        transitionRecords: transitionRecordsSnapshot,
        devices: targetDevices,
        roomId,
        roomName,
        desiredDurationSeconds,
        presetId,
        goalShotsPerTarget: goalShots ?? {},
      });

      setRecentSessionSummary(sessionSummary);
      setGameHistory((prev) => [sessionSummary.historyEntry, ...prev]);

      try {
        const { status, sessionPersisted, sessionPersistError } = await saveGameHistory(sessionSummary.historyEntry);
        if (status === 'created') {
          console.info('[Games] Game history entry created', sessionSummary.historyEntry.gameId);
        } else if (status === 'updated') {
          console.info('[Games] Game history entry updated', sessionSummary.historyEntry.gameId);
        }
        if (!sessionPersisted) {
          console.warn('[Games] Session analytics missing from Supabase sessions table', {
            gameId: sessionSummary.historyEntry.gameId,
            sessionPersistError,
          });
        }
      } catch (persistError) {
        console.warn('[Games] Failed to persist game history', persistError);
        toast.error('Failed to persist game history. Please check your connection.');
      }

      return sessionSummary;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // --- Effects ---

  // Reset auto-stop refs when session ends
  useEffect(() => {
    if (!isRunningLifecycle) {
      autoStopTriggeredRef.current = false;
      goalTerminationTriggeredRef.current = false;
    }
  }, [isRunningLifecycle]);

  // Track confirmation state in ref for async callbacks
  useEffect(() => {
    sessionConfirmedRef.current = sessionConfirmed;
    if (!sessionConfirmed) {
      hasMarkedTelemetryConfirmedRef.current = false;
    }
  }, [sessionConfirmed]);

  // Transition launching → running when telemetry confirms
  useEffect(() => {
    if (
      sessionLifecycle === 'launching' &&
      sessionConfirmed &&
      typeof telemetryConfirmedAt === 'number'
    ) {
      const anchor =
        startTriggeredAt !== null && telemetryConfirmedAt < startTriggeredAt
          ? startTriggeredAt
          : telemetryConfirmedAt;
      startSessionTimer(anchor);
      setSessionLifecycle('running');
    }
  }, [
    sessionLifecycle,
    sessionConfirmed,
    telemetryConfirmedAt,
    startTriggeredAt,
    startSessionTimer,
  ]);

  // Monitor if all targets with goals have been stopped and terminate game if needed
  useEffect(() => {
    if (!isRunningLifecycle || activeDeviceIds.length === 0 || Object.keys(goalShotsPerTarget).length === 0) {
      return;
    }

    if (goalTerminationTriggeredRef.current) {
      return;
    }

    const activeTargetsWithGoals = activeDeviceIds.filter((id) => goalShotsPerTarget[id] !== undefined);
    const allTargetsWithGoalsStopped = activeTargetsWithGoals.length > 0 && activeTargetsWithGoals.every((id) => stoppedTargets.has(id));
    const isSingleTarget = activeDeviceIds.length === 1;

    if ((isSingleTarget || allTargetsWithGoalsStopped) && stoppedTargets.size > 0) {
      goalTerminationTriggeredRef.current = true;
      console.info('[Games] All targets with goals reached their goals. Terminating game.', {
        isSingleTarget,
        allTargetsWithGoalsStopped,
        activeDeviceIds,
        stoppedTargets: Array.from(stoppedTargets),
        activeTargetsWithGoals,
      });
      toast.success('All targets reached their goals. Game ending...');
      setTimeout(() => {
        void handleStopGame();
      }, 500);
    }
  }, [isRunningLifecycle, activeDeviceIds, goalShotsPerTarget, stoppedTargets, handleStopGame]);

  // Auto-stop when desired duration elapses
  useEffect(() => {
    if (!isRunningLifecycle) {
      return;
    }
    if (typeof sessionDurationSeconds !== 'number' || sessionDurationSeconds <= 0) {
      return;
    }
    if (autoStopTriggeredRef.current) {
      return;
    }
    if (sessionTimerSeconds < sessionDurationSeconds) {
      return;
    }
    autoStopTriggeredRef.current = true;
    console.info('[Games] Auto-stopping session because desired duration elapsed', {
      desiredDurationSeconds: sessionDurationSeconds,
      elapsedSeconds: sessionTimerSeconds,
    });
    toast.info('Session reached its time limit. Stopping game...');
    void handleStopGame();
  }, [handleStopGame, isRunningLifecycle, sessionDurationSeconds, sessionTimerSeconds]);

  // --- Register callbacks in the session registry ---
  register('finalizeSession', finalizeSession);
  register('getHitHistory', () => hitHistory);
  register('getSplitRecords', () => splitRecords);
  register('getTransitionRecords', () => transitionRecords);

  return {
    splitRecords,
    transitionRecords,
  };
}
