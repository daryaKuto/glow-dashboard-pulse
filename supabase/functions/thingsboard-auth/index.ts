import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { requireUser } from "../_shared/auth.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { errorResponse, jsonResponse, preflightResponse } from "../_shared/response.ts";
import { loginWithCredentials } from "../_shared/thingsboard.ts";

type AuthResult = {
  connected: boolean;
  reason?: string;
  lastSync?: string | null;
};

interface AuthRequestBody {
  credentials?: {
    email?: string;
    password?: string;
  };
}

function decodePassword(encrypted: string): string {
  try {
    return atob(encrypted);
  } catch (error) {
    console.error('[thingsboard-auth] Failed to decode password', error);
    throw new Error('invalid_encrypted_password');
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return preflightResponse(req);
  }

  if (req.method !== "POST") {
    return errorResponse("Only POST is supported", 405);
  }

  if (!supabaseAdmin) {
    return errorResponse('Supabase admin client not configured', 500);
  }

  const authResult = await requireUser(req);
  if ("error" in authResult) {
    return authResult.error;
  }

  let body: AuthRequestBody = {};
  try {
    body = await req.json();
  } catch (_error) {
    // Ignore malformed JSON – treat as empty body
    body = {};
  }

  const credentials = body.credentials;
  if (credentials?.email && credentials?.password) {
    try {
      await loginWithCredentials(credentials.email, credentials.password);
      return jsonResponse({ connected: true } satisfies AuthResult);
    } catch (loginError) {
      console.warn('[thingsboard-auth] Credential verification failed', loginError);
      return jsonResponse({
        connected: false,
        reason: 'invalid_credentials',
      } satisfies AuthResult);
    }
  }

  const userId = authResult.user.id;

  const { data: profile, error } = await supabaseAdmin
    .from('user_profiles')
    .select('thingsboard_email, thingsboard_password_encrypted, thingsboard_last_sync')
    .eq('id', userId)
    .single();

  if (error) {
    console.error('[thingsboard-auth] Failed to load profile', error);
    return errorResponse('Failed to load profile', 500, error.message ?? error.details);
  }

  if (!profile?.thingsboard_email || !profile?.thingsboard_password_encrypted) {
    const result: AuthResult = {
      connected: false,
      reason: 'missing_credentials',
      lastSync: profile?.thingsboard_last_sync ?? null,
    };
    return jsonResponse(result);
  }

  let password: string;
  try {
    password = decodePassword(profile.thingsboard_password_encrypted);
  } catch (_decodeError) {
    const result: AuthResult = {
      connected: false,
      reason: 'invalid_encrypted_password',
      lastSync: profile?.thingsboard_last_sync ?? null,
    };
    return jsonResponse(result);
  }

  try {
    await loginWithCredentials(profile.thingsboard_email, password);
  } catch (loginError) {
    console.warn('[thingsboard-auth] Stored credential login failed', loginError);
    const result: AuthResult = {
      connected: false,
      reason: 'invalid_credentials',
      lastSync: profile?.thingsboard_last_sync ?? null,
    };
    return jsonResponse(result);
  }

  const syncTimestamp = new Date().toISOString();
  try {
    await supabaseAdmin
      .from('user_profiles')
      .update({
        thingsboard_last_sync: syncTimestamp,
        updated_at: syncTimestamp,
      })
      .eq('id', userId);
  } catch (updateError) {
    console.warn('[thingsboard-auth] Failed to update last_sync', updateError);
  }

  const result: AuthResult = {
    connected: true,
    lastSync: syncTimestamp,
  };

  return jsonResponse(result);
});
