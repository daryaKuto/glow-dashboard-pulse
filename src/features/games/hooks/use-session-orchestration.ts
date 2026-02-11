import { useCallback, useEffect, useRef } from 'react';
import { toast } from '@/components/ui/sonner';
import type { SessionHitRecord } from '@/features/games/lib/device-game-flow';
import type { NormalizedGameDevice } from '@/features/games/hooks/use-game-devices';
import type { SplitRecord, TransitionRecord } from '@/features/games/hooks/use-game-telemetry';
import type { FinalizeSessionArgs } from '@/features/games/hooks/use-thingsboard-control';
import type { LiveSessionSummary } from '@/components/games/types';
import type { GameHistory } from '@/features/games/lib/device-game-flow';
import type { SessionLifecycle } from '@/components/game-session/sessionState';
import {
  buildLiveSessionSummary,
} from '@/features/games/lib/session-summary-builder';
import {
  saveGameHistory,
} from '@/features/games/lib/game-history';

export interface UseSessionOrchestrationOptions {
  // Lifecycle
  sessionLifecycle: SessionLifecycle;
  isRunningLifecycle: boolean;
  isLaunchingLifecycle: boolean;
  isStoppingLifecycle: boolean;
  isFinalizingLifecycle: boolean;
  isSessionLocked: boolean;
  setSessionLifecycle: React.Dispatch<React.SetStateAction<SessionLifecycle>>;
  setIsSessionDialogDismissed: (value: boolean) => void;

  // Session activation
  sessionConfirmed: boolean;
  telemetryConfirmedAt: number | null;
  startTriggeredAt: number | null;

  // Timer
  sessionTimerSeconds: number;
  resetSessionTimer: (anchor: number | null) => void;
  startSessionTimer: (anchor: number) => void;

  // Device state
  activeDeviceIds: string[];
  selectedDeviceIds: string[];
  setSelectedDeviceIds: React.Dispatch<React.SetStateAction<string[]>>;
  pendingSessionTargets: NormalizedGameDevice[];
  setPendingSessionTargets: React.Dispatch<React.SetStateAction<NormalizedGameDevice[]>>;
  currentSessionTargets: NormalizedGameDevice[];
  setCurrentSessionTargets: React.Dispatch<React.SetStateAction<NormalizedGameDevice[]>>;
  setAvailableDevices: React.Dispatch<React.SetStateAction<NormalizedGameDevice[]>>;

  // Session config
  sessionDurationSeconds: number | null;
  setSessionDurationSeconds: React.Dispatch<React.SetStateAction<number | null>>;
  sessionRoomId: string | null;
  sessionRoomName: string | null;
  setSessionRoomId: React.Dispatch<React.SetStateAction<string | null>>;
  goalShotsPerTarget: Record<string, number>;
  setGoalShotsPerTarget: React.Dispatch<React.SetStateAction<Record<string, number>>>;

  // Presets
  stagedPresetId: string | null;
  activePresetId: string | null;
  setStagedPresetId: React.Dispatch<React.SetStateAction<string | null>>;
  setActivePresetId: React.Dispatch<React.SetStateAction<string | null>>;

  // Session summary / history
  recentSessionSummary: LiveSessionSummary | null;
  setRecentSessionSummary: React.Dispatch<React.SetStateAction<LiveSessionSummary | null>>;
  setGameHistory: React.Dispatch<React.SetStateAction<GameHistory[]>>;

  // TB control callbacks
  openStartDialogForTargets: (args: {
    targetIds: string[];
    source: 'manual' | 'preset';
    requireOnline: boolean;
    syncCurrentTargets?: boolean;
  }) => Promise<{ targets: NormalizedGameDevice[]; gameId: string } | null>;
  beginSessionLaunch: (args?: {
    targets?: NormalizedGameDevice[];
    gameId?: string;
  }) => void;
  handleStopDirectGame: () => Promise<void>;

  // Direct session setters
  setDirectSessionTargets: React.Dispatch<React.SetStateAction<Array<{ deviceId: string; name: string }>>>;
  setDirectSessionGameId: React.Dispatch<React.SetStateAction<string | null>>;
  updateDirectStartStates: (
    value:
      | Record<string, 'idle' | 'pending' | 'success' | 'error'>
      | ((
        prev: Record<string, 'idle' | 'pending' | 'success' | 'error'>,
      ) => Record<string, 'idle' | 'pending' | 'success' | 'error'>)
  ) => void;

  // Telemetry data
  hitHistory: SessionHitRecord[];
  stoppedTargets: Set<string>;
  telemetryState: { splits: SplitRecord[]; transitions: TransitionRecord[] };

