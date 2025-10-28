import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { requireUser } from "../_shared/auth.ts";
import { getDeviceTelemetry } from "../_shared/thingsboard.ts";
import { getCache, setCache } from "../_shared/cache.ts";
import { errorResponse, jsonResponse, preflightResponse } from "../_shared/response.ts";

const TELEMETRY_KEYS = ["hits", "hit_ts", "beep_ts", "gameStatus", "event"];
const CACHE_TTL_MS = 5_000;

interface ShootingActivityRequest {
  deviceIds?: string[];
  keys?: string[];
}

interface ShootingActivityRecord {
  deviceId: string;
  telemetry: Record<string, unknown>;
  error?: string;
}

Deno.serve(async (req) => {
  const method = req.method.toUpperCase();

  if (method === "OPTIONS") {
    return preflightResponse(req);
  }

  if (method !== "POST") {
    return errorResponse("Only POST is supported", 405);
  }

  const authResult = await requireUser(req);
  if ("error" in authResult) {
    return authResult.error;
  }

  let payload: ShootingActivityRequest;
  try {
    payload = await req.json();
  } catch (_err) {
    return errorResponse("Request body must be valid JSON", 400);
  }

  const deviceIds = Array.isArray(payload.deviceIds) ? payload.deviceIds.filter(Boolean).map(String) : [];
  if (deviceIds.length === 0) {
    return jsonResponse({ activity: [], cached: false });
  }

  const keys = Array.isArray(payload.keys) && payload.keys.length > 0 ? payload.keys.map(String) : TELEMETRY_KEYS;
  const cacheKey = `shooting-${authResult.user.id}-${deviceIds.sort().join(',')}-${keys.join(',')}`;
  const cached = getCache<{ activity: ShootingActivityRecord[] }>(cacheKey);
  if (cached) {
    return jsonResponse({ ...cached, cached: true });
  }

  try {
    const activity: ShootingActivityRecord[] = [];
    for (const deviceId of deviceIds) {
      try {
        const telemetry = await getDeviceTelemetry(deviceId, keys);
        activity.push({ deviceId, telemetry });
      } catch (error) {
        console.error(`❌ [shooting-activity] Failed to fetch telemetry for ${deviceId}:`, error);
        activity.push({
          deviceId,
          telemetry: {},
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    const response = { activity };
    setCache(cacheKey, response, CACHE_TTL_MS);
    return jsonResponse({ ...response, cached: false });
  } catch (error) {
    console.error('❌ [shooting-activity] Unexpected error:', error);
    return errorResponse('Failed to fetch shooting activity', 500, error instanceof Error ? error.message : error);
  }
});
