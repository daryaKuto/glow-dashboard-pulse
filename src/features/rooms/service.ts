/**
 * Service layer for Rooms feature
 * 
 * Contains business logic and orchestration.
 * Uses repository functions and domain layer validators/permissions.
 * Returns ApiResponse<T>.
 */

import {
  roomsRepository,
  type RoomsWithTargets,
  type RoomLayoutRow,
  getRoomLayout,
  saveRoomLayout,
  createRoomWithLayout,
  deleteRoomLayout,
  updateTargetPositions,
} from './repo';
import type { RoomRepository } from '@/domain/rooms/ports';
import type { Target } from '@/features/targets';
import type {
  Room,
  CreateRoomData,
  UpdateRoomData,
  RoomOrder,
  AssignTargetToRoomData,
} from './schema';
import { apiOk, apiErr, type ApiResponse } from '@/shared/lib/api-response';
import {
  validateCreateRoomInput,
  validateUpdateRoomInput,
  validateRoomOrderArray,
  validateTargetAssignment,
  validateBatchTargetAssignment,
  validateRoomId,
} from '@/domain/rooms/validators';
import {
  canCreateRoom,
  canUpdateRoom,
  canDeleteRoom,
  canAssignTargetsToRoom,
  canViewRoom,
  type UserContext,
  type RoomContext,
} from '@/domain/rooms/permissions';

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
 * Create a new room with permission check
 */
