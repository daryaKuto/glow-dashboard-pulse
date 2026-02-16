import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { requireUser } from "../_shared/auth.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { getCache, setCache } from "../_shared/cache.ts";
import { errorResponse, jsonResponse, preflightResponse } from "../_shared/response.ts";
import { getTenantDevices, getBatchTelemetry, getBatchServerAttributes } from "../_shared/thingsboard.ts";
import { determineStatus, parseActiveAttribute, parseLastActivityTime } from "../_shared/deviceStatus.ts";

type TargetWithTelemetry = {
  id: string;
  name: string;
  type?: string;
  status?: string;
  activityStatus?: "active" | "recent" | "standby";
  /** Raw from ThingsBoard: device status string (e.g. ACTIVE, inactive). UI derives display status from this + active + tbLastActivityTime. */
  rawStatus?: string | null;
  /** Raw from ThingsBoard: server attribute active (connection state). */
  active?: boolean | null;
  /** Raw from ThingsBoard: server attribute lastActivityTime (ms). UI can use for standby threshold. */
  tbLastActivityTime?: number | null;
  roomId: string | null;
  roomName: string | null;
  telemetry: Record<string, unknown>;
  battery?: number | null;
  wifiStrength?: number | null;
  lastEvent?: string | null;
  lastActivityTime?: number | null;
  gameStatus?: string | null;
  lastGameId?: string | null;
  totalShots?: number | null;
  lastHits?: number | null;
  lastShotTime?: number | null;
};

const TELEMETRY_KEYS = ["hits", "hit_ts", "battery", "wifiStrength", "event", "gameStatus", "gameId"];
const CACHE_TTL_MS = 30_000;

