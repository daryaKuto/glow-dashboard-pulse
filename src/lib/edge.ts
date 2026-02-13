import { supabase } from '@/data/supabase-client';
import type { Target } from '@/features/targets/schema';
import { getRateLimiter } from '@/shared/lib/rate-limit-config';
import { RateLimitMonitor } from '@/shared/lib/rate-limit-monitor';
import { throttledLog, throttledLogOnChange } from '@/utils/log-throttle';
import { logger } from '@/shared/lib/logger';

/**
 * Rate-limited wrapper for Supabase edge function calls.
 * Acquires a token from the rate limiter before making the request.
 */
async function rateLimitedEdgeCall<T>(
  functionName: string,
  options: Parameters<typeof supabase.functions.invoke>[1]
): Promise<ReturnType<typeof supabase.functions.invoke<T>>> {
  const limiter = getRateLimiter('SUPABASE_EDGE');
  
  if (limiter) {
    const status = limiter.getStatus();

    // Record warning if approaching limit
    if (status.isLimited) {
      RateLimitMonitor.recordHit('SUPABASE_EDGE', status.availableTokens, status.queuedRequests);
    }
    
    try {
      await limiter.acquire();
    } catch (error) {
      // Log rate limit error but don't block the request entirely
      logger.warn(`[Edge] Rate limit exceeded for ${functionName}`, error);
      RateLimitMonitor.recordHit('SUPABASE_EDGE', 0, status.queuedRequests);
      // Re-throw to let caller handle the rate limit error
      throw error;
    }
  }
  
  const result = await supabase.functions.invoke<T>(functionName, options);
  return result;
}

interface TargetsFunctionResponse {
  data?: Array<Record<string, any>>;
  cached?: boolean;
  summary?: TargetsSummaryPayload;
}

interface TargetsSummaryPayload {
  totalTargets?: number;
  onlineTargets?: number;
  standbyTargets?: number;
  offlineTargets?: number;
  assignedTargets?: number;
  unassignedTargets?: number;
  totalRooms?: number;
  lastUpdated?: number;
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

export interface DashboardMetricsTotals {
  totalSessions: number;
  bestScore: number | null;
  avgScore: number | null;
}

export interface DashboardRecentSession {
  id: string;
  started_at: string;
  score: number;
  hit_count: number;
  duration_ms: number;
  accuracy_percentage: number | null;
}

export interface DashboardMetricsData {
  summary: TargetsSummary;
  totals: DashboardMetricsTotals;
  recentSessions: DashboardRecentSession[];
  generatedAt: number;
}

export interface ThingsboardSession {
  token: string;
  issuedAt: number;
  expiresAt: number;
  expiresIn: number;
}

type ThingsboardSessionOptions = {
  force?: boolean;
  invalidate?: boolean;
};

const MIN_SESSION_BUFFER_MS = 60_000;

// Deduplication for fetchTargetsWithTelemetry edge function calls
const pendingEdgeFetchTargets = new Map<string, Promise<{ targets: Target[]; cached: boolean; summary: TargetsSummary | null }>>();

let cachedThingsboardSession:
  | {
      session: ThingsboardSession;
    }
  | null = null;

const getSupabaseAuthHeaders = async (): Promise<Record<string, string>> => {
  const headers: Record<string, string> = {};
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
  } catch (sessionError) {
    logger.warn('[Edge] Unable to retrieve Supabase session before edge function call', sessionError);
  }
  return headers;
};

const isSessionFresh = (session: ThingsboardSession): boolean => {
  return session.expiresAt - Date.now() > MIN_SESSION_BUFFER_MS;
};

const mapSummary = (summary?: TargetsSummaryPayload | null): TargetsSummary | null => {
  if (!summary) {
    return null;
  }

  return {
    totalTargets: Number(summary.totalTargets ?? 0),
    onlineTargets: Number(summary.onlineTargets ?? 0),
    standbyTargets: Number(summary.standbyTargets ?? 0),
    offlineTargets: Number(summary.offlineTargets ?? 0),
    assignedTargets: Number(summary.assignedTargets ?? 0),
    unassignedTargets: Number(summary.unassignedTargets ?? 0),
    totalRooms: Number(summary.totalRooms ?? 0),
    lastUpdated: Number(summary.lastUpdated ?? Date.now()),
  };
};

interface RoomsFunctionResponse {
  rooms?: Array<Record<string, any>>;
  unassignedTargets?: Array<Record<string, any>>;
  cached?: boolean;
}

/** 12 hours. Must match scripts/check-online-targets-thingsboard.sh RECENT_MS and edge/thingsboard-targets RECENT_THRESHOLD_MS. */
const RECENT_THRESHOLD_MS = 43200_000;