  // Bridge refs
  hitHistoryRef: React.MutableRefObject<SessionHitRecord[]>;
  splitRecordsRef: React.MutableRefObject<SplitRecord[]>;
  transitionRecordsRef: React.MutableRefObject<TransitionRecord[]>;
  finalizeSessionRef: React.MutableRefObject<(args: FinalizeSessionArgs) => Promise<unknown>>;
  sessionConfirmedRef: React.MutableRefObject<boolean>;
  hasMarkedTelemetryConfirmedRef: React.MutableRefObject<boolean>;
  selectionManuallyModifiedRef: React.MutableRefObject<boolean>;

  // Setup flow
  canLaunchGame: boolean;
  advanceToReviewStep: () => void;
  resetSetupFlow: () => void;
}

export interface UseSessionOrchestrationReturn {
  finalizeSession: (args: FinalizeSessionArgs) => Promise<LiveSessionSummary>;
  handleStopGame: () => Promise<void>;
  handleCloseStartDialog: () => void;
  handleUsePreviousSettings: () => Promise<void>;
  handleCreateNewSetup: () => void;
  handleOpenStartDialog: () => Promise<void>;
  handleConfirmStartDialog: () => void;
  handleStopFromDialog: () => void;
  splitRecords: SplitRecord[];
  transitionRecords: TransitionRecord[];
}

