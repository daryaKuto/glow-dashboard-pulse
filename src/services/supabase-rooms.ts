import { supabase } from '@/integrations/supabase/client';

export interface UserRoom {
  id: string;
  name: string;
  room_type: string;
  icon: string;
  order_index: number;
  created_at: string;
  updated_at: string;
  target_count?: number; // Calculated field
}

export interface UserRoomTarget {
  id: string;
  user_id: string;
  room_id: string;
  target_id: string;
  target_name: string;
  assigned_at: string;
}

export interface CreateRoomData {
  name: string;
  room_type: string;
  icon: string;
  order_index: number;
  assignedTargets?: string[];
}

class SupabaseRoomsService {
  private syncedTargets: any[] = [];

  // Get current user ID
  private async getCurrentUserId(): Promise<string> {
    console.log('🔐 getCurrentUserId - Starting auth check...');
    
    const { data: { user }, error } = await supabase.auth.getUser();
    
    console.log('🔐 getCurrentUserId - Supabase auth check:', {
      user: user ? { id: user.id, email: user.email } : null,
      error: error?.message
    });
    
    if (error) {
      console.error('❌ Supabase auth error:', error);
      throw new Error(`Authentication error: ${error.message}`);
    }
    
    if (!user) {
      console.error('❌ No user found in Supabase session');
      throw new Error('No authenticated user found');
    }
    
    console.log('✅ User authenticated:', user.email);
    return user.id;
  }

  // Get all user rooms with target counts
  async getUserRooms(): Promise<UserRoom[]> {
    try {
      const userId = await this.getCurrentUserId();
      
      // Get rooms with target counts
      const { data: rooms, error } = await supabase
        .from('user_rooms')
        .select(`
          *,
          user_room_targets(count)
        `)
        .eq('user_id', userId)
        .order('order_index', { ascending: true });

      if (error) {
        console.error('❌ Error fetching user rooms:', error);
        throw error;
      }

      // Transform the data to include target count
      const transformedRooms = rooms.map(room => ({
        ...room,
        target_count: room.user_room_targets?.[0]?.count || 0
      }));

      return transformedRooms;
    } catch (error) {
      console.error('Error fetching user rooms:', error);
      throw error;
    }
  }

  // Create a new room
  async createRoom(roomData: CreateRoomData): Promise<UserRoom> {
    try {
      const userId = await this.getCurrentUserId();
      
      const { data: room, error: roomError } = await supabase
        .from('user_rooms')
        .insert({
          user_id: userId,
          name: roomData.name,
          room_type: roomData.room_type,
          icon: roomData.icon,
          order_index: roomData.order_index
        })
        .select()
        .single();

      if (roomError) throw roomError;

      // Assign targets if provided
      if (roomData.assignedTargets && roomData.assignedTargets.length > 0) {
        await this.assignTargetsToRoom(room.id, roomData.assignedTargets);
      }

      return {
        ...room,
        target_count: roomData.assignedTargets?.length || 0
      };
    } catch (error) {
      console.error('Error creating room:', error);
      throw error;
    }
  }

