import { supabase } from '@/data/supabase-client';
import { fetchRoomsData } from '@/lib/edge';
import type { Target } from '@/features/targets';
import { apiOk, apiErr, type ApiResponse } from '@/shared/lib/api-response';
import type { RoomRepository } from '@/domain/rooms/ports';
import type {
  Room,
  CreateRoomData,
  UpdateRoomData,
  RoomOrder,
  AssignTargetToRoomData,
} from './schema';

/**
 * Repository layer for Rooms feature
 * 
 * Handles all data access operations (Supabase queries, edge function calls).
 * Returns ApiResponse<T> for consistent error handling.
 */

export interface EdgeRoom {
  id: string;
  name: string;
  order: number;
  icon?: string | null;
  room_type?: string | null;
  targetCount: number;
  targets: Target[];
}

export interface RoomsWithTargets {
  rooms: EdgeRoom[];
  unassignedTargets: Target[];
  cached: boolean;
}

/**
 * Get all rooms with targets from edge function
 */
export async function getRooms(force = false): Promise<ApiResponse<RoomsWithTargets>> {
  try {
    const result = await fetchRoomsData(force);
    return apiOk(result);
  } catch (error) {
    console.error('[Rooms Repo] Error fetching rooms:', error);
    return apiErr(
      'FETCH_ROOMS_ERROR',
      error instanceof Error ? error.message : 'Failed to fetch rooms',
      error
    );
  }
}

/**
 * Get current user ID from Supabase auth
 */
async function getCurrentUserId(): Promise<string> {
  const { data: { user }, error } = await supabase.auth.getUser();
  
  if (error) {
    throw new Error(`Authentication error: ${error.message}`);
  }
  
  if (!user) {
    throw new Error('No authenticated user found');
  }
  
  return user.id;
}

/**
 * Create a new room
 */
export async function createRoom(roomData: CreateRoomData): Promise<ApiResponse<Room>> {
  try {
    const userId = await getCurrentUserId();
    
    const { data: room, error: roomError } = await supabase
      .from('user_rooms')
      .insert({
        user_id: userId,
        name: roomData.name,
        room_type: roomData.room_type,
        icon: roomData.icon,
        order_index: roomData.order_index,
      })
      .select()
      .single();

    if (roomError) {
      return apiErr('CREATE_ROOM_ERROR', roomError.message, roomError);
    }

    // Assign targets if provided
    if (roomData.assignedTargets && roomData.assignedTargets.length > 0) {
      const assignResult = await assignTargetsToRoom(room.id, roomData.assignedTargets);
      if (!assignResult.ok) {
        // Room was created but assignment failed - return partial success
        console.warn('[Rooms Repo] Room created but target assignment failed:', assignResult.error);
      }
    }

    const result: Room = {
      id: room.id,
      name: room.name,
      room_type: room.room_type,
      icon: room.icon,
      order_index: room.order_index,
      created_at: room.created_at,
      updated_at: room.updated_at,
      target_count: roomData.assignedTargets?.length || 0,
    };

    return apiOk(result);
  } catch (error) {
    console.error('[Rooms Repo] Error creating room:', error);
    return apiErr(
      'CREATE_ROOM_ERROR',
      error instanceof Error ? error.message : 'Failed to create room',
      error
    );
  }
}

/**
 * Update an existing room
 */
export async function updateRoom(
  roomId: string,
  updates: UpdateRoomData
): Promise<ApiResponse<Room>> {
  try {
    const userId = await getCurrentUserId();
    
    const updateData: Record<string, unknown> = {};
    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.room_type !== undefined) updateData.room_type = updates.room_type;
    if (updates.icon !== undefined) updateData.icon = updates.icon;
    if (updates.order_index !== undefined) updateData.order_index = updates.order_index;

    const { data: room, error } = await supabase
      .from('user_rooms')
      .update(updateData)
      .eq('id', roomId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      return apiErr('UPDATE_ROOM_ERROR', error.message, error);
    }

    const result: Room = {
      id: room.id,
      name: room.name,
      room_type: room.room_type,
      icon: room.icon,
      order_index: room.order_index,
      created_at: room.created_at,
      updated_at: room.updated_at,
    };

    return apiOk(result);
  } catch (error) {
    console.error('[Rooms Repo] Error updating room:', error);
    return apiErr(
      'UPDATE_ROOM_ERROR',
      error instanceof Error ? error.message : 'Failed to update room',
      error
    );
  }
}

/**
 * Repository adapter (ports & adapters pilot)
 */
export const roomsRepository: RoomRepository<Target> = {
  getRooms,
  createRoom,
  updateRoom,
  deleteRoom,
  updateRoomOrder,
  assignTargetToRoom,
  assignTargetsToRoom,
  unassignTargets,
  getRoomTargets,
};

/**
 * Delete a room
 */
export async function deleteRoom(roomId: string): Promise<ApiResponse<void>> {
  try {
    const userId = await getCurrentUserId();
    
    // First, unassign all targets from this room
    await unassignTargetsFromRoom(roomId);
    
    // Then delete the room
    const { error } = await supabase
      .from('user_rooms')
      .delete()
      .eq('id', roomId)
      .eq('user_id', userId);

    if (error) {
      return apiErr('DELETE_ROOM_ERROR', error.message, error);
    }

    return apiOk(undefined);
  } catch (error) {
    console.error('[Rooms Repo] Error deleting room:', error);
    return apiErr(
      'DELETE_ROOM_ERROR',
      error instanceof Error ? error.message : 'Failed to delete room',
      error
    );
  }
}

