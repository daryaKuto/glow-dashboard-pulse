import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { tbSubscribeTelemetry } from '@/services/thingsboard-client';

interface DeviceDescriptor {
  deviceId: string;
  deviceName: string;
}

interface UseDirectTbTelemetryOptions {
  enabled: boolean;
  token: string | null;
  gameId: string | null;
  devices: DeviceDescriptor[];
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
}: UseDirectTbTelemetryOptions): DirectTelemetryState => {
  const [hitCounts, setHitCounts] = useState<Record<string, number>>({});
  const [hitHistory, setHitHistory] = useState<DirectTelemetryState['hitHistory']>([]);
  const [splits, setSplits] = useState<DirectTelemetryState['splits']>([]);
  const [transitions, setTransitions] = useState<DirectTelemetryState['transitions']>([]);
  const [hitTimesByDevice, setHitTimesByDevice] = useState<Record<string, number[]>>({});
  const [sessionEventTimestamp, setSessionEventTimestamp] = useState<number | null>(null);
  const [readyDevices, setReadyDevices] = useState<Record<string, number>>({});
  const lastHitTimestampRef = useRef<Record<string, number | null>>({});
  const lastHitDeviceRef = useRef<{
    deviceId: string;
    deviceName: string;
    timestamp: number;
  } | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const trackedDevices = useMemo(() => devices.map((device) => device.deviceId), [devices]);
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
    lastHitTimestampRef.current = {};
    lastHitDeviceRef.current = null;
  }, []);

  useEffect(() => {
    if (!enabled) {
      if (unsubscribeRef.current) {
        console.info('[DirectTelemetry] Disabled – tearing down subscription');
      }
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

    console.info('[DirectTelemetry] Subscribing to ThingsBoard telemetry', {
      gameId,
      trackedDevices,
    });

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
        const deviceId =
          typeof deviceIdValue === 'string' && deviceIdValue.trim().length > 0
            ? deviceIdValue
            : fallbackEntityId;
        if (!deviceId || deviceId.trim().length === 0) {
          console.warn('[DirectTelemetry] Dropping telemetry without deviceId', {
            entityId: payload.entityId,
            telemetry,
          });
          return;
        }
        const deviceName = deviceNameMap.get(deviceId) ?? deviceId;

        console.info('[DirectTelemetry] Raw telemetry received', {
          entityId: payload.entityId,
          deviceId,
          gameIdValue,
          telemetry,
        });

        if (gameIdValue !== gameId) {
          return;
        }

        if (eventValue === 'start' || eventValue === 'busy') {
          console.info('[DirectTelemetry] Ready event received', { deviceId, eventValue, eventTimestamp });
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

        console.info('[DirectTelemetry] Hit event received', {
          deviceId,
          deviceName,
          eventTimestamp,
          gameId,
          raw: telemetry,
        });

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
            console.info('[DirectTelemetry] Split computed', {
              deviceId,
              deviceName,
              splitTimeSeconds: splitTime,
              timestamp: eventTimestamp,
            });
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
          console.info('[useDirectTbTelemetry] Falling back to polling telemetry', error);
        },
      },
    );

    unsubscribeRef.current = () => {
      unsubscribe();
      unsubscribeRef.current = null;
      console.info('[DirectTelemetry] Subscription closed');
    };

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, [enabled, token, gameId, trackedDevices, deviceNameMap, resetState]);

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
