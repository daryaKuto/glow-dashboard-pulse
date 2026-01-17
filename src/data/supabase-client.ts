/**
 * Data layer - Supabase client
 * 
 * Single source of truth for Supabase client instance.
 * Re-exports from integrations to maintain clear data layer boundary.
 */

export { supabase } from '@/integrations/supabase/client';
export type { Database } from '@/integrations/supabase/types';



