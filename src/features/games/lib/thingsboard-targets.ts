import type { Target } from '@/features/targets/schema';

/**
 * WARNING: This ThingsBoard-specific target hydration is intended solely
 * for the Games workflow (hooks/services living alongside the Games page).
 * Other features must consume data via Supabase edge helpers (see src/lib/edge.ts).
 */
import { supabase } from '@/data/supabase-client';
import {
  getTenantDevices,
  getDeviceTelemetry,
  getHistoricalTelemetry,
  getBatchServerAttributes,
  setAuthToken,
  isAxiosNetworkError,
  type ThingsboardDevice,
} from './thingsboard-client';
import { logger } from '@/shared/lib/logger';

interface ThingsboardSessionResponse {
  token: string;
  issuedAt: number;
  expiresAt: number;
  expiresIn: number;
}

export interface TargetsSummary {
  totalTargets: number;
  onlineTargets: number;
  standbyTargets: number;
  offlineTargets: number;
  assignedTargets: number;
  unassignedTargets: number;
  totalRooms: number;
  lastUpdated: number;
}

export interface TargetDetail {
  deviceId: string;
  status: 'online' | 'standby' | 'offline';
  activityStatus: 'active' | 'recent' | 'standby';
  lastShotTime: number | null;
  totalShots: number;
  recentShotsCount: number;
  telemetry: Record<string, any>;
  history?: Record<string, any>;
  battery?: number | null;
  wifiStrength?: number | null;
  lastEvent?: string | null;
  gameStatus?: string | null;
  errors?: string[];
}

export interface TargetDetailsOptions {
  force?: boolean;
  includeHistory?: boolean;
  historyRangeMs?: number;
  historyLimit?: number;
  telemetryKeys?: string[];
  historyKeys?: string[];
  recentWindowMs?: number;
}

type TelemetrySeriesEntry = { ts?: number; value?: unknown } | [number, unknown] | number | string | null | undefined;

const TELEMETRY_KEYS = ['hits', 'hit_ts', 'battery', 'wifiStrength', 'event', 'gameStatus', 'gameId'];
const telemetryErrorLogState = new Map<string, number>();
const DEFAULT_HISTORY_KEYS = ['hits', 'hit_ts'];
const ACTIVE_THRESHOLD_MS = 30_000;
// 12 hours – must match scripts/check-online-targets-thingsboard.sh RECENT_MS and edge targets-with-telemetry
const RECENT_THRESHOLD_MS = 43200_000;
const DEFAULT_HISTORY_RANGE_MS = 24 * 60 * 60 * 1000;
const DEFAULT_HISTORY_LIMIT = 500;
const DEFAULT_RECENT_WINDOW_MS = 5 * 60 * 1000;
const TOKEN_REFRESH_BUFFER_MS = 60_000;

// Deduplication for fetchTargetsWithTelemetry to prevent redundant concurrent calls
let pendingFetchTargetsPromise: Promise<{ targets: Target[]; summary: TargetsSummary | null; cached: boolean }> | null = null;

let cachedSession: ThingsboardSessionResponse | null = null;
let inflightSessionPromise: Promise<void> | null = null;

const toNumber = (value: unknown): number | null => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  if (value && typeof value === 'object' && 'value' in (value as Record<string, unknown>)) {
    return toNumber((value as { value: unknown }).value);
  }
  return null;
};

const toStringValue = (value: unknown): string | null => {
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number') {
    return String(value);
  }
  if (value && typeof value === 'object' && 'value' in (value as Record<string, unknown>)) {
    return toStringValue((value as { value: unknown }).value);
  }
  return null;
};

const toTimestamp = (entry: TelemetrySeriesEntry): number | null => {
  if (!entry) {
    return null;
  }
  if (Array.isArray(entry)) {
    const [first] = entry;
    return typeof first === 'number' ? first : null;
  }
  if (typeof entry === 'object' && entry !== null && 'ts' in entry) {
    const ts = (entry as { ts?: unknown }).ts;
    return typeof ts === 'number' ? ts : toNumber(ts);
  }
  if (typeof entry === 'number') {
    return entry;
  }
  return null;
};

