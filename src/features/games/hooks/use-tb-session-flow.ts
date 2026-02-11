import { useCallback } from 'react';
import type { SessionLifecycle } from '@/components/game-session/sessionState';
import type { NormalizedGameDevice } from '@/features/games/hooks/use-game-devices';
import { deriveIsOnline } from '@/features/games/lib/device-status-utils';
import type { LiveSessionSummary } from '@/components/games/types';
import { invokeGameControl } from '@/lib/edge';
import { toast } from '@/components/ui/sonner';
import type { SessionRegistry, SessionCallbacks } from './use-session-registry';


export interface UseTbSessionFlowOptions {
  // From C.1
  refreshDirectAuthToken: () => Promise<string>;
  setDirectControlError: React.Dispatch<React.SetStateAction<string | null>>;

  // From C.2
  executeDirectStart: (args: {
    deviceIds: string[];
    timestamp: number;
    isRetry?: boolean;
    gameIdOverride?: string;
    targetsOverride?: NormalizedGameDevice[];
  }) => Promise<{ successIds: string[]; errorIds: string[] }>;
  updateDirectStartStates: (
    value:
      | Record<string, 'idle' | 'pending' | 'success' | 'error'>
      | ((
        prev: Record<string, 'idle' | 'pending' | 'success' | 'error'>,
      ) => Record<string, 'idle' | 'pending' | 'success' | 'error'>)
  ) => void;

  // Lifecycle (from useSessionLifecycle)
  isLaunchingLifecycle: boolean;
  isRunningLifecycle: boolean;
  isStoppingLifecycle: boolean;
  isFinalizingLifecycle: boolean;
  isSessionLocked: boolean;
  sessionLifecycle: SessionLifecycle;
  setSessionLifecycle: React.Dispatch<React.SetStateAction<SessionLifecycle>>;
  setIsSessionDialogDismissed: (value: boolean) => void;

  // Timer
  resetSessionTimer: (anchor: number | null) => void;
  freezeSessionTimer: (timestamp: number) => void;

  // Activation
  resetSessionActivation: () => void;
  markSessionTriggered: (timestamp: number) => void;

  // Device selection
  selectedDeviceIds: string[];
  setSelectedDeviceIds: React.Dispatch<React.SetStateAction<string[]>>;
  selectionManuallyModifiedRef: React.MutableRefObject<boolean>;
  setSessionRoomId: React.Dispatch<React.SetStateAction<string | null>>;

  // Registry
  registry: SessionRegistry;
  register: <K extends keyof SessionCallbacks>(key: K, fn: SessionCallbacks[K]) => void;

  // Session state (from useSessionState)
  activeDeviceIds: string[];
  setActiveDeviceIds: React.Dispatch<React.SetStateAction<string[]>>;
  pendingSessionTargets: NormalizedGameDevice[];
  setPendingSessionTargets: React.Dispatch<React.SetStateAction<NormalizedGameDevice[]>>;
  currentSessionTargets: NormalizedGameDevice[];
  setCurrentSessionTargets: React.Dispatch<React.SetStateAction<NormalizedGameDevice[]>>;
  setAvailableDevices: React.Dispatch<React.SetStateAction<NormalizedGameDevice[]>>;
  gameStartTime: number | null;
  setGameStartTime: React.Dispatch<React.SetStateAction<number | null>>;
  setGameStopTime: React.Dispatch<React.SetStateAction<number | null>>;
  setErrorMessage: React.Dispatch<React.SetStateAction<string | null>>;
  setRecentSessionSummary: React.Dispatch<React.SetStateAction<LiveSessionSummary | null>>;
  goalShotsPerTarget: Record<string, number>;
  sessionDurationSeconds: number | null;
  setSessionDurationSeconds: React.Dispatch<React.SetStateAction<number | null>>;
  sessionRoomId: string | null;
  sessionRoomName: string | null;
  stagedPresetId: string | null;
  activePresetId: string | null;
  setActivePresetId: React.Dispatch<React.SetStateAction<string | null>>;
  setStagedPresetId: React.Dispatch<React.SetStateAction<string | null>>;
  setGoalShotsPerTarget: React.Dispatch<React.SetStateAction<Record<string, number>>>;

