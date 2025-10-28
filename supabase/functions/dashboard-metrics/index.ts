import "jsr:@supabase/functions-js/edge-runtime.d.ts";

console.log('[dashboard-metrics] module initialized');

import { requireUser } from "../_shared/auth.ts";
import { jsonResponse, errorResponse, preflightResponse } from "../_shared/response.ts";
import {
  fetchDevicesWithTelemetry,
  loadSnapshotsForUser,
  buildTargetsForUser,
  buildDashboardMetrics,
  buildDashboardMetricsFromSnapshots,
  persistDeviceSnapshots,
  persistDashboardMetrics,
  readCachedMetrics,
  isMetricsCacheValid,
} from "../_shared/deviceSnapshots.ts";

const SNAPSHOT_FRESHNESS_MS = Number.parseInt(
  Deno.env.get("SNAPSHOT_FRESHNESS_MS") ?? "120000",
  10,
);

Deno.serve(async (req) => {
  const method = req.method.toUpperCase();

  if (method === "OPTIONS") {
    console.log('[dashboard-metrics] handling preflight');
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
  const force = url.searchParams.get("force") === "true";

  try {
    if (!force) {
      const cache = await readCachedMetrics(user.id);
      if (cache && cache.metrics && isMetricsCacheValid(cache)) {
        console.log('[dashboard-metrics] returning cached metrics', { userId: user.id });
        return jsonResponse({ metrics: cache.metrics, cached: true });
      }
    }

    const { targets: snapshotTargets, fetchedAt } = await loadSnapshotsForUser(user.id);
    const snapshotsAreFresh = fetchedAt !== null && Date.now() - fetchedAt < SNAPSHOT_FRESHNESS_MS;

    if (!force && snapshotTargets.length > 0 && snapshotsAreFresh) {
      const metrics = await buildDashboardMetricsFromSnapshots(user.id, snapshotTargets);
      await persistDashboardMetrics(user.id, metrics);
      console.log('[dashboard-metrics] recomputed from snapshots', { userId: user.id, targetCount: snapshotTargets.length });
      return jsonResponse({ metrics, cached: false, source: "snapshots" });
    }

    // Need to refresh from ThingsBoard
    const { devices, telemetryById } = await fetchDevicesWithTelemetry();
    const { targets: refreshedTargets, context } = await buildTargetsForUser(user.id, devices, telemetryById);
    await persistDeviceSnapshots(user.id, refreshedTargets);
    const metrics = await buildDashboardMetrics(user.id, refreshedTargets, context);
    await persistDashboardMetrics(user.id, metrics);
    console.log('[dashboard-metrics] refreshed from ThingsBoard', {
      userId: user.id,
      deviceCount: devices.length,
      targetCount: refreshedTargets.length,
    });

    return jsonResponse({ metrics, cached: false, source: "thingsboard" });
  } catch (error) {
    console.error('[dashboard-metrics] unexpected error', { userId: user.id, error: error instanceof Error ? error.message : String(error) });
    return errorResponse(
      "Failed to load dashboard metrics",
      500,
      error instanceof Error ? error.message : error,
    );
  }
});