/**
 * Derive display status from raw ThingsBoard data.
 *
 * Status semantics:
 *   - **online**  = device is in an active game session (gameStatus is start/busy/active)
 *   - **standby** = device is powered on / recently active, but NOT in a game
 *   - **offline** = device hasn't been seen for >12 hours
 *
 * IMPORTANT: ThingsBoard's `rawStatus` ("ACTIVE"/"INACTIVE") indicates *connection*
 * state, NOT game state. Only `gameStatus` determines true "online" status.
 *
 * Mirrors `determineStatus` in _shared/deviceStatus.ts (edge) and
 * `compute_status` in scripts/check-online-targets-thingsboard.sh.
 */
export function deriveStatusFromRaw(
  raw: {
    rawStatus?: string | null;
    active?: boolean | null;
    tbLastActivityTime?: number | null;
    gameStatus?: string | null;
  }
): 'online' | 'standby' | 'offline' | null {
  const { active, tbLastActivityTime, gameStatus } = raw;
  const hasRaw = active !== undefined && active !== null;
  const now = Date.now();
  const hasRecentActivity =
    tbLastActivityTime != null && now - tbLastActivityTime <= RECENT_THRESHOLD_MS;

  // STEP 1: gameStatus is the ONLY reliable indicator of an active game session.
  if (gameStatus && ['start', 'busy', 'active'].includes(String(gameStatus).toLowerCase())) {
    return 'online';
  }

  // STEP 2: Device is explicitly disconnected (active === false).
  if (hasRaw && active === false) {
    if (hasRecentActivity) return 'standby';
    return 'offline';
  }

  // STEP 3: Device is connected (active === true).
  // Connected but not in a game → standby (if recently active) or offline.
  if (hasRaw && active === true) {
    if (hasRecentActivity) return 'standby';
    return 'offline';
  }

  // STEP 4: active is null/unknown — fall back to lastActivityTime.
  if (hasRecentActivity) return 'standby';
  return 'offline';
}

const sanitizeStatus = (status: unknown): 'online' | 'standby' | 'offline' => {
  const statusText = typeof status === 'string' ? status.toLowerCase() : '';
  if (statusText === 'online') return 'online';
  // "active" from ThingsBoard means connected, NOT in a game — treat as standby.
  if (statusText === 'active' || statusText === 'active_online') return 'standby';
  if (statusText === 'standby' || statusText === 'idle') return 'standby';
  return 'offline';
};

const coerceRoomId = (value: unknown): string | null => {
  if (typeof value === 'string' && value.length > 0) {
    return value;
  }
  if (typeof value === 'number') {
    return String(value);
  }
  return null;
};

const sanitizeActivityStatus = (value: unknown): 'active' | 'recent' | 'standby' | undefined => {
  if (value === 'active' || value === 'recent' || value === 'standby') return value;
  return undefined;
};

function coerceActive(value: unknown): boolean | null {
  if (value === true || value === false) return value;
  if (value === undefined || value === null) return null;
  const s = String(value).toLowerCase();
  if (s === 'true') return true;
  if (s === 'false') return false;
  return null;
}

/**
 * If the server already derived a valid display status (online/standby/offline),
 * trust it directly. Returns null if the value is not a recognized display status.
 */
function sanitizeActivityStatusToDisplayStatus(value: unknown): 'online' | 'standby' | 'offline' | null {
  if (typeof value !== 'string') return null;
  const v = value.toLowerCase();
  if (v === 'online' || v === 'standby' || v === 'offline') return v;
  return null;
}

