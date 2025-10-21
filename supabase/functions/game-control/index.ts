import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { requireUser } from "../_shared/auth.ts";
import { errorResponse, jsonResponse, preflightResponse } from "../_shared/response.ts";
import {
  getBatchTelemetry,
  getTenantDevices,
  sendOneWayRpc,
  setDeviceSharedAttributes,
} from "../_shared/thingsboard.ts";

type DeviceStatusPayload = {
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
};

type StartPayload = {
  action: "start";
  deviceIds?: string[];
  gameId?: string;
};

type StopPayload = {
  action: "stop";
  deviceIds?: string[];
  gameId?: string;
};

type RequestPayload = StartPayload | StopPayload;

const TELEMETRY_KEYS = ["hits", "wifiStrength", "ambientLight", "event", "gameStatus", "hit_ts"];

function normalizeNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeString(value: unknown): string | null {
  if (typeof value === "string" && value.trim().length > 0) {
    return value;
  }
  if (typeof value === "number") {
    return String(value);
  }
  return null;
}

function isTimeoutError(error: unknown): boolean {
  return error instanceof Error && error.message.includes("504");
}

async function listDevices(): Promise<Array<{ id: { id: string }; name: string; status?: string }>> {
  const devices: Array<{ id: { id: string }; name: string; status?: string }> = [];
  const pageSize = 100;
  let page = 0;
  let hasNext = true;

  while (hasNext) {
    const params = new URLSearchParams({ pageSize: String(pageSize), page: String(page) });
    const payload = await getTenantDevices(params);
    const pageDevices: Array<{ id: { id: string }; name: string; status?: string }> = payload.data ?? [];
    devices.push(...pageDevices);

    const totalPages = typeof payload.totalPages === "number" ? payload.totalPages : undefined;
    const hasNextFlag = typeof payload.hasNext === "boolean" ? payload.hasNext : undefined;

    if (totalPages !== undefined) {
      hasNext = page + 1 < totalPages;
    } else if (hasNextFlag !== undefined) {
      hasNext = hasNextFlag;
    } else {
      hasNext = pageDevices.length === pageSize;
    }

    page += 1;

    if (!hasNext) {
      break;
    }
  }

  return devices;
}

async function fetchDeviceStatuses(): Promise<DeviceStatusPayload[]> {
  const allDevices = await listDevices();
  if (allDevices.length === 0) {
    return [];
  }

  const ids = allDevices.map((device) => device.id?.id ?? String(device.id));
  const telemetryResults = await getBatchTelemetry(ids, TELEMETRY_KEYS, 5);
  const telemetryById = new Map(telemetryResults.map((item) => [item.deviceId, item.telemetry]));

  return allDevices.map((device) => {
    const deviceId = device.id?.id ?? String(device.id);
    const telemetry = telemetryById.get(deviceId) ?? {};

    const hitsRaw = Array.isArray(telemetry.hits) && telemetry.hits.length > 0 ? telemetry.hits[0]?.value : null;
    const wifiRaw = Array.isArray(telemetry.wifiStrength) && telemetry.wifiStrength.length > 0
      ? telemetry.wifiStrength[0]?.value
      : null;
    const ambientRaw = Array.isArray(telemetry.ambientLight) && telemetry.ambientLight.length > 0
      ? telemetry.ambientLight[0]?.value
      : null;
    const eventRaw = Array.isArray(telemetry.event) && telemetry.event.length > 0 ? telemetry.event[0] : null;
    const hitTsRaw = Array.isArray(telemetry.hit_ts) && telemetry.hit_ts.length > 0 ? telemetry.hit_ts[0] : null;
    const gameStatusRaw = Array.isArray(telemetry.gameStatus) && telemetry.gameStatus.length > 0
      ? telemetry.gameStatus[0]?.value
      : null;

    const deviceStatus = normalizeString(device.status) ?? "unknown";
    const wifiStrength = normalizeNumber(wifiRaw);
    const gameStatus = normalizeString(gameStatusRaw);
    const ambientLight = normalizeString(ambientRaw);
    const lastEvent = normalizeString(eventRaw?.value);
    const lastSeen = normalizeNumber(eventRaw?.ts) ?? normalizeNumber(hitTsRaw?.ts);
    const hitCount = normalizeNumber(hitsRaw) ?? 0;

    const isOnline = (() => {
      if (gameStatus === "start" || gameStatus === "busy") {
        return true;
      }
      const status = (deviceStatus ?? "").toLowerCase();
      return status === "online" || status === "active" || status === "active_online" || status === "busy";
    })();

    return {
      deviceId,
      name: device.name,
      status: deviceStatus,
      isOnline,
      wifiStrength,
      ambientLight,
      hitCount,
      lastEvent,
      lastSeen,
      gameStatus,
    } satisfies DeviceStatusPayload;
  });
}

