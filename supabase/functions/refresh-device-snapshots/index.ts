import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { jsonResponse, errorResponse, preflightResponse } from "../_shared/response.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import {
  fetchDevicesWithTelemetry,
  refreshSnapshotsForUser,
} from "../_shared/deviceSnapshots.ts";

interface RefreshResult {
  userId: string;
  refreshed: boolean;
  error?: string;
  targetCount?: number;
}

async function fetchActiveUsers(targetUserId?: string) {
  if (!supabaseAdmin) {
    throw new Error("Supabase admin client not configured");
  }

  const query = supabaseAdmin
    .from("user_profiles")
    .select("id, is_active")
    .eq("is_active", true);

  if (targetUserId) {
    query.eq("id", targetUserId);
  }

  const { data, error } = await query;
  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => String(row.id));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return preflightResponse(req);
  }

  if (req.method !== "POST") {
    return errorResponse("Only POST is supported", 405);
  }

  if (!supabaseAdmin) {
    return errorResponse("Supabase admin client not configured", 500);
  }

  try {
    const url = new URL(req.url);
    console.log('[refresh-device-snapshots] invocation received', { targetUserId: url.searchParams.get("user_id") });
    const { devices, telemetryById } = await fetchDevicesWithTelemetry();
    const targetUserId = url.searchParams.get("user_id");
    const userIds = await fetchActiveUsers(targetUserId ?? undefined);

    const results: RefreshResult[] = [];

    for (const userId of userIds) {
      try {
        const { targets } = await refreshSnapshotsForUser(userId, devices, telemetryById);
        results.push({ userId, refreshed: true, targetCount: targets.length });
      } catch (error) {
        console.error('[refresh-device-snapshots] user refresh failed', { userId, error: error instanceof Error ? error.message : String(error) });
        results.push({
          userId,
          refreshed: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    const successCount = results.filter((result) => result.refreshed).length;
    console.log('[refresh-device-snapshots] completed', {
      refreshedAt: new Date().toISOString(),
      deviceCount: devices.length,
      userCount: userIds.length,
      successCount,
    });

    return jsonResponse({
      refreshedAt: new Date().toISOString(),
      deviceCount: devices.length,
      userCount: userIds.length,
      results,
    });
  } catch (error) {
    console.error('[refresh-device-snapshots] unexpected error', { error: error instanceof Error ? error.message : String(error) });
    return errorResponse(
      "Failed to refresh device snapshots",
      500,
      error instanceof Error ? error.message : error,
    );
  }
});
