import { supabase } from '@/integrations/supabase/client';
import type { RoomLayoutResponse, RoomLayoutData, FloorPlanLayout } from '@/lib/types';

/**
 * Service for managing room layouts in Supabase
 * Handles floor plan data and target positions
 */
class SupabaseRoomLayoutsService {
  /**
   * Get current user ID from Supabase auth
   */
  private async getCurrentUserId(): Promise<string> {
    const { data: { user }, error } = await supabase.auth.getUser();
    
    if (error) {
      console.error('Supabase auth error:', error);
      throw new Error(`Authentication error: ${error.message}`);
    }
    
    if (!user) {
      throw new Error('No authenticated user found');
    }
    return user.id;
  }

  /**
   * Load room layout including target positions and floor plan
   */
  async loadRoomLayout(roomId: string): Promise<RoomLayoutResponse> {
    try {
      const userId = await this.getCurrentUserId();

      // Load target positions from user_room_targets
      const { data: targetsData, error: targetsError } = await supabase
        .from('user_room_targets')
        .select('target_id, position_x, position_y')
        .eq('user_id', userId)
        .eq('room_id', roomId)
        .not('position_x', 'is', null)
        .not('position_y', 'is', null);

      if (targetsError) {
        console.error('Error loading target positions:', targetsError);
        throw targetsError;
      }

      // Load groups for this room
      const { data: groupsData, error: groupsError } = await supabase
        .from('user_target_groups')
        .select('id, name')
        .eq('user_id', userId)
        .eq('room_id', roomId);

      if (groupsError) {
        console.error('Error loading groups:', groupsError);
        throw groupsError;
      }

      // Load group assignments to get target IDs
      const groupIds = (groupsData as any)?.map((g: any) => g.id) || [];
      const { data: assignmentsData, error: assignmentsError } = await supabase
        .from('user_target_group_assignments')
        .select('group_id, target_id')
        .eq('user_id', userId)
        .in('group_id', groupIds);

      if (assignmentsError) {
        console.error('Error loading group assignments:', assignmentsError);
        throw assignmentsError;
      }

      // Build groups with target IDs
      const groups = (groupsData as any)?.map((group: any) => ({
        id: group.id,
        name: group.name,
        targetIds: (assignmentsData as any)
          ?.filter((a: any) => a.group_id === group.id)
          .map((a: any) => a.target_id) || [],
      })) || [];

      // Load floor plan layout
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/833eaf25-0547-420d-a570-1d7cab6b5873',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'supabase-room-layouts.ts:82',message:'Loading floor plan layout',data:{userId,roomId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      const { data: layoutData, error: layoutError } = await supabase
        .from('user_room_layouts' as any)
        .select('layout_data, canvas_width, canvas_height, viewport_scale, viewport_x, viewport_y')
        .eq('user_id', userId)
        .eq('room_id', roomId)
        .maybeSingle();

      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/833eaf25-0547-420d-a570-1d7cab6b5873',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'supabase-room-layouts.ts:88',message:'Floor plan query result',data:{hasData:!!layoutData,errorCode:layoutError?.code,errorMessage:layoutError?.message,errorDetails:JSON.stringify(layoutError)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion

      let floorPlan: RoomLayoutData | undefined;

      if (layoutError) {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/833eaf25-0547-420d-a570-1d7cab6b5873',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'supabase-room-layouts.ts:93',message:'Processing layout error',data:{errorCode:layoutError.code,errorMessage:layoutError.message,errorStatus:layoutError.status,fullError:JSON.stringify(layoutError)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
        // #endregion
        // PGRST116 is "not found" error, which is OK (no layout exists yet)
        // 406 is "Not Acceptable" which usually means RLS policies aren't set up yet
        if (layoutError.code === 'PGRST116') {
          // No layout exists - this is fine
          console.log('No floor plan layout found for room:', roomId);
        } else if (layoutError.code === 'PGRST301' || layoutError.status === 406 || layoutError.message?.includes('406')) {
          // RLS policy error or 406 - table might not have RLS set up yet
          console.warn('Floor plan layout table may not have RLS policies set up:', layoutError.message);
          // Continue without floor plan - don't throw
        } else {
          // Other errors - log but don't throw to allow app to continue
          console.error('Error loading floor plan layout:', layoutError);
          // Don't throw - allow app to continue without floor plan
        }
      }

      if (layoutData) {
        const layout = layoutData as any;
        floorPlan = {
          layout: layout.layout_data as FloorPlanLayout,
          canvasWidth: layout.canvas_width,
          canvasHeight: layout.canvas_height,
          viewportScale: layout.viewport_scale,
          viewportX: layout.viewport_x,
          viewportY: layout.viewport_y,
        };
      }

      return {
        targets: (targetsData as any)?.map((t: any) => ({
          id: t.target_id,
          x: t.position_x || 0,
          y: t.position_y || 0,
        })) || [],
        groups,
        floorPlan,
      };
    } catch (error) {
      console.error('Error loading room layout:', error);
      throw error;
    }
  }