export async function createRoomWithPermissionService(
  user: UserContext,
  roomData: CreateRoomData,
  currentRoomCount: number
): Promise<ApiResponse<Room>> {
  // Validate using domain layer
  const validation = validateCreateRoomInput(roomData);
  if (!validation.success) {
    const firstError = validation.errors[0];
    return apiErr('VALIDATION_ERROR', firstError?.message || 'Invalid room data');
  }

  // Check permission
  const permissionResult = canCreateRoom(user, currentRoomCount);
  if (!permissionResult.allowed) {
    return apiErr(permissionResult.code, permissionResult.reason);
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
 * Update an existing room with permission check
 */
export async function updateRoomWithPermissionService(
  user: UserContext,
  room: RoomContext,
  updates: UpdateRoomData
): Promise<ApiResponse<Room>> {
  // Validate room ID
  const roomIdValidation = validateRoomId(room.roomId);
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

  // Check permission
  const permissionResult = canUpdateRoom(user, room);
  if (!permissionResult.allowed) {
    return apiErr(permissionResult.code, permissionResult.reason);
  }

  return roomRepo.updateRoom(room.roomId, updates);
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
 * Delete a room with permission check
 */
export async function deleteRoomWithPermissionService(
  user: UserContext,
  room: RoomContext
): Promise<ApiResponse<void>> {
  // Validate room ID using domain layer
  const validation = validateRoomId(room.roomId);
  if (!validation.success) {
    const firstError = validation.errors[0];
    return apiErr('VALIDATION_ERROR', firstError?.message || 'Invalid room ID');
  }

  // Check permission
  const permissionResult = canDeleteRoom(user, room);
  if (!permissionResult.allowed) {
    return apiErr(permissionResult.code, permissionResult.reason);
  }

  return roomRepo.deleteRoom(room.roomId);
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
 * Assign multiple targets to room with permission check
 */
export async function assignTargetsToRoomWithPermissionService(
  user: UserContext,
  room: RoomContext,
  targetIds: string[],
  targetNames?: Map<string, string>
): Promise<ApiResponse<void>> {
  // Convert Map to Record for validation
  const targetNamesRecord = targetNames 
    ? Object.fromEntries(targetNames.entries()) 
    : undefined;

  // Validate using domain layer
  const validation = validateBatchTargetAssignment({
    targetIds,
    roomId: room.roomId,
    targetNames: targetNamesRecord,
  });
  if (!validation.success) {
    const firstError = validation.errors[0];
    return apiErr('VALIDATION_ERROR', firstError?.message || 'Invalid batch assignment data');
  }

  // Check permission
  const permissionResult = canAssignTargetsToRoom(user, room, targetIds.length);
  if (!permissionResult.allowed) {
    return apiErr(permissionResult.code, permissionResult.reason);
  }

  return roomRepo.assignTargetsToRoom(room.roomId, targetIds, targetNames);
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

// ============================================================================
// Permission check helpers
// ============================================================================

/**
 * Check if user can create a room
 */
export function checkCanCreateRoom(
  user: UserContext,
  currentRoomCount: number
): ApiResponse<boolean> {
  const result = canCreateRoom(user, currentRoomCount);
  
  if (!result.allowed) {
    return apiErr(result.code, result.reason);
  }

  return apiOk(true);
}

/**
 * Check if user can update a room
 */
export function checkCanUpdateRoom(
  user: UserContext,
  room: RoomContext
): ApiResponse<boolean> {
  const result = canUpdateRoom(user, room);
  
  if (!result.allowed) {
    return apiErr(result.code, result.reason);
  }

  return apiOk(true);
}

/**
 * Check if user can delete a room
 */
export function checkCanDeleteRoom(
  user: UserContext,
  room: RoomContext
): ApiResponse<boolean> {
  const result = canDeleteRoom(user, room);
  
  if (!result.allowed) {
    return apiErr(result.code, result.reason);
  }

  return apiOk(true);
}

/**
 * Check if user can assign targets to a room
 */
export function checkCanAssignTargetsToRoom(
  user: UserContext,
  room: RoomContext,
  targetCount: number
): ApiResponse<boolean> {
  const result = canAssignTargetsToRoom(user, room, targetCount);
  
  if (!result.allowed) {
    return apiErr(result.code, result.reason);
  }

  return apiOk(true);
}

/**
 * Check if user can view a room
 */
export function checkCanViewRoom(
  user: UserContext,
  room: RoomContext
): ApiResponse<boolean> {
  const result = canViewRoom(user, room);
  
  if (!result.allowed) {
    return apiErr(result.code, result.reason);
  }

  return apiOk(true);
}

// ============================================================================
// Layout Services
// ============================================================================

/**
 * Get room layout
 */
export async function getRoomLayoutService(
  roomId: string
): Promise<ApiResponse<RoomLayoutRow | null>> {
  const validation = validateRoomId(roomId);
  if (!validation.success) {
    const firstError = validation.errors[0];
    return apiErr('VALIDATION_ERROR', firstError?.message || 'Invalid room ID');
  }

  return getRoomLayout(roomId);
}

/**
 * Save room layout
 */
export async function saveRoomLayoutService(
  roomId: string,
  layoutData: Record<string, unknown>,
  viewport: { scale: number; x: number; y: number },
  canvasWidth: number,
  canvasHeight: number
): Promise<ApiResponse<void>> {
  const validation = validateRoomId(roomId);
  if (!validation.success) {
    const firstError = validation.errors[0];
    return apiErr('VALIDATION_ERROR', firstError?.message || 'Invalid room ID');
  }

  return saveRoomLayout(roomId, layoutData, viewport, canvasWidth, canvasHeight);
}

/**
 * Create a new room with layout
 */
export async function createRoomWithLayoutService(
  roomData: CreateRoomData,
  layoutData: Record<string, unknown>,
  viewport: { scale: number; x: number; y: number },
  canvasWidth: number,
  canvasHeight: number
): Promise<ApiResponse<Room>> {
  const validation = validateCreateRoomInput(roomData);
  if (!validation.success) {
    const firstError = validation.errors[0];
    return apiErr('VALIDATION_ERROR', firstError?.message || 'Invalid room data');
  }

  return createRoomWithLayout(roomData, layoutData, viewport, canvasWidth, canvasHeight);
}

/**
 * Delete room layout
 */
export async function deleteRoomLayoutService(
  roomId: string
): Promise<ApiResponse<void>> {
  const validation = validateRoomId(roomId);
  if (!validation.success) {
    const firstError = validation.errors[0];
    return apiErr('VALIDATION_ERROR', firstError?.message || 'Invalid room ID');
  }

  return deleteRoomLayout(roomId);
}

/**
 * Update target positions from canvas
 */
export async function updateTargetPositionsService(
  roomId: string,
  positions: Array<{ targetId: string; x: number; y: number }>
): Promise<ApiResponse<void>> {
  const validation = validateRoomId(roomId);
  if (!validation.success) {
    const firstError = validation.errors[0];
    return apiErr('VALIDATION_ERROR', firstError?.message || 'Invalid room ID');
  }

  return updateTargetPositions(roomId, positions);
}

// Re-export types for consumers
export type { UserContext, RoomContext } from '@/domain/rooms/permissions';
export type { RoomLayoutRow } from './repo';
