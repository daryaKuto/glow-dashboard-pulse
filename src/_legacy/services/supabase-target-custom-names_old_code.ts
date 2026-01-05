/**
 * @deprecated Legacy implementation.
 * Replaced by: src/features/targets/repo.ts (getTargetCustomNames/setTargetCustomName/removeTargetCustomName).
 */

import { supabase } from '@/integrations/supabase/client';

export interface UserTargetCustomName {
  id: string;
  user_id: string;
  target_id: string;
  original_name: string;
  custom_name: string;
  created_at: string;
  updated_at: string;
}

class SupabaseTargetCustomNamesService {
  // Get current user ID
  private async getCurrentUserId(): Promise<string> {
    const { data: { user }, error } = await supabase.auth.getUser();
    
    if (error) {
      console.error('❌ Supabase auth error:', error);
      throw new Error(`Authentication error: ${error.message}`);
    }
    
    if (!user) {
      console.error('❌ No user found in Supabase session');
      throw new Error('No authenticated user found');
    }
    return user.id;
  }

  // Get custom name for a specific target
  async getCustomName(targetId: string): Promise<string | null> {
    try {
      const userId = await this.getCurrentUserId();
      
      const { data, error } = await supabase
        .from('user_target_custom_names')
        .select('custom_name')
        .eq('user_id', userId)
        .eq('target_id', targetId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No custom name found
          return null;
        }
        throw error;
      }

      return data?.custom_name || null;
    } catch (error) {
      console.error('Error fetching custom name:', error);
      return null;
    }
  }

  // Get all custom names for the current user
  async getAllCustomNames(): Promise<Map<string, string>> {
    try {
      const userId = await this.getCurrentUserId();
      
      const { data, error } = await supabase
        .from('user_target_custom_names')
        .select('target_id, custom_name')
        .eq('user_id', userId);

      if (error) throw error;

      const customNamesMap = new Map<string, string>();
      data?.forEach(record => {
        customNamesMap.set(record.target_id, record.custom_name);
      });

      return customNamesMap;
    } catch (error) {
      console.error('Error fetching all custom names:', error);
      return new Map();
    }
  }

  // Set custom name for a target
  async setCustomName(targetId: string, originalName: string, customName: string): Promise<void> {
    try {
      if (!customName.trim()) {
        throw new Error('Custom name cannot be empty');
      }

      const userId = await this.getCurrentUserId();
      
      // Use upsert to insert or update
      const { error } = await supabase
        .from('user_target_custom_names')
        .upsert({
          user_id: userId,
          target_id: targetId,
          original_name: originalName,
          custom_name: customName.trim(),
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id,target_id'
        });

      if (error) throw error;
    } catch (error) {
      console.error('Error setting custom name:', error);
      throw error;
    }
  }

  // Remove custom name (revert to original)
  async removeCustomName(targetId: string): Promise<void> {
    try {
      const userId = await this.getCurrentUserId();
      
      const { error } = await supabase
        .from('user_target_custom_names')
        .delete()
        .eq('user_id', userId)
        .eq('target_id', targetId);

      if (error) throw error;
    } catch (error) {
      console.error('Error removing custom name:', error);
      throw error;
    }
  }
}

export const supabaseTargetCustomNamesService = new SupabaseTargetCustomNamesService();
