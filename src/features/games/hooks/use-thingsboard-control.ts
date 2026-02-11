import { useState, useRef, useCallback } from 'react';
import type { SessionLifecycle } from '@/components/game-session/sessionState';
import type { NormalizedGameDevice } from '@/features/games/hooks/use-game-devices';
import type { SessionHitRecord } from '@/features/games/lib/device-game-flow';
import type { SplitRecord, TransitionRecord } from '@/features/games/hooks/use-game-telemetry';
import type { LiveSessionSummary } from '@/components/games/types';
import { ensureTbAuthToken } from '@/features/games/lib/thingsboard-client';
import { invokeGameControl } from '@/lib/edge';
import { toast } from '@/components/ui/sonner';

const DIRECT_TB_CONTROL_ENABLED = true;

export interface FinalizeSessionArgs {
  resolvedGameId: string;
  sessionLabel: string;
  startTimestamp: number;
  stopTimestamp: number;
  targetDevices: NormalizedGameDevice[];
  hitHistorySnapshot: SessionHitRecord[];
  splitRecordsSnapshot: SplitRecord[];
  transitionRecordsSnapshot: TransitionRecord[];
  roomId: string | null;
  roomName: string | null;
  desiredDurationSeconds: number | null;
  presetId: string | null;
  goalShotsPerTarget?: Record<string, number>;
}

export interface UseThingsboardControlOptions {
  // Lifecycle (from useSessionLifecycle)
  isLaunchingLifecycle: boolean;
  isRunningLifecycle: boolean;
  isStoppingLifecycle: boolean;
  isFinalizingLifecycle: boolean;
  setSessionLifecycle: React.Dispatch<React.SetStateAction<SessionLifecycle>>;
  setIsSessionDialogDismissed: React.Dispatch<React.SetStateAction<boolean>>;

  // Session timer (from useSessionTimer)
  resetSessionTimer: (timestamp: number | null) => void;
  startSessionTimer: (timestamp: number) => void;
  freezeSessionTimer: (timestamp: number) => void;

  // Session activation (from useSessionActivation)
  resetSessionActivation: () => void;
  markSessionTriggered: (timestamp: number) => void;
  markTelemetryConfirmed: (timestamp: number) => void;

  // Device selection (from useDeviceSelection)
  setSelectedDeviceIds: React.Dispatch<React.SetStateAction<string[]>>;
  selectionManuallyModifiedRef: React.MutableRefObject<boolean>;
  setSessionRoomId: React.Dispatch<React.SetStateAction<string | null>>;

  // Telemetry sync (from useSessionTelemetrySync) — setter refs break ordering dependency
  setHitCountsRef: React.MutableRefObject<React.Dispatch<React.SetStateAction<Record<string, number>>>>;
  setHitHistoryRef: React.MutableRefObject<React.Dispatch<React.SetStateAction<SessionHitRecord[]>>>;
  setStoppedTargetsRef: React.MutableRefObject<React.Dispatch<React.SetStateAction<Set<string>>>>;

  // Session state (from games-page.tsx)
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
  // Refs (used by handleStopDirectGame at call time — refs break the circular
  // dependency between useThingsboardControl and useSessionTelemetrySync)
  hitHistoryRef: React.MutableRefObject<SessionHitRecord[]>;
  splitRecordsRef: React.MutableRefObject<SplitRecord[]>;
  transitionRecordsRef: React.MutableRefObject<TransitionRecord[]>;
  availableDevicesRef: React.MutableRefObject<NormalizedGameDevice[]>;
  currentGameDevicesRef: React.MutableRefObject<string[]>;

  // Lookup helpers
  availableDeviceMap: Map<string, NormalizedGameDevice>;
  deriveIsOnline: (device: NormalizedGameDevice) => boolean;

  // External async callbacks (finalizeSession passed as ref to break circular hook ordering)
  finalizeSessionRef: React.MutableRefObject<(args: FinalizeSessionArgs) => Promise<unknown>>;
  loadGameHistory: () => Promise<void>;
  loadLiveDevices: (opts: { silent?: boolean; showToast?: boolean; reason?: string }) => Promise<void>;
  resetSetupFlow: () => void;
}

