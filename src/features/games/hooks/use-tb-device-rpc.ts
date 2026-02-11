import { useState, useRef, useCallback } from 'react';
import type { SessionLifecycle } from '@/components/game-session/sessionState';
import type { NormalizedGameDevice } from '@/features/games/hooks/use-game-devices';
import { invokeGameControl } from '@/lib/edge';
import { toast } from '@/components/ui/sonner';
import type { SessionRegistry } from './use-session-registry';

export interface UseTbDeviceRpcOptions {
  // From C.1
  refreshDirectAuthToken: () => Promise<string>;
  setDirectControlError: React.Dispatch<React.SetStateAction<string | null>>;

  // Lifecycle
  setSessionLifecycle: React.Dispatch<React.SetStateAction<SessionLifecycle>>;

  // Timer
  startSessionTimer: (anchor: number) => void;
  resetSessionTimer: (anchor: number | null) => void;

  // Activation
  markTelemetryConfirmed: (timestamp: number) => void;

  // Session state (from useSessionState via page)
  setGameStartTime: React.Dispatch<React.SetStateAction<number | null>>;
  setGameStopTime: React.Dispatch<React.SetStateAction<number | null>>;
  setErrorMessage: React.Dispatch<React.SetStateAction<string | null>>;
  setActivePresetId: React.Dispatch<React.SetStateAction<string | null>>;

  // Direct session state (from C.3 via page)
  directSessionGameId: string | null;
  directSessionTargets: Array<{ deviceId: string; name: string }>;
  setDirectFlowActive: React.Dispatch<React.SetStateAction<boolean>>;
  setDirectTelemetryEnabled: React.Dispatch<React.SetStateAction<boolean>>;

  // Session config
  sessionDurationSeconds: number | null;
  sessionRoomId: string | null;

  // Registry (for setHitCounts / setHitHistory)
  registry: SessionRegistry;
}

export interface UseTbDeviceRpcReturn {
  directStartStates: Record<string, 'idle' | 'pending' | 'success' | 'error'>;
  isRetryingFailedDevices: boolean;
  directStartStatesRef: React.MutableRefObject<Record<string, 'idle' | 'pending' | 'success' | 'error'>>;
  updateDirectStartStates: (
    value:
      | Record<string, 'idle' | 'pending' | 'success' | 'error'>
      | ((
        prev: Record<string, 'idle' | 'pending' | 'success' | 'error'>,
      ) => Record<string, 'idle' | 'pending' | 'success' | 'error'>)
  ) => void;
  executeDirectStart: (args: {
    deviceIds: string[];
    timestamp: number;
    isRetry?: boolean;
    gameIdOverride?: string;
    targetsOverride?: NormalizedGameDevice[];
  }) => Promise<{ successIds: string[]; errorIds: string[] }>;
  handleRetryFailedDevices: () => Promise<void>;
}

export function useTbDeviceRpc(options: UseTbDeviceRpcOptions): UseTbDeviceRpcReturn {
  const {
    refreshDirectAuthToken,
    setDirectControlError,
    setSessionLifecycle,
    startSessionTimer,
    resetSessionTimer,
    markTelemetryConfirmed,
    setGameStartTime,
    setGameStopTime,
    setErrorMessage,
    setActivePresetId,
    directSessionGameId,
    directSessionTargets,
    setDirectFlowActive,
    setDirectTelemetryEnabled,
    sessionDurationSeconds,
    sessionRoomId,
    registry,
  } = options;

  // Tracks the per-device RPC start acknowledgement so the dialog can render success/pending/error badges.
  const [directStartStates, setDirectStartStates] = useState<Record<string, 'idle' | 'pending' | 'success' | 'error'>>({});
  // Toggles the retry button state while we resend start commands to failed devices.
  const [isRetryingFailedDevices, setIsRetryingFailedDevices] = useState(false);

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
      return next;
    });
  }, []);

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
        registry.current.setHitCounts?.({});
        registry.current.setHitHistory?.([]);
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

      let edgeResponse: Awaited<ReturnType<typeof invokeGameControl>> | null = null;
      try {
        edgeResponse = await invokeGameControl('start', {
          deviceIds: uniqueIds,
          gameId: activeGameId,
          desiredDurationSeconds: sessionDurationSeconds,
          roomId: sessionRoomId,
        });
      } catch (error) {
        console.error('[Games] Edge game-control start failed', error);
        edgeResponse = null;
      }

      const deviceResultMap = new Map<string, boolean>();
      if (edgeResponse?.results) {
        for (const result of edgeResponse.results) {
          deviceResultMap.set(result.deviceId, result.success);
        }
      }

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
        registry.current.setHitCounts?.({});
        registry.current.setHitHistory?.([]);
        setDirectControlError('Start commands failed. Adjust the devices or refresh your session and try again.');
        setActivePresetId(null);
        if (!isRetry) {
          toast.error('Failed to start session. Update device status and retry.');
        }
        return { successIds: [], errorIds };
      }

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
  }, [directSessionGameId, executeDirectStart]);

  return {
    directStartStates,
    isRetryingFailedDevices,
    directStartStatesRef,
    updateDirectStartStates,
    executeDirectStart,
    handleRetryFailedDevices,
  };
}
