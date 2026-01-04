/**
 * Service layer for Rooms feature
 * 
 * Contains business logic and orchestration.
 * Uses repository functions and domain layer validators.
 * Returns ApiResponse<T>.
 */

import { roomsRepository, type RoomsWithTargets } from './repo';
import type { RoomRepository } from '@/domain/rooms/ports';
import type { Target } from '@/features/targets';
import type {
  Room,
  CreateRoomData,
  UpdateRoomData,
  RoomOrder,
  AssignTargetToRoomData,
} from './schema';
import { apiErr, type ApiResponse } from '@/shared/lib/api-response';
import {
  validateCreateRoomInput,
  validateUpdateRoomInput,
  validateRoomOrderArray,
  validateTargetAssignment,
  validateBatchTargetAssignment,
  validateRoomId,
} from '@/domain/rooms/validators';

let roomRepo: RoomRepository<Target> = roomsRepository;

export const setRoomRepository = (repo: RoomRepository<Target>): void => {
  roomRepo = repo;
};

/**
 * Get all rooms with targets
 */
export async function getRoomsWithTargets(force = false): Promise<ApiResponse<RoomsWithTargets>> {
  return roomRepo.getRooms(force);
}

/**
 * Create a new room
 */
export async function createRoomService(
  roomData: CreateRoomData
): Promise<ApiResponse<Room>> {
  // Validate using domain layer
  const validation = validateCreateRoomInput(roomData);
  if (!validation.success) {
    const firstError = validation.errors[0];
    return apiErr('VALIDATION_ERROR', firstError?.message || 'Invalid room data');
  }

  return roomRepo.createRoom(roomData);
}

/**
 * Update an existing room
 */
export async function updateRoomService(
  roomId: string,
  updates: UpdateRoomData
): Promise<ApiResponse<Room>> {
  // Validate room ID
  const roomIdValidation = validateRoomId(roomId);
  if (!roomIdValidation.success) {
    const firstError = roomIdValidation.errors[0];
    return apiErr('VALIDATION_ERROR', firstError?.message || 'Invalid room ID');
  }

  // Validate update data
  const updateValidation = validateUpdateRoomInput(updates);
  if (!updateValidation.success) {
    const firstError = updateValidation.errors[0];
    return apiErr('VALIDATION_ERROR', firstError?.message || 'Invalid update data');
  }

  return roomRepo.updateRoom(roomId, updates);
}

/**
 * Delete a room
 */
export async function deleteRoomService(roomId: string): Promise<ApiResponse<void>> {
  // Validate room ID using domain layer
  const validation = validateRoomId(roomId);
  if (!validation.success) {
    const firstError = validation.errors[0];
    return apiErr('VALIDATION_ERROR', firstError?.message || 'Invalid room ID');
  }

  return roomRepo.deleteRoom(roomId);
}

/**
 * Update room order
 */
export async function updateRoomOrderService(
  roomOrders: RoomOrder
): Promise<ApiResponse<void>> {
  // Validate using domain layer
  const validation = validateRoomOrderArray(roomOrders);
  if (!validation.success) {
    const firstError = validation.errors[0];
    return apiErr('VALIDATION_ERROR', firstError?.message || 'Invalid room order data');
  }

  return roomRepo.updateRoomOrder(roomOrders);
}

/**
 * Assign target to room
 */
export async function assignTargetToRoomService(
  data: AssignTargetToRoomData
): Promise<ApiResponse<void>> {
  // Validate using domain layer
  const validation = validateTargetAssignment(data);
  if (!validation.success) {
    const firstError = validation.errors[0];
    return apiErr('VALIDATION_ERROR', firstError?.message || 'Invalid assignment data');
  }

  return roomRepo.assignTargetToRoom(data);
}

/**
 * Assign multiple targets to room
 */
export async function assignTargetsToRoomService(
  targetIds: string[],
  roomId: string | null,
  targetNames?: Map<string, string>
): Promise<ApiResponse<void>> {
  // Convert Map to Record for validation
  const targetNamesRecord = targetNames 
    ? Object.fromEntries(targetNames.entries()) 
    : undefined;

  // Validate using domain layer
  const validation = validateBatchTargetAssignment({
    targetIds,
    roomId,
    targetNames: targetNamesRecord,
  });
  if (!validation.success) {
    const firstError = validation.errors[0];
    return apiErr('VALIDATION_ERROR', firstError?.message || 'Invalid batch assignment data');
  }

  if (roomId === null) {
    // Unassign all targets
    return roomRepo.unassignTargets(targetIds);
  }

  return roomRepo.assignTargetsToRoom(roomId, targetIds, targetNames);
}

/**
 * Get room targets
 * Note: Full target data comes from edge function, not this service
 * This is kept for API consistency but targets are included in getRoomsWithTargets
 */
export async function getRoomTargetsService(
  roomId: string
): Promise<ApiResponse<string[]>> {
  // Validate room ID using domain layer
  const validation = validateRoomId(roomId);
  if (!validation.success) {
    const firstError = validation.errors[0];
    return apiErr('VALIDATION_ERROR', firstError?.message || 'Invalid room ID');
  }

  // This returns target IDs - full target data comes from edge function
  // See getRoomsWithTargets which includes targets in the response
  return roomRepo.getRoomTargets(roomId);
}