export interface UseThingsboardControlReturn {
  // State (exposed for UI rendering)
  directSessionGameId: string | null;
  directSessionTargets: Array<{ deviceId: string; name: string }>;
  directFlowActive: boolean;
  directStartStates: Record<string, 'idle' | 'pending' | 'success' | 'error'>;
  directTelemetryEnabled: boolean;
  directControlToken: string | null;
  directControlError: string | null;
  isDirectAuthLoading: boolean;
  isRetryingFailedDevices: boolean;

  // Derived
  isDirectTelemetryLifecycle: boolean;
  isDirectFlow: boolean;

  // Setters (used by other hooks/components)
  setDirectSessionGameId: React.Dispatch<React.SetStateAction<string | null>>;
  setDirectSessionTargets: React.Dispatch<React.SetStateAction<Array<{ deviceId: string; name: string }>>>;
  setDirectFlowActive: React.Dispatch<React.SetStateAction<boolean>>;
  setDirectTelemetryEnabled: React.Dispatch<React.SetStateAction<boolean>>;
  setDirectControlError: React.Dispatch<React.SetStateAction<string | null>>;
  updateDirectStartStates: (
    value:
      | Record<string, 'idle' | 'pending' | 'success' | 'error'>
      | ((
        prev: Record<string, 'idle' | 'pending' | 'success' | 'error'>,
      ) => Record<string, 'idle' | 'pending' | 'success' | 'error'>)
  ) => void;

  // Callbacks (used by UI event handlers)
  refreshDirectAuthToken: () => Promise<string>;
  openStartDialogForTargets: (args: {
    targetIds: string[];
    source: 'manual' | 'preset';
    requireOnline: boolean;
    syncCurrentTargets?: boolean;
  }) => Promise<{ targets: NormalizedGameDevice[]; gameId: string } | null>;
  handleStopDirectGame: () => Promise<void>;
  executeDirectStart: (args: {
    deviceIds: string[];
    timestamp: number;
    isRetry?: boolean;
    gameIdOverride?: string;
    targetsOverride?: NormalizedGameDevice[];
  }) => Promise<{ successIds: string[]; errorIds: string[] }>;
  beginSessionLaunch: (args?: {
    targets?: NormalizedGameDevice[];
    gameId?: string;
  }) => void;
  handleRetryFailedDevices: () => Promise<void>;

  // Ref
  directStartStatesRef: React.MutableRefObject<Record<string, 'idle' | 'pending' | 'success' | 'error'>>;
}