const latestSeriesEntry = (series: unknown): TelemetrySeriesEntry => {
  if (Array.isArray(series) && series.length > 0) {
    return series[0] as TelemetrySeriesEntry;
  }
  return series as TelemetrySeriesEntry;
};

// Matches edge _shared/deviceStatus.ts and scripts/check-online-targets-thingsboard.sh
//
// Status semantics:
//   - online  = device is in an active game session (gameStatus is start/busy/active)
//   - standby = device is powered on / recently active, but NOT in a game
//   - offline = device hasn't been seen for >12 hours
//
// IMPORTANT: ThingsBoard's rawStatus ("ACTIVE"/"INACTIVE") indicates *connection*
// state, NOT game state. Only gameStatus determines true "online" status.
export const determineStatus = (
  _rawStatus: string | null,
  gameStatus: string | null,
  _lastShotTime: number | null,
  isActiveFromTb: boolean | null,
  lastActivityTime: number | null,
): 'online' | 'offline' | 'standby' => {
  const now = Date.now();
  const hasRecentActivity =
    lastActivityTime != null && now - lastActivityTime <= RECENT_THRESHOLD_MS;

  // STEP 1: gameStatus is the ONLY reliable indicator of an active game session.
  if (gameStatus && ['start', 'busy', 'active'].includes(String(gameStatus).toLowerCase())) {
    return 'online';
  }

  // STEP 2: Device is explicitly disconnected (active === false).
  if (isActiveFromTb === false) {
    if (hasRecentActivity) return 'standby';
    return 'offline';
  }

  // STEP 3: Device is connected (active === true).
  // Connected but not in a game → standby (if recently active) or offline.
  if (isActiveFromTb === true) {
    if (hasRecentActivity) return 'standby';
    return 'offline';
  }

  // STEP 4: active is null/unknown — fall back to lastActivityTime.
  if (hasRecentActivity) return 'standby';
  return 'offline';
};

const determineActivityStatus = (lastShotTime: number | null): 'active' | 'recent' | 'standby' => {
  if (!lastShotTime) {
    return 'standby';
  }
  const delta = Date.now() - lastShotTime;
  if (delta <= ACTIVE_THRESHOLD_MS) {
    return 'active';
  }
  if (delta <= RECENT_THRESHOLD_MS) {
    return 'recent';
  }
  return 'standby';
};

const ensureAuthToken = async (): Promise<void> => {
  const now = Date.now();
  if (cachedSession && cachedSession.expiresAt - TOKEN_REFRESH_BUFFER_MS > now) {
    setAuthToken(cachedSession.token);
    return;
  }

  if (inflightSessionPromise) {
    await inflightSessionPromise;
    return;
  }

  inflightSessionPromise = (async () => {
    const { data, error } = await supabase.functions.invoke<ThingsboardSessionResponse>('thingsboard-session', {
      method: 'GET',
    });

    if (error || !data) {
      cachedSession = null;
      throw error ?? new Error('Failed to obtain ThingsBoard session');
    }

    cachedSession = data;
    setAuthToken(data.token);
  })();

  try {
    await inflightSessionPromise;
  } finally {
    inflightSessionPromise = null;
  }
};

const loadUserContext = async (): Promise<{
  roomNameById: Map<string, string>;
  assignmentByTarget: Map<string, string>;
}> => {
  const roomNameById = new Map<string, string>();
  const assignmentByTarget = new Map<string, string>();

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    return { roomNameById, assignmentByTarget };
  }

  const userId = user.id;

  const [{ data: rooms, error: roomsError }, { data: assignments, error: assignmentsError }] = await Promise.all([
    supabase
      .from('user_rooms')
      .select('id,name')
      .eq('user_id', userId),
    supabase
      .from('user_room_targets')
      .select('target_id,room_id')
      .eq('user_id', userId),
  ]);

  if (!roomsError && Array.isArray(rooms)) {
    rooms.forEach((room) => {
      if (room?.id) {
        roomNameById.set(String(room.id), room.name ?? 'Room');
      }
    });
  }

  if (!assignmentsError && Array.isArray(assignments)) {
    assignments.forEach((assignment) => {
      if (assignment?.target_id && assignment?.room_id) {
        assignmentByTarget.set(String(assignment.target_id), String(assignment.room_id));
      }
    });
  }

  return { roomNameById, assignmentByTarget };
};

