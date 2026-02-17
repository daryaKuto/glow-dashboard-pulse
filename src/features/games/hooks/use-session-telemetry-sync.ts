import { useState, useRef, useEffect, useCallback } from 'react';
import type { SessionLifecycle } from '@/features/games/lib/session-state';
import type { SessionHitRecord } from '@/features/games/lib/device-game-flow';
import type { NormalizedGameDevice } from '@/features/games/hooks/use-game-devices';
import { tbSendOneway } from '@/features/games/lib/thingsboard-client';
import { toast } from '@/components/ui/sonner';
import { logger } from '@/shared/lib/logger';

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

  // Shared ref for stopped targets (created in parent, shared with useDirectTbTelemetry)
  stoppedTargetsRef: React.MutableRefObject<Set<string>>;

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
    stoppedTargetsRef,
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
  // stoppedTargetsRef is passed in from parent (shared with useDirectTbTelemetry)
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
      // Use REF for guard check (always current) — avoids stale closure when
      // multiple targets reach their goal in the same React render cycle.
      if (stoppedTargetsRef.current.has(deviceId)) {
        return; // Already stopped
      }

      // Optimistically mark as stopped in the ref BEFORE async RPC.
      // This prevents duplicate stop calls from concurrent effect runs.
      stoppedTargetsRef.current = new Set(stoppedTargetsRef.current).add(deviceId);

      const gameId = directSessionGameId;
      if (!gameId) {
        // Rollback ref on failure
        const rollback = new Set(stoppedTargetsRef.current);
        rollback.delete(deviceId);
        stoppedTargetsRef.current = rollback;
        console.warn('[Games] Cannot stop target: no game ID', { deviceId });
        return;
      }

      try {
        logger.info('[Games] Stopping target due to goal reached', {
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

        // Use functional updater to read LATEST state — avoids stale closure
        // where concurrent calls would overwrite each other's additions.
        setStoppedTargets((prev) => new Set(prev).add(deviceId));

        toast.success(`${deviceName} reached goal of ${goalShots} shots`);
      } catch (error) {
        // Rollback ref on failure so the target can be retried
        const rollback = new Set(stoppedTargetsRef.current);
        rollback.delete(deviceId);
        stoppedTargetsRef.current = rollback;

        console.error('[Games] Failed to stop target when goal reached', {
          deviceId,
          deviceName,
          error,
        });
        toast.error(`Failed to stop ${deviceName}. Please stop manually.`);
      }
    },
    [directSessionGameId],
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

        // Log per-target hit count summary with device names
        const goals = goalShotsPerTargetRef.current;
        const summary = Object.entries(currentHitCounts).map(([id, count]) => {
          const device = currentSessionTargetsRef.current.find((d) => d.deviceId === id) ||
            availableDevicesRef.current.find((d) => d.deviceId === id);
          const name = device?.name ?? id.slice(0, 8);
          const goal = goals[id];
          return `${name}: ${count}${goal ? `/${goal}` : ''}`;
        });
        const total = Object.values(currentHitCounts).reduce((s, c) => s + c, 0);
        console.log(
          `%c[TelemetrySync] Hit counts updated%c — total: ${total} | ${summary.join(' | ')}`,
          'color: #816E94; font-weight: bold',
          'color: inherit',
        );
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
        const hitCountKeys = Object.keys(currentTelemetry.hitCounts);
        const goalKeys = Object.keys(goalShotsPerTargetRef.current);

        // Log mismatch between hitCount keys and goal keys (diagnostic for DNF/auto-stop bugs)
        if (hitCountKeys.length > 0 && goalKeys.length > 0) {
          const hitKeysNotInGoals = hitCountKeys.filter((k) => !goalKeys.includes(k));
          const goalKeysNotInHits = goalKeys.filter((k) => !hitCountKeys.includes(k));
          if (hitKeysNotInGoals.length > 0 || goalKeysNotInHits.length > 0) {
            logger.warn('[TelemetrySync] DeviceId mismatch between hitCounts and goalShotsPerTarget', {
              hitCountKeys,
              goalKeys,
              hitKeysNotInGoals,
              goalKeysNotInHits,
            });
          }
        }

        Object.entries(goalShotsPerTargetRef.current).forEach(([deviceId, goalShots]) => {
          const currentHits = currentTelemetry.hitCounts[deviceId] ?? 0;
          if (currentHits >= goalShots && !stoppedTargetsRef.current.has(deviceId)) {
            logger.warn('[TelemetrySync][DIAG] Goal reached — stopping target', {
              deviceId,
              currentHits,
              goalShots,
              stoppedTargets: Array.from(stoppedTargetsRef.current),
            });
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
      stoppedTargetsRef.current = new Set();
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
    goalShotsPerTargetRef,
    stopTargetWhenGoalReached,
  };
}
