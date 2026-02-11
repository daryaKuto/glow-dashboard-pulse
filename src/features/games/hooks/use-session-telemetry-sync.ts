import { useState, useRef, useEffect, useCallback } from 'react';
import type { SessionLifecycle } from '@/components/game-session/sessionState';
import type { SessionHitRecord } from '@/features/games/lib/device-game-flow';
import type { NormalizedGameDevice } from '@/features/games/hooks/use-game-devices';
import { tbSendOneway } from '@/features/games/lib/thingsboard-client';
import { toast } from '@/components/ui/sonner';

/** Shape of the telemetry snapshot provided by useDirectTbTelemetry */
interface TelemetrySnapshot {
  hitCounts: Record<string, number>;
  hitHistory: Array<{
    deviceId: string;
    deviceName: string;
    timestamp: number;
    gameId: string;
  }>;
  hitTimesByDevice: Record<string, number[]>;
  sessionEventTimestamp: number | null;
}

interface UseSessionTelemetrySyncOptions {
  // Lifecycle
  isLaunchingLifecycle: boolean;
  isRunningLifecycle: boolean;
  sessionLifecycle: SessionLifecycle;

  // Game identity
  directSessionGameId: string | null;

  // Telemetry source
  telemetryState: TelemetrySnapshot;

  // Goal shots (synced to internal ref)
  goalShotsPerTarget: Record<string, number>;

  // Session activation
  sessionConfirmed: boolean;
  markTelemetryConfirmed: (timestamp: number) => void;
  hasMarkedTelemetryConfirmedRef: React.MutableRefObject<boolean>;

  // External refs for device lookups
  currentSessionTargetsRef: React.MutableRefObject<NormalizedGameDevice[]>;
  availableDevicesRef: React.MutableRefObject<NormalizedGameDevice[]>;

  // Available devices updater (telemetry enrichment)
  setAvailableDevices: React.Dispatch<React.SetStateAction<NormalizedGameDevice[]>>;

  // Active devices (effect dep)
  activeDeviceIds: string[];
}

interface UseSessionTelemetrySyncReturn {
  // State
  hitCounts: Record<string, number>;
  hitHistory: SessionHitRecord[];
  stoppedTargets: Set<string>;

  // Setters (used externally by session start/stop flows)
  setHitCounts: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  setHitHistory: React.Dispatch<React.SetStateAction<SessionHitRecord[]>>;
  setStoppedTargets: React.Dispatch<React.SetStateAction<Set<string>>>;

  // Refs
  stoppedTargetsRef: React.MutableRefObject<Set<string>>;
  goalShotsPerTargetRef: React.MutableRefObject<Record<string, number>>;

  // Callback
  stopTargetWhenGoalReached: (deviceId: string, deviceName: string, goalShots: number) => Promise<void>;
}