const collectDevices = async (): Promise<ThingsboardDevice[]> => {
  const devices: ThingsboardDevice[] = [];
  let page = 0;
  const pageSize = 100;
  let hasNext = true;

  while (hasNext) {
    const params = new URLSearchParams({
      pageSize: String(pageSize),
      page: String(page),
    });
    const payload = await getTenantDevices(params);
    const batch = payload.data ?? [];
    devices.push(...batch);

    if (typeof payload.totalPages === 'number') {
      hasNext = page + 1 < payload.totalPages;
    } else if (typeof payload.hasNext === 'boolean') {
      hasNext = payload.hasNext;
    } else {
      hasNext = batch.length === pageSize;
    }

    page += 1;
  }

  return devices;
};

const fetchTelemetryForDevices = async (deviceIds: string[], keys: string[], limit = 5): Promise<Map<string, Record<string, unknown>>> => {
  const startTime = performance.now();
  const telemetryById = new Map<string, Record<string, unknown>>();

  // Process devices sequentially - rate limiter will handle throttling via acquire()
  // No artificial delays needed - the rate limiter queues requests when tokens are exhausted
  for (let i = 0; i < deviceIds.length; i++) {
    const deviceId = deviceIds[i];

    let attempts = 0;
    while (attempts < 2) {
      attempts += 1;
      try {
        // Rate limiter's acquire() will wait/queue if tokens aren't available
        const telemetry = await getDeviceTelemetry(deviceId, keys, limit);
        telemetryById.set(deviceId, telemetry ?? {});
        break; // Success, exit retry loop
      } catch (error) {
        if (attempts >= 2) {
          const now = Date.now();
          const last = telemetryErrorLogState.get(deviceId) ?? 0;
          if (now - last > 10_000) {
            if (isAxiosNetworkError(error)) {
              // Network errors are expected - only log in dev mode
              if (import.meta.env.DEV) {
                console.debug(`[targets] Telemetry fetch skipped for ${deviceId} due to network issue (handled gracefully)`);
              }
            } else {
              console.warn(`[targets] Failed to fetch telemetry for ${deviceId}`, error);
            }
            telemetryErrorLogState.set(deviceId, now);
          }
          telemetryById.set(deviceId, {});
        } else {
          // Retry delay only for retries, not for rate limiting
          await new Promise((resolve) => setTimeout(resolve, 300));
        }
      }
    }
  }
  
  const duration = performance.now() - startTime;
  if (deviceIds.length > 10) {
    logger.info('⚡ [Performance] fetchTelemetryForDevices', {
      deviceCount: deviceIds.length,
      duration: `${duration.toFixed(2)}ms`,
      avgPerDevice: `${(duration / deviceIds.length).toFixed(2)}ms`,
    });
  }
  
  return telemetryById;
};

