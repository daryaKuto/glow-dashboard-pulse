/**
 * Hook to manage game device states and telemetry
 *
 * @migrated from src/hooks/useGameDevices.ts
 * @see src/_legacy/README.md for migration details
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { DeviceStatus } from '@/features/games/lib/device-game-flow';
import { fetchTargetsWithTelemetry } from '@/lib/edge';
import type { Target } from '@/features/targets/schema';

export interface NormalizedGameDevice extends DeviceStatus {
  raw: RawGameDevice;
  gameId: string | null;
  statusLabel: 'offline' | 'idle' | 'active' | 'stopped';
}

type RawGameDevice = {
  deviceId: string;
  name?: string | null;
  status?: string | null;
  gameStatus?: string | null;
  isOnline?: boolean;
  wifiStrength?: number | null;
  ambientLight?: string | null;
  hitCount?: number | null;
  lastSeen?: number | null;
  event?: string | null;
  lastGameId?: string | null;
};

export const DEVICE_ONLINE_STALE_THRESHOLD_MS = 5 * 60 * 1000;

export interface UseGameDevicesOptions {
  immediate?: boolean;
}

export interface UseGameDevicesResult {
  devices: NormalizedGameDevice[];
  lastFetched: number | null;
  isLoading: boolean;
  error: Error | null;
  refresh: (options?: { silent?: boolean }) => Promise<{ devices: NormalizedGameDevice[]; fetchedAt: number } | null>;
  pollInfo: (deviceIds: string[]) => Promise<{ devices: NormalizedGameDevice[]; fetchedAt: number } | null>;
}

const resolveSeriesValue = (input: unknown): unknown => {
  if (Array.isArray(input) && input.length > 0) {
    const first = input[0];
    if (Array.isArray(first) && first.length > 1) {
      return first[1];
    }
    if (first && typeof first === 'object' && 'value' in (first as Record<string, unknown>)) {
      return (first as { value: unknown }).value;
    }
    return first;
  }
  if (input && typeof input === 'object' && 'value' in (input as Record<string, unknown>)) {
    return (input as { value: unknown }).value;
  }
  return input;
};

const resolveSeriesNumber = (input: unknown): number | null => {
  const value = resolveSeriesValue(input);
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const resolveSeriesString = (input: unknown): string | null => {
  const value = resolveSeriesValue(input);
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number') {
    return String(value);
  }
  return null;
};

const normalizeGameDevice = (target: Target): NormalizedGameDevice => {
  const telemetry = target.telemetry ?? {};
  const statusValue = (target.status ?? '').toString().toLowerCase();
  const eventValue = resolveSeriesString(telemetry.event);
  const gameStatusValue = (target.gameStatus ?? eventValue ?? '').toString().toLowerCase();

  const isOnline =
    statusValue === 'online' ||
    statusValue === 'standby' ||
    statusValue === 'active' ||
    statusValue === 'recent';

  let derivedStatus: DeviceStatus['gameStatus'];
  let statusLabel: NormalizedGameDevice['statusLabel'];

  if (!isOnline) {
    derivedStatus = 'offline';
    statusLabel = 'offline';
  } else if (gameStatusValue === 'start' || gameStatusValue === 'busy' || gameStatusValue === 'active') {
    derivedStatus = 'start';
    statusLabel = 'active';
  } else {
    derivedStatus = 'idle';
    statusLabel = 'idle';
  }

  const ambientValue = (resolveSeriesString(telemetry.ambientLight) ?? '').toLowerCase();
  const ambientLight: DeviceStatus['ambientLight'] =
    ambientValue === 'average' ? 'average' : ambientValue === 'poor' ? 'poor' : 'good';

  const wifiStrengthRaw = target.wifiStrength ?? resolveSeriesNumber(telemetry.wifiStrength) ?? 0;
  const wifiStrength = Number.isFinite(Number(wifiStrengthRaw))
    ? Math.max(0, Math.round(Number(wifiStrengthRaw)))
    : 0;

  const hitCount =
    target.totalShots ??
    target.lastHits ??
    resolveSeriesNumber(telemetry.hits) ??
    0;

  const lastSeen =
    target.lastActivityTime ??
    target.lastShotTime ??
    resolveSeriesNumber(telemetry.hit_ts) ??
    0;

  return {
    deviceId: target.id,
    name: target.name ?? target.deviceName ?? target.id,
    gameStatus: derivedStatus,
    wifiStrength,
    ambientLight,
    hitCount: Number(hitCount) || 0,
    lastSeen: typeof lastSeen === 'number' ? lastSeen : 0,
    isOnline,
    hitTimes: [],
    raw: {
      deviceId: target.id,
      name: target.name ?? target.deviceName ?? target.id,
      status: target.status ?? null,
      gameStatus: target.gameStatus ?? null,
      isOnline,
      wifiStrength,
      ambientLight,
      hitCount: Number(hitCount) || 0,
      lastSeen: typeof lastSeen === 'number' ? lastSeen : null,
      event: eventValue,
      lastGameId: target.lastGameId ?? null,
    },
    gameId: target.lastGameId ?? null,
    statusLabel,
  };
};

export function useGameDevices(options: UseGameDevicesOptions = {}): UseGameDevicesResult {
  const { immediate = true } = options;
  const [devices, setDevices] = useState<NormalizedGameDevice[]>([]);
  const [lastFetched, setLastFetched] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const loadingRef = useRef(false);

  const refresh = useCallback(
    async ({ silent = false }: { silent?: boolean } = {}) => {
      if (loadingRef.current) {
        return null;
      }

      loadingRef.current = true;
      if (!silent) {
        setIsLoading(true);
      }

      try {
        const startTime = performance.now();
        const { targets } = await fetchTargetsWithTelemetry(true);
        const fetchDuration = performance.now() - startTime;
        const normalized = targets.map(normalizeGameDevice);
        const normalizeDuration = performance.now() - startTime - fetchDuration;
        const fetchedAt = Date.now();
        setDevices(normalized);
        setLastFetched(fetchedAt);
        setError(null);

        console.info('⚡ [Performance] useGameDevices.refresh', {
          deviceCount: targets.length,
          fetchDuration: `${fetchDuration.toFixed(2)}ms`,
          normalizeDuration: `${normalizeDuration.toFixed(2)}ms`,
          totalDuration: `${(fetchDuration + normalizeDuration).toFixed(2)}ms`,
        });

        return { devices: normalized, fetchedAt };
      } catch (err) {
        const errorInstance = err instanceof Error ? err : new Error(String(err));
        setError(errorInstance);
        if (!silent) {
          throw errorInstance;
        }
        return null;
      } finally {
        loadingRef.current = false;
        if (!silent) {
          setIsLoading(false);
        }
      }
    },
    [],
  );

  useEffect(() => {
    if (!immediate) {
      return;
    }
    void refresh();
  }, [immediate, refresh]);

  const pollInfo = useCallback(
    async (deviceIds: string[]) => {
      if (!Array.isArray(deviceIds) || deviceIds.length === 0) {
        return null;
      }
      return refresh({ silent: true });
    },
    [refresh],
  );

  const memoizedDevices = useMemo(() => devices, [devices]);

  return {
    devices: memoizedDevices,
    lastFetched,
    isLoading,
    error,
    refresh,
    pollInfo,
  };
}
