/**
 * Service layer for Rooms feature
 * 
 * Contains business logic and orchestration.
 * Uses repository functions and returns ApiResponse<T>.
 */

import {
  getRooms,
  createRoom as createRoomRepo,
  updateRoom as updateRoomRepo,
  deleteRoom as deleteRoomRepo,
  updateRoomOrder as updateRoomOrderRepo,
  assignTargetToRoom as assignTargetToRoomRepo,
  assignTargetsToRoom,
  getRoomTargets,
  type RoomsWithTargets,
} from './repo';
import type {
  Room,
  CreateRoomData,
  UpdateRoomData,
  RoomOrder,
  AssignTargetToRoomData,
} from './schema';
import { apiOk, apiErr, type ApiResponse } from '@/shared/lib/api-response';

/**
 * Get all rooms with targets
 */
export async function getRoomsWithTargets(force = false): Promise<ApiResponse<RoomsWithTargets>> {
  return getRooms(force);
}

/**
 * Create a new room
 */
export async function createRoomService(
  roomData: CreateRoomData
): Promise<ApiResponse<Room>> {
  // Validate required fields
  if (!roomData.name || !roomData.name.trim()) {
    return apiErr('VALIDATION_ERROR', 'Room name is required');
  }

  if (!roomData.room_type) {
    return apiErr('VALIDATION_ERROR', 'Room type is required');
  }

  return createRoomRepo(roomData);
}

/**
 * Update an existing room
 */
export async function updateRoomService(
  roomId: string,
  updates: UpdateRoomData
): Promise<ApiResponse<Room>> {
  if (!roomId) {
    return apiErr('VALIDATION_ERROR', 'Room ID is required');
  }

  // Validate name if provided
  if (updates.name !== undefined && !updates.name.trim()) {
    return apiErr('VALIDATION_ERROR', 'Room name cannot be empty');
  }

  return updateRoomRepo(roomId, updates);
}

/**
 * Delete a room
 */
export async function deleteRoomService(roomId: string): Promise<ApiResponse<void>> {
  if (!roomId) {
    return apiErr('VALIDATION_ERROR', 'Room ID is required');
  }

  return deleteRoomRepo(roomId);
}

/**
 * Update room order
 */
export async function updateRoomOrderService(
  roomOrders: RoomOrder
): Promise<ApiResponse<void>> {
  if (!Array.isArray(roomOrders) || roomOrders.length === 0) {
    return apiErr('VALIDATION_ERROR', 'Room orders array is required');
  }

  // Validate each room order
  for (const order of roomOrders) {
    if (!order.id) {
      return apiErr('VALIDATION_ERROR', 'Room ID is required in order');
    }
    if (typeof order.order_index !== 'number' || order.order_index < 0) {
      return apiErr('VALIDATION_ERROR', 'Invalid order index');
    }
  }

  return updateRoomOrderRepo(roomOrders);
}

/**
 * Assign target to room
 */
export async function assignTargetToRoomService(
  data: AssignTargetToRoomData
): Promise<ApiResponse<void>> {
  if (!data.targetId) {
    return apiErr('VALIDATION_ERROR', 'Target ID is required');
  }

  // roomId can be null (to unassign)
  if (data.roomId !== null && !data.roomId) {
    return apiErr('VALIDATION_ERROR', 'Invalid room ID');
  }

  return assignTargetToRoomRepo(data);
}

/**
 * Assign multiple targets to room
 */
export async function assignTargetsToRoomService(
  targetIds: string[],
  roomId: string | null,
  targetNames?: Map<string, string>
): Promise<ApiResponse<void>> {
  if (!Array.isArray(targetIds) || targetIds.length === 0) {
    return apiErr('VALIDATION_ERROR', 'Target IDs array is required');
  }

  if (roomId !== null && !roomId) {
    return apiErr('VALIDATION_ERROR', 'Invalid room ID');
  }

  if (roomId === null) {
    // Unassign all targets
    const { unassignTargets } = await import('./repo');
    return unassignTargets(targetIds);
  }

  return assignTargetsToRoom(roomId, targetIds, targetNames);
}

/**
 * Get room targets
 * Note: Full target data comes from edge function, not this service
 * This is kept for API consistency but targets are included in getRoomsWithTargets
 */
export async function getRoomTargetsService(
  roomId: string
): Promise<ApiResponse<string[]>> {
  if (!roomId) {
    return apiErr('VALIDATION_ERROR', 'Room ID is required');
  }

  // This returns target IDs - full target data comes from edge function
  // See getRoomsWithTargets which includes targets in the response
  const { getRoomTargets } = await import('./repo');
  return getRoomTargets(roomId);
}