type DeviceCommandResult = {
  deviceId: string;
  success: boolean;
  warning?: string;
  error?: string;
};

async function handleStart(payload: StartPayload) {
  const deviceIds = Array.isArray(payload.deviceIds) ? payload.deviceIds.filter(Boolean) : [];
  if (deviceIds.length === 0) {
    return errorResponse("No deviceIds provided", 400);
  }

  const gameId = payload.gameId && payload.gameId.trim().length > 0 ? payload.gameId : `GM-${Date.now()}`;
  const timestamp = Date.now();

  const results: DeviceCommandResult[] = [];
  for (const deviceId of deviceIds) {
    const result: DeviceCommandResult = { deviceId, success: false };
    try {
      await setDeviceSharedAttributes(deviceId, { gameId, status: "busy" });
      try {
        await sendOneWayRpc(deviceId, "start", {
          ts: timestamp,
          values: {
            deviceId,
            event: "start",
            gameId,
          },
        });
      } catch (error) {
        if (isTimeoutError(error)) {
          result.warning = "rpc-timeout";
        } else {
          throw error;
        }
      }
      result.success = true;
    } catch (error) {
      result.error = error instanceof Error ? error.message : String(error);
    }
    results.push(result);
  }

  const successCount = results.filter((r) => r.success).length;
  const failureCount = results.length - successCount;

  return jsonResponse({
    action: "start",
    gameId,
    startedAt: timestamp,
    deviceIds,
    successCount,
    failureCount,
    results,
  });
}

async function handleStop(payload: StopPayload) {
  const deviceIds = Array.isArray(payload.deviceIds) ? payload.deviceIds.filter(Boolean) : [];
  if (deviceIds.length === 0) {
    return errorResponse("No deviceIds provided", 400);
  }

  const gameId = payload.gameId && payload.gameId.trim().length > 0 ? payload.gameId : null;
  const timestamp = Date.now();

  const results: DeviceCommandResult[] = [];
  for (const deviceId of deviceIds) {
    const result: DeviceCommandResult = { deviceId, success: false };
    try {
      const attributes: Record<string, unknown> = { status: "free" };
      if (gameId) {
        attributes.gameId = gameId;
      }
      await setDeviceSharedAttributes(deviceId, attributes);
      try {
        await sendOneWayRpc(deviceId, "stop", {
          ts: timestamp,
          values: {
            deviceId,
            event: "stop",
            gameId,
          },
        });
      } catch (error) {
        if (isTimeoutError(error)) {
          result.warning = "rpc-timeout";
        } else {
          throw error;
        }
      }
      result.success = true;
    } catch (error) {
      result.error = error instanceof Error ? error.message : String(error);
    }
    results.push(result);
  }

  const successCount = results.filter((r) => r.success).length;
  const failureCount = results.length - successCount;

  return jsonResponse({
    action: "stop",
    gameId,
    stoppedAt: timestamp,
    deviceIds,
    successCount,
    failureCount,
    results,
  });
}

Deno.serve(async (req) => {
  const method = req.method.toUpperCase();
  if (method === "OPTIONS") {
    return preflightResponse(req);
  }

  const authResult = await requireUser(req);
  if ("error" in authResult) {
    return authResult.error;
  }

  if (method === "GET") {
    try {
      const devices = await fetchDeviceStatuses();
      return jsonResponse({ devices, fetchedAt: Date.now() });
    } catch (error) {
      console.error("Failed to fetch device statuses", error);
      return errorResponse("Failed to fetch ThingsBoard devices", 502);
    }
  }

  if (method === "POST") {
    let payload: RequestPayload | null = null;
    try {
      payload = (await req.json()) as RequestPayload;
    } catch (_error) {
      return errorResponse("Invalid JSON payload", 400);
    }

    if (!payload || typeof payload.action !== "string") {
      return errorResponse("Missing action", 400);
    }

    if (payload.action === "start") {
      return handleStart(payload as StartPayload);
    }
    if (payload.action === "stop") {
      return handleStop(payload as StopPayload);
    }

    return errorResponse(`Unsupported action: ${payload.action}`, 400);
  }

  return errorResponse("Method not allowed", 405);
});
