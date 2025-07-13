import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables. Please check your .env.local file.');
}

export const supabase = createClient<Database>(supabaseUrl, supabaseKey, {
  auth: { persistSession: true },
  global: {
    headers: {
      'X-Client-Info': 'glow-dashboard-pulse',
    },
  },
  db: {
    schema: 'public',
  },
  realtime: {
    timeout: 10000, // 10 second timeout for realtime connections
  },
});