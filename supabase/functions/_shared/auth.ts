import { createClient, type User } from "https://esm.sh/@supabase/supabase-js@2";
import { errorResponse } from './response.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? Deno.env.get('EDGE_SUPABASE_URL');
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? Deno.env.get('EDGE_SUPABASE_ANON_KEY');

const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: false } })
  : undefined;

type AuthSuccess = { user: User };
type AuthFailure = { error: Response };

type AuthResult = AuthSuccess | AuthFailure;

export async function requireUser(request: Request): Promise<AuthResult> {
  if (!supabase) {
    return { error: errorResponse('Supabase client not configured', 500) };
  }

  const authHeader = request.headers.get('Authorization') ?? '';
  const token = authHeader.replace('Bearer ', '').trim();

  if (!token) {
    return { error: errorResponse('Missing Authorization header', 401) };
  }

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) {
    return { error: errorResponse('Invalid or expired token', 401, error?.message) };
  }

  return { user: data.user };
}
