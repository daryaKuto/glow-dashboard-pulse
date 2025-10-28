import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { requireUser } from "../_shared/auth.ts";
import { errorResponse, jsonResponse, preflightResponse } from "../_shared/response.ts";
import {
  sendDeviceTelemetry,
  sendOneWayRpc,
  setDeviceSharedAttributes,
} from "../_shared/thingsboard.ts";

type RpcCommandPayload = {
  deviceId: string;
  method: string;
  params?: Record<string, unknown>;
};

type RpcBatchPayload = {
  deviceIds: string[];
  method: string;
  params?: Record<string, unknown>;
};

type AttributeCommandPayload = {
  deviceIds: string[];
  attributes: Record<string, unknown>;
  scope?: "SHARED_SCOPE" | "SERVER_SCOPE";
};

type TelemetryCommandPayload = {
  deviceIds: string[];
  telemetry: Record<string, unknown>;
  scope?: "DEVICE_SCOPE" | "SERVER_SCOPE";
};

type DeviceCommandRequest = {
  action: string;
  rpc?: RpcCommandPayload;
  rpcBatch?: RpcBatchPayload;
  setAttributes?: AttributeCommandPayload;
  sendTelemetry?: TelemetryCommandPayload;
};

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

  let payload: DeviceCommandRequest;
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
      case "send-rpc": {
        const data = payload.rpc;
        if (!data || !data.deviceId || !data.method) {
          return errorResponse("rpc payload requires deviceId and method", 400);
        }

        await sendOneWayRpc(data.deviceId, data.method, data.params ?? {});
        return jsonResponse({ deviceId: data.deviceId, method: data.method, success: true });
      }

      case "send-rpc-batch": {
        const data = payload.rpcBatch;
        if (!data || !Array.isArray(data.deviceIds) || data.deviceIds.length === 0 || !data.method) {
          return errorResponse("rpcBatch payload requires deviceIds and method", 400);
        }

        const results = await Promise.allSettled(
          data.deviceIds.map((deviceId) => sendOneWayRpc(deviceId, data.method!, data.params ?? {})),
        );

        const summary = results.map((result, index) => ({
          deviceId: data.deviceIds[index],
          success: result.status === "fulfilled",
          error: result.status === "rejected" ? String(result.reason) : undefined,
        }));

        return jsonResponse({ method: data.method, results: summary });
      }

      case "set-attributes": {
        const data = payload.setAttributes;
        if (!data || !Array.isArray(data.deviceIds) || data.deviceIds.length === 0 || typeof data.attributes !== "object") {
          return errorResponse("setAttributes payload requires deviceIds and attributes", 400);
        }

        const scope = data.scope === "SERVER_SCOPE" ? "SERVER_SCOPE" : "SHARED_SCOPE";
        const results = await Promise.allSettled(
          data.deviceIds.map((deviceId) => setDeviceSharedAttributes(deviceId, data.attributes, scope)),
        );

        const summary = results.map((result, index) => ({
          deviceId: data.deviceIds[index],
          success: result.status === "fulfilled",
          error: result.status === "rejected" ? String(result.reason) : undefined,
        }));

        return jsonResponse({ scope, results: summary });
      }

      case "send-telemetry": {
        const data = payload.sendTelemetry;
        if (!data || !Array.isArray(data.deviceIds) || data.deviceIds.length === 0 || typeof data.telemetry !== "object") {
          return errorResponse("sendTelemetry payload requires deviceIds and telemetry", 400);
        }

        const scope = data.scope === "SERVER_SCOPE" ? "SERVER_SCOPE" : "DEVICE_SCOPE";
        const results = await Promise.allSettled(
          data.deviceIds.map((deviceId) => sendDeviceTelemetry(deviceId, data.telemetry, scope)),
        );

        const summary = results.map((result, index) => ({
          deviceId: data.deviceIds[index],
          success: result.status === "fulfilled",
          error: result.status === "rejected" ? String(result.reason) : undefined,
        }));

        return jsonResponse({ scope, results: summary });
      }

      default:
        return errorResponse(`Unsupported action: ${action}`, 400);
    }
  } catch (error) {
    console.error("[device-command] action failed", { action, error });
    return errorResponse(
      error instanceof Error ? error.message : "Unexpected error",
      500,
      error instanceof Error ? error.stack : error,
    );
  }
});