  /**
   * Save room layout including target positions and floor plan
   */
  async saveRoomLayout(
    roomId: string,
    targets: Array<{ id: string; x: number; y: number }>,
    groups: Array<{ id: string; name: string; targetIds: string[] }>,
    floorPlan?: RoomLayoutData
  ): Promise<void> {
    try {
      const userId = await this.getCurrentUserId();

      // Update target positions
      if (targets.length > 0) {
        const updates = targets.map(target => ({
          user_id: userId,
          room_id: roomId,
          target_id: target.id,
          position_x: target.x,
          position_y: target.y,
        }));

        // Use upsert to update existing or create new positions
        // Note: This requires the target to already exist in user_room_targets
        // We'll update position_x and position_y for existing records
        for (const target of targets) {
          // @ts-ignore - position_x/position_y columns exist but may not be in types
          const { error } = await supabase
            .from('user_room_targets')
            .update({
              position_x: target.x,
              position_y: target.y,
            } as any)
            .eq('user_id', userId)
            .eq('room_id', roomId)
            .eq('target_id', target.id);

          if (error) {
            console.error(`Error updating position for target ${target.id}:`, error);
            // Continue with other targets even if one fails
          }
        }
      }

      // Save floor plan layout
      if (floorPlan) {
        const { error: layoutError } = await supabase
          .from('user_room_layouts' as any)
          .upsert({
            user_id: userId,
            room_id: roomId,
            layout_data: floorPlan.layout,
            canvas_width: floorPlan.canvasWidth || 600,
            canvas_height: floorPlan.canvasHeight || 750,
            viewport_scale: floorPlan.viewportScale || 1.0,
            viewport_x: floorPlan.viewportX || 0,
            viewport_y: floorPlan.viewportY || 0,
            updated_at: new Date().toISOString(),
          } as any, {
            onConflict: 'user_id,room_id',
          });

        if (layoutError) {
          // Handle RLS policy errors gracefully
          if (layoutError.code === 'PGRST301' || layoutError.status === 406 || layoutError.message?.includes('406')) {
            console.warn('Cannot save floor plan layout - RLS policies may not be set up:', layoutError.message);
            // Don't throw - allow app to continue
          } else {
            console.error('Error saving floor plan layout:', layoutError);
            throw layoutError;
          }
        }
      } else {
        // If no floor plan, delete existing layout
        const { error: deleteError } = await supabase
          .from('user_room_layouts' as any)
          .delete()
          .eq('user_id', userId)
          .eq('room_id', roomId);

        if (deleteError && deleteError.code !== 'PGRST116') {
          // Ignore RLS errors when deleting (might not have permissions or table might not exist)
          if (deleteError.code !== 'PGRST301' && deleteError.status !== 406 && !deleteError.message?.includes('406')) {
            console.error('Error deleting floor plan layout:', deleteError);
          }
          // Don't throw - it's OK if there's nothing to delete or RLS blocks it
        }
      }
    } catch (error) {
      console.error('Error saving room layout:', error);
      throw error;
    }
  }
}

export const supabaseRoomLayoutsService = new SupabaseRoomLayoutsService();

