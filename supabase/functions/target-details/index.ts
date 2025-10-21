import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { requireUser } from "../_shared/auth.ts";
import {
  getBatchTelemetry,
  getDeviceTelemetry,
  getHistoricalTelemetry,
} from "../_shared/thingsboard.ts";
import { getCache, setCache } from "../_shared/cache.ts";
import { errorResponse, jsonResponse, preflightResponse } from "../_shared/response.ts";

const DEFAULT_TELEMETRY_KEYS = [
  "hits",
  "hit_ts",
  "battery",
  "wifiStrength",
  "event",
  "gameStatus",
];

const DEFAULT_HISTORY_KEYS = ["hits", "hit_ts"];
const DEFAULT_HISTORY_RANGE_MS = 24 * 60 * 60 * 1000; // 24 hours
const DEFAULT_HISTORY_LIMIT = 500;
const CACHE_TTL_MS = 10_000;
const ACTIVE_THRESHOLD_MS = 30_000;
const RECENT_THRESHOLD_MS = 10 * 60 * 1000; // 10 minutes
const RECENT_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

interface TargetDetailsRequest {
  deviceIds?: string[];
  force?: boolean;
  includeHistory?: boolean;
  historyRangeMs?: number;
  historyLimit?: number;
  telemetryKeys?: string[];
  historyKeys?: string[];
  recentWindowMs?: number;
}

interface TargetDetailPayload {
  deviceId: string;
  status: "online" | "standby" | "offline";
  activityStatus: "active" | "recent" | "standby";
  lastShotTime: number | null;
  totalShots: number;
  recentShotsCount: number;
  telemetry: Record<string, unknown>;
  history?: Record<string, unknown>;
  battery?: number | null;
  wifiStrength?: number | null;
  lastEvent?: string | null;
  gameStatus?: string | null;
  errors?: string[];
}

type CachedResponse = {
  details: TargetDetailPayload[];
};

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  if (value && typeof value === "object") {
    const numericValue = (value as Record<string, unknown>).valueOf();
    if (typeof numericValue === "number" && Number.isFinite(numericValue)) {
      return numericValue;
    }
  }
  return null;
}

