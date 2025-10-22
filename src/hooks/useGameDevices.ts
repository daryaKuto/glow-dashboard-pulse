import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { fetchGameControlDevices, fetchGameControlInfo, type GameControlDevice } from '@/lib/edge';
import type { DeviceStatus } from '@/services/device-game-flow';
import { useTargets } from '@/store/useTargets';

export interface NormalizedGameDevice extends DeviceStatus {
  raw: GameControlDevice;
  gameId: string | null;
  statusLabel: 'offline' | 'idle' | 'active' | 'stopped';
}

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

// Normalises raw edge data into the richer shape the game UI expects so downstream consumers never have to re-derive status flags.
function normalizeGameDevice(device: GameControlDevice): NormalizedGameDevice {
  const targetsState = (() => {
    try {
      return useTargets.getState();
    } catch {
      return null;
    }
  })();
  const matchingTarget = targetsState?.targets.find((target) => target.id === device.deviceId);

  const statusValue = (device.status ?? '').toString().toLowerCase();
  const statusIsOnline =
    statusValue === 'online' ||
    statusValue === 'active' ||
    statusValue === 'busy' ||
    statusValue === 'active_online' ||
    (statusValue.includes('online') && !statusValue.includes('offline'));
  const statusIsStandby = statusValue === 'standby';

  const isOnlineFlag = (() => {
    if (typeof device.isOnline === 'boolean') {
      return device.isOnline;
    }
    if (typeof device.isOnline === 'string') {
      const normalized = device.isOnline.trim().toLowerCase();
      if (['false', '0', 'no', 'off'].includes(normalized)) {
        return false;
      }
      if (['true', '1', 'yes', 'on'].includes(normalized)) {
        return true;
      }
    }
    return Boolean(device.isOnline);
  })();
  const rawStatus = (device.gameStatus ?? device.status ?? '').toString().toLowerCase();
  const lastSeen = typeof device.lastSeen === 'number' && Number.isFinite(device.lastSeen) ? device.lastSeen : 0;
  const recentlySeen = lastSeen > 0 && Date.now() - lastSeen <= DEVICE_ONLINE_STALE_THRESHOLD_MS;
  const targetIndicatesOnline =
    matchingTarget?.status === 'online' ||
    matchingTarget?.status === 'standby' ||
    matchingTarget?.status === 'active';

  const derivedIsOnline = isOnlineFlag || statusIsOnline || statusIsStandby || targetIndicatesOnline || recentlySeen;

  let derivedStatus: DeviceStatus['gameStatus'] = 'idle';
  let statusLabel: NormalizedGameDevice['statusLabel'] = 'idle';

  if (!derivedIsOnline) {
    derivedStatus = 'offline';
    statusLabel = 'offline';
  } else if (rawStatus === 'start' || rawStatus === 'busy') {
    derivedStatus = 'start';
    statusLabel = 'active';
  } else if (rawStatus === 'stop') {
    derivedStatus = 'stop';
    statusLabel = 'stopped';
  } else {
    derivedStatus = 'idle';
    statusLabel = 'idle';
  }

  const ambientValue = (device.ambientLight ?? '').toString().toLowerCase();
  let ambientLight: DeviceStatus['ambientLight'];
  if (ambientValue === 'average') {
    ambientLight = 'average';
  } else if (ambientValue === 'poor') {
    ambientLight = 'poor';
  } else {
    ambientLight = 'good';
  }

  const wifiSource =
    matchingTarget?.wifiStrength ??
    (Number.isFinite(Number(device.wifiStrength)) ? Number(device.wifiStrength) : null);
  const wifiStrength = Number.isFinite(Number(wifiSource))
    ? Math.max(0, Math.round(Number(wifiSource)))
    : 0;
  const hitCount = Number.isFinite(Number(device.hitCount)) ? Number(device.hitCount) : 0;

  return {
    deviceId: device.deviceId,
    name: matchingTarget?.name ?? device.name,
    gameStatus: derivedStatus,
    wifiStrength,
    ambientLight,
    hitCount,
    lastSeen,
    isOnline: derivedIsOnline,
    hitTimes: [],
    raw: device,
    gameId: device.gameId ?? null,
    statusLabel,
  };
}

