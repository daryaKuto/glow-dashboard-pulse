import { supabaseAdmin } from "./supabaseAdmin.ts";
import { getTenantDevices, getBatchTelemetry, getDeviceTelemetry } from "./thingsboard.ts";

const DEFAULT_TELEMETRY_KEYS = [
  "hits",
  "hit_ts",
  "battery",
  "wifiStrength",
  "event",
  "gameStatus",
];

const METRICS_CACHE_TTL_MS = Number.parseInt(
  Deno.env.get("METRICS_CACHE_TTL_MS") ?? "300000",
  10,
);

export interface ThingsBoardDevice {
  id: { id: string } | string;
  name: string;
  type?: string;
  status?: string;
  additionalInfo?: Record<string, unknown> | null;
}

export interface TargetSnapshot {
  deviceId: string;
  name: string;
  type?: string;
  status?: string;
  roomId: string | null;
  roomName: string | null;
  battery: number | null;
  wifiStrength: number | null;
  lastEvent: string | null;
  lastActivityTime: number | null;
  telemetry: Record<string, unknown>;
}

export interface SummaryMetrics {
  totalTargets: number;
  onlineTargets: number;
  offlineTargets: number;
  assignedTargets: number;
  unassignedTargets: number;
  totalRooms: number;
  lastUpdated: number;
}

export interface DashboardMetrics {
  summary: SummaryMetrics;
  totals: {
    totalSessions: number;
    bestScore: number | null;
    avgScore: number | null;
  };
  recentSessions: Array<{
    id: string;
    started_at: string;
    score: number;
    hit_count: number;
    duration_ms: number;
    accuracy_percentage: number | null;
  }>;
  generatedAt: number;
}

interface UserRoomContext {
  roomNameById: Map<string, string>;
  assignmentByTarget: Map<string, string>;
}

interface SnapshotRow {
  user_id: string;
  device_id: string;
  name: string;
  type: string | null;
  status: string | null;
  room_id: string | null;
  room_name: string | null;
  battery: number | null;
  wifi_strength: number | null;
  last_event: string | null;
  last_activity_ts: string | null;
  telemetry: Record<string, unknown> | null;
  fetched_at: string | null;
}

function normalizeDeviceId(device: ThingsBoardDevice): string {
  if (typeof device.id === "string") {
    return device.id;
  }
  return device.id?.id ?? "";
}

