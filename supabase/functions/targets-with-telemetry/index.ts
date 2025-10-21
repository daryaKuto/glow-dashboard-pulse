import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { requireUser } from "../_shared/auth.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { getCache, setCache } from "../_shared/cache.ts";
import { errorResponse, jsonResponse, preflightResponse } from "../_shared/response.ts";
import { getTenantDevices, getDeviceTelemetry } from "../_shared/thingsboard.ts";

type TargetWithTelemetry = {
  id: string;
  name: string;
  type?: string;
  status?: string;
  roomId: string | null;
  roomName: string | null;
  telemetry: Record<string, unknown>;
  battery?: number | null;
  wifiStrength?: number | null;
  lastEvent?: string | null;
  lastActivityTime?: number | null;
};

const TELEMETRY_KEYS = ["hits", "hit_ts", "battery", "wifiStrength", "event", "gameStatus"];
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

    const summary = allDevices.reduce(
      (acc, device) => {
        const deviceId = device.id?.id ?? String(device.id);
        acc.totalTargets += 1;

        const status = (device.status ?? "").toString().toLowerCase();
        if (status === "online" || status === "active" || status === "active_online") {
          acc.onlineTargets += 1;
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
        offlineTargets: 0,
        assignedTargets: 0,
        unassignedTargets: 0,
        totalRooms,
        lastUpdated: Date.now(),
      }
    );

    if (summaryOnly) {
      const summaryPayload = { summary };
      setCache(cacheKey, summaryPayload, CACHE_TTL_MS);
      return jsonResponse({ ...summaryPayload, cached: false });
    }

    const telemetryResults = await Promise.all(
      allDevices.map(async (device) => {
        const deviceId = device.id?.id ?? String(device.id);
        try {
          const telemetry = await getDeviceTelemetry(deviceId, TELEMETRY_KEYS);
          return { device, deviceId, telemetry };
        } catch (telemetryError) {
          console.warn(`Telemetry fetch failed for ${deviceId}:`, telemetryError);
          return { device, deviceId, telemetry: {} as Record<string, unknown> };
        }
      })
    );

    const targets: TargetWithTelemetry[] = telemetryResults.map(({ device, deviceId, telemetry }) => {
      const assignment = assignmentByTarget.get(deviceId) ?? { roomId: null, roomName: null };

      const battery = telemetry?.battery?.[0]?.value ?? null;
      const wifiStrength = telemetry?.wifiStrength?.[0]?.value ?? null;
      const lastEvent = telemetry?.event?.[0]?.value ?? null;
      const lastActivityTime = telemetry?.hit_ts?.[0]?.ts ?? telemetry?.hits?.[0]?.ts ?? null;

      return {
        id: deviceId,
        name: device.name,
        type: device.type,
        status: device.status,
        roomId: assignment.roomId,
        roomName: assignment.roomName,
        telemetry,
        battery,
        wifiStrength,
        lastEvent,
        lastActivityTime,
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
