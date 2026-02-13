import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { requireUser } from "../_shared/auth.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { getCache, setCache } from "../_shared/cache.ts";
import { errorResponse, jsonResponse, preflightResponse } from "../_shared/response.ts";
import { getTenantDevices, getDeviceTelemetry, getBatchServerAttributes } from "../_shared/thingsboard.ts";
import { determineStatus, parseActiveAttribute, parseLastActivityTime } from "../_shared/deviceStatus.ts";

type RoomPayload = {
  id: string;
  name: string;
  room_type?: string | null;
  icon?: string | null;
  order_index?: number | null;
  created_at?: string | null;
  updated_at?: string | null;
  targets: TargetWithTelemetry[];
  targetCount: number;
};

type TargetWithTelemetry = {
  id: string;
  name: string;
  type?: string;
  status?: string;
  roomId: string | null;
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
  let forceRefresh = false;
  if (url.searchParams.get("refresh") === "true" || url.searchParams.get("force") === "true") {
    forceRefresh = true;
  }

  if (!forceRefresh && method === "POST") {
    try {
      const payload = await req.json();
      if (payload && (payload.refresh === true || payload.force === true)) {
        forceRefresh = true;
      }
    } catch (_err) {
      // ignore empty/invalid JSON bodies
    }
  }
  const cacheKey = `rooms-${user.id}`;

  if (!forceRefresh) {
    const cached = getCache<{ rooms: RoomPayload[]; unassignedTargets: TargetWithTelemetry[] }>(cacheKey);
    if (cached) {
      return jsonResponse({ ...cached, cached: true });
    }
  }

  if (!supabaseAdmin) {
    return errorResponse("Supabase admin client is not configured", 500);
  }

  try {
    const [roomsRes, assignmentsRes] = await Promise.all([
      supabaseAdmin
        .from("user_rooms")
        .select("id,name,room_type,icon,order_index,created_at,updated_at")
        .eq("user_id", user.id)
        .order("order_index", { ascending: true }),
      supabaseAdmin
        .from("user_room_targets")
        .select("target_id,room_id")
        .eq("user_id", user.id),
    ]);

    if (roomsRes.error) {
      throw roomsRes.error;
    }
    if (assignmentsRes.error) {
      throw assignmentsRes.error;
    }

    const assignmentByTarget = new Map<string, string>();
    assignmentsRes.data?.forEach((assignment) => {
      assignmentByTarget.set(assignment.target_id, assignment.room_id);
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

    // Fetch server attributes (active, lastActivityTime) for correct status derivation
    const allDeviceIds = telemetryResults.map(({ deviceId }) => deviceId);
    const serverAttrsMap = await getBatchServerAttributes(
      allDeviceIds,
      ["active", "lastActivityTime"],
    );

    const roomMap = new Map<string, RoomPayload>();

    roomsRes.data?.forEach((room) => {
      roomMap.set(room.id, {
        id: room.id,
        name: room.name,
        room_type: room.room_type,
        icon: room.icon,
        order_index: room.order_index,
        created_at: room.created_at,
        updated_at: room.updated_at,
        targets: [],
        targetCount: 0,
      });
    });

    const unassignedTargets: TargetWithTelemetry[] = [];

    telemetryResults.forEach(({ device, deviceId, telemetry }) => {
      const roomId = assignmentByTarget.get(deviceId) ?? null;

      // Derive canonical status using shared logic (matches targets-with-telemetry)
      const serverAttrs = serverAttrsMap.get(deviceId) ?? {};
      const isActive = parseActiveAttribute(serverAttrs.active);
      const lastActivityTime = parseLastActivityTime(serverAttrs.lastActivityTime);
      const gameStatus = telemetry?.gameStatus?.[0]?.value as string | null ?? null;
      const derivedStatus = determineStatus(
        device.status ?? null,
        gameStatus,
        null, // lastShotTime — not used by determineStatus
        isActive,
        lastActivityTime,
      );

      const target: TargetWithTelemetry = {
        id: deviceId,
        name: device.name,
        type: device.type,
        status: derivedStatus,
        roomId,
        telemetry,
        battery: telemetry?.battery?.[0]?.value ?? null,
        wifiStrength: telemetry?.wifiStrength?.[0]?.value ?? null,
        lastEvent: telemetry?.event?.[0]?.value ?? null,
        lastActivityTime: lastActivityTime ?? telemetry?.hit_ts?.[0]?.ts ?? telemetry?.hits?.[0]?.ts ?? null,
      };

      if (roomId && roomMap.has(roomId)) {
        const room = roomMap.get(roomId)!;
        room.targets.push(target);
        room.targetCount += 1;
      } else {
        unassignedTargets.push(target);
      }
    });

    const roomsPayload = Array.from(roomMap.values());

    const responsePayload = {
      rooms: roomsPayload,
      unassignedTargets,
    };

    setCache(cacheKey, responsePayload, CACHE_TTL_MS);

    return jsonResponse({ ...responsePayload, cached: false });
  } catch (error) {
    console.error("rooms function error", error);
    return errorResponse("Failed to load rooms", 500, error instanceof Error ? error.message : error);
  }
});