  // Refs
  availableDevicesRef: React.MutableRefObject<NormalizedGameDevice[]>;
  currentGameDevicesRef: React.MutableRefObject<string[]>;

  // Lookup helpers
  availableDeviceMap: Map<string, NormalizedGameDevice>;

  // External async callbacks
  loadGameHistory: () => Promise<void>;
  loadLiveDevices: (opts: { silent?: boolean; showToast?: boolean; reason?: string }) => Promise<void>;
  resetSetupFlow: () => void;

  // Orchestration-specific (from recentSessionSummary for handleUsePreviousSettings)
  recentSessionSummary: LiveSessionSummary | null;
  canLaunchGame: boolean;
  advanceToReviewStep: () => void;

  // Direct session state (lifted to page level to break C.2/C.3 circular dependency)
  directSessionGameId: string | null;
  setDirectSessionGameId: React.Dispatch<React.SetStateAction<string | null>>;
  directSessionTargets: Array<{ deviceId: string; name: string }>;
  setDirectSessionTargets: React.Dispatch<React.SetStateAction<Array<{ deviceId: string; name: string }>>>;
  directFlowActive: boolean;
  setDirectFlowActive: React.Dispatch<React.SetStateAction<boolean>>;
  directTelemetryEnabled: boolean;
  setDirectTelemetryEnabled: React.Dispatch<React.SetStateAction<boolean>>;
}

export interface UseTbSessionFlowReturn {
  // Derived
  isDirectTelemetryLifecycle: boolean;
  isDirectFlow: boolean;

  // Callbacks (UI event handlers)
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
  handleStopGame: () => Promise<void>;
  handleCloseStartDialog: () => void;
  handleUsePreviousSettings: () => Promise<void>;
  handleCreateNewSetup: () => void;
  handleOpenStartDialog: () => Promise<void>;
  handleConfirmStartDialog: () => void;
  handleStopFromDialog: () => void;
}

