import { supabase } from '@/integrations/supabase/client';
import { fetchTargetsWithTelemetry } from '@/lib/edge';
import type { Target } from '@/store/useTargets';

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
  
  // Cache for getAllTargetsWithAssignments with 30 second TTL
  private targetsWithAssignmentsCache: {
    data: any[] | null;
    timestamp: number;
    userId: string | null;
  } = {
    data: null,
    timestamp: 0,
    userId: null
  };
  
  private readonly CACHE_TTL = 30000; // 30 seconds
  private onTargetsInvalidated: (() => void) | null = null;

  // Clear cache when mutations occur
  private clearTargetsCache(): void {
    console.log('🧹 [CACHE] Clearing targets with assignments cache');
    this.targetsWithAssignmentsCache = {
      data: null,
      timestamp: 0,
      userId: null
    };
    this.notifyTargetsInvalidated();
  }

  // Check if cache is valid for current user
  private isCacheValid(userId: string): boolean {
    const now = Date.now();
    const cacheAge = now - this.targetsWithAssignmentsCache.timestamp;
    const isValid = this.targetsWithAssignmentsCache.data !== null &&
                   this.targetsWithAssignmentsCache.userId === userId &&
                   cacheAge < this.CACHE_TTL;
    
    return isValid;
  }

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

  setTargetsInvalidationHandler(handler: (() => void) | null): void {
    this.onTargetsInvalidated = handler ?? null;
  }

  private notifyTargetsInvalidated(): void {
    if (!this.onTargetsInvalidated) {
      return;
    }

    try {
      this.onTargetsInvalidated();
    } catch (error) {
      console.warn('⚠️ [CACHE] Failed to notify targets invalidation handler:', error);
    }
  }

  private async fetchLatestTargets(force = false): Promise<Target[]> {
    try {
      const { targets } = await fetchTargetsWithTelemetry(force);
      return targets;
    } catch (error) {
      console.warn('⚠️ [CACHE] Unable to fetch latest targets snapshot:', error);
      return [];
    }
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
  async assignTargetsToRoom(roomId: string, targetIds: string[], targetNames?: Map<string, string>): Promise<void> {
    try {
      console.log(`🎯 [ASSIGNMENT] Starting assignment of ${targetIds.length} targets to room ${roomId}`);
      console.log(`🎯 [ASSIGNMENT] Target IDs:`, targetIds);
      console.log(`🎯 [ASSIGNMENT] Target names map:`, targetNames ? Object.fromEntries(targetNames) : 'None provided');
      
      const userId = await this.getCurrentUserId();
      console.log(`🔍 [ID-CHECK] User ID retrieved: ${userId}`);
      console.log(`🔍 [ID-CHECK] Room ID format: ${roomId} (type: ${typeof roomId})`);
      
      // First, unassign these targets from any other room
      console.log('🎯 [ASSIGNMENT] Unassigning targets from other rooms...');
      await this.unassignTargets(targetIds);
      console.log('✅ [SUCCESS] Targets unassigned from other rooms');
      
      // Create target assignments with proper names
      const assignments = targetIds.map(targetId => {
        const assignment = {
          user_id: userId,
          room_id: roomId,
          target_id: targetId,
          target_name: targetNames?.get(targetId) || `Target ${targetId.substring(0, 8)}`
        };
        console.log(`🔍 [ID-CHECK] Created assignment for target ${targetId}:`, assignment);
        return assignment;
      });

      console.log('🎯 [ASSIGNMENT] Inserting assignments into Supabase:', assignments);
      console.log('🔐 [AUTH] Current user:', await supabase.auth.getUser());
      
      const { data, error } = await supabase
        .from('user_room_targets')
        .insert(assignments)
        .select();

      if (error) {
        console.error('❌ [ERROR] Supabase insert error:', error);
        console.error('❌ [ERROR] Error code:', error.code);
        console.error('❌ [ERROR] Error message:', error.message);
        console.error('❌ [ERROR] Error details:', error.details);
        console.error('❌ [ERROR] Error hint:', error.hint);
        console.error('❌ [ERROR] Assignments that failed:', assignments);
        throw error; // Make sure this reaches the UI
      }
      
      console.log('✅ [SUCCESS] Assignments inserted successfully:', data);
      console.log(`📊 [DATA] Inserted ${data?.length || 0} assignment records`);
      
      // Clear cache after successful assignment
      this.clearTargetsCache();
      
      // Step 5: Verify the data was actually saved and can be read back
      console.log('🔍 [VERIFY] Verifying assignments can be read back...');
      try {
        const { data: verifyData, error: verifyError } = await supabase
          .from('user_room_targets')
          .select('target_id, room_id, target_name, assigned_at, created_at')
          .eq('user_id', userId)
          .eq('room_id', roomId);
        
        if (verifyError) {
          console.error('❌ [VERIFY-ERROR] Failed to read back assignments:', verifyError);
        } else {
          console.log('✅ [VERIFY] Successfully read back assignments:', verifyData);
          console.log(`📊 [VERIFY] Read back ${verifyData?.length || 0} assignment records`);
          
          if (!verifyData || verifyData.length === 0) {
            console.error('❌ [VERIFY-ERROR] No assignments found after insert - RLS may be blocking reads');
          } else if (verifyData.length !== data.length) {
            console.warn(`⚠️ [VERIFY-WARNING] Mismatch: inserted ${data.length}, read back ${verifyData.length}`);
          } else {
            console.log('✅ [VERIFY] All assignments successfully verified');
          }
        }
      } catch (verifyErr) {
        console.error('❌ [VERIFY-ERROR] Exception during verification:', verifyErr);
      }
    } catch (error) {
      console.error('❌ [ERROR] Error assigning targets to room:', error);
      throw error;
    }
  }

  // Unassign targets from all rooms
  async unassignTargets(targetIds: string[]): Promise<void> {
    try {
      console.log(`🎯 [ASSIGNMENT] Unassigning ${targetIds.length} targets from all rooms`);
      console.log(`🎯 [ASSIGNMENT] Target IDs to unassign:`, targetIds);
      
      const userId = await this.getCurrentUserId();
      console.log(`🔍 [ID-CHECK] User ID for unassign: ${userId}`);
      
      console.log('🎯 [ASSIGNMENT] Executing Supabase delete query...');
      const { data, error } = await supabase
        .from('user_room_targets')
        .delete()
        .in('target_id', targetIds)
        .eq('user_id', userId)
        .select();

      if (error) {
        console.error('❌ [ERROR] Supabase unassign error:', error);
        console.error('❌ [ERROR] Error details:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });
        throw error;
      }
      
      console.log('✅ [SUCCESS] Targets unassigned successfully:', data);
      console.log(`📊 [DATA] Unassigned ${data?.length || 0} assignment records`);
      
      // Clear cache after successful unassignment
      this.clearTargetsCache();
    } catch (error) {
      console.error('❌ [ERROR] Error unassigning targets:', error);
      throw error;
    }
  }

  // Assign single target to room (wrapper for assignTargetsToRoom)
  async assignTargetToRoom(targetId: string, roomId: string | null, targetName?: string): Promise<void> {
    try {
      console.log(`🎯 [ASSIGNMENT] Single target assignment: ${targetId} to ${roomId ? `room ${roomId}` : 'unassigned'}`);
      console.log(`🔍 [ID-CHECK] Target ID format: ${targetId} (type: ${typeof targetId})`);
      console.log(`🔍 [ID-CHECK] Room ID format: ${roomId} (type: ${typeof roomId})`);
      
      if (roomId === null) {
        // Unassign target from all rooms
        console.log('🎯 [ASSIGNMENT] Unassigning target from all rooms...');
        await this.unassignTargets([targetId]);
        console.log('✅ [SUCCESS] Target unassigned from all rooms');
        return;
      }

      // Get target name if not provided
      let finalTargetName = targetName;
      if (!finalTargetName) {
        try {
          console.log('🔍 [TARGET-NAME] Fetching target name from latest targets snapshot...');
          const allTargets = await this.fetchLatestTargets();
          const target = allTargets.find((t) => this.getTargetId(t) === targetId);
          finalTargetName = target?.name || `Target ${targetId.substring(0, 8)}`;
          console.log(`🔍 [TARGET-NAME] Found target name: ${finalTargetName}`);
        } catch (error) {
          console.warn('⚠️ [TARGET-NAME] Could not fetch target name, using fallback:', error);
          finalTargetName = `Target ${targetId.substring(0, 8)}`;
        }
      }

      // Create target names map for the plural method
      const targetNames = new Map<string, string>();
      targetNames.set(targetId, finalTargetName);

      // Call the plural method with single target
      await this.assignTargetsToRoom(roomId, [targetId], targetNames);
      console.log(`✅ [SUCCESS] Single target assignment completed: ${targetId} → ${roomId}`);
    } catch (error) {
      console.error('❌ [ERROR] Error in single target assignment:', error);
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
      
      // Clear cache after successful unassignment
      this.clearTargetsCache();
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

      // Get all targets from cached snapshots
      const allTargets = await this.fetchLatestTargets();
      
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
  }

  // Get all synced targets (SUPABASE ONLY)
  private getSyncedTargets(): any[] {
    // Return stored synced targets or empty array
    if (this.syncedTargets.length > 0) {
      return this.syncedTargets;
    }
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

      // Get all targets from cached snapshots
      const allTargets = await this.fetchLatestTargets();
      
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

  // Get all target-room assignments for the current user
  async getAllTargetRoomAssignments(): Promise<Array<{ target_id: string; room_id: string }>> {
    try {
      const userId = await this.getCurrentUserId();
      
      const { data, error } = await supabase
        .from('user_room_targets')
        .select('target_id, room_id')
        .eq('user_id', userId);
      
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching target room assignments:', error);
      return [];
    }
  }

  // Get rooms with target counts in a single optimized query
  async getRoomsWithTargetCounts(): Promise<UserRoom[]> {
    try {
      const userId = await this.getCurrentUserId();
      
      // Get rooms first
      const { data: rooms, error: roomsError } = await supabase
        .from('user_rooms')
        .select('id, name, room_type, icon, order_index, created_at, updated_at')
        .eq('user_id', userId)
        .order('order_index', { ascending: true });

      if (roomsError) throw roomsError;

      // Get target counts for all rooms in a single query
      const { data: targetCounts, error: countsError } = await supabase
        .from('user_room_targets')
        .select('room_id')
        .eq('user_id', userId);

      if (countsError) throw countsError;

      // Count targets per room
      const roomTargetCounts = new Map<string, number>();
      targetCounts?.forEach(assignment => {
        const count = roomTargetCounts.get(assignment.room_id) || 0;
        roomTargetCounts.set(assignment.room_id, count + 1);
      });

      // Transform the data to include target counts
      const roomsWithCounts: UserRoom[] = rooms?.map(room => ({
        id: room.id,
        name: room.name,
        room_type: room.room_type,
        icon: room.icon,
        order_index: room.order_index,
        created_at: room.created_at,
        updated_at: room.updated_at,
        target_count: roomTargetCounts.get(room.id) || 0
      })) || [];

      return roomsWithCounts;
    } catch (error) {
      console.error('❌ Error getting rooms with target counts:', error);
      throw error;
    }
  }

  // Get all targets with their room assignments
  async getAllTargetsWithAssignments(forceRefresh: boolean = false): Promise<any[]> {
    try {
      // Step 1: Verify authentication status
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError) {
        console.error('❌ [AUTH-ERROR] Authentication check failed:', authError);
        throw new Error(`Authentication failed: ${authError.message}`);
      }
      if (!user) {
        console.error('❌ [AUTH-ERROR] No authenticated user found');
        throw new Error('No authenticated user found');
      }
      
      const userId = await this.getCurrentUserId();
      // Check cache first (unless force refresh is requested)
      if (!forceRefresh && this.isCacheValid(userId)) {
        return this.targetsWithAssignmentsCache.data!;
      }
      
      // Step 2: Verify user ID matches auth user
      if (userId !== user.id) {
        console.error(`❌ [AUTH-ERROR] User ID mismatch: auth.id=${user.id}, getCurrentUserId()=${userId}`);
        throw new Error('User ID mismatch between auth and profile');
      }
      
      // Step 3: Get all target assignments from Supabase with detailed logging
      const { data: assignments, error } = await supabase
        .from('user_room_targets')
        .select('target_id, room_id, target_name, assigned_at, created_at')
        .eq('user_id', userId);

      if (error) {
        console.error('❌ [ERROR] Error fetching assignments:', error);
        console.error('❌ [ERROR] Error details:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });
        throw error;
      }
      
      // Step 4: If no assignments found, check if there are any in the table at all
      if (!assignments || assignments.length === 0) {
        const { data: allAssignments, error: allError } = await supabase
          .from('user_room_targets')
          .select('*')
          .limit(5);
        
        if (allError) {
          console.error('❌ [DEBUG-ERROR] Error checking all assignments:', allError);
        }
      }

      try {
        // Try to get target snapshot with 15 second timeout (increased from 5s)
        const allTargets = await Promise.race([
          this.fetchLatestTargets(true),
          new Promise<Target[]>((_, reject) =>
            setTimeout(() => reject(new Error('Targets snapshot timeout')), 15000)
          ),
        ]);
      
      // Create a map of target_id -> room_id
      const assignmentMap = new Map<string, string>();
      if (assignments) {
        assignments.forEach(assignment => {
          assignmentMap.set(assignment.target_id, assignment.room_id);
        });
      }
      
      const assignmentIds = Array.from(assignmentMap.keys());
      const targetIds = allTargets.map(t => this.getTargetId(t));

      // Clean up stale assignments for non-existent targets
      const staleAssignmentIds = assignmentIds.filter(id => !targetIds.includes(id));
      if (staleAssignmentIds.length > 0) {
        try {
          await supabase
            .from('user_room_targets')
            .delete()
            .eq('user_id', userId)
            .in('target_id', staleAssignmentIds);
        } catch (error) {
          console.error('❌ Error cleaning up stale assignments:', error);
        }
      }

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
        return result;
      });

      // Check for duplicates in the merged data
      const mergedIds = targetsWithAssignments.map(t => this.getTargetId(t));
      const duplicateMergedIds = mergedIds.filter((id, index) => mergedIds.indexOf(id) !== index);
      if (duplicateMergedIds.length > 0) {
        console.warn('🚨 Duplicate target IDs found in merged data:', duplicateMergedIds);
        duplicateMergedIds.forEach(dupId => {
          const duplicates = targetsWithAssignments.filter(t => this.getTargetId(t) === dupId);
          console.log(`   ID ${dupId}:`, duplicates.map(t => ({ name: t.name, roomId: t.roomId })));
        });
      }

        // Deduplicate targets by ID before returning
        const uniqueTargets = targetsWithAssignments.reduce((acc: any[], target) => {
          const targetId = this.getTargetId(target);
          const existingIndex = acc.findIndex(t => this.getTargetId(t) === targetId);
          if (existingIndex === -1) {
            acc.push(target);
          } else {
            console.warn(`⚠️ Service: Duplicate target found: ${target.name} (ID: ${targetId})`);
            // Keep the one with more complete data (has roomId or more properties)
            const existing = acc[existingIndex];
            if (target.roomId && !existing.roomId) {
              acc[existingIndex] = target; // Replace with the one that has roomId
            } else if (Object.keys(target).length > Object.keys(existing).length) {
              acc[existingIndex] = target; // Replace with more complete data
            }
          }
          return acc;
        }, []);

        // Store in cache
        this.targetsWithAssignmentsCache = {
          data: uniqueTargets,
          timestamp: Date.now(),
          userId: userId
        };
        return uniqueTargets;
      } catch (error) {
        // Fallback: Use Supabase data only
        console.warn('ThingsBoard unavailable, showing assigned devices only:', error);
        
        // Return devices we know about from assignments
        return assignments?.map(a => ({
          id: a.target_id,
          name: a.target_name || `Target ${a.target_id.substring(0, 8)}`,
          roomId: a.room_id,
          status: 'unknown',
          isFromSupabase: true  // Flag to show limited data
        })) || [];
      }
    } catch (error) {
      console.error('Error fetching targets with assignments:', error);
      throw error;
    }
  }

  // Store a game session in the database
  // This stores the complete analytics from a game instance played by a user
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
