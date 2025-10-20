import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const url = Deno.env.get('SUPABASE_URL') ?? Deno.env.get('EDGE_SUPABASE_URL');
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('EDGE_SUPABASE_SERVICE_ROLE_KEY');

if (!url) {
  console.warn('[supabaseAdmin] SUPABASE_URL/EDGE_SUPABASE_URL is not set. Make sure to configure your function secrets.');
}

if (!serviceRoleKey) {
  console.warn('[supabaseAdmin] SUPABASE_SERVICE_ROLE_KEY/EDGE_SUPABASE_SERVICE_ROLE_KEY is not set. Admin operations will fail until it is provided.');
}

export const supabaseAdmin = url && serviceRoleKey
  ? createClient(url, serviceRoleKey, {
      auth: { persistSession: false },
    })
  : undefined;

export type SupabaseAdminClient = typeof supabaseAdmin;