export function useThingsboardControl(options: UseThingsboardControlOptions): UseThingsboardControlReturn {
  const {
    isLaunchingLifecycle,
    isRunningLifecycle,
    isStoppingLifecycle,
    isFinalizingLifecycle,
    setSessionLifecycle,
    setIsSessionDialogDismissed,
    resetSessionTimer,
    startSessionTimer,
    freezeSessionTimer,
    resetSessionActivation,
    markSessionTriggered,
    markTelemetryConfirmed,
    setSelectedDeviceIds,
    selectionManuallyModifiedRef,
    setSessionRoomId,
    setHitCountsRef,
    setHitHistoryRef,
    setStoppedTargetsRef,
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
    hitHistoryRef,
    splitRecordsRef,
    transitionRecordsRef,
    availableDevicesRef,
    currentGameDevicesRef,
    availableDeviceMap,
    deriveIsOnline,
    finalizeSessionRef,
    loadGameHistory,
    loadLiveDevices,
    resetSetupFlow,
  } = options;

  // ── 1. State declarations ──────────────────────────────────────────────

  // directSessionGameId mirrors the ThingsBoard `gameId` string used by the RPC start/stop commands.
  const [directSessionGameId, setDirectSessionGameId] = useState<string | null>(null);
  // directSessionTargets stores `{deviceId, name}` pairs used by the popup telemetry stream and status pills.
  const [directSessionTargets, setDirectSessionTargets] = useState<Array<{ deviceId: string; name: string }>>([]);
  // Indicates whether the direct TB control path is active (needed to gate realtime commands and UI copy).
  const [directFlowActive, setDirectFlowActive] = useState(false);
  // Tracks the per-device RPC start acknowledgement so the dialog can render success/pending/error badges.
  const [directStartStates, setDirectStartStates] = useState<Record<string, 'idle' | 'pending' | 'success' | 'error'>>({});
  // Flag toggled after commands are issued so the dialog knows it can subscribe directly to ThingsBoard.
  const [directTelemetryEnabled, setDirectTelemetryEnabled] = useState(false);
  // Stores the JWT returned by `ensureTbAuthToken` for RPCs and direct WebSocket subscriptions.
  const [directControlToken, setDirectControlToken] = useState<string | null>(null);
  // Populates the dialog error banner whenever the ThingsBoard auth handshake fails.
  const [directControlError, setDirectControlError] = useState<string | null>(null);
  // Spinner state for the authentication request shown while the dialog prepares direct control.
  const [isDirectAuthLoading, setIsDirectAuthLoading] = useState(false);
  // Toggles the retry button state while we resend start commands to failed devices.
  const [isRetryingFailedDevices, setIsRetryingFailedDevices] = useState(false);

  // ── 2. Ref + wrapper callback ──────────────────────────────────────────

  const directStartStatesRef = useRef<Record<string, 'idle' | 'pending' | 'success' | 'error'>>({});
  const updateDirectStartStates = useCallback((
    value:
      | Record<string, 'idle' | 'pending' | 'success' | 'error'>
      | ((
        prev: Record<string, 'idle' | 'pending' | 'success' | 'error'>,
      ) => Record<string, 'idle' | 'pending' | 'success' | 'error'>),
  ) => {
    setDirectStartStates((prev) => {
      const next = typeof value === 'function' ? value(prev) : value;
      directStartStatesRef.current = next;
      console.info('[Games] Direct start state update', next);
      return next;
    });
  }, []);

  // ── 3. Derived values ──────────────────────────────────────────────────

  const isDirectTelemetryLifecycle =
    DIRECT_TB_CONTROL_ENABLED && Boolean(directSessionGameId) &&
    (isLaunchingLifecycle || isRunningLifecycle || isStoppingLifecycle || isFinalizingLifecycle);

  const isDirectFlow = isDirectTelemetryLifecycle && directTelemetryEnabled;

  // ── 4. refreshDirectAuthToken ──────────────────────────────────────────

  const refreshDirectAuthToken = useCallback(async () => {
    try {
      setIsDirectAuthLoading(true);
      const token = await ensureTbAuthToken();
      setDirectControlToken(token);
      setDirectControlError(null);
      return token;
    } catch (authError) {
      const message =
        authError instanceof Error ? authError.message : 'Failed to refresh ThingsBoard authentication.';
      setDirectControlError(message);
      throw authError;
    } finally {
      setIsDirectAuthLoading(false);
    }
  }, []);

  // ── 5. openStartDialogForTargets ───────────────────────────────────────

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
        console.info('[Games] Authenticating with ThingsBoard before opening start dialog', { source });
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

      console.info('[Games] Session dialog prepared', {
        source,
        targetCount: effectiveTargets.length,
        missingDeviceIds,
        offlineTargetIds: offlineTargets.map((device) => device.deviceId),
        gameId: resolvedGameId,
      });

      return { targets: effectiveTargets, gameId: resolvedGameId };
    },
    [
      availableDeviceMap,
      deriveIsOnline,
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
      toast,
      updateDirectStartStates,
    ],
  );

  // ── 6. executeDirectStart ──────────────────────────────────────────────

  const executeDirectStart = useCallback(
    async ({
      deviceIds,
      timestamp,
      isRetry = false,
      gameIdOverride,
      targetsOverride,
    }: {
      deviceIds: string[];
      timestamp: number;
      isRetry?: boolean;
      gameIdOverride?: string;
      targetsOverride?: NormalizedGameDevice[];
    }) => {
      const activeGameId = gameIdOverride ?? directSessionGameId;
      const uniqueIds = Array.from(new Set(deviceIds));
      if (uniqueIds.length === 0) {
        toast.error('No devices selected to start.');
        return { successIds: [], errorIds: [] };
      }

      if (!activeGameId) {
        toast.error('Missing ThingsBoard game identifier. Close and reopen the dialog to retry.');
        return { successIds: [], errorIds: uniqueIds };
      }

      const candidateTargets =
        targetsOverride && targetsOverride.length > 0
          ? targetsOverride.map((device) => ({
              deviceId: device.deviceId,
              name: device.name ?? device.deviceId,
            }))
          : directSessionTargets;

      const targetsToCommand = candidateTargets.filter((target) => uniqueIds.includes(target.deviceId));
      if (targetsToCommand.length === 0) {
        toast.error('Unable to resolve ThingsBoard devices for the start command.');
        setDirectFlowActive(false);
        setDirectTelemetryEnabled(false);
        setSessionLifecycle('selecting');
        setGameStartTime(null);
        setGameStopTime(null);
        resetSessionTimer(null);
        setHitCountsRef.current({});
        setHitHistoryRef.current([]);
        setDirectControlError('Unable to resolve ThingsBoard devices for the start command.');
        setActivePresetId(null);
        return { successIds: [], errorIds: uniqueIds };
      }

      updateDirectStartStates((prev) => {
        const next = { ...prev };
        uniqueIds.forEach((deviceId) => {
          next[deviceId] = 'pending';
        });
        return next;
      });

      // Route start commands through the edge function (server-side) so the RPC
      // reaches ThingsBoard without browser CORS / timeout constraints.
      let edgeResponse: Awaited<ReturnType<typeof invokeGameControl>> | null = null;
      try {
        console.info('[Games] Sending start via edge game-control', {
          deviceIds: uniqueIds,
          gameId: activeGameId,
          desiredDurationSeconds: sessionDurationSeconds,
          roomId: sessionRoomId,
        });
        edgeResponse = await invokeGameControl('start', {
          deviceIds: uniqueIds,
          gameId: activeGameId,
          desiredDurationSeconds: sessionDurationSeconds,
          roomId: sessionRoomId,
        });
        console.info('[Games] Edge game-control start response', edgeResponse);
      } catch (error) {
        console.error('[Games] Edge game-control start failed', error);
        edgeResponse = null;
      }

      // Map per-device results from the edge response
      const deviceResultMap = new Map<string, boolean>();
      if (edgeResponse?.results) {
        for (const result of edgeResponse.results) {
          deviceResultMap.set(result.deviceId, result.success);
        }
      }

      // Update per-device states
      uniqueIds.forEach((deviceId) => {
        const success = deviceResultMap.get(deviceId) ?? false;
        updateDirectStartStates((prev) => ({
          ...prev,
          [deviceId]: success ? 'success' : 'error',
        }));
      });

      const successIds = uniqueIds.filter((deviceId) => deviceResultMap.get(deviceId) === true);
      const errorIds = uniqueIds.filter((deviceId) => !deviceResultMap.get(deviceId));

      if (successIds.length === 0) {
        setDirectFlowActive(false);
        setDirectTelemetryEnabled(false);
        setSessionLifecycle('selecting');
        setGameStartTime(null);
        setGameStopTime(null);
        resetSessionTimer(null);
        setHitCountsRef.current({});
        setHitHistoryRef.current([]);
        setDirectControlError('Start commands failed. Adjust the devices or refresh your session and try again.');
        setActivePresetId(null);
        if (!isRetry) {
          toast.error('Failed to start session. Update device status and retry.');
        }
        return { successIds: [], errorIds };
      }

      // All RPCs dispatched — transition to running.
      // Oneway RPCs (504 timeout = expected) don't receive a device acknowledgment,
      // so we anchor the timer to RPC-completion time and go straight to 'running'.
      const rpcCompleteTimestamp = Date.now();
      setDirectFlowActive(true);
      setDirectTelemetryEnabled(true);
      setSessionLifecycle('running');
      startSessionTimer(rpcCompleteTimestamp);
      setGameStartTime((prev) => prev ?? rpcCompleteTimestamp);
      markTelemetryConfirmed(rpcCompleteTimestamp);
      setDirectControlError(errorIds.length > 0 ? 'Some devices failed to start. Retry failed devices.' : null);

      if (errorIds.length > 0) {
        toast.warning(`${errorIds.length} device${errorIds.length === 1 ? '' : 's'} failed to start. Use retry to try again.`);
      } else if (!isRetry) {
        toast.success(`Start commands dispatched to ${successIds.length} device${successIds.length === 1 ? '' : 's'}.`);
      }

      return { successIds, errorIds };
    },
    [
      directSessionTargets,
      directSessionGameId,
      updateDirectStartStates,
      toast,
      setActivePresetId,
      setSessionLifecycle,
      setGameStartTime,
      setGameStopTime,
      resetSessionTimer,
      markTelemetryConfirmed,
      startSessionTimer,
      sessionDurationSeconds,
      sessionRoomId,
    ],
  );

  // ── 7. beginSessionLaunch ──────────────────────────────────────────────

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
      setHitCountsRef.current(Object.fromEntries(launchDeviceIds.map((id) => [id, 0])));
      setHitHistoryRef.current([]);
      setStoppedTargetsRef.current(new Set()); // Reset stopped targets when starting new session
      setErrorMessage(null);
      setDirectControlError(null);

      setActivePresetId(stagedPresetId);
      markSessionTriggered(timestamp);
      setSessionLifecycle('launching');
      setDirectFlowActive(true);
      setDirectTelemetryEnabled(false);
      // Don't start the timer here — it will be started by executeDirectStart
      // when all RPC commands complete, so the timer is synchronized with when
      // devices actually received the start command (not when the button was pressed).

      updateDirectStartStates(() => {
        const next: Record<string, 'idle' | 'pending' | 'success' | 'error'> = {};
        launchDeviceIds.forEach((deviceId) => {
          next[deviceId] = 'pending';
        });
        return next;
      });

      console.info('[Games] Begin session pressed (direct ThingsBoard path)', {
        deviceIds: launchDeviceIds,
        gameId: activeGameId,
        desiredDurationSeconds: sessionDurationSeconds,
        sessionRoomId,
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
      deriveIsOnline,
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
      startSessionTimer,
      sessionDurationSeconds,
      sessionRoomId,
      stagedPresetId,
      toast,
      updateDirectStartStates,
    ],
  );

  // ── 8. handleStopDirectGame ────────────────────────────────────────────

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
    console.info('[Games] Disabling direct telemetry stream (stop initiated)');
    setDirectTelemetryEnabled(false);

    // Route stop commands through the edge function (server-side) so the RPC
    // reaches ThingsBoard without browser CORS / timeout constraints.
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

    // Map per-device results
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

    const hitHistorySnapshot = [...hitHistoryRef.current];
    const splitRecordsSnapshot = [...splitRecordsRef.current];
    const transitionRecordsSnapshot = [...transitionRecordsRef.current];
    const startTimestampSnapshot = gameStartTime ?? stopTimestamp;
    const sessionLabel = `Game ${new Date(startTimestampSnapshot).toLocaleTimeString()}`;

    try {
      await finalizeSessionRef.current({
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
    toast,
  ]);

  // ── 9. handleRetryFailedDevices ────────────────────────────────────────

  const handleRetryFailedDevices = useCallback(async () => {
    const failedIds = Object.entries(directStartStatesRef.current)
      .filter(([, state]) => state === 'error')
      .map(([deviceId]) => deviceId);

    if (failedIds.length === 0) {
      toast.info('No failed devices to retry.');
      return;
    }

    if (!directSessionGameId) {
      toast.error('Session is missing a ThingsBoard identifier. Close and reopen the dialog to retry.');
      return;
    }

    setIsRetryingFailedDevices(true);
    try {
      setDirectControlError(null);
      await executeDirectStart({ deviceIds: failedIds, timestamp: Date.now(), isRetry: true });
    } catch (error) {
      console.error('[Games] Retry failed devices encountered an error', error);
      toast.error('Retry failed devices encountered an error. Check connectivity and try again.');
    } finally {
      setIsRetryingFailedDevices(false);
    }
  }, [directSessionGameId, executeDirectStart, toast]);

  // ── Return ─────────────────────────────────────────────────────────────

  return {
    // State
    directSessionGameId,
    directSessionTargets,
    directFlowActive,
    directStartStates,
    directTelemetryEnabled,
    directControlToken,
    directControlError,
    isDirectAuthLoading,
    isRetryingFailedDevices,

    // Derived
    isDirectTelemetryLifecycle,
    isDirectFlow,

    // Setters
    setDirectSessionGameId,
    setDirectSessionTargets,
    setDirectFlowActive,
    setDirectTelemetryEnabled,
    setDirectControlError,
    updateDirectStartStates,

    // Callbacks
    refreshDirectAuthToken,
    openStartDialogForTargets,
    handleStopDirectGame,
    executeDirectStart,
    beginSessionLaunch,
    handleRetryFailedDevices,

    // Ref
    directStartStatesRef,
  };
}