function extractNumber(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function chunkArray<T>(items: T[], size: number): T[][] {
  if (size <= 0) {
    throw new Error("chunk size must be greater than 0");
  }
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function extractLatestNumber(telemetry: Record<string, any>, key: string): number | null {
  const series = telemetry?.[key];
  if (Array.isArray(series) && series.length > 0) {
    const last = series[series.length - 1];
    return extractNumber(last?.value ?? last);
  }
  return null;
}

function extractLatestTimestamp(telemetry: Record<string, any>, keys: string[]): number | null {
  let latest = 0;
  for (const key of keys) {
    const series = telemetry?.[key];
    if (Array.isArray(series) && series.length > 0) {
      const last = series[series.length - 1];
      const ts = extractNumber(last?.ts);
      if (ts && ts > latest) {
        latest = ts;
      }
    }
  }
  return latest > 0 ? latest : null;
}

function extractLatestEvent(telemetry: Record<string, any>): string | null {
  const series = telemetry?.event;
  if (Array.isArray(series) && series.length > 0) {
    const last = series[series.length - 1];
    const value = last?.value ?? last;
    return typeof value === "string" ? value : null;
  }
  return null;
}

function computeSummary(targets: TargetSnapshot[], totalRooms: number): SummaryMetrics {
  const aggregates = targets.reduce(
    (acc, target) => {
      acc.totalTargets += 1;

      if (target.status) {
        const normalized = target.status.toLowerCase();
        if (normalized === "online" || normalized === "active" || normalized === "active_online") {
          acc.onlineTargets += 1;
        } else {
          acc.offlineTargets += 1;
        }
      } else {
        acc.offlineTargets += 1;
      }

      if (target.roomId) {
        acc.assignedTargets += 1;
        acc.rooms.add(target.roomId);
      }

      if (target.lastActivityTime) {
        acc.lastUpdated = Math.max(acc.lastUpdated, target.lastActivityTime);
      }

      return acc;
    },
    {
      totalTargets: 0,
      onlineTargets: 0,
      offlineTargets: 0,
      assignedTargets: 0,
      rooms: new Set<string>(),
      lastUpdated: 0,
    }
  );

  const unassignedTargets = Math.max(aggregates.totalTargets - aggregates.assignedTargets, 0);

  return {
    totalTargets: aggregates.totalTargets,
    onlineTargets: aggregates.onlineTargets,
    offlineTargets: aggregates.offlineTargets,
    assignedTargets: aggregates.assignedTargets,
    unassignedTargets,
    totalRooms: totalRooms >= 0 ? totalRooms : aggregates.rooms.size,
    lastUpdated: aggregates.lastUpdated || Date.now(),
  };
}

export async function fetchUserRoomContext(userId: string): Promise<UserRoomContext> {
  if (!supabaseAdmin) {
    throw new Error("Supabase admin client not configured");
  }

  const [roomsResponse, assignmentsResponse] = await Promise.all([
    supabaseAdmin
      .from("user_rooms")
      .select("id,name")
      .eq("user_id", userId),
    supabaseAdmin
      .from("user_room_targets")
      .select("target_id,room_id")
      .eq("user_id", userId),
  ]);

  if (roomsResponse.error) {
    throw roomsResponse.error;
  }
  if (assignmentsResponse.error) {
    throw assignmentsResponse.error;
  }

  const roomNameById = new Map<string, string>();
  roomsResponse.data?.forEach((room) => {
    if (room && room.id) {
      roomNameById.set(String(room.id), room.name ?? "Room");
    }
  });

  const assignmentByTarget = new Map<string, string>();
  assignmentsResponse.data?.forEach((assignment) => {
    if (assignment?.target_id) {
      assignmentByTarget.set(String(assignment.target_id), assignment.room_id ? String(assignment.room_id) : "");
    }
  });

  return { roomNameById, assignmentByTarget };
}

function buildTargetSnapshot(
  device: ThingsBoardDevice,
  telemetry: Record<string, any>,
  context: UserRoomContext,
): TargetSnapshot {
  const deviceId = normalizeDeviceId(device);
  const roomIdRaw = context.assignmentByTarget.get(deviceId) ?? null;
  const roomId = roomIdRaw && roomIdRaw.length > 0 ? roomIdRaw : null;
  const roomName = roomId ? context.roomNameById.get(roomId) ?? null : null;

  const battery = extractLatestNumber(telemetry, "battery");
  const wifiStrength = extractLatestNumber(telemetry, "wifiStrength");
  const lastEvent = extractLatestEvent(telemetry);
  const lastActivityTime = extractLatestTimestamp(telemetry, ["hit_ts", "hits"]);

  return {
    deviceId,
    name: device.name,
    type: device.type,
    status: device.status,
    roomId,
    roomName,
    battery,
    wifiStrength,
    lastEvent,
    lastActivityTime,
    telemetry,
  };
}

export async function fetchDevicesWithTelemetry(keys = DEFAULT_TELEMETRY_KEYS) {
  const devices: ThingsBoardDevice[] = [];
  let page = 0;
  const pageSize = 100;
  let hasNext = true;

  while (hasNext) {
    const params = new URLSearchParams({ pageSize: String(pageSize), page: String(page) });
    const payload = await getTenantDevices(params);
    const batch = (payload?.data ?? payload ?? []) as ThingsBoardDevice[];
    devices.push(...batch);

    const totalPages = typeof payload?.totalPages === "number" ? payload.totalPages : undefined;
    const hasNextFlag = typeof payload?.hasNext === "boolean" ? payload.hasNext : undefined;

    if (totalPages !== undefined) {
      hasNext = page + 1 < totalPages;
    } else if (hasNextFlag !== undefined) {
      hasNext = hasNextFlag;
    } else {
      hasNext = batch.length === pageSize;
    }

    page += 1;
  }

  const deviceIds = devices.map(normalizeDeviceId).filter((id) => id.length > 0);
  const telemetryById = new Map<string, Record<string, any>>();

  if (deviceIds.length > 0) {
    const chunks = chunkArray(deviceIds, 50);
    for (const chunk of chunks) {
      try {
        const telemetryResults = await getBatchTelemetry(chunk, keys, 5);
        telemetryResults.forEach(({ deviceId, telemetry }) => {
          telemetryById.set(deviceId, telemetry ?? {});
        });
      } catch (error) {
        console.error('[deviceSnapshots] batch telemetry fetch failed', {
          chunkSize: chunk.length,
          error: error instanceof Error ? error.message : String(error),
        });
        for (const deviceId of chunk) {
          try {
            const telemetry = await getDeviceTelemetry(deviceId, keys, 5);
            telemetryById.set(deviceId, telemetry ?? {});
          } catch (singleError) {
            console.error('[deviceSnapshots] single telemetry fetch failed', {
              deviceId,
              error: singleError instanceof Error ? singleError.message : String(singleError),
            });
            telemetryById.set(deviceId, {});
          }
        }
      }
    }
  }

  return { devices, telemetryById };
}

export async function buildTargetsForUser(
  userId: string,
  devices: ThingsBoardDevice[],
  telemetryById: Map<string, Record<string, any>>,
): Promise<{ targets: TargetSnapshot[]; context: UserRoomContext }> {
  const context = await fetchUserRoomContext(userId);
  const targets = devices.map((device) => {
    const deviceId = normalizeDeviceId(device);
    const telemetry = telemetryById.get(deviceId) ?? {};
    return buildTargetSnapshot(device, telemetry, context);
  });

  return { targets, context };
}

export async function persistDeviceSnapshots(
  userId: string,
  targets: TargetSnapshot[],
) {
  if (!supabaseAdmin) {
    throw new Error("Supabase admin client not configured");
  }

  const nowIso = new Date().toISOString();
  const rows = targets.map((target) => ({
    user_id: userId,
    device_id: target.deviceId,
    name: target.name,
    type: target.type ?? null,
    status: target.status ?? null,
    room_id: target.roomId,
    room_name: target.roomName,
    battery: target.battery,
    wifi_strength: target.wifiStrength,
    last_event: target.lastEvent,
    last_activity_ts: target.lastActivityTime ? new Date(target.lastActivityTime).toISOString() : null,
    telemetry: target.telemetry,
    fetched_at: nowIso,
    created_at: nowIso,
    updated_at: nowIso,
  }));

  await supabaseAdmin
    .from("device_snapshots")
    .delete()
    .eq("user_id", userId);

  if (rows.length > 0) {
    await supabaseAdmin.from("device_snapshots").insert(rows);
  }
}

async function fetchRecentSessions(userId: string) {
  if (!supabaseAdmin) {
    throw new Error("Supabase admin client not configured");
  }

  const [{ data: sessions, error }, bestScoreResponse, totalSessionsResponse, analyticsResponse] = await Promise.all([
    supabaseAdmin
      .from("sessions")
      .select("id, started_at, score, hit_count, duration_ms, accuracy_percentage")
      .eq("user_id", userId)
      .order("started_at", { ascending: false })
      .limit(5),
    supabaseAdmin
      .from("sessions")
      .select("score")
      .eq("user_id", userId)
      .order("score", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabaseAdmin
      .from("sessions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId),
    supabaseAdmin
      .from("user_analytics")
      .select("avg_score")
      .eq("user_id", userId)
      .order("date", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (error) {
    throw error;
  }

  if (bestScoreResponse.error) {
    throw bestScoreResponse.error;
  }
  if (totalSessionsResponse.error) {
    throw totalSessionsResponse.error;
  }
  if (analyticsResponse.error) {
    throw analyticsResponse.error;
  }

  const bestScore = bestScoreResponse?.data?.score ?? null;
  const totalSessions = totalSessionsResponse.count ?? (sessions?.length ?? 0);
  const avgScore = analyticsResponse?.data?.avg_score ?? null;

  const recent = (sessions ?? []).map((session) => ({
    id: session.id,
    started_at: session.started_at,
    score: session.score,
    hit_count: session.hit_count ?? 0,
    duration_ms: session.duration_ms ?? 0,
    accuracy_percentage: session.accuracy_percentage ?? null,
  }));

  return {
    recent,
    totals: {
      totalSessions,
      bestScore,
      avgScore: avgScore === null ? null : Number(avgScore),
    },
  };
}

export async function buildDashboardMetrics(
  userId: string,
  targets: TargetSnapshot[],
  context: UserRoomContext,
): Promise<DashboardMetrics> {
  const summary = computeSummary(targets, context.roomNameById.size);
  const { recent, totals } = await fetchRecentSessions(userId);

  return {
    summary,
    totals,
    recentSessions: recent,
    generatedAt: Date.now(),
  };
}

export async function buildDashboardMetricsFromSnapshots(
  userId: string,
  targets: TargetSnapshot[],
): Promise<DashboardMetrics> {
  const context = await fetchUserRoomContext(userId);
  return buildDashboardMetrics(userId, targets, context);
}

export async function persistDashboardMetrics(
  userId: string,
  metrics: DashboardMetrics,
) {
  if (!supabaseAdmin) {
    throw new Error("Supabase admin client not configured");
  }

  await supabaseAdmin
    .from("dashboard_metrics_cache")
    .upsert({
      user_id: userId,
      metrics,
      updated_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + METRICS_CACHE_TTL_MS).toISOString(),
      last_error: null,
    });
}

export async function refreshSnapshotsForUser(
  userId: string,
  devices: ThingsBoardDevice[],
  telemetryById: Map<string, Record<string, any>>,
) {
  const { targets, context } = await buildTargetsForUser(userId, devices, telemetryById);
  const metrics = await buildDashboardMetrics(userId, targets, context);

  await persistDeviceSnapshots(userId, targets);
  await persistDashboardMetrics(userId, metrics);

  return { targets, metrics };
}

export async function loadSnapshotsForUser(userId: string): Promise<{ targets: TargetSnapshot[]; fetchedAt: number | null }> {
  if (!supabaseAdmin) {
    throw new Error("Supabase admin client not configured");
  }

  const { data, error } = await supabaseAdmin
    .from<SnapshotRow>("device_snapshots")
    .select("*")
    .eq("user_id", userId)
    .order("name", { ascending: true });

  if (error) {
    throw error;
  }

  if (!data || data.length === 0) {
    return { targets: [], fetchedAt: null };
  }

  const targets = data.map((row) => ({
    deviceId: row.device_id,
    name: row.name,
    type: row.type ?? undefined,
    status: row.status ?? undefined,
    roomId: row.room_id,
    roomName: row.room_name,
    battery: row.battery,
    wifiStrength: row.wifi_strength,
    lastEvent: row.last_event,
    lastActivityTime: row.last_activity_ts ? Date.parse(row.last_activity_ts) : null,
    telemetry: row.telemetry ?? {},
  }));

  const fetchedAt = data[0]?.fetched_at ? Date.parse(data[0].fetched_at) : null;
  return { targets, fetchedAt: Number.isNaN(fetchedAt ?? NaN) ? null : fetchedAt };
}

export async function readCachedMetrics(userId: string) {
  if (!supabaseAdmin) {
    throw new Error("Supabase admin client not configured");
  }

  const { data, error } = await supabaseAdmin
    .from("dashboard_metrics_cache")
    .select("metrics, expires_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ?? null;
}

export function isMetricsCacheValid(cache: { expires_at: string | null }): boolean {
  if (!cache?.expires_at) {
    return false;
  }
  const expires = Date.parse(cache.expires_at);
  return Number.isFinite(expires) && expires > Date.now();
}
