import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { errorResponse, preflightResponse } from "../_shared/response.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { getBatchTelemetry } from "../_shared/thingsboard.ts";

const DEFAULT_KEYS = ["hits", "hit_ts", "event", "gameStatus", "gameId"] as const;
const SAMPLE_INTERVAL_MS = 1_000;
const HEARTBEAT_INTERVAL_MS = 15_000;
const MAX_DEVICE_IDS = 50;
const BACKOFF_MULTIPLIER = 1.6;
const MAX_BACKOFF_MS = 10_000;

function normaliseToken(raw: string | null): string | null {
  if (!raw) {
    return null;
  }
  return raw.startsWith("Bearer ") ? raw.slice(7) : raw;
}

type TelemetryEnvelope = {
  type: "telemetry" | "heartbeat" | "connected" | "error";
  timestamp: number;
  payload?: unknown;
  backoffMs?: number;
  message?: string;
};

type CleanupHandles = {
  sampleTimer?: number;
  heartbeatTimer?: number;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return preflightResponse(req);
  }

  if (req.method !== "GET") {
    return errorResponse("Only GET is supported", 405);
  }

  if (!supabaseAdmin) {
    return errorResponse("Supabase admin client not configured", 500);
  }

  const url = new URL(req.url);
  const deviceIdsParam = url.searchParams.get("deviceIds");
  if (!deviceIdsParam) {
    return errorResponse("Missing deviceIds query parameter", 400);
  }

  const deviceIds = deviceIdsParam
    .split(",")
    .map((id) => id.trim())
    .filter((id) => id.length > 0);

  if (deviceIds.length === 0) {
    return errorResponse("No valid deviceIds provided", 400);
  }

  if (deviceIds.length > MAX_DEVICE_IDS) {
    return errorResponse(`Too many deviceIds requested (max ${MAX_DEVICE_IDS})`, 400);
  }

  const token = normaliseToken(url.searchParams.get("access_token") ?? req.headers.get("authorization"));
  if (!token) {
    return errorResponse("Missing access token", 401);
  }

  try {
    const { error } = await supabaseAdmin.auth.getUser(token);
    if (error) {
      throw error;
    }
  } catch (error) {
    console.error("[device-telemetry] access token validation failed", error);
    return errorResponse("Unauthorized", 401);
  }

  const { socket, response } = Deno.upgradeWebSocket(req);
  const handles: CleanupHandles = {};
  let active = true;
  let consecutiveErrors = 0;

  const scheduleSample = (delayMs: number) => {
    if (!active) {
      return;
    }
    const delay = Math.max(200, Math.min(delayMs, MAX_BACKOFF_MS));
    if (handles.sampleTimer !== undefined) {
      clearTimeout(handles.sampleTimer);
    }
    handles.sampleTimer = setTimeout(async () => {
      if (!active) {
        return;
      }
      try {
        const telemetry = await getBatchTelemetry(deviceIds, [...DEFAULT_KEYS], 1);
        consecutiveErrors = 0;
        const envelope: TelemetryEnvelope = {
          type: "telemetry",
          timestamp: Date.now(),
          payload: telemetry,
        };
        socket.send(JSON.stringify(envelope));
        scheduleSample(SAMPLE_INTERVAL_MS);
      } catch (error) {
        consecutiveErrors += 1;
        const backoff = Math.min(
          Math.round(SAMPLE_INTERVAL_MS * Math.pow(BACKOFF_MULTIPLIER, consecutiveErrors)),
          MAX_BACKOFF_MS,
        );
        console.error("[device-telemetry] Failed to fetch telemetry", error);
        const envelope: TelemetryEnvelope = {
          type: "error",
          timestamp: Date.now(),
          message: "telemetry_fetch_failed",
          backoffMs: backoff,
        };
        try {
          socket.send(JSON.stringify(envelope));
        } catch (_sendError) {
          // Ignore send failures during degraded periods.
        }
        scheduleSample(backoff);
      }
    }, delay) as unknown as number;
  };

  const stop = () => {
    active = false;
    if (handles.sampleTimer !== undefined) {
      clearTimeout(handles.sampleTimer);
    }
    if (handles.heartbeatTimer !== undefined) {
      clearInterval(handles.heartbeatTimer);
    }
  };

  socket.onopen = () => {
    const connected: TelemetryEnvelope = {
      type: "connected",
      timestamp: Date.now(),
      payload: { deviceIds },
    };
    socket.send(JSON.stringify(connected));

    handles.heartbeatTimer = setInterval(() => {
      if (!active) {
        return;
      }
      const heartbeat: TelemetryEnvelope = {
        type: "heartbeat",
        timestamp: Date.now(),
      };
      try {
        socket.send(JSON.stringify(heartbeat));
      } catch (error) {
        console.warn("[device-telemetry] heartbeat send failed", error);
      }
    }, HEARTBEAT_INTERVAL_MS) as unknown as number;

    scheduleSample(0);
  };

  socket.onclose = () => {
    stop();
  };

  socket.onerror = (event) => {
    console.error("[device-telemetry] socket error", event);
    stop();
  };

  return response;
});