export const mapEdgeTarget = (record: Record<string, any>): Target => {
  const rawStatus = record.rawStatus ?? null;
  const active = coerceActive(record.active);
  const tbLastActivityTime = record.tbLastActivityTime ?? null;
  const gameStatus = record.gameStatus ?? null;

  // Trust the server-derived status when it's a valid value (online/standby/offline).
  // The edge function already runs determineStatus() with the full ThingsBoard context.
  // Only fall back to client-side re-derivation when the server doesn't provide a status.
  const serverStatus = sanitizeActivityStatusToDisplayStatus(record.status);
  const status = serverStatus ?? deriveStatusFromRaw({
    rawStatus,
    active,
    tbLastActivityTime,
    gameStatus,
  }) ?? sanitizeStatus(record.status);
  const activityStatus = sanitizeActivityStatus(record.activityStatus)
    ?? (status === 'standby' ? 'standby' : status === 'online' ? 'active' : undefined);

  // Fallback extraction from raw telemetry for fields the edge may not yet return as top-level.
  // Ensures normalizeGameDevice gets correct values regardless of edge function deploy order.
  const telemetry = record.telemetry ?? {};
  const hitsEntry = Array.isArray(telemetry.hits) && telemetry.hits.length > 0 ? telemetry.hits[0] : null;
  const hitsValue = hitsEntry?.value ?? null;
  const totalShotsFromTelemetry = hitsValue != null ? Number(hitsValue) : null;
  const gameIdEntry = Array.isArray(telemetry.gameId) && telemetry.gameId.length > 0 ? telemetry.gameId[0] : null;
  const gameIdFromTelemetry = gameIdEntry?.value != null ? String(gameIdEntry.value) : null;
  const gameStatusEntry = Array.isArray(telemetry.gameStatus) && telemetry.gameStatus.length > 0 ? telemetry.gameStatus[0] : null;
  const gameStatusFromTelemetry = gameStatusEntry?.value != null ? String(gameStatusEntry.value) : null;
  const hitTsEntry = Array.isArray(telemetry.hit_ts) && telemetry.hit_ts.length > 0 ? telemetry.hit_ts[0] : null;
  const lastShotTimeFromTelemetry = typeof hitTsEntry?.ts === 'number' ? hitTsEntry.ts : null;

  return {
    id: String(record.id),
    name: String(record.name ?? 'Unknown Target'),
    status,
    activityStatus,
    rawStatus: typeof rawStatus === 'string' ? rawStatus : null,
    active: typeof active === 'boolean' ? active : null,
    tbLastActivityTime: typeof tbLastActivityTime === 'number' ? tbLastActivityTime : null,
    battery: record.battery ?? null,
    wifiStrength: record.wifiStrength ?? null,
    roomId: coerceRoomId(record.roomId),
    telemetry,
    lastEvent: record.lastEvent ?? null,
    lastGameId: record.lastGameId ?? gameIdFromTelemetry ?? null,
    lastGameName: record.lastGameName ?? null,
    lastHits: record.lastHits ?? (totalShotsFromTelemetry != null && Number.isFinite(totalShotsFromTelemetry) ? totalShotsFromTelemetry : null),
    totalShots: record.totalShots ?? (totalShotsFromTelemetry != null && Number.isFinite(totalShotsFromTelemetry) ? totalShotsFromTelemetry : null),
    lastActivity: record.lastActivity ?? null,
    lastActivityTime: record.lastActivityTime ?? null,
    lastShotTime: record.lastShotTime ?? lastShotTimeFromTelemetry ?? null,
    gameStatus: record.gameStatus ?? gameStatusFromTelemetry ?? null,
    deviceName: record.deviceName ?? record.name ?? 'Unknown Target',
    deviceType: record.type ?? record.deviceType ?? 'default',
    createdTime: record.createdTime ?? null,
    additionalInfo: record.additionalInfo ?? {},
    type: record.type ?? undefined,
    isNoDataMessage: record.isNoDataMessage ?? false,
    isErrorMessage: record.isErrorMessage ?? false,
    message: record.message ?? undefined,
  };
};

