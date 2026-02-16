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
      const message = roomError.message?.includes('unique_user_room_name')
        ? `A room named "${roomData.name}" already exists. Please choose a different name.`
        : roomError.message;
      return apiErr('CREATE_ROOM_ERROR', message, roomError);
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

// ============================================================================
// Layout CRUD
// ============================================================================

export interface RoomLayoutRow {
  id: string;
  user_id: string;
  room_id: string;
  layout_data: Record<string, unknown>;
  canvas_width: number;
  canvas_height: number;
  viewport_scale: number;
  viewport_x: number;
  viewport_y: number;
  created_at: string;
  updated_at: string;
}

/**
 * Get room layout data
 */
export async function getRoomLayout(roomId: string): Promise<ApiResponse<RoomLayoutRow | null>> {
  try {
    const userId = await getCurrentUserId();

    const { data, error } = await (supabase as any)
      .from('user_room_layouts')
      .select('*')
      .eq('room_id', roomId)
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      return apiErr('GET_LAYOUT_ERROR', error.message, error);
    }

    return apiOk(data as RoomLayoutRow | null);
  } catch (error) {
    console.error('[Rooms Repo] Error fetching room layout:', error);
    return apiErr(
      'GET_LAYOUT_ERROR',
      error instanceof Error ? error.message : 'Failed to fetch room layout',
      error
    );
  }
}

/**
 * Save (upsert) room layout data
 */
export async function saveRoomLayout(
  roomId: string,
  layoutData: Record<string, unknown>,
  viewport: { scale: number; x: number; y: number },
  canvasWidth: number,
  canvasHeight: number
): Promise<ApiResponse<void>> {
  try {
    const userId = await getCurrentUserId();

    // Check if layout already exists
    const { data: existing } = await (supabase as any)
      .from('user_room_layouts')
      .select('id')
      .eq('room_id', roomId)
      .eq('user_id', userId)
      .maybeSingle();

    if (existing) {
      const { error } = await (supabase as any)
        .from('user_room_layouts')
        .update({
          layout_data: layoutData,
          canvas_width: canvasWidth,
          canvas_height: canvasHeight,
          viewport_scale: viewport.scale,
          viewport_x: viewport.x,
          viewport_y: viewport.y,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
        .eq('user_id', userId);

      if (error) {
        return apiErr('SAVE_LAYOUT_ERROR', error.message, error);
      }
    } else {
      const { error } = await (supabase as any)
        .from('user_room_layouts')
        .insert({
          user_id: userId,
          room_id: roomId,
          layout_data: layoutData,
          canvas_width: canvasWidth,
          canvas_height: canvasHeight,
          viewport_scale: viewport.scale,
          viewport_x: viewport.x,
          viewport_y: viewport.y,
        });

      if (error) {
        return apiErr('SAVE_LAYOUT_ERROR', error.message, error);
      }
    }

    return apiOk(undefined);
  } catch (error) {
    console.error('[Rooms Repo] Error saving room layout:', error);
    return apiErr(
      'SAVE_LAYOUT_ERROR',
      error instanceof Error ? error.message : 'Failed to save room layout',
      error
    );
  }
}

/**
 * Create a new room AND its layout in one operation
 */
export async function createRoomWithLayout(
  roomData: CreateRoomData,
  layoutData: Record<string, unknown>,
  viewport: { scale: number; x: number; y: number },
  canvasWidth: number,
  canvasHeight: number
): Promise<ApiResponse<Room>> {
  const roomResult = await createRoom(roomData);
  if (!roomResult.ok) return roomResult;

  const layoutResult = await saveRoomLayout(
    roomResult.data.id,
    layoutData,
    viewport,
    canvasWidth,
    canvasHeight
  );

  if (!layoutResult.ok) {
    console.warn('[Rooms Repo] Room created but layout save failed:', layoutResult.error);
  }

  return roomResult;
}

/**
 * Delete a room layout
 */
export async function deleteRoomLayout(roomId: string): Promise<ApiResponse<void>> {
  try {
    const userId = await getCurrentUserId();

    const { error } = await (supabase as any)
      .from('user_room_layouts')
      .delete()
      .eq('room_id', roomId)
      .eq('user_id', userId);

    if (error) {
      return apiErr('DELETE_LAYOUT_ERROR', error.message, error);
    }

    return apiOk(undefined);
  } catch (error) {
    console.error('[Rooms Repo] Error deleting room layout:', error);
    return apiErr(
      'DELETE_LAYOUT_ERROR',
      error instanceof Error ? error.message : 'Failed to delete room layout',
      error
    );
  }
}

/**
 * Update target positions in user_room_targets from canvas placement
 */
export async function updateTargetPositions(
  roomId: string,
  positions: Array<{ targetId: string; x: number; y: number }>
): Promise<ApiResponse<void>> {
  try {
    const userId = await getCurrentUserId();

    for (const pos of positions) {
      await (supabase as any)
        .from('user_room_targets')
        .update({
          position_x: pos.x,
          position_y: pos.y,
        })
        .eq('room_id', roomId)
        .eq('target_id', pos.targetId)
        .eq('user_id', userId);
    }

    return apiOk(undefined);
  } catch (error) {
    console.error('[Rooms Repo] Error updating target positions:', error);
    return apiErr(
      'UPDATE_POSITIONS_ERROR',
      error instanceof Error ? error.message : 'Failed to update target positions',
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