export function useTbSessionFlow(options: UseTbSessionFlowOptions): UseTbSessionFlowReturn {
  const {
    refreshDirectAuthToken,
    setDirectControlError,
    executeDirectStart,
    updateDirectStartStates,
    isLaunchingLifecycle,
    isRunningLifecycle,
    isStoppingLifecycle,
    isFinalizingLifecycle,
    isSessionLocked,
    sessionLifecycle,
    setSessionLifecycle,
    setIsSessionDialogDismissed,
    resetSessionTimer,
    freezeSessionTimer,
    resetSessionActivation,
    markSessionTriggered,
    selectedDeviceIds,
    setSelectedDeviceIds,
    selectionManuallyModifiedRef,
    setSessionRoomId,
    registry,
    register,
    activeDeviceIds,
    setActiveDeviceIds,
    pendingSessionTargets,
    setPendingSessionTargets,
    currentSessionTargets,
    setCurrentSessionTargets,
    setAvailableDevices,
    gameStartTime,
    setGameStartTime,
    setGameStopTime,
    setErrorMessage,
    setRecentSessionSummary,
    goalShotsPerTarget,
    sessionDurationSeconds,
    setSessionDurationSeconds,
    sessionRoomId,
    sessionRoomName,
    stagedPresetId,
    activePresetId,
    setActivePresetId,
    setStagedPresetId,
    setGoalShotsPerTarget,
    availableDevicesRef,
    currentGameDevicesRef,
    availableDeviceMap,
    loadGameHistory,
    loadLiveDevices,
    resetSetupFlow,
    recentSessionSummary,
    canLaunchGame,
    advanceToReviewStep,
    directSessionGameId,
    setDirectSessionGameId,
    directSessionTargets,
    setDirectSessionTargets,
    directFlowActive,
    setDirectFlowActive,
    directTelemetryEnabled,
    setDirectTelemetryEnabled,
  } = options;

  const isStarting = isLaunchingLifecycle;

  // ── 1. Derived values ──────────────────────────────────────────────────

  const isDirectTelemetryLifecycle =
    Boolean(directSessionGameId) &&
    (isLaunchingLifecycle || isRunningLifecycle || isStoppingLifecycle || isFinalizingLifecycle);

  const isDirectFlow = isDirectTelemetryLifecycle && directTelemetryEnabled;

  // ── 3. openStartDialogForTargets (from TB control) ─────────────────────

  const openStartDialogForTargets = useCallback(
    async ({
      targetIds,
      source,
      requireOnline,
      syncCurrentTargets = false,
    }: {
      targetIds: string[];
      source: 'manual' | 'preset';
      requireOnline: boolean;
      syncCurrentTargets?: boolean;
    }): Promise<{ targets: NormalizedGameDevice[]; gameId: string } | null> => {
      const uniqueIds = Array.from(
        new Set(
          targetIds
            .map((id) => (typeof id === 'string' ? id.trim() : ''))
            .filter((id): id is string => id.length > 0),
        ),
      );

      if (uniqueIds.length === 0) {
        const message = source === 'preset' ? 'Preset has no targets to apply.' : 'Select at least one target before starting a game.';
        setErrorMessage(message);
        toast.error(message);
        return null;
      }

      const resolvedTargets = uniqueIds
        .map((deviceId) => availableDeviceMap.get(deviceId) ?? null)
        .filter((device): device is NormalizedGameDevice => device !== null);

      const missingDeviceIds = uniqueIds.filter((deviceId) => !availableDeviceMap.has(deviceId));

      if (resolvedTargets.length === 0) {
        const message =
          source === 'preset'
            ? 'Preset targets are not available in the current device snapshot.'
            : 'Selected targets are unavailable. Refresh the device list and try again.';
        setErrorMessage(message);
        toast.error(message);
        return null;
      }

      const onlineTargets = resolvedTargets.filter((device) => deriveIsOnline(device));
      const offlineTargets = resolvedTargets.filter((device) => !deriveIsOnline(device));

      if (requireOnline && offlineTargets.length > 0) {
        const message =
          offlineTargets.length === resolvedTargets.length
            ? 'Selected targets are offline. Choose at least one online or standby target.'
            : 'Some selected targets are offline. Deselect offline devices to continue.';
        setErrorMessage(message);
        toast.error(message);
        return null;
      }

      if (missingDeviceIds.length > 0) {
        console.warn('[Games] Preset targets missing in snapshot', {
          source,
          missingDeviceIds,
        });
        toast.warning(`Missing ${missingDeviceIds.length} preset target${missingDeviceIds.length === 1 ? '' : 's'}. Refresh devices and try again.`);
      }

      if (!requireOnline && offlineTargets.length > 0) {
        toast.warning(`${offlineTargets.length} preset target${offlineTargets.length === 1 ? '' : 's'} offline. They will be kept in the selection.`);
      }

      const effectiveTargets = requireOnline ? onlineTargets : resolvedTargets;
      if (effectiveTargets.length === 0) {
        const message = 'No online or standby targets available for this session.';
        setErrorMessage(message);
        toast.error(message);
        return null;
      }

      let generatedGameId: string | null = null;
      try {
        await refreshDirectAuthToken();
        generatedGameId = `GM-${Date.now()}`;
      } catch (error) {
        console.error('[Games] ThingsBoard authentication failed', { error, source });
        const message = error instanceof Error ? error.message : 'Failed to authenticate with ThingsBoard.';
        setDirectControlError(message);
        setErrorMessage(message);
        toast.error(message);
        return null;
      }

      const directTargetList = effectiveTargets.map((device) => ({
        deviceId: device.deviceId,
        name: device.name ?? device.deviceId,
      }));
      const resolvedGameId = generatedGameId ?? `GM-${Date.now()}`;

      const initialStates = directTargetList.reduce<Record<string, 'idle' | 'pending' | 'success' | 'error'>>((acc, target) => {
        acc[target.deviceId] = 'idle';
        return acc;
      }, {});

      selectionManuallyModifiedRef.current = true;
      setSelectedDeviceIds(effectiveTargets.map((device) => device.deviceId));
      setDirectSessionTargets(directTargetList);
      updateDirectStartStates(() => initialStates);
      setDirectFlowActive(false);
      setDirectSessionGameId(resolvedGameId);
      setDirectTelemetryEnabled(false);

      setErrorMessage(null);
      setDirectControlError(null);
      setPendingSessionTargets(effectiveTargets);
      if (syncCurrentTargets) {
        setCurrentSessionTargets(effectiveTargets);
      }
      resetSessionTimer(null);
      resetSessionActivation();
      setGameStartTime(null);
      setGameStopTime(null);
      setIsSessionDialogDismissed(false);
      setSessionLifecycle('selecting');

      return { targets: effectiveTargets, gameId: resolvedGameId };
    },
    [
      availableDeviceMap,
      refreshDirectAuthToken,
      resetSessionActivation,
      resetSessionTimer,
      setCurrentSessionTargets,
      setErrorMessage,
      setGameStartTime,
      setGameStopTime,
      setIsSessionDialogDismissed,
      setPendingSessionTargets,
      setSelectedDeviceIds,
      setSessionLifecycle,
      updateDirectStartStates,
    ],
  );

  // ── 4. beginSessionLaunch (from TB control) ────────────────────────────

  const beginSessionLaunch = useCallback(
    ({ targets: preparedTargets, gameId: gameIdOverride }: { targets?: NormalizedGameDevice[]; gameId?: string } = {}) => {
      const activeGameId = gameIdOverride ?? directSessionGameId;
      const hasPreparedTargets = preparedTargets && preparedTargets.length > 0;
      if (!activeGameId || (!hasPreparedTargets && directSessionTargets.length === 0 && pendingSessionTargets.length === 0)) {
        toast.error('No devices are ready for direct control. Close and reopen the dialog.');
        return;
      }

      const stagedTargets =
        hasPreparedTargets
          ? preparedTargets!
          : pendingSessionTargets.length > 0
            ? pendingSessionTargets
            : directSessionTargets
                .map((target) => availableDevicesRef.current.find((device) => device.deviceId === target.deviceId) ?? null)
                .filter((device): device is NormalizedGameDevice => device !== null);

      if (stagedTargets.length === 0) {
        toast.error('Unable to resolve target metadata for the selected devices.');
        return;
      }

      const timestamp = Date.now();
      const offlineTargets = stagedTargets.filter((device) => !deriveIsOnline(device));
      let launchTargets = stagedTargets;

      if (offlineTargets.length > 0) {
        const onlineTargets = stagedTargets.filter((device) => deriveIsOnline(device));
        if (onlineTargets.length === 0) {
          setPendingSessionTargets([]);
          setCurrentSessionTargets([]);
          updateDirectStartStates({});
          setDirectControlError('All staged targets are offline. Adjust your selection and try again.');
          toast.error('All staged targets are offline. Adjust your selection and try again.');
          return;
        }

        toast.warning(`${offlineTargets.length} target${offlineTargets.length === 1 ? '' : 's'} went offline and were removed from launch.`);
        launchTargets = onlineTargets;
        const launchIdSet = new Set(launchTargets.map((device) => device.deviceId));
        setDirectSessionTargets((prev) => prev.filter((target) => launchIdSet.has(target.deviceId)));
      }

      const launchDeviceIds = launchTargets.map((device) => device.deviceId);

      setPendingSessionTargets(launchTargets);
      setCurrentSessionTargets(launchTargets);
      currentGameDevicesRef.current = launchDeviceIds;
      selectionManuallyModifiedRef.current = true;
      setSelectedDeviceIds(launchDeviceIds);
      setActiveDeviceIds(launchDeviceIds);
      setRecentSessionSummary(null);
      setGameStartTime(null);
      setGameStopTime(null);
      registry.current.setHitCounts?.(Object.fromEntries(launchDeviceIds.map((id) => [id, 0])));
      registry.current.setHitHistory?.([]);
      registry.current.setStoppedTargets?.(new Set<string>());
      setErrorMessage(null);
      setDirectControlError(null);

      setActivePresetId(stagedPresetId);
      markSessionTriggered(timestamp);
      setSessionLifecycle('launching');
      setDirectFlowActive(true);
      setDirectTelemetryEnabled(false);

      updateDirectStartStates(() => {
        const next: Record<string, 'idle' | 'pending' | 'success' | 'error'> = {};
        launchDeviceIds.forEach((deviceId) => {
          next[deviceId] = 'pending';
        });
        return next;
      });

      void executeDirectStart({
        deviceIds: launchDeviceIds,
        timestamp,
        gameIdOverride: activeGameId,
        targetsOverride: launchTargets,
      });
    },
    [
      availableDevicesRef,
      directSessionGameId,
      directSessionTargets,
      executeDirectStart,
      markSessionTriggered,
      pendingSessionTargets,
      setActiveDeviceIds,
      setActivePresetId,
      setCurrentSessionTargets,
      setErrorMessage,
      setGameStartTime,
      setGameStopTime,
      setPendingSessionTargets,
      setRecentSessionSummary,
      setSelectedDeviceIds,
      setSessionLifecycle,
      sessionDurationSeconds,
      sessionRoomId,
      stagedPresetId,
      updateDirectStartStates,
    ],
  );

  // ── 5. handleStopDirectGame (from TB control) ──────────────────────────

  const handleStopDirectGame = useCallback(async () => {
    if (!directSessionGameId) {
      return;
    }

    const activeDeviceIdsSnapshot = [...activeDeviceIds];
    if (activeDeviceIdsSnapshot.length === 0) {
      setSessionLifecycle('idle');
      setGameStopTime(null);
      resetSessionTimer(null);
      resetSessionActivation();
      setDirectTelemetryEnabled(false);
      setDirectFlowActive(false);
      setSessionRoomId(null);
      setSessionDurationSeconds(null);
      return;
    }

    console.info('[Games] Stopping direct ThingsBoard session', {
      gameId: directSessionGameId,
      deviceIds: activeDeviceIdsSnapshot,
    });

    const stopTimestamp = Date.now();
    setSessionLifecycle('stopping');
    setGameStopTime(stopTimestamp);
    freezeSessionTimer(stopTimestamp);
    console.info('[Games] Game stop initiated', {
      gameId: directSessionGameId,
      stopTimestamp,
      stopTimeISO: new Date(stopTimestamp).toISOString(),
      reason: 'manual_or_timeout',
    });
    setDirectTelemetryEnabled(false);

    const stopDeviceIds = directSessionTargets.map(({ deviceId }) => deviceId);
    stopDeviceIds.forEach((deviceId) => {
      updateDirectStartStates((prev) => ({ ...prev, [deviceId]: 'pending' }));
    });

    let stopResponse: Awaited<ReturnType<typeof invokeGameControl>> | null = null;
    try {
      console.info('[Games] Sending stop via edge game-control', {
        deviceIds: stopDeviceIds,
        gameId: directSessionGameId,
      });
      stopResponse = await invokeGameControl('stop', {
        deviceIds: stopDeviceIds,
        gameId: directSessionGameId,
      });
      console.info('[Games] Edge game-control stop response', stopResponse);
    } catch (error) {
      console.error('[Games] Edge game-control stop failed', error);
      stopResponse = null;
    }

    const stopResultMap = new Map<string, boolean>();
    if (stopResponse?.results) {
      for (const result of stopResponse.results) {
        stopResultMap.set(result.deviceId, result.success);
      }
    }

    stopDeviceIds.forEach((deviceId) => {
      const success = stopResultMap.get(deviceId) ?? false;
      updateDirectStartStates((prev) => ({
        ...prev,
        [deviceId]: success ? 'success' : 'error',
      }));
    });

    const stopFailureCount = stopDeviceIds.filter((id) => !stopResultMap.get(id)).length;
    if (stopFailureCount > 0) {
      toast.error(`${stopFailureCount} device(s) may not have received the stop command.`);
    } else {
      toast.success('Stop commands sent to all devices.');
    }

    setSessionLifecycle('finalizing');

    setAvailableDevices((prev) =>
      prev.map((device) => {
        if (activeDeviceIdsSnapshot.includes(device.deviceId)) {
          return {
            ...device,
            gameStatus: 'stop',
            lastSeen: stopTimestamp,
          };
        }
        return device;
      }),
    );

    const targetDevices =
      currentSessionTargets.length > 0
        ? currentSessionTargets
        : activeDeviceIdsSnapshot
            .map((deviceId) => availableDevicesRef.current.find((device) => device.deviceId === deviceId) ?? null)
            .filter((device): device is NormalizedGameDevice => device !== null);

    const hitHistorySnapshot = [...(registry.current.getHitHistory?.() ?? [])];
    const splitRecordsSnapshot = [...(registry.current.getSplitRecords?.() ?? [])];
    const transitionRecordsSnapshot = [...(registry.current.getTransitionRecords?.() ?? [])];
    const startTimestampSnapshot = gameStartTime ?? stopTimestamp;
    const sessionLabel = `Game ${new Date(startTimestampSnapshot).toLocaleTimeString()}`;

    try {
      await registry.current.finalizeSession?.({
        resolvedGameId: directSessionGameId,
        sessionLabel,
        startTimestamp: startTimestampSnapshot,
        stopTimestamp,
        targetDevices,
        hitHistorySnapshot,
        splitRecordsSnapshot,
        transitionRecordsSnapshot,
        roomId: sessionRoomId,
        roomName: sessionRoomName,
        desiredDurationSeconds: sessionDurationSeconds,
        presetId: activePresetId,
        goalShotsPerTarget,
      });

      console.info('[Games] Direct session persisted successfully', {
        gameId: directSessionGameId,
        stopTimestamp,
      });
      await loadGameHistory();
      toast.success('Game stopped successfully.');
    } catch (error) {
      console.error('[Games] Failed to persist direct session summary', error);
      toast.error('Failed to finalize session. Please try again.');
      setSessionLifecycle('running');
      setDirectTelemetryEnabled(true);
      return;
    }

    currentGameDevicesRef.current = [];
    setActiveDeviceIds([]);
    setCurrentSessionTargets([]);
    setPendingSessionTargets([]);
    setDirectFlowActive(false);
    setSessionLifecycle('idle');
    setGameStartTime(null);
    setGameStopTime(stopTimestamp);
    resetSessionTimer(null);
    resetSessionActivation();
    setDirectTelemetryEnabled(false);
    updateDirectStartStates({});
    setDirectSessionTargets([]);
    setDirectSessionGameId(null);
    setSessionRoomId(null);
    setSessionDurationSeconds(null);
    setActivePresetId(null);
    setStagedPresetId(null);
    resetSetupFlow();
    void loadLiveDevices({ silent: true, showToast: true, reason: 'postStop' });
  }, [
    directSessionGameId,
    directSessionTargets,
    activeDeviceIds,
    currentSessionTargets,
    freezeSessionTimer,
    gameStartTime,
    activePresetId,
    sessionRoomId,
    sessionRoomName,
    sessionDurationSeconds,
    goalShotsPerTarget,
    resetSessionActivation,
    resetSessionTimer,
    setActiveDeviceIds,
    setCurrentSessionTargets,
    updateDirectStartStates,
    setSessionLifecycle,
    setGameStopTime,
    setPendingSessionTargets,
    setGameStartTime,
    setAvailableDevices,
    resetSetupFlow,
    loadLiveDevices,
    loadGameHistory,
  ]);

  // ── 6. Orchestration callbacks (from use-session-orchestration.ts) ─────

  const handleStopGame = useCallback(async () => {
    if (!isRunningLifecycle || isStoppingLifecycle || isFinalizingLifecycle) {
      return;
    }

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

  // ── Register callbacks in the session registry ─────────────────────────
  register('openStartDialogForTargets', openStartDialogForTargets);
  register('beginSessionLaunch', beginSessionLaunch);

  // ── Return ─────────────────────────────────────────────────────────────

  return {
    // Derived
    isDirectTelemetryLifecycle,
    isDirectFlow,

    // Callbacks
    openStartDialogForTargets,
    beginSessionLaunch,
    handleStopDirectGame,
    handleStopGame,
    handleCloseStartDialog,
    handleUsePreviousSettings,
    handleCreateNewSetup,
    handleOpenStartDialog,
    handleConfirmStartDialog,
    handleStopFromDialog,
  };
}