export async function fetchTargetsWithTelemetry(force = false): Promise<{ targets: Target[]; cached: boolean; summary: TargetsSummary | null }> {
  // Deduplicate concurrent calls - if a request is already in flight, return the same promise
  // Even with force=true, we should deduplicate concurrent calls to avoid redundant expensive operations
  const cacheKey = 'all'; // Use single cache key to deduplicate all concurrent calls
  if (pendingEdgeFetchTargets.has(cacheKey)) {
    return pendingEdgeFetchTargets.get(cacheKey)!;
  }

  const fetchPromise = (async () => {
    const payload = force ? { force: true } : {};
    const { data, error } = await rateLimitedEdgeCall<TargetsFunctionResponse>('targets-with-telemetry', {
      method: 'POST',
      body: payload,
    });

  if (error) {
    throw error;
  }

  if (!data || !Array.isArray(data.data)) {
    const summary = mapSummary(data?.summary);
    const cached = Boolean(data?.cached);
    logger.info('[Edge] targets-with-telemetry fetched (no list)', {
      supabaseEdgeFunction: 'targets-with-telemetry',
      backingTables: ['public.user_profiles', 'public.user_rooms', 'public.user_room_targets'],
      thingsboardInvolved: true,
      fetchedAt: new Date().toISOString(),
      targetCount: 0,
      cached,
      summary: summary
        ? {
            totalTargets: summary.totalTargets,
            onlineTargets: summary.onlineTargets,
            assignedTargets: summary.assignedTargets,
          }
        : null,
    });
    return { targets: [], cached, summary };
  }

  const targets = data.data.map(mapEdgeTarget);
  const summary = mapSummary(data.summary);

  // Group targets by status with ThingsBoard connection info
  const onlineTargets = targets.filter(t => t.status === 'online' || t.status === 'standby');
  const offlineTargets = targets.filter(t => t.status === 'offline');
  const statusBreakdown = targets.reduce((acc, t) => {
    acc[t.status] = (acc[t.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  // Throttle log to prevent flooding (only log when data changes or every 5 seconds)
  throttledLogOnChange('edge-targets-telemetry', 5000, '[Edge] targets-with-telemetry fetched', {
    supabaseEdgeFunction: 'targets-with-telemetry',
    backingTables: ['public.user_profiles', 'public.user_rooms', 'public.user_room_targets'],
    thingsboardInvolved: true,
    fetchedAt: new Date().toISOString(),
    targetCount: targets.length,
    cached: Boolean(data.cached),
    summary: summary
      ? {
          totalTargets: summary.totalTargets,
          onlineTargets: summary.onlineTargets,
          assignedTargets: summary.assignedTargets,
        }
      : null,
    statusBreakdown,
    connectionStatus: {
      online: `${onlineTargets.length}/${targets.length}`,
      offline: `${offlineTargets.length}/${targets.length}`,
      onlineTargets: onlineTargets.slice(0, 5).map(t => ({
        name: t.name,
        status: t.status,
        lastActivity: t.lastActivityTime ? new Date(t.lastActivityTime).toISOString() : null,
      })),
      offlineTargets: offlineTargets.slice(0, 5).map(t => ({
        name: t.name,
        status: t.status,
        lastActivity: t.lastActivityTime ? new Date(t.lastActivityTime).toISOString() : null,
      })),
    },
    sample: targets.slice(0, 5).map((target) => ({ id: target.id, name: target.name, status: target.status, roomName: target.roomName })),
  });
    return { targets, cached: Boolean(data.cached), summary };
  })();
  
  // Store the promise for deduplication (always, to prevent concurrent calls)
  pendingEdgeFetchTargets.set(cacheKey, fetchPromise);
  fetchPromise.finally(() => {
    // Clear the pending promise when done
    if (pendingEdgeFetchTargets.get(cacheKey) === fetchPromise) {
      pendingEdgeFetchTargets.delete(cacheKey);
    }
  });
  
  return fetchPromise;
}

export async function fetchTargetsSummary(force = false): Promise<{ summary: TargetsSummary | null; cached: boolean }> {
  const payload: Record<string, unknown> = { summary: true };
  if (force) {
    payload.force = true;
  }

  const headers = await getSupabaseAuthHeaders();

  const { data, error } = await rateLimitedEdgeCall<TargetsFunctionResponse>('targets-with-telemetry', {
    method: 'POST',
    body: payload,
    headers: Object.keys(headers).length > 0 ? headers : undefined,
  });

  if (error) {
    throw error;
  }

  const summary = mapSummary(data?.summary);
  const cached = Boolean(data?.cached);
  // Throttle log to prevent flooding
  throttledLogOnChange('edge-targets-summary', 5000, '[Edge] targets summary fetched', {
    fetchedAt: new Date().toISOString(),
    cached,
    summary: summary
      ? {
          totalTargets: summary.totalTargets,
          onlineTargets: summary.onlineTargets,
          assignedTargets: summary.assignedTargets,
        }
      : null,
  });

  return {
    summary,
    cached,
  };
}

export async function fetchThingsboardSession(options: ThingsboardSessionOptions = {}): Promise<ThingsboardSession> {
  const headers = await getSupabaseAuthHeaders();
  const method = options.invalidate || options.force ? 'POST' : 'GET';

  const body =
    method === 'POST'
      ? {
          force: Boolean(options.force),
          invalidate: Boolean(options.invalidate),
        }
      : undefined;

  const { data, error } = await rateLimitedEdgeCall<ThingsboardSession>('thingsboard-session', {
    method,
    body,
    headers: Object.keys(headers).length > 0 ? headers : undefined,
  });

  if (error) {
    throw error;
  }

  if (!data || typeof data.token !== 'string') {
    throw new Error('thingsboard-session did not return a token');
  }

  cachedThingsboardSession = {
    session: data,
  };

  return data;
}

export async function ensureThingsboardSession(options: { force?: boolean } = {}): Promise<ThingsboardSession> {
  if (!options.force && cachedThingsboardSession?.session && isSessionFresh(cachedThingsboardSession.session)) {
    return cachedThingsboardSession.session;
  }

  return fetchThingsboardSession({ force: options.force });
}

export function invalidateThingsboardSessionCache(): void {
  cachedThingsboardSession = null;
}

export interface EdgeRoom {
  id: string;
  name: string;
  order: number;
  icon?: string | null;
  room_type?: string | null;
  targetCount: number;
  targets: Target[];
}

interface DashboardMetricsResponse {
  metrics?: DashboardMetricsData | null;
  cached?: boolean;
  source?: string;
}

export async function fetchDashboardMetrics(force = false): Promise<{ metrics: DashboardMetricsData | null; cached: boolean; source?: string }> {
  const headers: Record<string, string> = {};
  let token: string | undefined;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

  try {
    const { data: sessionData } = await supabase.auth.getSession();
    token = sessionData.session?.access_token ?? undefined;
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
  } catch (sessionError) {
    logger.warn('[Edge] Unable to retrieve Supabase session before dashboard metrics fetch', sessionError);
  }

  const invokeRequest = async () => {
    const body: Record<string, unknown> = {};
    if (force) {
      body.force = true;
    }

    return rateLimitedEdgeCall<DashboardMetricsResponse>('dashboard-metrics', {
      body,
      headers: Object.keys(headers).length > 0 ? headers : undefined,
      options: {
        cache: 'no-store',
      },
    });
  };

  const fetchDirect = async () => {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
    if (!supabaseUrl || !token || !anonKey) {
      return null;
    }

    const url = new URL(`${supabaseUrl}/functions/v1/dashboard-metrics`);
    if (force) {
      url.searchParams.set('force', 'true');
    }

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: anonKey,
      },
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new Error(`dashboard-metrics ${response.status}: ${detail}`);
    }

    const payload = await response.json() as DashboardMetricsResponse;
    return { data: payload, error: null };
  };

  let result;
  try {
    result = await invokeRequest();
  } catch (invokeError) {
    logger.warn('[Edge] dashboard-metrics invoke failed, retrying via fetch', invokeError);
    result = await fetchDirect();
    if (!result) {
      throw invokeError;
    }
  }

  if (!result) {
    throw new Error('dashboard-metrics invocation failed with no response');
  }

  if (result.error) {
    logger.warn('[Edge] dashboard-metrics invoke returned error', result.error);
    const fallback = await fetchDirect();
    if (fallback) {
      result = fallback;
    } else {
      throw result.error;
    }
  }

  const metrics = result.data?.metrics ?? null;
  const cached = Boolean(result.data?.cached);
  const source = result.data?.source ?? undefined;

  // Throttle log to prevent flooding
  throttledLogOnChange('edge-dashboard-metrics', 5000, '[Edge] dashboard-metrics fetched', {
    cached,
    source: source ?? null,
    summary: metrics ? {
      totalTargets: metrics.summary.totalTargets,
      onlineTargets: metrics.summary.onlineTargets,
      assignedTargets: metrics.summary.assignedTargets,
      totalRooms: metrics.summary.totalRooms,
    } : null,
    recentSessions: metrics?.recentSessions?.length ?? 0,
  });

  return { metrics, cached, source };
}

export async function fetchRoomsData(force = false): Promise<{ rooms: EdgeRoom[]; unassignedTargets: Target[]; cached: boolean }> {
  const payload = force ? { force: true } : {};
  const { data, error } = await rateLimitedEdgeCall<RoomsFunctionResponse>('rooms', {
    method: 'POST',
    body: payload,
  });

  if (error) {
    throw error;
  }

  const rawRooms = data?.rooms ?? [];
  const rawUnassigned = data?.unassignedTargets ?? [];

  const rooms: EdgeRoom[] = rawRooms.map((room) => {
    const targets = Array.isArray(room.targets) ? room.targets.map((target: Record<string, any>) => {
      const mapped = mapEdgeTarget(target);
      return { ...mapped, roomId: room.id };
    }) : [];

    return {
      id: String(room.id),
      name: String(room.name ?? 'Room'),
      order: Number(room.order_index ?? room.order ?? 0),
      icon: room.icon ?? null,
      room_type: room.room_type ?? null,
      targetCount: Number(room.targetCount ?? targets.length ?? 0),
      targets,
    };
  });

  const unassignedTargets = rawUnassigned.map((record) => {
    const mapped = mapEdgeTarget(record);
    return { ...mapped, roomId: null };
  });

  const result = {
    rooms,
    unassignedTargets,
    cached: Boolean(data?.cached),
  };

  // Throttle log to prevent flooding
  throttledLogOnChange('edge-rooms', 5000, '[Edge] rooms payload fetched', {
    supabaseEdgeFunction: 'rooms',
    backingTables: ['public.user_rooms', 'public.user_room_targets'],
    fetchedAt: new Date().toISOString(),
    roomCount: rooms.length,
    unassignedTargets: unassignedTargets.length,
    cached: result.cached,
    sample: rooms.slice(0, 5).map((room) => ({ id: room.id, name: room.name, targetCount: room.targetCount })),
  });

  return result;
}

interface TelemetryHistoryResponse {
  devices?: Array<{
    deviceId: string;
    telemetry: Record<string, unknown>;
    error?: string;
  }>;
  cached?: boolean;
}

export async function fetchTelemetryHistory(deviceIds: string[], startTs: number, endTs: number, limit?: number, keys?: string[]): Promise<{ devices: TelemetryHistoryResponse['devices']; cached: boolean }> {
  if (deviceIds.length === 0) {
    return { devices: [], cached: false };
  }

  const body: Record<string, unknown> = {
    deviceIds,
    startTs,
    endTs,
  };

  if (typeof limit === 'number') {
    body.limit = limit;
  }
  if (Array.isArray(keys) && keys.length > 0) {
    body.keys = keys;
  }

  const { data, error } = await rateLimitedEdgeCall<TelemetryHistoryResponse>('telemetry-history', {
    method: 'POST',
    body,
  });

  if (error) {
    throw error;
  }

  const devices = data?.devices ?? [];
  const cached = Boolean(data?.cached);
  logger.info('[Edge] telemetry-history fetched', {
    deviceCount: devices.length,
    cached,
  });
  return {
    devices,
    cached,
  };
}

interface DeviceAttributesResponse {
  deviceId?: string;
  attributes?: Record<string, unknown> | null;
}

export async function fetchDeviceAttributes(
  deviceId: string,
  options: {
    scope?: 'CLIENT_SCOPE' | 'SHARED_SCOPE' | 'SERVER_SCOPE';
    keys?: string[];
  } = {},
): Promise<Record<string, unknown>> {
  if (!deviceId) {
    throw new Error('Device ID is required to fetch attributes');
  }

  const headers: Record<string, string> = {};
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
  } catch (sessionError) {
    logger.warn('[Edge] Unable to retrieve Supabase session before device-admin get-attributes', sessionError);
  }

  const body: Record<string, unknown> = {
    action: 'get-attributes',
    getAttributes: {
      deviceId,
    },
  };

  if (options.scope) {
    (body.getAttributes as Record<string, unknown>).scope = options.scope;
  }
  if (Array.isArray(options.keys) && options.keys.length > 0) {
    (body.getAttributes as Record<string, unknown>).keys = options.keys.map(String);
  }

  const { data, error } = await rateLimitedEdgeCall<DeviceAttributesResponse>('device-admin', {
    method: 'POST',
    body,
    headers: Object.keys(headers).length > 0 ? headers : undefined,
  });

  if (error) {
    throw error;
  }

  const attributes = data?.attributes ?? {};
  logger.info('[Edge] device-admin attributes fetched', {
    deviceId,
    scope: options.scope ?? null,
    keyCount: attributes ? Object.keys(attributes).length : 0,
  });

  return attributes ?? {};
}

interface ShootingActivityResponse {
  activity?: Array<{
    deviceId: string;
    telemetry: Record<string, unknown>;
    error?: string;
  }>;
  cached?: boolean;
}

export async function fetchShootingActivity(deviceIds: string[], keys?: string[]): Promise<{ activity: ShootingActivityResponse['activity']; cached: boolean }> {
  if (deviceIds.length === 0) {
    return { activity: [], cached: false };
  }

  const body: Record<string, unknown> = { deviceIds };
  if (Array.isArray(keys) && keys.length > 0) {
    body.keys = keys;
  }

  const { data, error } = await rateLimitedEdgeCall<ShootingActivityResponse>('shooting-activity', {
    method: 'POST',
    body,
  });

  if (error) {
    throw error;
  }

  const activity = data?.activity ?? [];
  const cached = Boolean(data?.cached);
  logger.info('[Edge] shooting-activity fetched', {
    deviceCount: activity.length,
    cached,
  });
  return {
    activity,
    cached,
  };
}

interface TargetDetailsResponse {
  details?: TargetDetail[];
  cached?: boolean;
}

export interface TargetDetail {
  deviceId: string;
  status: 'online' | 'standby' | 'offline';
  activityStatus: 'active' | 'recent' | 'standby';
  rawStatus?: string | null;
  active?: boolean | null;
  tbLastActivityTime?: number | null;
  lastShotTime: number | null;
  totalShots: number | null;
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

export async function fetchTargetDetails(
  deviceIds: string[],
  options: TargetDetailsOptions = {},
): Promise<{ details: TargetDetail[]; cached: boolean }> {
  if (deviceIds.length === 0) {
    return { details: [], cached: false };
  }

  const body: Record<string, unknown> = {
    deviceIds,
  };

  if (options.force) {
    body.force = true;
  }
  if (typeof options.includeHistory === 'boolean') {
    body.includeHistory = options.includeHistory;
  }
  if (typeof options.historyRangeMs === 'number') {
    body.historyRangeMs = options.historyRangeMs;
  }
  if (typeof options.historyLimit === 'number') {
    body.historyLimit = options.historyLimit;
  }
  if (Array.isArray(options.telemetryKeys) && options.telemetryKeys.length > 0) {
    body.telemetryKeys = options.telemetryKeys;
  }
  if (Array.isArray(options.historyKeys) && options.historyKeys.length > 0) {
    body.historyKeys = options.historyKeys;
  }
  if (typeof options.recentWindowMs === 'number') {
    body.recentWindowMs = options.recentWindowMs;
  }

  const { data, error } = await rateLimitedEdgeCall<TargetDetailsResponse>('target-details', {
    method: 'POST',
    body,
  });

  if (error) {
    throw error;
  }

  const detailsArray = data?.details;
  const details = Array.isArray(detailsArray) ? detailsArray as TargetDetail[] : [];

  const cached = Boolean(data?.cached);
  // Throttle log to prevent flooding
  throttledLogOnChange('edge-target-details', 5000, '[Edge] target-details fetched', {
    supabaseEdgeFunction: 'target-details',
    backingTables: ['public.user_profiles'],
    thingsboardInvolved: true,
    fetchedAt: new Date().toISOString(),
    detailCount: details.length,
    cached,
    sample: details.slice(0, 5).map((detail) => ({
      deviceId: detail.deviceId,
      status: detail.status,
      lastShotTime: detail.lastShotTime,
      recentShotsCount: detail.recentShotsCount,
      battery: detail.battery,
      wifiStrength: detail.wifiStrength,
    })),
  });

  return {
    details,
    cached,
  };
}

// -----------------------
// Game Control (Start/Stop)
// -----------------------

export interface GameControlDevice {
  deviceId: string;
  name: string;
  status: string;
  isOnline: boolean;
  wifiStrength: number | null;
  ambientLight: string | null;
  hitCount: number;
  lastEvent: string | null;
  lastSeen: number | null;
  gameStatus: string | null;
  gameId: string | null;
}

interface GameControlStatusResponse {
  devices?: GameControlDevice[];
  fetchedAt?: number;
}

export interface GameControlCommandResult {
  deviceId: string;
  success: boolean;
  warning?: string;
  error?: string;
  data?: Record<string, unknown> | null;
}

export interface GameControlCommandResponse {
  action: 'configure' | 'start' | 'stop' | 'info';
  gameId?: string | null;
  gameDuration?: number | null;
  configuredAt?: number;
  startedAt?: number;
  stoppedAt?: number;
  infoAt?: number;
  deviceIds?: string[];
  successCount?: number;
  failureCount?: number;
  results?: GameControlCommandResult[];
  warnings?: Array<{ deviceId: string; warning: string }>;
}

export async function fetchGameControlDevices(): Promise<{ devices: GameControlDevice[]; fetchedAt: number }> {
  const headers: Record<string, string> = {};
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
  } catch (sessionError) {
    logger.warn('[Edge] Unable to retrieve Supabase session before game-control fetch', sessionError);
  }

  const { data, error } = await rateLimitedEdgeCall<GameControlStatusResponse>('game-control', {
    method: 'GET',
    headers: Object.keys(headers).length > 0 ? headers : undefined,
  });

  if (error) {
    throw error;
  }

  const devices = Array.isArray(data?.devices) ? data.devices : [];

  const fetchedAt = Number(data?.fetchedAt ?? Date.now());
  logger.info('[Edge] game-control status fetched', {
    deviceCount: devices.length,
    fetchedAt,
  });

  return {
    devices,
    fetchedAt,
  };
}

export async function invokeGameControl(
  action: 'configure' | 'start' | 'stop' | 'info',
  payload: {
    deviceIds?: string[];
    gameId?: string | null;
    gameDuration?: number | null;
    desiredDurationSeconds?: number | null;
    roomId?: string | null;
  },
): Promise<GameControlCommandResponse> {
  const body: Record<string, unknown> = {
    action,
  };

  if (Array.isArray(payload.deviceIds)) {
    body.deviceIds = payload.deviceIds;
  }

  if (payload.gameId) {
    body.gameId = payload.gameId;
  }
  if (typeof payload.gameDuration === 'number') {
    body.gameDuration = payload.gameDuration;
  }
  if (typeof payload.desiredDurationSeconds === 'number' && payload.desiredDurationSeconds > 0) {
    body.desiredDurationSeconds = payload.desiredDurationSeconds;
  }
  if (payload.roomId) {
    body.roomId = payload.roomId;
  }

  const headers: Record<string, string> = {};
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
  } catch (sessionError) {
    logger.warn('[Edge] Unable to retrieve Supabase session before game-control command', sessionError);
  }

  const { data, error } = await rateLimitedEdgeCall<GameControlCommandResponse>('game-control', {
    method: 'POST',
    body,
    headers: Object.keys(headers).length > 0 ? headers : undefined,
  });

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error('No response from game-control function');
  }

  logger.info('[Edge] game-control command result', {
    action,
    deviceCount: payload.deviceIds?.length ?? 0,
    successCount: data.successCount ?? null,
    failureCount: data.failureCount ?? null,
  });

  return data;
}