const mapDeviceToTarget = (
  device: ThingsboardDevice,
  telemetry: Record<string, unknown>,
  assignmentByTarget: Map<string, string>,
): Target => {
  const deviceId = device.id?.id ?? String(device.id);
  const hitsEntry = latestSeriesEntry(telemetry.hits);
  const hitTsEntry = latestSeriesEntry(telemetry.hit_ts);
  const batteryEntry = latestSeriesEntry(telemetry.battery);
  const wifiEntry = latestSeriesEntry(telemetry.wifiStrength);
  const eventEntry = latestSeriesEntry(telemetry.event);
  const gameStatusEntry = latestSeriesEntry(telemetry.gameStatus);
  const gameIdEntry = latestSeriesEntry(telemetry.gameId);
  const gameNameEntry = latestSeriesEntry((telemetry as Record<string, unknown>).game_name);

  const lastShotTime =
    toTimestamp(hitTsEntry) ??
    toTimestamp(hitsEntry) ??
    null;
  const activityStatus = determineActivityStatus(lastShotTime);
  const lastEvent = toStringValue(eventEntry);
  const gameStatus = toStringValue(gameStatusEntry);
  const totalShots = toNumber(hitsEntry) ?? 0;
  const wifiStrength = toNumber(wifiEntry);
  const battery = toNumber(batteryEntry);
  const roomId = assignmentByTarget.get(deviceId) ?? null;

  // Get ThingsBoard's actual connection status from server-side attributes
  const isActiveFromTb = typeof device.active === 'boolean' ? device.active : null;
  const lastActivityTimeFromTb = device.lastActivityTime ?? null;

  const status = determineStatus(
    device.status ? String(device.status) : null,
    gameStatus,
    lastShotTime,
    isActiveFromTb,
    lastActivityTimeFromTb,
  );

  // Debug logging for ThingsBoard connection status
  if (isActiveFromTb !== null) {
    const icon = status === 'offline' ? '🔴' : status === 'online' ? '🟢' : '🟡';
    console.debug(
      `${icon} [TB Status] ${device.name}: active=${isActiveFromTb}, status=${status}, ` +
      `lastActivity=${lastActivityTimeFromTb ? new Date(lastActivityTimeFromTb).toISOString() : 'none'}`
    );
  }

  return {
    id: deviceId,
    name: device.name ?? 'Unknown Target',
    status,
    battery,
    wifiStrength,
    roomId,
    telemetry,
    telemetryHistory: undefined,
    lastEvent,
    lastGameId: toStringValue(gameIdEntry),
    lastGameName: toStringValue(gameNameEntry),
    lastHits: totalShots,
    lastActivity: lastEvent,
    lastActivityTime: lastActivityTimeFromTb ?? lastShotTime, // Prefer TB's lastActivityTime
    lastShotTime,
    totalShots,
    recentShotsCount: 0,
    activityStatus,
    gameStatus,
    errors: undefined,
    deviceName: device.name,
    deviceType: device.type ?? undefined,
    createdTime: (device as unknown as { createdTime?: number }).createdTime ?? null,
    additionalInfo: (device as unknown as { additionalInfo?: Record<string, unknown> }).additionalInfo ?? {},
    type: device.type ?? undefined,
    isNoDataMessage: false,
    isErrorMessage: false,
    message: undefined,
  };
};

/**
 * @deprecated Use `fetchTargetsWithTelemetry` from `@/lib/edge` instead.
 * Direct ThingsBoard fetching is no longer used for Games setup — the edge
 * function provides the same data server-side with caching (~500ms vs ~3500ms).
 * Kept only for reference; `determineStatus` is still actively used by tests.
 */
