/**
 * Hook for direct ThingsBoard WebSocket telemetry subscription
 *
 * @migrated from src/hooks/useDirectTbTelemetry.ts
 * @see src/_legacy/README.md for migration details
 */

import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import { tbSubscribeTelemetry } from '@/features/games/lib/thingsboard-client';
import { logger } from '@/shared/lib/logger';

interface DeviceDescriptor {
  deviceId: string;
  deviceName: string;
}

interface UseDirectTbTelemetryOptions {
  enabled: boolean;
  token: string | null;
  gameId: string | null;
  devices: DeviceDescriptor[];
  /** Ref to the set of device IDs that have been stopped (goal reached).
   *  Hits from stopped targets are ignored to prevent post-goal hit inflation. */
  stoppedTargetsRef?: MutableRefObject<Set<string>>;
}

export interface DirectTelemetryState {
  hitCounts: Record<string, number>;
  hitHistory: Array<{
    deviceId: string;
    deviceName: string;
    timestamp: number;
    gameId: string;
  }>;
  splits: Array<{
    deviceId: string;
    deviceName: string;
    time: number;
    timestamp: number;
    splitNumber: number;
  }>;
  transitions: Array<{
    fromDevice: string;
    toDevice: string;
    fromDeviceName: string;
    toDeviceName: string;
    time: number;
    timestamp: number;
    transitionNumber: number;
  }>;
  hitTimesByDevice: Record<string, number[]>;
  sessionEventTimestamp: number | null;
  readyDevices: Record<string, number>;
}

const resolveValue = (input: unknown): unknown => {
  if (Array.isArray(input) && input.length > 0) {
    const first = input[0];
    if (Array.isArray(first)) {
      return first[1];
    }
    if (first && typeof first === 'object') {
      const record = first as Record<string, unknown>;
      if ('value' in record) {
        return record.value;
      }
    }
    return first;
  }
  return input;
};

const resolveTimestamp = (input: unknown, fallback: number): number => {
  if (Array.isArray(input) && input.length > 0) {
    const first = input[0];
    if (Array.isArray(first) && typeof first[0] === 'number') {
      return first[0];
    }
    if (first && typeof first === 'object' && 'ts' in first) {
      const candidate = (first as { ts?: number }).ts;
      if (typeof candidate === 'number') {
        return candidate;
      }
    }
  }
  if (typeof input === 'number') {
    return input;
  }
  return fallback;
};