  // Update room
  async updateRoom(roomId: string, updates: Partial<CreateRoomData>): Promise<UserRoom> {
    try {
      const userId = await this.getCurrentUserId();
      
      const { data: room, error } = await supabase
        .from('user_rooms')
        .update({
          name: updates.name,
          room_type: updates.room_type,
          icon: updates.icon,
          order_index: updates.order_index
        })
        .eq('id', roomId)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) throw error;
      return room;
    } catch (error) {
      console.error('Error updating room:', error);
      throw error;
    }
  }

  // Delete room
  async deleteRoom(roomId: string): Promise<void> {
    try {
      const userId = await this.getCurrentUserId();
      
      // First, unassign all targets from this room
      await this.unassignTargetsFromRoom(roomId);
      
      // Then delete the room
      const { error } = await supabase
        .from('user_rooms')
        .delete()
        .eq('id', roomId)
        .eq('user_id', userId);

      if (error) throw error;
    } catch (error) {
      console.error('Error deleting room:', error);
      throw error;
    }
  }

  // Update room order
  async updateRoomOrder(roomOrders: { id: string, order_index: number }[]): Promise<void> {
    try {
      const userId = await this.getCurrentUserId();
      
      // Update each room's order
      for (const roomOrder of roomOrders) {
        const { error } = await supabase
          .from('user_rooms')
          .update({ order_index: roomOrder.order_index })
          .eq('id', roomOrder.id)
          .eq('user_id', userId);

        if (error) throw error;
      }
    } catch (error) {
      console.error('Error updating room order:', error);
      throw error;
    }
  }

  // Assign targets to a room
  async assignTargetsToRoom(roomId: string, targetIds: string[]): Promise<void> {
    try {
      console.log(`🔄 assignTargetsToRoom: Starting assignment of ${targetIds.length} targets to room ${roomId}`);
      const userId = await this.getCurrentUserId();
      console.log(`✅ Got user ID: ${userId}`);
      
      // First, unassign these targets from any other room
      console.log('🔄 Unassigning targets from other rooms...');
      await this.unassignTargets(targetIds);
      console.log('✅ Targets unassigned from other rooms');
      
      // Create target assignments
      const assignments = targetIds.map(targetId => ({
        user_id: userId,
        room_id: roomId,
        target_id: targetId,
        target_name: `Target ${targetId.substring(0, 8)}` // Default name, should be updated with real name
      }));

      console.log('🔄 Inserting assignments into Supabase:', assignments);
      const { data, error } = await supabase
        .from('user_room_targets')
        .insert(assignments)
        .select();

      if (error) {
        console.error('❌ Supabase insert error:', error);
        throw error;
      }
      
      console.log('✅ Assignments inserted successfully:', data);
    } catch (error) {
      console.error('❌ Error assigning targets to room:', error);
      throw error;
    }
  }

  // Unassign targets from all rooms
  async unassignTargets(targetIds: string[]): Promise<void> {
    try {
      console.log(`🔄 unassignTargets: Removing ${targetIds.length} targets from all rooms`);
      const userId = await this.getCurrentUserId();
      console.log(`✅ Got user ID for unassign: ${userId}`);
      
      const { data, error } = await supabase
        .from('user_room_targets')
        .delete()
        .in('target_id', targetIds)
        .eq('user_id', userId)
        .select();

      if (error) {
        console.error('❌ Supabase unassign error:', error);
        throw error;
      }
      
      console.log('✅ Targets unassigned successfully:', data);
    } catch (error) {
      console.error('❌ Error unassigning targets:', error);
      throw error;
    }
  }

  // Unassign all targets from a specific room
  async unassignTargetsFromRoom(roomId: string): Promise<void> {
    try {
      const userId = await this.getCurrentUserId();
      
      const { error } = await supabase
        .from('user_room_targets')
        .delete()
        .eq('room_id', roomId)
        .eq('user_id', userId);

      if (error) throw error;
    } catch (error) {
      console.error('Error unassigning targets from room:', error);
      throw error;
    }
  }

  // Get targets assigned to a specific room
  async getRoomTargets(roomId: string): Promise<any[]> {
    try {
      const userId = await this.getCurrentUserId();
      
      // Get target assignments for this room
      const { data: assignments, error } = await supabase
        .from('user_room_targets')
        .select('target_id')
        .eq('room_id', roomId)
        .eq('user_id', userId);

      if (error) throw error;

      if (!assignments || assignments.length === 0) {
        return [];
      }

      // Get all targets from ThingsBoard
      const { API } = await import('@/lib/api');
      const allTargets = await API.getTargets() as any[];
      
      // Filter to only include targets that are assigned to this room
      const assignedTargetIds = assignments.map(a => a.target_id);
      const roomTargets = allTargets.filter(target => 
        assignedTargetIds.includes(this.getTargetId(target))
      );

      return roomTargets;
    } catch (error) {
      console.error('Error fetching room targets:', error);
      throw error;
    }
  }

  // Helper function to extract target ID
  private getTargetId(target: any): string {
    if (target.id?.id) return target.id.id;
    if (target.id) return target.id;
    return 'unknown';
  }

  // Store synced targets from ThingsBoard
  setSyncedTargets(targets: any[]): void {
    this.syncedTargets = targets;
    console.log('📡 Stored synced targets:', targets.length);
  }

  // Get all synced targets (SUPABASE ONLY)
  private getSyncedTargets(): any[] {
    // Return stored synced targets or empty array
    if (this.syncedTargets.length > 0) {
      return this.syncedTargets;
    }
    
    console.log('⚠️ No synced targets stored, returning empty array');
    return [];
  }

  // Get ALL synced targets (for stats display)
  async getAllSyncedTargets(): Promise<any[]> {
    return this.getSyncedTargets();
  }

  // Get unassigned targets
  async getUnassignedTargets(): Promise<any[]> {
    try {
      const userId = await this.getCurrentUserId();
      
      // Get all target assignments
      const { data: assignments, error } = await supabase
        .from('user_room_targets')
        .select('target_id')
        .eq('user_id', userId);

      if (error) throw error;

      // Get all targets from ThingsBoard
      const { API } = await import('@/lib/api');
      const allTargets = await API.getTargets() as any[];
      
      // Filter out assigned targets
      const assignedTargetIds = assignments?.map(a => a.target_id) || [];
      const unassignedTargets = allTargets.filter(target => 
        !assignedTargetIds.includes(this.getTargetId(target))
      );

      return unassignedTargets;
    } catch (error) {
      console.error('Error fetching unassigned targets:', error);
      // Return all synced targets as fallback
      return this.getSyncedTargets();
    }
  }

  // Get all targets with their room assignments
  async getAllTargetsWithAssignments(): Promise<any[]> {
    try {
      const userId = await this.getCurrentUserId();
      
      // Get all target assignments
      const { data: assignments, error } = await supabase
        .from('user_room_targets')
        .select('target_id, room_id')
        .eq('user_id', userId);

      if (error) throw error;

      // Get all targets from ThingsBoard
      const { API } = await import('@/lib/api');
      const allTargets = await API.getTargets() as any[];
      
      // Create a map of target_id -> room_id
      const assignmentMap = new Map<string, string>();
      if (assignments) {
        assignments.forEach(assignment => {
          assignmentMap.set(assignment.target_id, assignment.room_id);
        });
      }
      
      console.log('🗺️ Assignment map:', Array.from(assignmentMap.entries()));

      // Merge target data with room assignments
      const targetsWithAssignments = allTargets.map(target => {
        const targetId = this.getTargetId(target);
        const roomId = assignmentMap.get(targetId);
        
        const result = {
          ...target,
          roomId: roomId || null
        };
        
        // Ensure roomId is properly set
        if (roomId) {
          result.roomId = roomId;
        }
        
        console.log(`🎯 Target ${target.name} (${targetId}) → Room ${result.roomId}`);
        return result;
      });

      console.log('✅ Final merged targets:', targetsWithAssignments.map(t => ({ 
        name: t.name, 
        roomId: t.roomId,
        roomIdType: typeof t.roomId
      })));
      return targetsWithAssignments;
    } catch (error) {
      console.error('Error fetching targets with assignments:', error);
      throw error;
    }
  }

  // Store a session in the database
  async storeSession(sessionData: {
    room_id: string;
    room_name: string;
    scenario_name: string;
    scenario_type: string;
    score: number;
    duration_ms: number;
    hit_count: number;
    miss_count: number;
    total_shots: number;
    avg_reaction_time_ms?: number;
    best_reaction_time_ms?: number;
    worst_reaction_time_ms?: number;
    started_at: string;
    ended_at?: string;
    thingsboard_data?: any;
    raw_sensor_data?: any;
  }): Promise<string> {
    try {
      const userId = await this.getCurrentUserId();
      
      const accuracy = sessionData.total_shots > 0 
        ? Math.round((sessionData.hit_count / sessionData.total_shots) * 100 * 100) / 100
        : 0;

      const { data: session, error } = await supabase
        .from('sessions')
        .insert({
          user_id: userId,
          room_id: sessionData.room_id,
          room_name: sessionData.room_name,
          scenario_name: sessionData.scenario_name,
          scenario_type: sessionData.scenario_type,
          score: sessionData.score,
          duration_ms: sessionData.duration_ms,
          hit_count: sessionData.hit_count,
          miss_count: sessionData.miss_count,
          total_shots: sessionData.total_shots,
          accuracy_percentage: accuracy,
          avg_reaction_time_ms: sessionData.avg_reaction_time_ms,
          best_reaction_time_ms: sessionData.best_reaction_time_ms,
          worst_reaction_time_ms: sessionData.worst_reaction_time_ms,
          started_at: sessionData.started_at,
          ended_at: sessionData.ended_at,
          thingsboard_data: sessionData.thingsboard_data || {},
          raw_sensor_data: sessionData.raw_sensor_data || {}
        })
        .select()
        .single();

      if (error) throw error;

      return session.id;
    } catch (error) {
      console.error('Error storing session:', error);
      throw error;
    }
  }

  // Store synced targets from ThingsBoard
  async storeSyncedTargets(targets: any[]): Promise<void> {
    try {
      const userId = await this.getCurrentUserId();
      
      console.log(`Storing ${targets.length} synced targets for user ${userId}`);
      
      // In a full implementation, you'd store these in a user_targets table
      // For now, we'll use the mock data approach but mark it as "synced"
    } catch (error) {
      console.error('Error storing synced targets:', error);
    }
  }
}

export const supabaseRoomsService = new SupabaseRoomsService();