export const fetchTargetsWithTelemetry = async (
  _force = false,
): Promise<{ targets: Target[]; summary: TargetsSummary | null; cached: boolean }> => {
  // Deduplicate concurrent calls - if a request is already in flight, return the same promise
  // Even with force=true, we should deduplicate concurrent calls to avoid redundant expensive operations
  if (pendingFetchTargetsPromise) {
    return pendingFetchTargetsPromise;
  }
  
  const fetchPromise = (async () => {
    try {
      await ensureAuthToken();
      const devices = await collectDevices();
      const deviceIds = devices.map((device) => device.id?.id ?? String(device.id));

      const fetchStartTime = performance.now();

      // Fetch both telemetry and server-side attributes in parallel for better performance
      // Rate limiter will handle throttling automatically via acquire() for both operations
      let telemetryDuration = 0;
      let attributesDuration = 0;
      const [telemetryById, serverAttributesById] = await Promise.all([
        (async () => {
          const telemetryStartTime = performance.now();
          const result = await fetchTelemetryForDevices(deviceIds, TELEMETRY_KEYS, 5);
          telemetryDuration = performance.now() - telemetryStartTime;
          return result;
        })(),
        (async () => {
          const attributesStartTime = performance.now();
          const result = await getBatchServerAttributes(deviceIds, ['active', 'lastActivityTime', 'lastConnectTime', 'lastDisconnectTime', 'inactivityTimeout']);
          attributesDuration = performance.now() - attributesStartTime;
          return result;
        })(),
      ]);
      const totalDuration = performance.now() - fetchStartTime;
      
      logger.info('⚡ [Performance] fetchTargetsWithTelemetry (ThingsBoard)', {
        deviceCount: deviceIds.length,
        telemetryDuration: `${telemetryDuration.toFixed(2)}ms`,
        attributesDuration: `${attributesDuration.toFixed(2)}ms`,
        totalDuration: `${totalDuration.toFixed(2)}ms`,
      });
      
      const { assignmentByTarget, roomNameById } = await loadUserContext();

      // Merge server attributes into device objects
      const devicesWithAttributes = devices.map((device) => {
        const deviceId = device.id?.id ?? String(device.id);
        const attributes = serverAttributesById.get(deviceId) ?? {};
        return {
          ...device,
          active: attributes.active,
          lastActivityTime: attributes.lastActivityTime,
          lastConnectTime: attributes.lastConnectTime,
          lastDisconnectTime: attributes.lastDisconnectTime,
          inactivityTimeout: attributes.inactivityTimeout,
        };
      });

      const targets = devicesWithAttributes.map((device) => {
        const deviceId = device.id?.id ?? String(device.id);
        const telemetry = telemetryById.get(deviceId) ?? {};
        const target = mapDeviceToTarget(device, telemetry, assignmentByTarget);
        target.roomId = assignmentByTarget.get(deviceId) ?? null;
        if (target.roomId && roomNameById.has(target.roomId)) {
          target.additionalInfo = {
            ...target.additionalInfo,
            roomName: roomNameById.get(target.roomId) ?? target.additionalInfo?.roomName,
          };
        }
        return target;
      });

      const totalTargets = targets.length;
      const onlineTargets = targets.filter((target) => target.status === 'online').length;
      const standbyTargets = targets.filter((target) => target.status === 'standby').length;
      const assignedTargets = targets.filter((target) => target.roomId).length;
      const offlineTargets = totalTargets - onlineTargets - standbyTargets;
      const unassignedTargets = totalTargets - assignedTargets;

      const summary: TargetsSummary = {
        totalTargets,
        onlineTargets,
        standbyTargets,
        offlineTargets,
        assignedTargets,
        unassignedTargets,
        totalRooms: roomNameById.size,
        lastUpdated: Date.now(),
      };

      return {
        targets,
        summary,
        cached: false,
      };
    } finally {
      // Clear the pending promise when done
      if (pendingFetchTargetsPromise === fetchPromise) {
        pendingFetchTargetsPromise = null;
      }
    }
  })();
  
  // Store the promise for deduplication (always, to prevent concurrent calls)
  pendingFetchTargetsPromise = fetchPromise;
  
  return fetchPromise;
};

/**
 * @deprecated Use `fetchTargetDetails` from `@/lib/edge` instead.
 * Direct ThingsBoard fetching is no longer used — the edge function
 * `target-details` provides the same data server-side.
 */
