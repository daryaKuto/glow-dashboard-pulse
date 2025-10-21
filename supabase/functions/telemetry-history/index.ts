import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { requireUser } from "../_shared/auth.ts";
import { getHistoricalTelemetry } from "../_shared/thingsboard.ts";
import { getCache, setCache } from "../_shared/cache.ts";
import { errorResponse, jsonResponse, preflightResponse } from "../_shared/response.ts";

const DEFAULT_KEYS = ["hits", "hit_ts", "beep_ts"];
const DEFAULT_LIMIT = 1000;
const CACHE_TTL_MS = 30_000;

interface TelemetryRequest {
  deviceIds?: string[];
  startTs?: number;
  endTs?: number;
  limit?: number;
  keys?: string[];
}

type TelemetryResult = {
  deviceId: string;
  telemetry: Record<string, unknown>;
  error?: string;
};

type CachedResponse = {
  devices: TelemetryResult[];
};

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

  let payload: TelemetryRequest;
  try {
    payload = await req.json();
  } catch (_err) {
    return errorResponse("Request body must be valid JSON", 400);
  }

  const deviceIds = Array.isArray(payload.deviceIds) ? payload.deviceIds.filter(Boolean).map(String) : [];
  if (deviceIds.length === 0) {
    return jsonResponse({ devices: [], cached: false });
  }

  const startTs = typeof payload.startTs === "number" ? payload.startTs : 0;
  const endTs = typeof payload.endTs === "number" ? payload.endTs : Date.now();
  const limit = typeof payload.limit === "number" ? payload.limit : DEFAULT_LIMIT;
  const keys = Array.isArray(payload.keys) && payload.keys.length > 0 ? payload.keys.map(String) : DEFAULT_KEYS;

  const cacheKey = `history-${authResult.user.id}-${deviceIds.sort().join(',')}-${startTs}-${endTs}-${limit}-${keys.join(',')}`;
  const cached = getCache<CachedResponse>(cacheKey);
  if (cached) {
    return jsonResponse({ ...cached, cached: true });
  }

  try {
    const devices: TelemetryResult[] = [];

    for (const deviceId of deviceIds) {
      try {
        const telemetry = await getHistoricalTelemetry(deviceId, keys, startTs, endTs, limit);
        devices.push({ deviceId, telemetry });
      } catch (error) {
        console.error(`❌ [telemetry-history] Failed to fetch telemetry for ${deviceId}:`, error);
        devices.push({
          deviceId,
          telemetry: {},
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    const response: CachedResponse = { devices };
    setCache(cacheKey, response, CACHE_TTL_MS);

    return jsonResponse({ ...response, cached: false });
  } catch (error) {
    console.error('❌ [telemetry-history] Unexpected error:', error);
    return errorResponse('Failed to fetch telemetry history', 500, error instanceof Error ? error.message : error);
  }
});