export function useSessionOrchestration(
  options: UseSessionOrchestrationOptions,
): UseSessionOrchestrationReturn {
  const {
    sessionLifecycle,
    isRunningLifecycle,
    isLaunchingLifecycle,
    isStoppingLifecycle,
    isFinalizingLifecycle,
    isSessionLocked,
    setSessionLifecycle,
    setIsSessionDialogDismissed,
    sessionConfirmed,
    telemetryConfirmedAt,
    startTriggeredAt,
    sessionTimerSeconds,
    resetSessionTimer,
    startSessionTimer,
    activeDeviceIds,
    selectedDeviceIds,
    setSelectedDeviceIds,
    setPendingSessionTargets,
    setCurrentSessionTargets,
    setAvailableDevices,
    sessionDurationSeconds,
    setSessionDurationSeconds,
    sessionRoomId,
    sessionRoomName,
    setSessionRoomId,
    goalShotsPerTarget,
    setGoalShotsPerTarget,
    setStagedPresetId,
    setActivePresetId,
    recentSessionSummary,
    setRecentSessionSummary,
    setGameHistory,
    openStartDialogForTargets,
    beginSessionLaunch,
    handleStopDirectGame,
    setDirectSessionTargets,
    setDirectSessionGameId,
    updateDirectStartStates,
    hitHistory,
    stoppedTargets,
    telemetryState,
    hitHistoryRef,
    splitRecordsRef,
    transitionRecordsRef,
    finalizeSessionRef,
    sessionConfirmedRef,
    hasMarkedTelemetryConfirmedRef,
    selectionManuallyModifiedRef,
    canLaunchGame,
    advanceToReviewStep,
    resetSetupFlow,
  } = options;

  const isStarting = isLaunchingLifecycle;

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

      console.info('[Games] Session summary prepared', {
        gameId: sessionSummary.gameId,
        startTime: sessionSummary.historyEntry.startTime,
        endTime: sessionSummary.historyEntry.endTime,
        startTimeISO: new Date(sessionSummary.historyEntry.startTime).toISOString(),
        endTimeISO: new Date(sessionSummary.historyEntry.endTime).toISOString(),
        totalHits: sessionSummary.totalHits,
        durationSeconds: sessionSummary.durationSeconds,
        deviceStats: sessionSummary.deviceStats,
        splits: sessionSummary.splits,
        transitions: sessionSummary.transitions,
        targets: sessionSummary.targets,
        hitHistory: sessionSummary.hitHistory,
        historyEntry: sessionSummary.historyEntry,
      });

      console.info('[Games] Persisting Supabase payload', sessionSummary.historyEntry);
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

  const handleStopGame = useCallback(async () => {
    if (!isRunningLifecycle || isStoppingLifecycle || isFinalizingLifecycle) {
      return;
    }

    console.info('[Games] Forwarding stop request to direct ThingsBoard handler');
    await handleStopDirectGame();
  }, [isRunningLifecycle, isStoppingLifecycle, isFinalizingLifecycle, handleStopDirectGame]);

  const handleCloseStartDialog = useCallback(() => {
    if (sessionLifecycle === 'selecting' && !isStarting && !isLaunchingLifecycle) {
      setSessionLifecycle('idle');
      setPendingSessionTargets([]);
      resetSessionTimer(null);
      setIsSessionDialogDismissed(false);
      setSessionRoomId(null);
      setSessionDurationSeconds(null);
      setStagedPresetId(null);
      resetSetupFlow();
      return;
    }

    if (sessionLifecycle !== 'idle') {
      setIsSessionDialogDismissed(true);
    }
  }, [isLaunchingLifecycle, isStarting, resetSessionTimer, sessionLifecycle, setIsSessionDialogDismissed, setPendingSessionTargets, resetSetupFlow]);

  const handleUsePreviousSettings = useCallback(async () => {
    if (!recentSessionSummary) {
      toast.info('No previous session available yet.');
      return;
    }
    if (isSessionLocked) {
      toast.info('Finish or stop the active session before reusing settings.');
      return;
    }

    const targetIds =
      Array.isArray(recentSessionSummary.targetDeviceIds) && recentSessionSummary.targetDeviceIds.length > 0
        ? recentSessionSummary.targetDeviceIds
        : recentSessionSummary.targets.map((target) => target.deviceId);

    if (targetIds.length === 0) {
      toast.error('Previous session did not capture any targets to reuse.');
      return;
    }

    setActivePresetId(null);
    const prepResult = await openStartDialogForTargets({
      targetIds,
      source: 'manual',
      requireOnline: false,
      syncCurrentTargets: true,
    });

    if (!prepResult || prepResult.targets.length === 0) {
      return;
    }

    const summaryDuration =
      typeof recentSessionSummary.desiredDurationSeconds === 'number' && recentSessionSummary.desiredDurationSeconds > 0
        ? Math.round(recentSessionSummary.desiredDurationSeconds)
        : null;

    setSessionRoomId(recentSessionSummary.roomId ?? null);
    setSessionDurationSeconds(summaryDuration);

    // Load goal shots from recent session summary if available
    const summaryGoalShots = recentSessionSummary.historyEntry?.goalShotsPerTarget;
    if (summaryGoalShots && typeof summaryGoalShots === 'object' && !Array.isArray(summaryGoalShots)) {
      setGoalShotsPerTarget(summaryGoalShots as Record<string, number>);
    } else {
      setGoalShotsPerTarget({});
    }

    setStagedPresetId(recentSessionSummary.presetId ?? null);
    advanceToReviewStep();
    toast.success('Previous session settings staged. Review and launch when ready.');
  }, [
    advanceToReviewStep,
    isSessionLocked,
    openStartDialogForTargets,
    recentSessionSummary,
    setSessionDurationSeconds,
    setSessionRoomId,
    setStagedPresetId,
    setActivePresetId,
  ]);

  const handleCreateNewSetup = useCallback(() => {
    if (isSessionLocked) {
      toast.info('Stop the active session before creating a new setup.');
      return;
    }

    selectionManuallyModifiedRef.current = true;
    setSelectedDeviceIds([]);
    setPendingSessionTargets([]);
    setCurrentSessionTargets([]);
    setDirectSessionTargets([]);
    setDirectSessionGameId(null);
    updateDirectStartStates({});
    setSessionRoomId(null);
    setSessionDurationSeconds(null);
    setStagedPresetId(null);
    setActivePresetId(null);
    setIsSessionDialogDismissed(true);
    setSessionLifecycle('idle');
    resetSetupFlow();
    toast.success('Setup reset. Select targets to begin.');
  }, [
    isSessionLocked,
    resetSetupFlow,
    updateDirectStartStates,
    setSelectedDeviceIds,
    setPendingSessionTargets,
    setCurrentSessionTargets,
    setDirectSessionTargets,
    setDirectSessionGameId,
    setSessionRoomId,
    setSessionDurationSeconds,
    setStagedPresetId,
    setActivePresetId,
    setIsSessionDialogDismissed,
    setSessionLifecycle,
  ]);

  const handleOpenStartDialog = useCallback(async () => {
    if (!canLaunchGame) {
      return;
    }
    setStagedPresetId(null);
    advanceToReviewStep();
    const prepResult = await openStartDialogForTargets({
      targetIds: selectedDeviceIds,
      source: 'manual',
      requireOnline: true,
      syncCurrentTargets: false,
    });
    if (!prepResult || prepResult.targets.length === 0) {
      return;
    }
    beginSessionLaunch({ targets: prepResult.targets, gameId: prepResult.gameId });
  }, [advanceToReviewStep, beginSessionLaunch, canLaunchGame, openStartDialogForTargets, selectedDeviceIds]);

  const handleConfirmStartDialog = useCallback(() => {
    beginSessionLaunch();
  }, [beginSessionLaunch]);

  const handleStopFromDialog = useCallback(() => {
    void handleStopGame();
  }, [handleStopGame]);

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
    // Reset the flag when sessionConfirmed changes to false (new session starting)
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
      // Small delay to ensure stop commands are sent before terminating
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

  // --- Sync bridge refs ---
  hitHistoryRef.current = hitHistory;
  splitRecordsRef.current = splitRecords;
  transitionRecordsRef.current = transitionRecords;
  finalizeSessionRef.current = finalizeSession;

  return {
    finalizeSession,
    handleStopGame,
    handleCloseStartDialog,
    handleUsePreviousSettings,
    handleCreateNewSetup,
    handleOpenStartDialog,
    handleConfirmStartDialog,
    handleStopFromDialog,
    splitRecords,
    transitionRecords,
  };
}
