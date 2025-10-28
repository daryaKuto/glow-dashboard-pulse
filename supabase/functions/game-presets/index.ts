import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { requireUser } from "../_shared/auth.ts";
import { errorResponse, jsonResponse, preflightResponse } from "../_shared/response.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";

type PresetPayload = {
  id?: string;
  name: string;
  description?: string | null;
  roomId?: string | null;
  roomName?: string | null;
  durationSeconds?: number | null;
  targetIds: string[];
  settings?: Record<string, unknown> | null;
};

type ListRequest = { action: "list" };
type SaveRequest = { action: "save"; preset: PresetPayload };
type DeleteRequest = { action: "delete"; id: string };

type RequestPayload = ListRequest | SaveRequest | DeleteRequest;

const ALLOWED_METHODS = ["POST", "OPTIONS"];

async function handleList(userId: string) {
  if (!supabaseAdmin) {
    return errorResponse("Supabase admin client not configured", 500);
  }

  const startedAt = Date.now();
  console.info("[game-presets] handleList called", {
    userId,
    at: new Date().toISOString(),
  });
  const { data, error } = await supabaseAdmin
    .from("game_presets")
    .select(
      "id, name, description, room_id, room_name, duration_seconds, target_ids, settings, created_at, updated_at",
    )
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if (error) {
    console.error("[game-presets] Failed to fetch presets", error);
    return errorResponse("Failed to fetch presets", 500, error.message ?? undefined);
  }

  console.info("[game-presets] handleList succeeded", {
    userId,
    at: new Date().toISOString(),
    elapsedMs: Date.now() - startedAt,
    presetCount: data?.length ?? 0,
    sample: (data ?? []).slice(0, 3).map((preset) => ({
      id: preset.id,
      name: preset.name,
      durationSeconds: preset.duration_seconds,
      targetCount: preset.target_ids?.length ?? 0,
    })),
  });
  return jsonResponse({
    presets: data ?? [],
  });
}

async function handleSave(userId: string, preset: PresetPayload | undefined) {
  if (!supabaseAdmin) {
    return errorResponse("Supabase admin client not configured", 500);
  }

  if (!preset) {
    return errorResponse("Missing preset payload", 400);
  }
  console.info("[game-presets] handleSave called", {
    userId,
    hasPreset: Boolean(preset),
    name: preset?.name,
    targetCount: preset?.targetIds?.length ?? 0,
    durationSeconds: preset?.durationSeconds ?? null,
    roomId: preset?.roomId ?? null,
  });
  if (!preset.name || typeof preset.name !== "string" || preset.name.trim().length === 0) {
    return errorResponse("Preset name is required", 400);
  }
  if (!Array.isArray(preset.targetIds) || preset.targetIds.length === 0) {
    return errorResponse("At least one target must be selected", 400);
  }

  const nowIso = new Date().toISOString();
  const row = {
    id: preset.id ?? undefined,
    user_id: userId,
    name: preset.name.trim(),
    description: preset.description ?? null,
    room_id: preset.roomId ?? null,
    room_name: preset.roomName ?? null,
    duration_seconds:
      typeof preset.durationSeconds === "number" && Number.isFinite(preset.durationSeconds)
        ? Math.max(0, Math.floor(preset.durationSeconds))
        : null,
    target_ids: preset.targetIds,
    settings: preset.settings ?? {},
    updated_at: nowIso,
  };

  if (!row.id) {
    row.updated_at = nowIso;
  }

  const { data, error } = await supabaseAdmin
    .from("game_presets")
    .upsert(
      {
        ...row,
        created_at: preset.id ? undefined : nowIso,
      },
      { onConflict: "id", defaultToNull: false },
    )
    .select(
      "id, name, description, room_id, room_name, duration_seconds, target_ids, settings, created_at, updated_at",
    )
    .single();

  if (error) {
    console.error("[game-presets] Failed to save preset", error);
    return errorResponse("Failed to save preset", 500, error.message ?? undefined);
  }

  console.info("[game-presets] handleSave succeeded", {
    presetId: data?.id,
    name: data?.name,
    targetCount: data?.target_ids?.length ?? 0,
    durationSeconds: data?.duration_seconds ?? null,
  });
  return jsonResponse({
    preset: data,
    status: preset.id ? "updated" : "created",
  });
}

async function handleDelete(userId: string, id: string | undefined) {
  if (!supabaseAdmin) {
    return errorResponse("Supabase admin client not configured", 500);
  }
  if (!id) {
    return errorResponse("Preset id is required", 400);
  }

  const { error, count } = await supabaseAdmin
    .from("game_presets")
    .delete({ count: "exact" })
    .eq("user_id", userId)
    .eq("id", id);

  if (error) {
    console.error("[game-presets] Failed to delete preset", error);
    return errorResponse("Failed to delete preset", 500, error.message ?? undefined);
  }

  return jsonResponse({
    status: count && count > 0 ? "deleted" : "not_found",
  });
}

Deno.serve(async (req) => {
  const method = req.method.toUpperCase();
  if (!ALLOWED_METHODS.includes(method)) {
    return errorResponse("Method not allowed", 405);
  }

  if (method === "OPTIONS") {
    return preflightResponse(req);
  }

  let payload: RequestPayload;
  try {
    payload = await req.json();
  } catch (error) {
    console.error("[game-presets] Failed to parse request body", error);
    return errorResponse("Invalid JSON payload", 400);
  }

  const authResult = await requireUser(req);
  if ("error" in authResult) {
    console.warn("[game-presets] requireUser returned error");
    return authResult.error;
  }

  const { user } = authResult;

  switch (payload.action) {
    case "list":
      return handleList(user.id);
    case "save":
      return handleSave(user.id, payload.preset);
    case "delete":
      return handleDelete(user.id, payload.id);
    default:
      return errorResponse("Unsupported action", 400);
  }
});
