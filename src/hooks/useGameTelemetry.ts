import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { subscribeToGameTelemetry } from '@/services/gameTelemetry';

interface DeviceMeta {
  deviceId: string;
  deviceName: string;
}

export interface HitRecord {
  deviceId: string;
  deviceName: string;
  timestamp: number;
  gameId: string;
}

export interface SplitRecord {
  deviceId: string;
  deviceName: string;
  time: number;
  timestamp: number;
  splitNumber: number;
}

export interface TransitionRecord {
  fromDevice: string;
  toDevice: string;
  fromDeviceName: string;
  toDeviceName: string;
  time: number;
  timestamp: number;
  transitionNumber: number;
}

interface UseGameTelemetryOptions {
  token: string | null;
  gameId: string | null;
  isGameActive: boolean;
  devices: DeviceMeta[];
}

interface GameTelemetryState {
  hitCounts: Record<string, number>;
  hitHistory: HitRecord[];
  splits: SplitRecord[];
  transitions: TransitionRecord[];
  hitTimesByDevice: Record<string, number[]>;
}

const resolveTelemetryValue = (input: unknown): unknown => {
  if (Array.isArray(input) && input.length > 0) {
    const firstEntry = input[0];
    if (Array.isArray(firstEntry)) {
      return firstEntry[1];
    }
    if (typeof firstEntry === 'object' && firstEntry !== null) {
      if ('value' in firstEntry) {
        return (firstEntry as { value: unknown }).value;
      }
    }
    return firstEntry;
  }
  return input;
};

const resolveTelemetryTimestamp = (input: unknown, fallback: number): number => {
  if (Array.isArray(input) && input.length > 0) {
    const firstEntry = input[0];
    if (Array.isArray(firstEntry) && typeof firstEntry[0] === 'number') {
      return firstEntry[0];
    }
    if (typeof firstEntry === 'object' && firstEntry !== null && 'ts' in firstEntry) {
      const ts = (firstEntry as { ts?: number }).ts;
      if (typeof ts === 'number') {
        return ts;
      }
    }
  }
  if (typeof input === 'number') {
    return input;
  }
  return fallback;
};

const buildDeviceKey = (devices: DeviceMeta[]): string =>
  devices
    .map((device) => device.deviceId)
    .sort()
    .join(',');

export const useGameTelemetry = ({
  token,
  gameId,
  isGameActive,
  devices,
}: UseGameTelemetryOptions): GameTelemetryState => {
  const [hitCounts, setHitCounts] = useState<Record<string, number>>({});
  const [hitHistory, setHitHistory] = useState<HitRecord[]>([]);
  const [splits, setSplits] = useState<SplitRecord[]>([]);
  const [transitions, setTransitions] = useState<TransitionRecord[]>([]);
  const [hitTimesByDevice, setHitTimesByDevice] = useState<Record<string, number[]>>({});
  const [lastHitTimestamp, setLastHitTimestamp] = useState<Record<string, number | null>>({});
  const [lastHitDevice, setLastHitDevice] = useState<{
    deviceId: string;
    deviceName: string;
    timestamp: number;
  } | null>(null);

  const deviceKey = useMemo(() => buildDeviceKey(devices), [devices]);

  const resetState = useCallback(() => {
    const initialCounts = devices.reduce<Record<string, number>>((acc, device) => {
      acc[device.deviceId] = 0;
      return acc;
    }, {});

    const initialTimestamps = devices.reduce<Record<string, number | null>>((acc, device) => {
      acc[device.deviceId] = null;
      return acc;
    }, {});

    setHitCounts(initialCounts);
    setHitHistory([]);
    setSplits([]);
    setTransitions([]);
    setHitTimesByDevice({});
    setLastHitTimestamp(initialTimestamps);
    setLastHitDevice(null);
  }, [devices]);

  const previousActiveRef = useRef<boolean>(false);

  useEffect(() => {
    // Reset whenever device list changes or a new game starts
    resetState();
  }, [resetState, deviceKey, gameId]);

  useEffect(() => {
    if (isGameActive && !previousActiveRef.current) {
      resetState();
    }
    previousActiveRef.current = isGameActive;
  }, [isGameActive, resetState]);

  useEffect(() => {
    if (!token || !isGameActive || !gameId || devices.length === 0) {
      return undefined;
    }

    const deviceNameMap = new Map<string, string>(
      devices.map((device) => [device.deviceId, device.deviceName])
    );

    const deviceIds = devices.map((device) => device.deviceId);

    const unsubscribe = subscribeToGameTelemetry(token, deviceIds, (message) => {
      if (!message.data) {
        return;
      }

      const telemetryData = message.data as Record<string, unknown>;

      const eventValue = resolveTelemetryValue(telemetryData.event);
      const gameIdValue = resolveTelemetryValue(telemetryData.gameId);

      const resolvedDeviceId =
        message.entityId ||
        (resolveTelemetryValue(telemetryData.deviceId) as string | undefined);

      if (eventValue !== 'hit' || gameIdValue !== gameId || !resolvedDeviceId) {
        return;
      }

      const deviceId = resolvedDeviceId;
      const deviceName = deviceNameMap.get(deviceId) ?? deviceId;
      const eventTimestamp = resolveTelemetryTimestamp(
        telemetryData.event,
        Date.now()
      );
      const currentTimestamp = eventTimestamp || Date.now();

      setHitCounts((prev) => ({
        ...prev,
        [deviceId]: (prev[deviceId] ?? 0) + 1,
      }));

      setHitHistory((prev) => [
        ...prev,
        {
          deviceId,
          deviceName,
          timestamp: currentTimestamp,
          gameId,
        },
      ]);

      setHitTimesByDevice((prev) => {
        const existing = prev[deviceId] ? [...prev[deviceId]] : [];
        existing.push(currentTimestamp);
        return {
          ...prev,
          [deviceId]: existing,
        };
      });

      setLastHitTimestamp((prev) => {
        const previousTimestamp = prev[deviceId];
        if (typeof previousTimestamp === 'number') {
          const splitTime = (currentTimestamp - previousTimestamp) / 1000;
          if (splitTime > 0) {
            setSplits((prevSplits) => ([
              ...prevSplits,
              {
                deviceId,
                deviceName,
                time: splitTime,
                timestamp: currentTimestamp,
                splitNumber: prevSplits.length + 1,
              },
            ]));
          }
        }

        return {
          ...prev,
          [deviceId]: currentTimestamp,
        };
      });

      setLastHitDevice((prevLast) => {
        if (
          prevLast &&
          prevLast.deviceId !== deviceId
        ) {
          const transitionTime = (currentTimestamp - prevLast.timestamp) / 1000;
          if (transitionTime > 0) {
            setTransitions((prevTransitions) => ([
              ...prevTransitions,
              {
                fromDevice: prevLast.deviceId,
                toDevice: deviceId,
                fromDeviceName: prevLast.deviceName,
                toDeviceName: deviceName,
                time: transitionTime,
                timestamp: currentTimestamp,
                transitionNumber: prevTransitions.length + 1,
              },
            ]));
          }
        }

        return {
          deviceId,
          deviceName,
          timestamp: currentTimestamp,
        };
      });
    });

    return unsubscribe;
  }, [token, isGameActive, gameId, devices, deviceKey]);

  return useMemo(
    () => ({
      hitCounts,
      hitHistory,
      splits,
      transitions,
      hitTimesByDevice,
    }),
    [hitCounts, hitHistory, splits, transitions, hitTimesByDevice]
  );
};
