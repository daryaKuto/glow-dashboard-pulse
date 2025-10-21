import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { requireUser } from "../_shared/auth.ts";
import { errorResponse, jsonResponse, preflightResponse } from "../_shared/response.ts";
import { sendDeviceTelemetry, sendOneWayRpc } from "../_shared/thingsboard.ts";

type StartSessionPayload = {
  sessionId: string;
  scenarioId: string;
  startTime: number;
  targetDeviceIds: string[];
};

type BeepCommandPayload = {
  sessionId: string;
  targetDeviceId: string;
  beepType: string;
  beepSequence: number;
  timestamp: number;
  expectedResponseWindow: number;
};

type EndSessionPayload = {
  sessionId: string;
  endTime: number;
  reason: string;
  targetDeviceIds: string[];
  results?: {
    score?: number;
    accuracy?: number;
    totalHits?: number;
    averageReactionTime?: number;
  };
};

type TelemetryPayload = {
  deviceId: string;
  telemetry: Record<string, unknown>;
  scope?: "DEVICE_SCOPE" | "SERVER_SCOPE";
};

const SCENARIO_KEYS = {
  SESSION_ID: "scenario_session_id",
  SESSION_STATUS: "scenario_status",
  SESSION_START: "scenario_start_time",
  SESSION_END: "scenario_end_time",
  GAME_NAME: "game_name",
  GAME_ID: "gameId",
  BEEP_SENT: "beep_sent_timestamp",
  BEEP_TYPE: "beep_type",
  BEEP_SEQUENCE: "beep_sequence",
  BEEP_TS: "beep_ts",
  SCENARIO_SCORE: "scenario_score",
  SCENARIO_ACCURACY: "scenario_accuracy",
  TOTAL_HITS: "total_hits",
  AVERAGE_REACTION: "avg_reaction_time",
} as const;

async function handleStartSession(payload: StartSessionPayload) {
  if (!payload.sessionId || !Array.isArray(payload.targetDeviceIds)) {
    throw new Error("Invalid start-session payload");
  }

  const telemetry = {
    [SCENARIO_KEYS.SESSION_ID]: payload.sessionId,
    [SCENARIO_KEYS.SESSION_STATUS]: "active",
    [SCENARIO_KEYS.SESSION_START]: payload.startTime ?? Date.now(),
    [SCENARIO_KEYS.GAME_NAME]: payload.scenarioId,
    [SCENARIO_KEYS.GAME_ID]: payload.sessionId,
  };

  for (const deviceId of payload.targetDeviceIds) {
    await sendDeviceTelemetry(deviceId, telemetry);
  }

  return {
    updatedDevices: payload.targetDeviceIds.length,
  };
}

async function handleBeepCommand(payload: BeepCommandPayload) {
  if (!payload.targetDeviceId || !payload.sessionId) {
    throw new Error("Invalid send-beep payload");
  }

  await sendOneWayRpc(payload.targetDeviceId, "beep", {
    type: payload.beepType,
    sequence: payload.beepSequence,
    sessionId: payload.sessionId,
    responseWindow: payload.expectedResponseWindow,
    timestamp: payload.timestamp,
  });

  await sendDeviceTelemetry(payload.targetDeviceId, {
    [SCENARIO_KEYS.BEEP_SENT]: payload.timestamp,
    [SCENARIO_KEYS.BEEP_TYPE]: payload.beepType,
    [SCENARIO_KEYS.BEEP_SEQUENCE]: payload.beepSequence,
    [SCENARIO_KEYS.BEEP_TS]: payload.timestamp,
    [SCENARIO_KEYS.SESSION_ID]: payload.sessionId,
  });

  return { deviceId: payload.targetDeviceId };
}

async function handleEndSession(payload: EndSessionPayload) {
  if (!payload.sessionId || !Array.isArray(payload.targetDeviceIds)) {
    throw new Error("Invalid end-session payload");
  }

  const telemetryBase = {
    [SCENARIO_KEYS.SESSION_ID]: payload.sessionId,
    [SCENARIO_KEYS.SESSION_STATUS]: payload.reason,
    [SCENARIO_KEYS.SESSION_END]: payload.endTime ?? Date.now(),
  } as Record<string, unknown>;

  if (payload.results) {
    if (typeof payload.results.score === "number") {
      telemetryBase[SCENARIO_KEYS.SCENARIO_SCORE] = payload.results.score;
    }
    if (typeof payload.results.accuracy === "number") {
      telemetryBase[SCENARIO_KEYS.SCENARIO_ACCURACY] = payload.results.accuracy;
    }
    if (typeof payload.results.totalHits === "number") {
      telemetryBase[SCENARIO_KEYS.TOTAL_HITS] = payload.results.totalHits;
    }
    if (typeof payload.results.averageReactionTime === "number") {
      telemetryBase[SCENARIO_KEYS.AVERAGE_REACTION] = payload.results.averageReactionTime;
    }
  }

  for (const deviceId of payload.targetDeviceIds) {
    await sendDeviceTelemetry(deviceId, telemetryBase);
  }

  return { updatedDevices: payload.targetDeviceIds.length };
}

async function handleSendTelemetry(payload: TelemetryPayload) {
  if (!payload.deviceId || !payload.telemetry) {
    throw new Error("Invalid send-telemetry payload");
  }

  await sendDeviceTelemetry(payload.deviceId, payload.telemetry, payload.scope ?? "DEVICE_SCOPE");
  return { deviceId: payload.deviceId };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return preflightResponse(req);
  }

  if (req.method !== "POST") {
    return errorResponse("Only POST is supported", 405);
  }

  const authResult = await requireUser(req);
  if ("error" in authResult) {
    return authResult.error;
  }

  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch (error) {
    console.error("scenario-control invalid JSON", error);
    return errorResponse("Invalid JSON body", 400);
  }

  const action = typeof payload.action === "string" ? payload.action : undefined;
  if (!action) {
    return errorResponse("Missing action", 400);
  }

  try {
    switch (action) {
      case "start-session": {
        const data = await handleStartSession(payload.session as StartSessionPayload);
        return jsonResponse({ success: true, action, ...data });
      }
      case "send-beep": {
        const data = await handleBeepCommand(payload.command as BeepCommandPayload);
        return jsonResponse({ success: true, action, ...data });
      }
      case "end-session": {
        const data = await handleEndSession(payload.session as EndSessionPayload);
        return jsonResponse({ success: true, action, ...data });
      }
      case "send-telemetry": {
        const data = await handleSendTelemetry(payload.telemetryPayload as TelemetryPayload);
        return jsonResponse({ success: true, action, ...data });
      }
      default:
        return errorResponse(`Unsupported action: ${action}`, 400);
    }
  } catch (error) {
    console.error("scenario-control action failed", { action, error });
    return errorResponse(
      error instanceof Error ? error.message : "Unexpected error",
      500,
      error instanceof Error ? error.stack : error,
    );
  }
});