/**
 * Update room order
 */
export async function updateRoomOrder(roomOrders: RoomOrder): Promise<ApiResponse<void>> {
  try {
    const userId = await getCurrentUserId();
    
    // Update each room's order
    for (const roomOrder of roomOrders) {
      const { error } = await supabase
        .from('user_rooms')
        .update({ order_index: roomOrder.order_index })
        .eq('id', roomOrder.id)
        .eq('user_id', userId);

      if (error) {
        return apiErr('UPDATE_ROOM_ORDER_ERROR', error.message, error);
      }
    }

    return apiOk(undefined);
  } catch (error) {
    console.error('[Rooms Repo] Error updating room order:', error);
    return apiErr(
      'UPDATE_ROOM_ORDER_ERROR',
      error instanceof Error ? error.message : 'Failed to update room order',
      error
    );
  }
}

/**
 * Assign targets to a room
 */
export async function assignTargetsToRoom(
  roomId: string,
  targetIds: string[],
  targetNames?: Map<string, string>
): Promise<ApiResponse<void>> {
  try {
    const userId = await getCurrentUserId();
    
    // First, unassign these targets from any other room
    await unassignTargets(targetIds);
    
    // Create target assignments
    const assignments = targetIds.map(targetId => ({
      user_id: userId,
      room_id: roomId,
      target_id: targetId,
      target_name: targetNames?.get(targetId) || `Target ${targetId.substring(0, 8)}`,
    }));

    const { error } = await supabase
      .from('user_room_targets')
      .insert(assignments);

    if (error) {
      return apiErr('ASSIGN_TARGETS_ERROR', error.message, error);
    }

    return apiOk(undefined);
  } catch (error) {
    console.error('[Rooms Repo] Error assigning targets to room:', error);
    return apiErr(
      'ASSIGN_TARGETS_ERROR',
      error instanceof Error ? error.message : 'Failed to assign targets to room',
      error
    );
  }
}

/**
 * Assign a single target to a room
 */
export async function assignTargetToRoom(
  data: AssignTargetToRoomData
): Promise<ApiResponse<void>> {
  try {
    if (data.roomId === null) {
      // Unassign target from all rooms
      return await unassignTargets([data.targetId]);
    }

    const targetNames = data.targetName
      ? new Map<string, string>([[data.targetId, data.targetName]])
      : undefined;

    return await assignTargetsToRoom(data.roomId, [data.targetId], targetNames);
  } catch (error) {
    console.error('[Rooms Repo] Error assigning target to room:', error);
    return apiErr(
      'ASSIGN_TARGET_ERROR',
      error instanceof Error ? error.message : 'Failed to assign target to room',
      error
    );
  }
}

/**
 * Unassign targets from all rooms
 */
export async function unassignTargets(targetIds: string[]): Promise<ApiResponse<void>> {
  try {
    const userId = await getCurrentUserId();
    
    const { error } = await supabase
      .from('user_room_targets')
      .delete()
      .in('target_id', targetIds)
      .eq('user_id', userId);

    if (error) {
      return apiErr('UNASSIGN_TARGETS_ERROR', error.message, error);
    }

    return apiOk(undefined);
  } catch (error) {
    console.error('[Rooms Repo] Error unassigning targets:', error);
    return apiErr(
      'UNASSIGN_TARGETS_ERROR',
      error instanceof Error ? error.message : 'Failed to unassign targets',
      error
    );
  }
}

/**
 * Unassign all targets from a specific room
 */
async function unassignTargetsFromRoom(roomId: string): Promise<ApiResponse<void>> {
  try {
    const userId = await getCurrentUserId();
    
    const { error } = await supabase
      .from('user_room_targets')
      .delete()
      .eq('room_id', roomId)
      .eq('user_id', userId);

    if (error) {
      return apiErr('UNASSIGN_TARGETS_FROM_ROOM_ERROR', error.message, error);
    }

    return apiOk(undefined);
  } catch (error) {
    console.error('[Rooms Repo] Error unassigning targets from room:', error);
    return apiErr(
      'UNASSIGN_TARGETS_FROM_ROOM_ERROR',
      error instanceof Error ? error.message : 'Failed to unassign targets from room',
      error
    );
  }
}

/**
 * Get targets assigned to a specific room
 */
export async function getRoomTargets(roomId: string): Promise<ApiResponse<Target[]>> {
  try {
    const userId = await getCurrentUserId();
    
    const { data: assignments, error } = await supabase
      .from('user_room_targets')
      .select('target_id')
      .eq('room_id', roomId)
      .eq('user_id', userId);

    if (error) {
      return apiErr('GET_ROOM_TARGETS_ERROR', error.message, error);
    }

    if (!assignments || assignments.length === 0) {
      return apiOk([]);
    }

    // Note: This returns assignment IDs, not full target data
    // Full target data should come from edge function or targets feature
    // For now, return empty array - this will be handled by the service layer
    return apiOk([]);
  } catch (error) {
    console.error('[Rooms Repo] Error fetching room targets:', error);
    return apiErr(
      'GET_ROOM_TARGETS_ERROR',
      error instanceof Error ? error.message : 'Failed to fetch room targets',
      error
    );
  }
}