function computeRecentShots(
  history: Record<string, unknown> | undefined,
  windowMs: number,
  now: number,
): number {
  if (!history) {
    return 0;
  }

  const threshold = now - windowMs;
  let count = 0;

  const hitTsEntries = Array.isArray((history as Record<string, unknown>).hit_ts)
    ? (history as { hit_ts: Array<{ ts: number }> }).hit_ts
    : [];

  for (const entry of hitTsEntries) {
    if (entry && typeof entry.ts === "number" && entry.ts >= threshold) {
      count += 1;
    }
  }

  if (count > 0) {
    return count;
  }

  const hitsEntries = Array.isArray((history as Record<string, unknown>).hits)
    ? (history as { hits: Array<{ ts: number; value: unknown }> }).hits
    : [];

  if (hitsEntries.length >= 2) {
    const start = toNumber(hitsEntries[0]?.value);
    const end = toNumber(hitsEntries[hitsEntries.length - 1]?.value);
    if (start !== null && end !== null && end > start) {
      return Math.max(0, end - start);
    }
  } else if (hitsEntries.length === 1) {
    const single = hitsEntries[0];
    if (single && typeof single.ts === "number" && single.ts >= threshold) {
      const val = toNumber(single.value);
      if (val !== null) {
        return Math.max(0, val);
      }
    }
  }

  return 0;
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

  let payload: TargetDetailsRequest;
  try {
    payload = await req.json();
  } catch (_err) {
    return errorResponse("Request body must be valid JSON", 400);
  }

  const deviceIds = Array.isArray(payload.deviceIds)
    ? payload.deviceIds.filter(Boolean).map(String)
    : [];

  if (deviceIds.length === 0) {
    return jsonResponse({ details: [], cached: false });
  }

  const telemetryKeys = Array.isArray(payload.telemetryKeys) && payload.telemetryKeys.length > 0
    ? payload.telemetryKeys.map(String)
    : DEFAULT_TELEMETRY_KEYS;

  const includeHistory = payload.includeHistory !== false;
  const historyRangeMs = typeof payload.historyRangeMs === "number" && payload.historyRangeMs > 0
    ? payload.historyRangeMs
    : DEFAULT_HISTORY_RANGE_MS;
  const historyLimit = typeof payload.historyLimit === "number" && payload.historyLimit > 0
    ? payload.historyLimit
    : DEFAULT_HISTORY_LIMIT;

  const historyKeys = includeHistory && Array.isArray(payload.historyKeys) && payload.historyKeys.length > 0
    ? payload.historyKeys.map(String)
    : DEFAULT_HISTORY_KEYS;

  const recentWindowMs = typeof payload.recentWindowMs === "number" && payload.recentWindowMs > 0
    ? payload.recentWindowMs
    : RECENT_WINDOW_MS;

  const force = payload.force === true;

  const sortedIds = [...deviceIds].sort();
  const cacheKey = `target-details-${authResult.user.id}-${sortedIds.join(',')}|${telemetryKeys.join(',')}|${includeHistory ? historyRangeMs : 'no-history'}|${historyLimit}|${historyKeys.join(',')}|${recentWindowMs}`;

  if (!force) {
    const cached = getCache<CachedResponse>(cacheKey);
    if (cached) {
      return jsonResponse({ ...cached, cached: true });
    }
  }

  const now = Date.now();
  const startTs = includeHistory ? Math.max(0, now - historyRangeMs) : 0;
  const endTs = now;

  const telemetryMap = new Map<string, Record<string, unknown>>();
  const errors = new Map<string, string[]>();

  try {
    const batchTelemetry = await getBatchTelemetry(deviceIds, telemetryKeys, 1);
    for (const item of batchTelemetry) {
      if (item.deviceId) {
        telemetryMap.set(item.deviceId, item.telemetry ?? {});
      }
    }
  } catch (error) {
    console.warn('[target-details] Batch telemetry fetch failed, falling back to per-device requests', error);
  }

  const ensureTelemetry = async (deviceId: string): Promise<Record<string, unknown>> => {
    if (telemetryMap.has(deviceId)) {
      return telemetryMap.get(deviceId) ?? {};
    }

    try {
      const telemetry = await getDeviceTelemetry(deviceId, telemetryKeys, 1);
      telemetryMap.set(deviceId, telemetry);
      return telemetry;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const existing = errors.get(deviceId) ?? [];
      existing.push(message);
      errors.set(deviceId, existing);
      return {};
    }
  };

  const historyMap = new Map<string, Record<string, unknown>>();
  if (includeHistory) {
    await Promise.all(deviceIds.map(async (deviceId) => {
      try {
        const history = await getHistoricalTelemetry(deviceId, historyKeys, startTs, endTs, historyLimit);
        historyMap.set(deviceId, history);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const existing = errors.get(deviceId) ?? [];
        existing.push(message);
        errors.set(deviceId, existing);
      }
    }));
  }

  const details: TargetDetailPayload[] = [];

  for (const deviceId of deviceIds) {
    const telemetry = await ensureTelemetry(deviceId);
    const history = includeHistory ? historyMap.get(deviceId) : undefined;

    const hitsEntries = Array.isArray((telemetry as Record<string, unknown>).hits)
      ? (telemetry as { hits: Array<{ ts?: number; value?: unknown }> }).hits
      : [];
    const latestHits = hitsEntries.length > 0 ? hitsEntries[hitsEntries.length - 1] : undefined;
    const totalShots = toNumber(latestHits?.value) ?? 0;

    const hitTsEntries = Array.isArray((telemetry as Record<string, unknown>).hit_ts)
      ? (telemetry as { hit_ts: Array<{ ts?: number }> }).hit_ts
      : [];
    const latestHitTs = hitTsEntries.length > 0 ? hitTsEntries[hitTsEntries.length - 1] : undefined;
    const lastShotTime = typeof latestHitTs?.ts === "number"
      ? latestHitTs.ts
      : (typeof latestHits?.ts === "number" ? latestHits.ts : null);

    const timeSinceLastShot = typeof lastShotTime === "number" ? now - lastShotTime : null;

    let activityStatus: "active" | "recent" | "standby" = "standby";
    if (timeSinceLastShot !== null) {
      if (timeSinceLastShot <= ACTIVE_THRESHOLD_MS) {
        activityStatus = "active";
      } else if (timeSinceLastShot <= RECENT_THRESHOLD_MS) {
        activityStatus = "recent";
      }
    }

    let status: "online" | "standby" | "offline" = "standby";
    if (timeSinceLastShot === null) {
      status = "offline";
    } else if (activityStatus === "active" || activityStatus === "recent") {
      status = "online";
    }

    const recentShotsCount = includeHistory
      ? computeRecentShots(history, recentWindowMs, now)
      : 0;

    const batteryEntries = Array.isArray((telemetry as Record<string, unknown>).battery)
      ? (telemetry as { battery: Array<{ value?: unknown }> }).battery
      : [];
    const wifiEntries = Array.isArray((telemetry as Record<string, unknown>).wifiStrength)
      ? (telemetry as { wifiStrength: Array<{ value?: unknown }> }).wifiStrength
      : [];

    const lastEventEntries = Array.isArray((telemetry as Record<string, unknown>).event)
      ? (telemetry as { event: Array<{ value?: unknown }> }).event
      : [];
    const gameStatusEntries = Array.isArray((telemetry as Record<string, unknown>).gameStatus)
      ? (telemetry as { gameStatus: Array<{ value?: unknown }> }).gameStatus
      : [];

    const detail: TargetDetailPayload = {
      deviceId,
      status,
      activityStatus,
      lastShotTime,
      totalShots,
      recentShotsCount,
      telemetry,
      history,
      battery: batteryEntries.length > 0 ? toNumber(batteryEntries[batteryEntries.length - 1]?.value) : null,
      wifiStrength: wifiEntries.length > 0 ? toNumber(wifiEntries[wifiEntries.length - 1]?.value) : null,
      lastEvent: lastEventEntries.length > 0
        ? String(lastEventEntries[lastEventEntries.length - 1]?.value ?? "")
        : null,
      gameStatus: gameStatusEntries.length > 0
        ? String(gameStatusEntries[gameStatusEntries.length - 1]?.value ?? "")
        : null,
      errors: errors.get(deviceId),
    };

    details.push(detail);
  }

  const response: CachedResponse = { details };
  setCache(cacheKey, response, CACHE_TTL_MS);

  return jsonResponse({ ...response, cached: false });
});