export const useDirectTbTelemetry = ({
  enabled,
  token,
  gameId,
  devices,
  stoppedTargetsRef,
}: UseDirectTbTelemetryOptions): DirectTelemetryState => {
  const [hitCounts, setHitCounts] = useState<Record<string, number>>({});
  const [hitHistory, setHitHistory] = useState<DirectTelemetryState['hitHistory']>([]);
  const [splits, setSplits] = useState<DirectTelemetryState['splits']>([]);
  const [transitions, setTransitions] = useState<DirectTelemetryState['transitions']>([]);
  const [hitTimesByDevice, setHitTimesByDevice] = useState<Record<string, number[]>>({});
  const [sessionEventTimestamp, setSessionEventTimestamp] = useState<number | null>(null);
  const [readyDevices, setReadyDevices] = useState<Record<string, number>>({});
  // Mirror of hitCounts for logging outside state updaters (avoids StrictMode double-log)
  const hitCountsRef = useRef<Record<string, number>>({});
  const lastHitTimestampRef = useRef<Record<string, number | null>>({});
  const lastHitDeviceRef = useRef<{
    deviceId: string;
    deviceName: string;
    timestamp: number;
  } | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const trackedDevices = useMemo(() => devices.map((device) => device.deviceId), [devices]);
  const trackedDeviceSet = useMemo(() => new Set(trackedDevices), [trackedDevices]);
  const deviceNameMap = useMemo(() => {
    const map = new Map<string, string>();
    devices.forEach((device) => {
      map.set(device.deviceId, device.deviceName);
    });
    return map;
  }, [devices]);

  const resetState = useCallback(() => {
    setHitCounts({});
    setHitHistory([]);
    setSplits([]);
    setTransitions([]);
    setHitTimesByDevice({});
    setSessionEventTimestamp(null);
    setReadyDevices({});
    hitCountsRef.current = {};
    lastHitTimestampRef.current = {};
    lastHitDeviceRef.current = null;
  }, []);

  useEffect(() => {
    if (!enabled) {
      resetState();
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
      return;
    }
    if (!token || !gameId || trackedDevices.length === 0) {
      console.warn('[DirectTelemetry] Missing prerequisites', {
        enabled,
        tokenPresent: Boolean(token),
        gameId,
        trackedDevices,
      });
      return;
    }

    // Capture the subscription start time so we can discard stale cached
    // telemetry that ThingsBoard sends as an initial snapshot when the
    // WebSocket opens.  Only events newer than this threshold are real.
    const subscriptionStartedAt = Date.now();

    const unsubscribe = tbSubscribeTelemetry(
      trackedDevices,
      token,
      (payload) => {
        if (!payload.data || !payload.entityId) {
          return;
        }
        const telemetry = payload.data as Record<string, unknown>;
        const eventValue = resolveValue(telemetry.event);
        const gameIdValue = resolveValue(telemetry.gameId);
        const deviceIdValue = resolveValue(telemetry.deviceId) as string | undefined;
        const eventTimestamp = resolveTimestamp(telemetry.event, Date.now());

        const fallbackEntityId = typeof payload.entityId === 'string' ? payload.entityId : '';
        let deviceId =
          typeof deviceIdValue === 'string' && deviceIdValue.trim().length > 0
            ? deviceIdValue
            : fallbackEntityId;

        // Normalize to tracked device ID if the resolved ID doesn't match.
        // Handles firmware sending MAC address while we track by ThingsBoard UUID.
        if (deviceId && !trackedDeviceSet.has(deviceId)) {
          if (fallbackEntityId && trackedDeviceSet.has(fallbackEntityId)) {
            logger.warn('[DirectTelemetry][DIAG] Normalized deviceId from telemetry to tracked UUID', {
              original: deviceId,
              normalized: fallbackEntityId,
            });
            deviceId = fallbackEntityId;
          } else {
            logger.warn('[DirectTelemetry] deviceId not in tracked set and no fallback match', {
              deviceId,
              fallbackEntityId,
              trackedDevices: [...trackedDeviceSet],
            });
          }
        }

        if (!deviceId || deviceId.trim().length === 0) {
          console.warn('[DirectTelemetry] Dropping telemetry without deviceId', {
            entityId: payload.entityId,
            telemetry,
          });
          return;
        }
        const deviceName = deviceNameMap.get(deviceId) ?? deviceId;

        // Drop stale cached telemetry from before this subscription opened.
        // ThingsBoard sends the latest cached values as an initial snapshot
        // when the WebSocket connects — these are historical, not live events.
        if (eventTimestamp < subscriptionStartedAt) {
          return;
        }

        if (eventValue === 'start' || eventValue === 'busy') {
          setSessionEventTimestamp((prev) => (prev === null ? eventTimestamp : Math.min(prev, eventTimestamp)));
          setReadyDevices((prev) => {
            if (prev[deviceId]) {
              return prev;
            }
            return {
              ...prev,
              [deviceId]: eventTimestamp,
            };
          });
          return;
        }

        if (eventValue !== 'hit') {
          return;
        }

        // Skip hits from targets that have already been stopped (goal reached).
        // The physical device may continue firing between the stop RPC and
        // when the firmware actually processes it — these late hits should
        // not inflate hitCounts or pollute hitHistory/splits/transitions.
        if (stoppedTargetsRef?.current.has(deviceId)) {
          logger.warn('[DirectTelemetry] Ignoring post-goal hit from stopped target', {
            deviceId,
            deviceName,
            eventTimestamp,
          });
          return;
        }

        // Log BEFORE the state updater so StrictMode double-invoke doesn't duplicate it
        {
          const prevCount = hitCountsRef.current[deviceId] ?? 0;
          const newCount = prevCount + 1;
          hitCountsRef.current = { ...hitCountsRef.current, [deviceId]: newCount };
          const perDevice: Record<string, number> = {};
          for (const [id, count] of Object.entries(hitCountsRef.current)) {
            perDevice[deviceNameMap.get(id) ?? id] = count;
          }
          console.log(
            `%c[HIT] #${newCount} — ${deviceName}%c | ts: ${eventTimestamp} | All counts: ${JSON.stringify(perDevice)}`,
            'color: #CE3E0A; font-weight: bold',
            'color: inherit',
          );
        }

        setHitCounts((prev) => ({
          ...prev,
          [deviceId]: (prev[deviceId] ?? 0) + 1,
        }));

        setHitHistory((prev) => [
          ...prev,
          {
            deviceId,
            deviceName,
            timestamp: eventTimestamp,
            gameId,
          },
        ]);

        setHitTimesByDevice((prev) => {
          const next = { ...prev };
          const existing = next[deviceId] ? [...next[deviceId]] : [];
          existing.push(eventTimestamp);
          next[deviceId] = existing;
          return next;
        });

        const previousTimestamp = lastHitTimestampRef.current[deviceId];
        if (typeof previousTimestamp === 'number') {
          const splitTime = (eventTimestamp - previousTimestamp) / 1000;
          if (splitTime > 0) {
            setSplits((prevSplits) => ([
              ...prevSplits,
              {
                deviceId,
                deviceName,
                time: splitTime,
                timestamp: eventTimestamp,
                splitNumber: prevSplits.length + 1,
              },
            ]));
          }
        }
        lastHitTimestampRef.current[deviceId] = eventTimestamp;

        const previousHit = lastHitDeviceRef.current;
        if (previousHit && previousHit.deviceId !== deviceId) {
          const transitionTime = (eventTimestamp - previousHit.timestamp) / 1000;
          if (transitionTime > 0) {
            setTransitions((prevTransitions) => ([
              ...prevTransitions,
              {
                fromDevice: previousHit.deviceId,
                toDevice: deviceId,
                fromDeviceName: previousHit.deviceName,
                toDeviceName: deviceName,
                time: transitionTime,
                timestamp: eventTimestamp,
                transitionNumber: prevTransitions.length + 1,
              },
            ]));
          }
        }
        lastHitDeviceRef.current = {
          deviceId,
          deviceName,
          timestamp: eventTimestamp,
        };
      },
      {
        realtime: true,
        pollIntervalMs: 1_000,
        onError: (error) => {
          logger.info('[useDirectTbTelemetry] Falling back to polling telemetry', error);
        },
      },
    );

    unsubscribeRef.current = () => {
      unsubscribe();
      unsubscribeRef.current = null;
    };

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, [enabled, token, gameId, trackedDevices, trackedDeviceSet, deviceNameMap, resetState]);

  return useMemo(
    () => ({
      hitCounts,
      hitHistory,
      splits,
      transitions,
      hitTimesByDevice,
      sessionEventTimestamp,
      readyDevices,
    }),
    [hitCounts, hitHistory, splits, transitions, hitTimesByDevice, sessionEventTimestamp, readyDevices],
  );
};

export default useDirectTbTelemetry;