// Centralised fetch/refresh hook for the games dashboard so every consumer works off the same throttled, memoised device snapshot.
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
        const { devices: edgeDevices, fetchedAt } = await fetchGameControlDevices();
        const normalized = edgeDevices.map(normalizeGameDevice);
        setDevices(normalized);
        setLastFetched(fetchedAt);
        setError(null);
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

  const memoizedDevices = useMemo(() => devices, [devices]);

  // Runs the edge "info" RPC and merges the returned telemetry into local device state without resetting the full list.
  const pollInfo = useCallback(
    async (deviceIds: string[]) => {
      if (!Array.isArray(deviceIds) || deviceIds.length === 0) {
        return null;
      }

      try {
        const response = await fetchGameControlInfo(deviceIds);
        const infoAt = response.infoAt ?? Date.now();
        const infoById = new Map<string, Record<string, unknown>>();

        for (const result of response.results ?? []) {
          if (result?.success) {
            infoById.set(result.deviceId, (result.data ?? {}) as Record<string, unknown>);
          }
        }

        if (infoById.size === 0) {
          return null;
        }

        let updatedDevices: NormalizedGameDevice[] = [];

        setDevices((prevDevices) => {
          if (prevDevices.length === 0) {
            updatedDevices = prevDevices;
            return prevDevices;
          }

          const nextDevices = prevDevices.map((device) => {
            const info = infoById.get(device.deviceId);
            if (!info) {
              return device;
            }

            let wifiStrength = device.wifiStrength;
            if (typeof info.wifiStrength === 'number') {
              wifiStrength = Math.max(0, Math.round(info.wifiStrength));
            } else if (typeof info.wifiStrength === 'string') {
              const numeric = Number(info.wifiStrength);
              if (Number.isFinite(numeric)) {
                wifiStrength = Math.max(0, Math.round(numeric));
              }
            }

            let ambientLight = device.ambientLight;
            if (typeof info.ambientLight === 'string') {
              const normalised = info.ambientLight.toLowerCase();
              if (normalised === 'average' || normalised === 'poor') {
                ambientLight = normalised;
              } else if (normalised === 'good') {
                ambientLight = 'good';
              }
            }

            let gameStatus = device.gameStatus;
            const statusSource = typeof info.gameStatus === 'string'
              ? info.gameStatus
              : typeof info.status === 'string'
                ? info.status
                : null;

            if (statusSource) {
              const lowered = statusSource.toLowerCase();
              if (lowered === 'start' || lowered === 'busy') {
                gameStatus = 'start';
              } else if (lowered === 'stop') {
                gameStatus = 'stop';
              } else if (lowered === 'idle') {
                gameStatus = 'idle';
              }
            }

            const infoLastSeen = typeof info.lastSeen === 'number'
              ? info.lastSeen
              : typeof info.ts === 'number'
                ? info.ts
                : typeof info.timestamp === 'number'
                  ? info.timestamp
                  : null;
            const lastSeen = infoLastSeen !== null && Number.isFinite(infoLastSeen)
              ? infoLastSeen
              : infoAt;
            const rawOnline = typeof info.isOnline === 'boolean'
              ? info.isOnline
              : device.isOnline;
            const recentlySeen = lastSeen > 0 && Date.now() - lastSeen <= DEVICE_ONLINE_STALE_THRESHOLD_MS;
            const isOnline = rawOnline || recentlySeen || gameStatus === 'start';

            const updated: NormalizedGameDevice = {
              ...device,
              wifiStrength,
              ambientLight,
              gameStatus,
              isOnline,
              lastSeen,
              statusLabel: !isOnline
                ? 'offline'
                : gameStatus === 'start'
                  ? 'active'
                  : gameStatus === 'stop'
                    ? 'stopped'
                    : 'idle',
              raw: {
                ...device.raw,
                wifiStrength,
                ambientLight,
                status: typeof info.status === 'string' ? info.status : device.raw.status,
                gameStatus: typeof info.gameStatus === 'string' ? info.gameStatus : device.raw.gameStatus,
                isOnline,
                lastSeen,
              },
            };

            return updated;
          });

          updatedDevices = nextDevices;
          return nextDevices;
        });

        if (updatedDevices.length === 0) {
          return null;
        }

        setLastFetched(infoAt);
        setError(null);
        return { devices: updatedDevices, fetchedAt: infoAt };
      } catch (err) {
        const errorInstance = err instanceof Error ? err : new Error(String(err));
        setError(errorInstance);
        throw errorInstance;
      }
    },
    [],
  );

  return {
    devices: memoizedDevices,
    lastFetched,
    isLoading,
    error,
    refresh,
    pollInfo,
  };
}
