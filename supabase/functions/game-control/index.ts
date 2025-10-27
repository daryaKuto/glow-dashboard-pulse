import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { requireUser } from "../_shared/auth.ts";
import { errorResponse, jsonResponse, preflightResponse } from "../_shared/response.ts";
import {
  getBatchTelemetry,
  getTenantDevices,
  sendOneWayRpc,
  sendTwoWayRpc,
  setDeviceSharedAttributes,
} from "../_shared/thingsboard.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";

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
  gameId: string | null;
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

type ConfigurePayload = {
  action: "configure";
  deviceIds?: string[];
  gameId?: string;
  gameDuration?: number;
};

type InfoPayload = {
  action: "info";
  deviceIds?: string[];
};

type HistoryPayload = {
  action: "history";
  mode?: "save" | "list";
  limit?: number;
  cursor?: string;
  startBefore?: number;
  startAfter?: number;
  deviceId?: string;
  summary?: {
    gameId: string;
    gameName?: string;
    durationMinutes?: number;
    startTime: number;
    endTime: number;
    totalHits?: number;
    actualDuration?: number;
    averageHitInterval?: number;
    score?: number | null;
    accuracy?: number | null;
    scenarioName?: string | null;
    scenarioType?: string | null;
    roomName?: string | null;
    roomId?: string | null;
    desiredDurationSeconds?: number | null;
    presetId?: string | null;
    targetDeviceIds?: string[];
    targetDeviceNames?: string[];
    deviceResults?: Array<Record<string, unknown>>;
    targetStats?: Array<Record<string, unknown>>;
    crossTargetStats?: Record<string, unknown>;
    splits?: Array<Record<string, unknown>>;
    transitions?: Array<Record<string, unknown>>;
    hitHistory?: Array<Record<string, unknown>>;
  };
};

type RequestPayload = StartPayload | StopPayload | ConfigurePayload | InfoPayload | HistoryPayload;

type HistorySummary = NonNullable<HistoryPayload['summary']>;

type HistorySummary = NonNullable<HistoryPayload['summary']>;

const TELEMETRY_KEYS = ["hits", "wifiStrength", "ambientLight", "event", "gameStatus", "gameId", "hit_ts"];

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

// Walks the ThingsBoard tenant devices page-by-page so downstream callers can build a full status snapshot.
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

// Combines the device catalogue with recent telemetry to produce the response body for GET status requests.
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
    const gameIdRaw = Array.isArray(telemetry.gameId) && telemetry.gameId.length > 0 ? telemetry.gameId[0]?.value : null;
    const hitTsRaw = Array.isArray(telemetry.hit_ts) && telemetry.hit_ts.length > 0 ? telemetry.hit_ts[0] : null;
    const gameStatusRaw = Array.isArray(telemetry.gameStatus) && telemetry.gameStatus.length > 0
      ? telemetry.gameStatus[0]?.value
      : null;

    const deviceStatus = normalizeString(device.status) ?? "unknown";
    const wifiStrength = normalizeNumber(wifiRaw);
    const gameStatus = normalizeString(gameStatusRaw);
    const gameId = normalizeString(gameIdRaw);
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
      gameId,
    } satisfies DeviceStatusPayload;
  });
}

type DeviceCommandResult = {
  deviceId: string;
  success: boolean;
  warning?: string;
  error?: string;
  data?: unknown;
};