export function useSessionTelemetrySync(options: UseSessionTelemetrySyncOptions): UseSessionTelemetrySyncReturn {
  const {
    isLaunchingLifecycle,
    isRunningLifecycle,
    sessionLifecycle,
    directSessionGameId,
    telemetryState,
    goalShotsPerTarget,
    sessionConfirmed,
    markTelemetryConfirmed,
    hasMarkedTelemetryConfirmedRef,
    currentSessionTargetsRef,
    availableDevicesRef,
    setAvailableDevices,
    activeDeviceIds,
  } = options;

  // --- State ---
  const [hitCounts, setHitCounts] = useState<Record<string, number>>({});
  const [hitHistory, setHitHistory] = useState<SessionHitRecord[]>([]);
  const [stoppedTargets, setStoppedTargets] = useState<Set<string>>(new Set());

  // --- Refs ---
  const stoppedTargetsRef = useRef<Set<string>>(new Set());
  const goalShotsPerTargetRef = useRef<Record<string, number>>({});
  const prevHitCountsRef = useRef<Record<string, number>>({});
  const prevHitHistoryRef = useRef<SessionHitRecord[]>([]);

  // Keep refs in sync
  useEffect(() => {
    stoppedTargetsRef.current = stoppedTargets;
  }, [stoppedTargets]);

  useEffect(() => {
    goalShotsPerTargetRef.current = goalShotsPerTarget;
  }, [goalShotsPerTarget]);

  // --- Callbacks ---

  const stopTargetWhenGoalReached = useCallback(
    async (deviceId: string, deviceName: string, goalShots: number) => {
      if (stoppedTargets.has(deviceId)) {
        return; // Already stopped
      }

      const gameId = directSessionGameId;
      if (!gameId) {
        console.warn('[Games] Cannot stop target: no game ID', { deviceId });
        return;
      }

      try {
        console.info('[Games] Stopping target due to goal reached', {
          deviceId,
          deviceName,
          goalShots,
          gameId,
        });

        const stopTimestamp = Date.now();
        await tbSendOneway(deviceId, 'stop', {
          ts: stopTimestamp,
          values: {
            gameId,
            reason: 'goal_reached',
            goalShots,
          },
        });

        const newStoppedTargets = new Set(stoppedTargets).add(deviceId);
        setStoppedTargets(newStoppedTargets);

        toast.success(`${deviceName} reached goal of ${goalShots} shots`);
      } catch (error) {
        console.error('[Games] Failed to stop target when goal reached', {
          deviceId,
          deviceName,
          error,
        });
        toast.error(`Failed to stop ${deviceName}. Please stop manually.`);
      }
    },
    [stoppedTargets, directSessionGameId],
  );

  // --- Main telemetry processing effect ---

  useEffect(() => {
    if ((isLaunchingLifecycle || isRunningLifecycle) && directSessionGameId) {
      const currentTelemetry = telemetryState;

      // Only update hitCounts if content actually changed (prevent infinite loop)
      const currentHitCounts = currentTelemetry.hitCounts;
      const hitCountsChanged = JSON.stringify(prevHitCountsRef.current) !== JSON.stringify(currentHitCounts);
      if (hitCountsChanged) {
        setHitCounts(currentHitCounts);
        prevHitCountsRef.current = currentHitCounts;
      }

      // Only update hitHistory if content actually changed (prevent infinite loop)
      const currentHitHistory = currentTelemetry.hitHistory;
      const hitHistoryChanged =
        prevHitHistoryRef.current.length !== currentHitHistory.length ||
        prevHitHistoryRef.current.some((prev, i) => {
          const curr = currentHitHistory[i];
          return !curr || prev.timestamp !== curr.timestamp || prev.deviceId !== curr.deviceId;
        });
      if (hitHistoryChanged) {
        setHitHistory(currentHitHistory);
        prevHitHistoryRef.current = currentHitHistory;
      }

      // Only update availableDevices if hitCounts or hitTimesByDevice changed
      if (hitCountsChanged || hitHistoryChanged) {
        setAvailableDevices((prev) => {
          const next = prev.map((device) => {
            const count = currentTelemetry.hitCounts[device.deviceId] ?? device.hitCount;
            const hitTimes = currentTelemetry.hitTimesByDevice[device.deviceId];
            if (typeof count !== 'number' && !hitTimes) {
              return device;
            }

            const newHitCount = typeof count === 'number' ? count : device.hitCount;
            const newHitTimes = hitTimes ?? device.hitTimes;

            // Only create new object if values actually changed
            if (newHitCount === device.hitCount && newHitTimes === device.hitTimes) {
              return device;
            }

            return {
              ...device,
              hitCount: newHitCount,
              hitTimes: newHitTimes,
            };
          });

          // Only update if array actually changed
          const hasChanges = next.some((device, i) => device !== prev[i]);
          if (hasChanges) {
            availableDevicesRef.current = next;
            return next;
          }
          return prev; // Return same reference if no changes
        });
      }

      // Check if any targets have reached their goal shots
      if (isRunningLifecycle && Object.keys(goalShotsPerTargetRef.current).length > 0) {
        Object.entries(goalShotsPerTargetRef.current).forEach(([deviceId, goalShots]) => {
          const currentHits = currentTelemetry.hitCounts[deviceId] ?? 0;
          if (currentHits >= goalShots && !stoppedTargetsRef.current.has(deviceId)) {
            const device = currentSessionTargetsRef.current.find((d) => d.deviceId === deviceId) ||
              availableDevicesRef.current.find((d) => d.deviceId === deviceId);
            const deviceName = device?.name ?? deviceId;
            void stopTargetWhenGoalReached(deviceId, deviceName, goalShots);
          }
        });
      }

      if (!sessionConfirmed && !hasMarkedTelemetryConfirmedRef.current) {
        const latestTelemetryTimestamp = (() => {
          if (typeof currentTelemetry.sessionEventTimestamp === 'number') {
            return currentTelemetry.sessionEventTimestamp;
          }
          const fromHistory = currentTelemetry.hitHistory.at(-1)?.timestamp;
          if (typeof fromHistory === 'number') {
            return fromHistory;
          }
          const flattened = Object.values(currentTelemetry.hitTimesByDevice)
            .flat()
            .filter((value): value is number => typeof value === 'number');
          if (flattened.length > 0) {
            return Math.min(...flattened);
          }
          return null;
        })();

        if (latestTelemetryTimestamp !== null) {
          hasMarkedTelemetryConfirmedRef.current = true;
          markTelemetryConfirmed(latestTelemetryTimestamp);
        }
      }
    } else if (sessionLifecycle === 'idle') {
      // Only reset if we actually have data to clear (prevent unnecessary updates)
      setHitCounts((prev) => {
        if (Object.keys(prev).length === 0) {
          return prev; // Already empty, return same reference
        }
        return {};
      });
      setHitHistory((prev) => {
        if (prev.length === 0) {
          return prev; // Already empty, return same reference
        }
        return [];
      });
      setStoppedTargets((prev) => (prev.size > 0 ? new Set() : prev)); // Only update if not already empty
      // Reset refs when session ends
      prevHitCountsRef.current = {};
      prevHitHistoryRef.current = [];
    }
  }, [
    activeDeviceIds,
    directSessionGameId,
    isRunningLifecycle,
    isLaunchingLifecycle,
    sessionLifecycle,
    sessionConfirmed,
    markTelemetryConfirmed,
    stopTargetWhenGoalReached,
    telemetryState,
    availableDevicesRef,
    currentSessionTargetsRef,
    hasMarkedTelemetryConfirmedRef,
    setAvailableDevices,
  ]);

  return {
    hitCounts,
    hitHistory,
    stoppedTargets,
    setHitCounts,
    setHitHistory,
    setStoppedTargets,
    stoppedTargetsRef,
    goalShotsPerTargetRef,
    stopTargetWhenGoalReached,
  };
}
