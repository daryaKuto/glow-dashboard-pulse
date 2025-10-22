import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { requireUser } from "../_shared/auth.ts";
import { errorResponse, jsonResponse, preflightResponse } from "../_shared/response.ts";
import { getTokenWithExpiry, invalidateTokenCache } from "../_shared/thingsboard.ts";

type SessionResponse = {
  token: string;
  issuedAt: number;
  expiresAt: number;
  expiresIn: number;
};

type SessionRequestBody = {
  force?: boolean;
  invalidate?: boolean;
};

Deno.serve(async (req) => {
  const method = req.method.toUpperCase();

  if (method === "OPTIONS") {
    return preflightResponse(req);
  }

  if (method !== "GET" && method !== "POST") {
    return errorResponse("Only GET or POST is supported", 405);
  }

  const authResult = await requireUser(req);
  if ("error" in authResult) {
    return authResult.error;
  }

  let body: SessionRequestBody = {};
  if (method === "POST") {
    try {
      body = await req.json();
    } catch (_err) {
      body = {};
    }
  }

  if (body.invalidate === true) {
    invalidateTokenCache();
  }

  try {
    const session = await getTokenWithExpiry({ force: body.force });
    const response: SessionResponse = {
      token: session.token,
      issuedAt: session.issuedAt,
      expiresAt: session.expiresAt,
      expiresIn: session.expiresIn,
    };
    return jsonResponse(response);
  } catch (error) {
    console.error("[thingsboard-session] Failed to fetch ThingsBoard token", error);
    return errorResponse(
      "Unable to obtain ThingsBoard session",
      502,
      error instanceof Error ? error.message : String(error),
    );
  }
});