// The configure handler seeds planned session metadata on each device so later start/stop RPCs operate against a shared context.
// Seeds shared attributes and issues the configure RPC so targets know the upcoming game context.
async function handleConfigure(payload: ConfigurePayload) {
  const deviceIds = Array.isArray(payload.deviceIds) ? payload.deviceIds.filter(Boolean) : [];
  if (deviceIds.length === 0) {
    return errorResponse("No deviceIds provided", 400);
  }

  const gameId = payload.gameId && payload.gameId.trim().length > 0 ? payload.gameId : `GM-${Date.now()}`;
  const gameDuration = typeof payload.gameDuration === "number" && Number.isFinite(payload.gameDuration)
    ? Math.max(1, Math.floor(payload.gameDuration))
    : null;
  const timestamp = Date.now();

  const results: DeviceCommandResult[] = [];
  for (const deviceId of deviceIds) {
    const result: DeviceCommandResult = { deviceId, success: false };
    try {
      const attributes: Record<string, unknown> = {
        gameId,
        status: "idle",
      };
      if (gameDuration !== null) {
        attributes.gameDuration = gameDuration;
      }

      await setDeviceSharedAttributes(deviceId, attributes);
      try {
        await sendOneWayRpc(deviceId, "configure", {
          ts: timestamp,
          values: {
            deviceId,
            event: "configure",
            gameId,
            gameDuration,
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
    action: "configure",
    gameId,
    gameDuration,
    configuredAt: timestamp,
    deviceIds,
    successCount,
    failureCount,
    results,
  });
}

// Handles the periodic info RPC, collecting each device's realtime telemetry snapshot in the response body.
// Issues the info (one-way) RPC but returns any device feedback so the UI can refresh health metrics quickly.
async function handleInfo(payload: InfoPayload) {
  const deviceIds = Array.isArray(payload.deviceIds) ? payload.deviceIds.filter(Boolean) : [];
  if (deviceIds.length === 0) {
    return errorResponse("No deviceIds provided", 400);
  }

  const timestamp = Date.now();
  const results: DeviceCommandResult[] = [];

  for (const deviceId of deviceIds) {
    const result: DeviceCommandResult = { deviceId, success: false };
    try {
      const info = await sendTwoWayRpc<Record<string, unknown> | undefined>(deviceId, "info", {
        ts: timestamp,
        deviceId,
      });
      result.success = true;
      result.data = info ?? null;
    } catch (error) {
      if (isTimeoutError(error)) {
        result.warning = "rpc-timeout";
      } else {
        result.error = error instanceof Error ? error.message : String(error);
      }
    }
    results.push(result);
  }

  const successCount = results.filter((r) => r.success).length;
  const failureCount = results.length - successCount;

  return jsonResponse({
    action: "info",
    infoAt: timestamp,
    deviceIds,
    successCount,
    failureCount,
    results,
  });
}

// Persists or retrieves user-specific game history records via Supabase, supporting upserts and filtered pagination.
async function handleHistory(
  userId: string,
  options: { mode: "save"; summary: HistorySummary } | { mode: "list"; limit?: number },
) {
  if (!supabaseAdmin) {
    return errorResponse('Supabase admin client not configured', 500);
  }

  if (options.mode === "save") {
    const summary = options.summary;
    if (!summary) {
      return errorResponse("Missing history summary payload", 400);
    }

    const summaryRecord = summary as Record<string, unknown>;

    let sessionId: string | null = null;
    try {
      const hitCount = typeof summary.totalHits === "number"
        ? summary.totalHits
        : Array.isArray(summary.deviceResults)
          ? summary.deviceResults.reduce((sum, device) => {
              const count = typeof device?.hitCount === "number" ? device.hitCount : Number(device?.hitCount) || 0;
              return sum + count;
            }, 0)
          : 0;

      const startedAtIso = new Date(summary.startTime).toISOString();
      const endedAtIso = new Date(summary.endTime).toISOString();
      const durationMs = typeof summary.actualDuration === "number"
        ? Math.max(0, Math.round(summary.actualDuration * 1000))
        : null;

      const sessionPayload = {
        user_id: userId,
        game_id: summary.gameId ?? null,
        scenario_name: summary.scenarioName ?? summary.gameName ?? null,
        scenario_type: summary.scenarioType ?? null,
        room_name: summary.roomName ?? null,
        room_id: typeof summaryRecord.roomId === "string" && summaryRecord.roomId.length > 0 ? summaryRecord.roomId : null,
        score: typeof summary.score === "number" ? summary.score : hitCount,
        duration_ms: durationMs,
        hit_count: hitCount,
        miss_count: 0,
        total_shots: hitCount,
        accuracy_percentage: typeof summary.accuracy === "number" ? summary.accuracy : null,
        avg_reaction_time_ms: null,
        best_reaction_time_ms: null,
        worst_reaction_time_ms: null,
        started_at: startedAtIso,
        ended_at: endedAtIso,
        thingsboard_data: summaryRecord,
        raw_sensor_data: {
          targetStats: summary.targetStats ?? null,
          crossTargetStats: summary.crossTargetStats ?? null,
          splits: summary.splits ?? null,
          transitions: summary.transitions ?? null,
        },
      };

      const { data: sessionInsert, error: sessionError } = await supabaseAdmin
        .from('sessions')
        .insert(sessionPayload)
        .select('id')
        .single();

      if (sessionError) {
        throw sessionError;
      }

      sessionId = sessionInsert?.id ?? null;

      if (sessionId && Array.isArray(summary.hitHistory) && summary.hitHistory.length > 0) {
      const hitRows = summary.hitHistory.map((hit) => ({
        session_id: sessionId,
        user_id: userId,
        target_id: hit.deviceId ?? null,
        target_name: hit.deviceName ?? null,
        room_name: summary.roomName ?? null,
        hit_type: 'hit',
        reaction_time_ms: typeof (hit as Record<string, unknown>)?.reactionTimeMs === 'number'
          ? (hit as Record<string, unknown>).reactionTimeMs
          : null,
        score: typeof (hit as Record<string, unknown>)?.score === 'number'
          ? (hit as Record<string, unknown>).score
          : null,
        hit_timestamp: new Date(hit.timestamp).toISOString(),
        hit_position: {},
        sensor_data: hit,
      }));

        const { error: hitsError } = await supabaseAdmin.from('session_hits').insert(hitRows);
        if (hitsError) {
          throw hitsError;
        }
      }

      if (sessionId) {
        summaryRecord.sessionId = sessionId;
      }
    } catch (sessionError) {
      console.warn('[game-control] Failed to persist session analytics', sessionError);
    }

    let isUpdate = false;
    try {
      const { data: existingRows } = await supabaseAdmin
        .from('game_history')
        .select('id')
        .eq('user_id', userId)
        .eq('game_id', summary.gameId)
        .limit(1);
      if (Array.isArray(existingRows) && existingRows.length > 0) {
        isUpdate = true;
      }
    } catch (lookupError) {
      console.warn('[game-control] Failed to check existing game history', lookupError);
    }

    const row = {
      user_id: userId,
      game_id: summary.gameId,
      game_name: summary.gameName ?? null,
      duration_minutes: typeof summary.durationMinutes === "number" ? summary.durationMinutes : null,
      started_at: new Date(summary.startTime).toISOString(),
      ended_at: new Date(summary.endTime).toISOString(),
      total_hits: typeof summary.totalHits === "number" ? summary.totalHits : null,
      actual_duration_seconds: typeof summary.actualDuration === "number" ? summary.actualDuration : null,
      average_hit_interval: typeof summary.averageHitInterval === "number" ? summary.averageHitInterval : null,
      summary: summaryRecord,
    };

    const { data, error } = await supabaseAdmin
      .from('game_history')
      .upsert(row, { onConflict: 'user_id,game_id' })
      .select('id, created_at, summary')
      .single();

    if (error) {
      console.error('[game-control] Failed to persist game history', error);
      return errorResponse('Failed to save game history', 500, error.message ?? undefined);
    }

    return jsonResponse({
      action: 'history',
      mode: 'save',
      record: {
        id: data?.id ?? null,
        createdAt: data?.created_at ?? null,
        summary: data?.summary ?? null,
      },
      status: isUpdate ? 'updated' : 'created',
    });
  }

  const limit = typeof options.limit === 'number' && Number.isFinite(options.limit)
    ? Math.max(1, Math.min(100, Math.floor(options.limit)))
    : 20;

  const fetchLimit = limit + 1;
  const query = supabaseAdmin
    .from('game_history')
    .select('id, created_at, summary, started_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(fetchLimit);

  if (options.cursor) {
    query.lt('created_at', options.cursor);
  }
  if (options.startBefore) {
    query.lt('started_at', new Date(options.startBefore).toISOString());
  }
  if (options.startAfter) {
    query.gt('started_at', new Date(options.startAfter).toISOString());
  }
  if (options.deviceId) {
    query.contains('summary->deviceResults', [{ deviceId: options.deviceId }]);
  }

  const { data, error } = await query;

  if (error) {
    console.error('[game-control] Failed to fetch game history', error);
    return errorResponse('Failed to fetch game history', 500, error.message ?? undefined);
  }

  const rows = Array.isArray(data) ? data : [];
  const hasMore = rows.length > limit;
  const sliced = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? sliced[sliced.length - 1]?.created_at ?? null : null;

  const history = sliced.map((entry) => ({
    id: entry.id,
    createdAt: entry.created_at,
    summary: entry.summary,
  }));

  return jsonResponse({
    action: 'history',
    mode: 'list',
    history,
    nextCursor,
  });
}

// Sets shared attributes and issues start RPCs so targets transition into the active state together.
async function handleStart(payload: StartPayload) {
  const deviceIds = Array.isArray(payload.deviceIds) ? payload.deviceIds.filter(Boolean) : [];
  if (deviceIds.length === 0) {
    return errorResponse("No deviceIds provided", 400);
  }

  const gameId = payload.gameId && payload.gameId.trim().length > 0 ? payload.gameId : `GM-${Date.now()}`;
  const timestamp = Date.now();

  const results: DeviceCommandResult[] = await Promise.all(
    deviceIds.map(async (deviceId) => {
      const result: DeviceCommandResult = { deviceId, success: false };
      const commandStartedAt = Date.now();
      try {
        console.log(`[game-control:start] setting shared attributes for ${deviceId}`);
        const attributesStartedAt = Date.now();
        await setDeviceSharedAttributes(deviceId, { gameId, status: "busy" });
        const attributesCompletedAt = Date.now();

        console.log(
          `[game-control:start] issuing start RPC for ${deviceId} (attrs ${attributesCompletedAt - attributesStartedAt}ms)`
        );

        const rpcStartedAt = Date.now();
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
            console.warn(`[game-control:start] RPC timeout for ${deviceId} (expected)`);
          } else {
            throw error;
          }
        }
        const rpcCompletedAt = Date.now();

        result.success = true;
        result.data = {
          attributeMs: attributesCompletedAt - attributesStartedAt,
          rpcMs: rpcCompletedAt - rpcStartedAt,
          totalMs: Date.now() - commandStartedAt,
        };

        console.log(
          `[game-control:start] device ${deviceId} marked busy and start command dispatched in ${
            (result.data as { totalMs: number }).totalMs
          }ms`
        );
      } catch (error) {
        result.error = error instanceof Error ? error.message : String(error);
        result.data = {
          totalMs: Date.now() - commandStartedAt,
        };
        console.error(
          `[game-control:start] failed to start device ${deviceId} after ${
            (result.data as { totalMs: number }).totalMs
          }ms`,
          error,
        );
      }
      return result;
    }),
  );

  const successCount = results.filter((r) => r.success).length;
  const failureCount = results.length - successCount;
  const warnings = results
    .filter((r) => typeof r.warning === "string" && r.warning.length > 0)
    .map((r) => ({ deviceId: r.deviceId, warning: r.warning as string }));

  return jsonResponse({
    action: "start",
    gameId,
    startedAt: timestamp,
    deviceIds,
    successCount,
    failureCount,
    results,
    warnings,
  });
}

// Reverts shared attributes and issues stop RPCs, capturing per-device success state for the caller.
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
      const attributes: Record<string, unknown> = {
        status: "free",
        gameId: gameId ?? null,
      };
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
  const warnings = results
    .filter((r) => typeof r.warning === "string" && r.warning.length > 0)
    .map((r) => ({ deviceId: r.deviceId, warning: r.warning as string }));

  return jsonResponse({
    action: "stop",
    gameId,
    stoppedAt: timestamp,
    deviceIds,
    successCount,
    failureCount,
    results,
    warnings,
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
    const url = new URL(req.url);
    const action = url.searchParams.get("action");
    if (action === "history") {
      const limitParam = url.searchParams.get('limit');
      const limit = limitParam ? Number(limitParam) : undefined;
      const cursor = url.searchParams.get('cursor') ?? undefined;
      const startBeforeParam = url.searchParams.get('startBefore');
      const startAfterParam = url.searchParams.get('startAfter');
      const deviceId = url.searchParams.get('deviceId') ?? undefined;
      return handleHistory(authResult.user.id, {
        mode: 'list',
        limit,
        cursor: cursor ?? undefined,
        startBefore: startBeforeParam ? Number(startBeforeParam) : undefined,
        startAfter: startAfterParam ? Number(startAfterParam) : undefined,
        deviceId,
      });
    }
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

    if (payload.action === "configure") {
      return handleConfigure(payload as ConfigurePayload);
    }
    if (payload.action === "info") {
      return handleInfo(payload as InfoPayload);
    }
    if (payload.action === "history") {
      const historyPayload = payload as HistoryPayload;
      if (historyPayload.mode === 'save' && historyPayload.summary) {
        return handleHistory(authResult.user.id, { mode: 'save', summary: historyPayload.summary as HistorySummary });
      }
      return handleHistory(authResult.user.id, {
        mode: 'list',
        limit: historyPayload.limit,
        cursor: historyPayload.cursor,
        startBefore: historyPayload.startBefore,
        startAfter: historyPayload.startAfter,
        deviceId: historyPayload.deviceId,
      });
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