Deno.serve(async (req) => {
  const method = req.method.toUpperCase();
  if (method === "OPTIONS") {
    return preflightResponse(req);
  }
  if (method !== "GET" && method !== "POST") {
    return errorResponse("Only GET or POST is supported", 405);
  }

  const authResult = await requireUser(req);
  if ("error" in authResult) {
    return authResult.error;
  }

  const { user } = authResult;

  const url = new URL(req.url);
  const urlParams = url.searchParams;

  let payload: Record<string, unknown> | null = null;
  if (method === "POST") {
    try {
      payload = await req.json();
    } catch (_err) {
      payload = null;
    }
  }

  let forceRefresh = false;
  if (urlParams.get("refresh") === "true" || urlParams.get("force") === "true") {
    forceRefresh = true;
  }
  if (!forceRefresh && payload && (payload.refresh === true || payload.force === true)) {
    forceRefresh = true;
  }

  let summaryOnly = false;
  if (urlParams.get("summary") === "true" || urlParams.get("mode") === "summary") {
    summaryOnly = true;
  }
  if (!summaryOnly && payload && (payload.summary === true || payload.mode === "summary")) {
    summaryOnly = true;
  }

  const cacheKey = summaryOnly ? `targets-summary-${user.id}` : `targets-${user.id}`;

  if (!forceRefresh) {
    const cached = getCache<unknown>(cacheKey);
    if (cached) {
      if (Array.isArray(cached)) {
        return jsonResponse({ data: cached, cached: true });
      }
      return jsonResponse({ ...(cached as Record<string, unknown>), cached: true });
    }
  }

  if (!supabaseAdmin) {
    return errorResponse("Supabase admin client is not configured", 500);
  }

  try {
    const [roomsResponse, assignmentsResponse] = await Promise.all([
      supabaseAdmin
        .from("user_rooms")
        .select("id,name")
        .eq("user_id", user.id),
      supabaseAdmin
        .from("user_room_targets")
        .select("target_id,room_id")
        .eq("user_id", user.id),
    ]);

    if (roomsResponse.error) {
      throw roomsResponse.error;
    }
    if (assignmentsResponse.error) {
      throw assignmentsResponse.error;
    }

    const roomNameById = new Map<string, string>();
    roomsResponse.data?.forEach((room) => {
      roomNameById.set(room.id, room.name);
    });

    const assignmentByTarget = new Map<string, { roomId: string | null; roomName: string | null }>();
    assignmentsResponse.data?.forEach((assignment) => {
      const roomId = assignment.room_id;
      assignmentByTarget.set(assignment.target_id, {
        roomId,
        roomName: roomId ? roomNameById.get(roomId) ?? null : null,
      });
    });

    const allDevices: Array<{ id: { id: string }; name: string; type?: string; status?: string }> = [];
    const pageSize = 100;
    let page = 0;
    let hasNext = true;

    while (hasNext) {
      const params = new URLSearchParams({ pageSize: String(pageSize), page: String(page) });
      const devicesPayload = await getTenantDevices(params);
      const devices: Array<{ id: { id: string }; name: string; type?: string; status?: string }> = devicesPayload.data ?? [];
      allDevices.push(...devices);

      const totalPages = typeof devicesPayload.totalPages === "number" ? devicesPayload.totalPages : undefined;
      const hasNextFlag = typeof devicesPayload.hasNext === "boolean" ? devicesPayload.hasNext : undefined;

      if (totalPages !== undefined) {
        hasNext = page + 1 < totalPages;
      } else if (hasNextFlag !== undefined) {
        hasNext = hasNextFlag;
      } else {
        hasNext = devices.length === pageSize;
      }

      page += 1;
      if (!hasNext) {
        break;
      }
    }

    const totalRooms = roomsResponse.data?.length ?? 0;

    const deviceIds = allDevices.map((d) => d.id?.id ?? String(d.id));

    if (summaryOnly) {
      // Summary mode only needs attributes, not telemetry
      const serverAttributesById = await getBatchServerAttributes(deviceIds, [
        "active",
        "lastActivityTime",
        "lastConnectTime",
        "lastDisconnectTime",
      ]);
      const summary = allDevices.reduce(
        (acc, device) => {
          const deviceId = device.id?.id ?? String(device.id);
          const attrs = serverAttributesById.get(deviceId) ?? {};
          const isActive = parseActiveAttribute(attrs.active);
          const lastActivityTimeFromTb = parseLastActivityTime(attrs.lastActivityTime);
          const rawStatus = device.status ? String(device.status) : null;
          const status = determineStatus(rawStatus, null, null, isActive, lastActivityTimeFromTb);
          acc.totalTargets += 1;
          if (status === "online") {
            acc.onlineTargets += 1;
          } else if (status === "standby") {
            acc.standbyTargets += 1;
          } else {
            acc.offlineTargets += 1;
          }
          if (assignmentByTarget.has(deviceId) && assignmentByTarget.get(deviceId)?.roomId) {
            acc.assignedTargets += 1;
          } else {
            acc.unassignedTargets += 1;
          }
          return acc;
        },
        {
          totalTargets: 0,
          onlineTargets: 0,
          standbyTargets: 0,
          offlineTargets: 0,
          assignedTargets: 0,
          unassignedTargets: 0,
          totalRooms,
          lastUpdated: Date.now(),
        }
      );
      const summaryPayload = { summary };
      setCache(cacheKey, summaryPayload, CACHE_TTL_MS);
      return jsonResponse({ ...summaryPayload, cached: false });
    }

    // Full mode: fetch telemetry and attributes in parallel using chunked batch helper
    const [batchTelemetryResults, serverAttributesById] = await Promise.all([
      getBatchTelemetry(deviceIds, TELEMETRY_KEYS),
      getBatchServerAttributes(deviceIds, [
        "active",
        "lastActivityTime",
        "lastConnectTime",
        "lastDisconnectTime",
      ]),
    ]);

    // Build a lookup map from batch telemetry results
    const telemetryById = new Map<string, Record<string, any>>();
    for (const result of batchTelemetryResults) {
      telemetryById.set(result.deviceId, result.telemetry);
    }

    const telemetryResults = allDevices.map((device) => {
      const deviceId = device.id?.id ?? String(device.id);
      const telemetry = telemetryById.get(deviceId) ?? {};
      return { device, deviceId, telemetry };
    });

    let summary = {
      totalTargets: 0,
      onlineTargets: 0,
      standbyTargets: 0,
      offlineTargets: 0,
      assignedTargets: 0,
      unassignedTargets: 0,
      totalRooms,
      lastUpdated: Date.now(),
    };

    const targets: TargetWithTelemetry[] = telemetryResults.map(({ device, deviceId, telemetry }) => {
      const assignment = assignmentByTarget.get(deviceId) ?? { roomId: null, roomName: null };
      const attrs = serverAttributesById.get(deviceId) ?? {};
      const battery = telemetry?.battery?.[0]?.value ?? null;
      const wifiStrength = telemetry?.wifiStrength?.[0]?.value ?? null;
      const lastEvent = telemetry?.event?.[0]?.value ?? null;
      const lastActivityTime = telemetry?.hit_ts?.[0]?.ts ?? telemetry?.hits?.[0]?.ts ?? null;
      const gameStatus = telemetry?.gameStatus?.[0]?.value ?? null;
      const rawStatus = device.status ? String(device.status) : null;
      const isActiveFromTb = parseActiveAttribute(attrs.active);
      const lastActivityTimeFromTb = parseLastActivityTime(attrs.lastActivityTime);
      const lastShotTime = typeof lastActivityTime === "number" ? lastActivityTime : null;
      const gameIdRaw = telemetry?.gameId?.[0]?.value ?? null;
      const lastGameId = gameIdRaw != null ? String(gameIdRaw) : null;
      const hitsRaw = telemetry?.hits?.[0]?.value ?? null;
      const totalShots = hitsRaw != null ? Number(hitsRaw) : null;
      const status = determineStatus(
        rawStatus,
        gameStatus,
        lastShotTime,
        isActiveFromTb,
        lastActivityTimeFromTb
      );

      summary.totalTargets += 1;
      if (status === "online") {
        summary.onlineTargets += 1;
      } else if (status === "standby") {
        summary.standbyTargets += 1;
      } else {
        summary.offlineTargets += 1;
      }
      if (assignmentByTarget.has(deviceId) && assignmentByTarget.get(deviceId)?.roomId) {
        summary.assignedTargets += 1;
      } else {
        summary.unassignedTargets += 1;
      }

      const activityStatus =
        status === "online" ? "active" : status === "standby" ? "standby" : undefined;
      return {
        id: deviceId,
        name: device.name,
        type: device.type,
        status,
        activityStatus,
        rawStatus: rawStatus ?? null,
        active: isActiveFromTb ?? null,
        tbLastActivityTime: lastActivityTimeFromTb ?? null,
        roomId: assignment.roomId,
        roomName: assignment.roomName,
        telemetry,
        battery,
        wifiStrength,
        lastEvent,
        lastActivityTime,
        gameStatus: gameStatus ? String(gameStatus) : null,
        lastGameId,
        totalShots: totalShots != null && Number.isFinite(totalShots) ? totalShots : null,
        lastHits: totalShots != null && Number.isFinite(totalShots) ? totalShots : null,
        lastShotTime,
      };
    });

    const payloadToCache = { data: targets, summary };
    setCache(cacheKey, payloadToCache, CACHE_TTL_MS);

    return jsonResponse({ data: targets, summary, cached: false });
  } catch (error) {
    console.error("targets-with-telemetry error", error);
    return errorResponse("Failed to load targets", 500, error instanceof Error ? error.message : error);
  }
});