// Invokes the ThingsBoard info RPC through game-control so the UI can refresh ambient telemetry without a full status fetch.
export async function fetchGameControlInfo(
  deviceIds: string[],
): Promise<GameControlCommandResponse> {
  return invokeGameControl('info', { deviceIds });
}

/**
 * Settings for game presets that configure scoring and session behavior.
 */
export interface GamePresetSettings {
  /** Required shots per target for scoring. Map of deviceId to required hit count. */
  goalShotsPerTarget?: Record<string, number>;
  /**
   * Whether target engagement order is enforced for multi-target sessions.
   * When true, targets must be engaged in order (A then B).
   * When false, targets can be engaged in any order.
   * Default: false (order not enforced)
   */
  orderEnforced?: boolean;
  /** Additional custom settings */
  [key: string]: unknown;
}

export interface GamePreset {
  id: string;
  name: string;
  description: string | null;
  roomId: string | null;
  roomName: string | null;
  durationSeconds: number | null;
  targetIds: string[];
  settings: GamePresetSettings;
  createdAt: string;
  updatedAt: string;
}

type GamePresetResponse = {
  id: string;
  name: string;
  description: string | null;
  room_id: string | null;
  room_name: string | null;
  duration_seconds: number | null;
  target_ids: string[];
  settings: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

const mapGamePreset = (record: GamePresetResponse): GamePreset => ({
  id: record.id,
  name: record.name,
  description: record.description,
  roomId: record.room_id,
  roomName: record.room_name,
  durationSeconds: record.duration_seconds,
  targetIds: record.target_ids ?? [],
  settings: record.settings ?? {},
  createdAt: record.created_at,
  updatedAt: record.updated_at,
});

export async function fetchGamePresets(): Promise<GamePreset[]> {
  const requestPayload = { action: 'list' as const };
  const requestStartedAt = Date.now();
  // Throttle log to prevent flooding
  throttledLog('edge-invoke-presets', 5000, '[Edge] Invoking game-presets list', {
    payload: requestPayload,
    at: new Date().toISOString(),
  });
  const { data, error, status, statusText } = await rateLimitedEdgeCall<{ presets: GamePresetResponse[] }>('game-presets', {
    method: 'POST',
    body: requestPayload,
  });

  if (error) {
    logger.error('[Edge] game-presets list failed', {
      error: error.message,
      status: error.status,
      elapsedMs: Date.now() - requestStartedAt,
    });
    throw error;
  }

  const presets = Array.isArray(data?.presets) ? data!.presets.map(mapGamePreset) : [];
  // Throttle log to prevent flooding
  throttledLogOnChange('edge-presets-fetched', 5000, '[Edge] game-presets list fetched', {
    fetchedAt: new Date().toISOString(),
    elapsedMs: Date.now() - requestStartedAt,
    status,
    statusText,
    rawPresetCount: Array.isArray(data?.presets) ? data!.presets.length : null,
    count: presets.length,
    sample: presets.slice(0, 3).map((preset) => ({
      id: preset.id,
      name: preset.name,
      targetCount: preset.targetIds.length,
      durationSeconds: preset.durationSeconds,
    })),
  });

  return presets;
}

export interface SaveGamePresetInput {
  id?: string;
  name: string;
  description?: string | null;
  roomId?: string | null;
  roomName?: string | null;
  durationSeconds?: number | null;
  targetIds: string[];
  settings?: Record<string, unknown>;
}

export async function saveGamePreset(preset: SaveGamePresetInput): Promise<GamePreset> {
  const requestStartedAt = Date.now();
  logger.info('[Edge] Invoking game-presets save', {
    presetName: preset.name,
    targetCount: preset.targetIds.length,
    includeRoom: Boolean(preset.roomId),
    at: new Date().toISOString(),
  });
  const { data, error } = await rateLimitedEdgeCall<{ preset: GamePresetResponse }>('game-presets', {
    method: 'POST',
    body: {
      action: 'save',
      preset: {
        id: preset.id,
        name: preset.name,
        description: preset.description,
        roomId: preset.roomId,
        roomName: preset.roomName,
        durationSeconds: preset.durationSeconds,
        targetIds: preset.targetIds,
        settings: preset.settings ?? {},
      },
    },
  });

  if (error) {
    logger.error('[Edge] game-presets save failed', {
      error: error.message,
      status: error.status,
      elapsedMs: Date.now() - requestStartedAt,
    });
    throw error;
  }

  const mapped = mapGamePreset(data!.preset);
  logger.info('[Edge] game-presets saved', {
    presetId: mapped.id,
    name: mapped.name,
    targetCount: mapped.targetIds.length,
    elapsedMs: Date.now() - requestStartedAt,
  });

  return mapped;
}

export async function deleteGamePreset(id: string): Promise<void> {
  const { error } = await rateLimitedEdgeCall('game-presets', {
    method: 'POST',
    body: { action: 'delete', id },
  });

  if (error) {
    throw error;
  }

  logger.info('[Edge] game-presets deleted', { id });
}
