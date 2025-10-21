import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { requireUser } from "../_shared/auth.ts";
import { errorResponse, jsonResponse, preflightResponse } from "../_shared/response.ts";
import {
  getBatchTelemetry,
  getDeviceAttributes,
  getDeviceTelemetry,
  getHistoricalTelemetry,
  sendDeviceTelemetry,
  setDeviceSharedAttributes,
} from "../_shared/thingsboard.ts";

const DEFAULT_KEYS = ["hits", "hit_ts", "battery", "wifiStrength", "event", "gameStatus"] as const;

type TelemetryKeys = string[] | undefined;

type LatestTelemetryPayload = {
  deviceId: string;
  keys?: TelemetryKeys;
  limit?: number;
};

type BatchTelemetryPayload = {
  deviceIds: string[];
  keys?: TelemetryKeys;
  limit?: number;
};

type HistoricalTelemetryPayload = {
  deviceId: string;
  keys?: TelemetryKeys;
  startTs: number;
  endTs: number;
  limit?: number;
};

type SetAttributesPayload = {
  deviceId: string;
  scope?: "SHARED_SCOPE" | "SERVER_SCOPE";
  attributes: Record<string, unknown>;
};

type SendTelemetryPayload = {
  deviceId: string;
  scope?: "DEVICE_SCOPE" | "SERVER_SCOPE";
  telemetry: Record<string, unknown>;
};

type GetAttributesPayload = {
  deviceId: string;
  scope?: "CLIENT_SCOPE" | "SHARED_SCOPE" | "SERVER_SCOPE";
  keys?: string[];
};

type DeviceAdminRequest = {
  action: string;
  latestTelemetry?: LatestTelemetryPayload;
  batchTelemetry?: BatchTelemetryPayload;
  historicalTelemetry?: HistoricalTelemetryPayload;
  setAttributes?: SetAttributesPayload;
  telemetryPayload?: SendTelemetryPayload;
  getAttributes?: GetAttributesPayload;
};

function normaliseKeys(keys?: TelemetryKeys): string[] {
  if (Array.isArray(keys) && keys.length > 0) {
    return keys.map(String);
  }
  return [...DEFAULT_KEYS];
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

  let payload: DeviceAdminRequest;
  try {
    payload = await req.json();
  } catch (_error) {
    return errorResponse("Invalid JSON payload", 400);
  }

  const action = typeof payload.action === "string" ? payload.action : undefined;
  if (!action) {
    return errorResponse("Missing action", 400);
  }

  try {
    switch (action) {
      case "latest-telemetry": {
        const data = payload.latestTelemetry;
        if (!data || !data.deviceId) {
          return errorResponse("latestTelemetry payload requires deviceId", 400);
        }

        const telemetry = await getDeviceTelemetry(
          data.deviceId,
          normaliseKeys(data.keys),
          typeof data.limit === "number" && data.limit > 0 ? data.limit : 1,
        );

        return jsonResponse({
          deviceId: data.deviceId,
          telemetry,
        });
      }

      case "batch-telemetry": {
        const data = payload.batchTelemetry;
        if (!data || !Array.isArray(data.deviceIds) || data.deviceIds.length === 0) {
          return errorResponse("batchTelemetry payload requires deviceIds", 400);
        }

        const telemetry = await getBatchTelemetry(
          data.deviceIds.map(String),
          normaliseKeys(data.keys),
          typeof data.limit === "number" && data.limit > 0 ? data.limit : 1,
        );

        return jsonResponse({ telemetry });
      }

      case "historical-telemetry": {
        const data = payload.historicalTelemetry;
        if (!data || !data.deviceId) {
          return errorResponse("historicalTelemetry payload requires deviceId", 400);
        }
        if (typeof data.startTs !== "number" || typeof data.endTs !== "number") {
          return errorResponse("historicalTelemetry requires startTs and endTs", 400);
        }

        const history = await getHistoricalTelemetry(
          data.deviceId,
          normaliseKeys(data.keys),
          data.startTs,
          data.endTs,
          typeof data.limit === "number" && data.limit > 0 ? data.limit : 1000,
        );

        return jsonResponse({
          deviceId: data.deviceId,
          history,
        });
      }

      case "set-attributes": {
        const data = payload.setAttributes;
        if (!data || !data.deviceId || typeof data.attributes !== "object") {
          return errorResponse("setAttributes payload requires deviceId and attributes", 400);
        }

        await setDeviceSharedAttributes(
          data.deviceId,
          data.attributes,
          data.scope === "SERVER_SCOPE" ? "SERVER_SCOPE" : "SHARED_SCOPE",
        );

        return jsonResponse({
          deviceId: data.deviceId,
          scope: data.scope ?? "SHARED_SCOPE",
          updated: true,
        });
      }

      case "get-attributes": {
        const data = payload.getAttributes;
        if (!data || !data.deviceId) {
          return errorResponse("getAttributes payload requires deviceId", 400);
        }

        const attributes = await getDeviceAttributes(data.deviceId, {
          scope: data.scope,
          keys: data.keys,
        });

        return jsonResponse({
          deviceId: data.deviceId,
          attributes,
        });
      }

      case "send-telemetry": {
        const data = payload.telemetryPayload;
        if (!data || !data.deviceId || typeof data.telemetry !== "object") {
          return errorResponse("telemetryPayload requires deviceId and telemetry", 400);
        }

        await sendDeviceTelemetry(
          data.deviceId,
          data.telemetry,
          data.scope === "SERVER_SCOPE" ? "SERVER_SCOPE" : "DEVICE_SCOPE",
        );

        return jsonResponse({
          deviceId: data.deviceId,
          scope: data.scope ?? "DEVICE_SCOPE",
          sent: true,
        });
      }

      default:
        return errorResponse(`Unsupported action: ${action}`, 400);
    }
  } catch (error) {
    console.error("[device-admin] action failed", { action, error });
    return errorResponse(
      error instanceof Error ? error.message : "Unexpected error",
      500,
      error instanceof Error ? error.stack : error,
    );
  }
});