export const fetchTargetDetails = async (
  deviceIds: string[],
  options: TargetDetailsOptions = {},
): Promise<{ details: TargetDetail[]; cached: boolean }> => {
  if (deviceIds.length === 0) {
    return { details: [], cached: false };
  }

  await ensureAuthToken();

  const telemetryKeys =
    Array.isArray(options.telemetryKeys) && options.telemetryKeys.length > 0
      ? options.telemetryKeys
      : TELEMETRY_KEYS;

  const includeHistory = options.includeHistory !== false;
  const historyRangeMs = typeof options.historyRangeMs === 'number' ? options.historyRangeMs : DEFAULT_HISTORY_RANGE_MS;
  const historyLimit = typeof options.historyLimit === 'number' ? options.historyLimit : DEFAULT_HISTORY_LIMIT;
  const historyKeys =
    Array.isArray(options.historyKeys) && options.historyKeys.length > 0
      ? options.historyKeys
      : DEFAULT_HISTORY_KEYS;
  const recentWindowMs = typeof options.recentWindowMs === 'number' ? options.recentWindowMs : DEFAULT_RECENT_WINDOW_MS;

  const telemetryById = new Map<string, Record<string, unknown>>();
  const serverAttributesById = new Map<string, Record<string, any>>();
  const errorMap = new Map<string, string[]>();

  // Fetch both telemetry and server-side attributes in parallel
  await Promise.all([
    // Fetch telemetry
    Promise.all(
      deviceIds.map(async (deviceId) => {
        try {
          const telemetry = await getDeviceTelemetry(deviceId, telemetryKeys, 5);
          telemetryById.set(deviceId, telemetry ?? {});
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          errorMap.set(deviceId, [message]);
          telemetryById.set(deviceId, {});
        }
      }),
    ),
    // Fetch server-side attributes
    (async () => {
      try {
        const attributes = await getBatchServerAttributes(deviceIds, ['active', 'lastActivityTime', 'lastConnectTime', 'lastDisconnectTime']);
        attributes.forEach((attrs, deviceId) => {
          serverAttributesById.set(deviceId, attrs);
        });
      } catch (error) {
        console.warn('[fetchTargetDetails] Failed to fetch server attributes:', error);
      }
    })(),
  ]);

  const historyById = new Map<string, Record<string, unknown>>();
  if (includeHistory) {
    const now = Date.now();
    const startTs = Math.max(0, now - historyRangeMs);

    await Promise.all(
      deviceIds.map(async (deviceId) => {
        try {
          const history = await getHistoricalTelemetry(deviceId, historyKeys, startTs, now, historyLimit);
          historyById.set(deviceId, history ?? {});
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          const existing = errorMap.get(deviceId) ?? [];
          existing.push(message);
          errorMap.set(deviceId, existing);
        }
      }),
    );
  }

  const details = deviceIds.map((deviceId) => {
    const telemetry = telemetryById.get(deviceId) ?? {};
    const history = includeHistory ? historyById.get(deviceId) : undefined;
    const serverAttributes = serverAttributesById.get(deviceId) ?? {};
    
    const hitsEntry = latestSeriesEntry(telemetry.hits);
    const hitTsEntry = latestSeriesEntry(telemetry.hit_ts);
    const batteryEntry = latestSeriesEntry(telemetry.battery);
    const wifiEntry = latestSeriesEntry(telemetry.wifiStrength);
    const eventEntry = latestSeriesEntry(telemetry.event);
    const gameStatusEntry = latestSeriesEntry(telemetry.gameStatus);

    const lastShotTime =
      toTimestamp(hitTsEntry) ??
      toTimestamp(hitsEntry) ??
      null;
    const totalShots = toNumber(hitsEntry) ?? 0;
    const activityStatus = determineActivityStatus(lastShotTime);
    const gameStatus = toStringValue(gameStatusEntry);
    
    // Get ThingsBoard's actual connection status
    const isActiveFromTb = typeof serverAttributes.active === 'boolean' ? serverAttributes.active : null;
    const lastActivityTimeFromTb = serverAttributes.lastActivityTime ?? null;
    
    const status = determineStatus(null, gameStatus, lastShotTime, isActiveFromTb, lastActivityTimeFromTb);

    let recentShotsCount = 0;
    if (includeHistory && history) {
      const cutoff = Date.now() - recentWindowMs;
      if (Array.isArray(history.hit_ts)) {
        recentShotsCount = (history.hit_ts as Array<{ ts?: number }>)
          .filter((entry) => typeof entry.ts === 'number' && entry.ts >= cutoff)
          .length;
      } else if (Array.isArray(history.hits) && history.hits.length >= 2) {
        const first = toNumber((history.hits[0] as { value?: unknown }).value ?? history.hits[0]);
        const last = toNumber(
          (history.hits[history.hits.length - 1] as { value?: unknown }).value ??
            history.hits[history.hits.length - 1],
        );
        if (first !== null && last !== null) {
          recentShotsCount = Math.max(0, last - first);
        }
      }
    }

    return {
      deviceId,
      status,
      activityStatus,
      lastShotTime,
      totalShots,
      recentShotsCount,
      telemetry,
      history,
      battery: toNumber(batteryEntry),
      wifiStrength: toNumber(wifiEntry),
      lastEvent: toStringValue(eventEntry),
      gameStatus,
      errors: errorMap.get(deviceId),
    };
  });

  return {
    details,
    cached: false,
  };
};

