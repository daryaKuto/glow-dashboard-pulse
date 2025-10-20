import { supabase } from '@/integrations/supabase/client';
import type { Target } from '@/store/useTargets';

interface TargetsFunctionResponse {
  data?: Array<Record<string, any>>;
  cached?: boolean;
  summary?: TargetsSummaryPayload;
}

interface TargetsSummaryPayload {
  totalTargets?: number;
  onlineTargets?: number;
  offlineTargets?: number;
  assignedTargets?: number;
  unassignedTargets?: number;
  totalRooms?: number;
  lastUpdated?: number;
}

export interface TargetsSummary {
  totalTargets: number;
  onlineTargets: number;
  offlineTargets: number;
  assignedTargets: number;
  unassignedTargets: number;
  totalRooms: number;
  lastUpdated: number;
}

const mapSummary = (summary?: TargetsSummaryPayload | null): TargetsSummary | null => {
  if (!summary) {
    return null;
  }

  return {
    totalTargets: Number(summary.totalTargets ?? 0),
    onlineTargets: Number(summary.onlineTargets ?? 0),
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

const sanitizeStatus = (status: unknown): 'online' | 'offline' => {
  if (status === 'online') return 'online';
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

export const mapEdgeTarget = (record: Record<string, any>): Target => ({
  id: String(record.id),
  name: String(record.name ?? 'Unknown Target'),
  status: sanitizeStatus(record.status),
  battery: record.battery ?? null,
  wifiStrength: record.wifiStrength ?? null,
  roomId: coerceRoomId(record.roomId),
  telemetry: record.telemetry ?? {},
  lastEvent: record.lastEvent ?? null,
  lastGameId: record.lastGameId ?? null,
  lastGameName: record.lastGameName ?? null,
  lastHits: record.lastHits ?? null,
  lastActivity: record.lastActivity ?? null,
  lastActivityTime: record.lastActivityTime ?? null,
  deviceName: record.deviceName ?? record.name ?? 'Unknown Target',
  deviceType: record.type ?? record.deviceType ?? 'default',
  createdTime: record.createdTime ?? null,
  additionalInfo: record.additionalInfo ?? {},
  type: record.type ?? undefined,
  isNoDataMessage: record.isNoDataMessage ?? false,
  isErrorMessage: record.isErrorMessage ?? false,
  message: record.message ?? undefined,
});

export async function fetchTargetsWithTelemetry(force = false): Promise<{ targets: Target[]; cached: boolean; summary: TargetsSummary | null }> {
  const payload = force ? { force: true } : {};
  const { data, error } = await supabase.functions.invoke<TargetsFunctionResponse>('targets-with-telemetry', {
    method: 'POST',
    body: payload,
  });

  if (error) {
    throw error;
  }

  if (!data || !Array.isArray(data.data)) {
    return { targets: [], cached: Boolean(data?.cached), summary: mapSummary(data?.summary) };
  }

  const targets = data.data.map(mapEdgeTarget);
  return { targets, cached: Boolean(data.cached), summary: mapSummary(data.summary) };
}

export async function fetchTargetsSummary(force = false): Promise<{ summary: TargetsSummary | null; cached: boolean }> {
  const payload: Record<string, unknown> = { summary: true };
  if (force) {
    payload.force = true;
  }

  const headers: Record<string, string> = {};
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
  } catch (sessionError) {
    console.warn('[Edge] Unable to retrieve Supabase session before summary fetch', sessionError);
  }

  const { data, error } = await supabase.functions.invoke<TargetsFunctionResponse>('targets-with-telemetry', {
    method: 'POST',
    body: payload,
    headers: Object.keys(headers).length > 0 ? headers : undefined,
  });

  if (error) {
    throw error;
  }

  return {
    summary: mapSummary(data?.summary),
    cached: Boolean(data?.cached),
  };
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

export async function fetchRoomsData(force = false): Promise<{ rooms: EdgeRoom[]; unassignedTargets: Target[]; cached: boolean }> {
  const payload = force ? { force: true } : {};
  const { data, error } = await supabase.functions.invoke<RoomsFunctionResponse>('rooms', {
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

  return {
    rooms,
    unassignedTargets,
    cached: Boolean(data?.cached),
  };
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

  const { data, error } = await supabase.functions.invoke<TelemetryHistoryResponse>('telemetry-history', {
    method: 'POST',
    body,
  });

  if (error) {
    throw error;
  }

  return {
    devices: data?.devices ?? [],
    cached: Boolean(data?.cached),
  };
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

  const { data, error } = await supabase.functions.invoke<ShootingActivityResponse>('shooting-activity', {
    method: 'POST',
    body,
  });

  if (error) {
    throw error;
  }

  return {
    activity: data?.activity ?? [],
    cached: Boolean(data?.cached),
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

  const { data, error } = await supabase.functions.invoke<TargetDetailsResponse>('target-details', {
    method: 'POST',
    body,
  });

  if (error) {
    throw error;
  }

  const detailsArray = data?.details;
  const details = Array.isArray(detailsArray) ? detailsArray as TargetDetail[] : [];

  return {
    details,
    cached: Boolean(data?.cached),
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
}

export interface GameControlCommandResponse {
  action: 'start' | 'stop';
  gameId?: string | null;
  startedAt?: number;
  stoppedAt?: number;
  deviceIds?: string[];
  successCount?: number;
  failureCount?: number;
  results?: GameControlCommandResult[];
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
    console.warn('[Edge] Unable to retrieve Supabase session before game-control fetch', sessionError);
  }

  const { data, error } = await supabase.functions.invoke<GameControlStatusResponse>('game-control', {
    method: 'GET',
    headers: Object.keys(headers).length > 0 ? headers : undefined,
  });

  if (error) {
    throw error;
  }

  const devices = Array.isArray(data?.devices) ? data.devices : [];

  return {
    devices,
    fetchedAt: Number(data?.fetchedAt ?? Date.now()),
  };
}

export async function invokeGameControl(
  action: 'start' | 'stop',
  payload: { deviceIds: string[]; gameId?: string | null },
): Promise<GameControlCommandResponse> {
  const body: Record<string, unknown> = {
    action,
    deviceIds: payload.deviceIds,
  };

  if (payload.gameId) {
    body.gameId = payload.gameId;
  }

  const headers: Record<string, string> = {};
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
  } catch (sessionError) {
    console.warn('[Edge] Unable to retrieve Supabase session before game-control command', sessionError);
  }

  const { data, error } = await supabase.functions.invoke<GameControlCommandResponse>('game-control', {
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

  return data;
}
