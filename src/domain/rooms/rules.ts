/**
 * Rooms Domain Business Rules
 * 
 * Business rules and invariants for room operations.
 * Pure functions - no React or Supabase imports.
 */

import { ROOM_CONSTRAINTS } from './validators';
import { normalizeString, stringsEqualIgnoreCase } from '../shared/validation-helpers';

/**
 * Room business rule result
 */
export type RuleResult = 
  | { valid: true }
  | { valid: false; violation: string; code: string };

/**
 * Room summary for rule checks
 */
export type RoomSummary = {
  id: string;
  name: string;
  targetCount: number;
};

/**
 * Check if room name is unique among user's rooms
 */
export function isRoomNameUnique(
  newName: string,
  existingRooms: RoomSummary[],
  excludeRoomId?: string
): RuleResult {
  const normalizedNewName = normalizeString(newName);
  
  const duplicate = existingRooms.find((room) => {
    // Skip the room being updated
    if (excludeRoomId && room.id === excludeRoomId) {
      return false;
    }
    return normalizeString(room.name) === normalizedNewName;
  });
  
  if (duplicate) {
    return {
      valid: false,
      violation: `A room with the name "${newName}" already exists`,
      code: 'DUPLICATE_NAME',
    };
  }
  
  return { valid: true };
}

/**
 * Check if room can accept more targets
 */
export function canRoomAcceptTargets(
  room: RoomSummary,
  additionalTargets: number,
  maxTargets: number = ROOM_CONSTRAINTS.MAX_TARGETS_PER_ROOM
): RuleResult {
  const newTotal = room.targetCount + additionalTargets;
  
  if (newTotal > maxTargets) {
    return {
      valid: false,
      violation: `Room "${room.name}" can only have ${maxTargets} targets (current: ${room.targetCount}, adding: ${additionalTargets})`,
      code: 'TARGET_LIMIT_EXCEEDED',
    };
  }
  
  return { valid: true };
}

/**
 * Check if user can create more rooms
 */
export function canUserCreateMoreRooms(
  currentRoomCount: number,
  maxRooms: number = ROOM_CONSTRAINTS.MAX_ROOMS_PER_USER
): RuleResult {
  if (currentRoomCount >= maxRooms) {
    return {
      valid: false,
      violation: `Maximum room limit (${maxRooms}) reached`,
      code: 'ROOM_LIMIT_EXCEEDED',
    };
  }
  
  return { valid: true };
}

/**
 * Check if room order indices are valid (no gaps, starts at 0)
 */
export function areRoomOrderIndicesValid(
  orders: Array<{ id: string; order_index: number }>
): RuleResult {
  if (orders.length === 0) {
    return { valid: true };
  }
  
  // Sort by order_index
  const sorted = [...orders].sort((a, b) => a.order_index - b.order_index);
  
  // Check for duplicates
  const indices = new Set<number>();
  for (const order of sorted) {
    if (indices.has(order.order_index)) {
      return {
        valid: false,
        violation: `Duplicate order index: ${order.order_index}`,
        code: 'DUPLICATE_ORDER_INDEX',
      };
    }
    indices.add(order.order_index);
  }
  
  // Check that indices start at 0 and are sequential
  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i].order_index !== i) {
      return {
        valid: false,
        violation: `Order indices must be sequential starting from 0. Expected ${i}, got ${sorted[i].order_index}`,
        code: 'NON_SEQUENTIAL_ORDER',
      };
    }
  }
  
  return { valid: true };
}

/**
 * Check if target can be unassigned from room
 */
export function canUnassignTarget(
  targetId: string,
  roomTargetIds: string[]
): RuleResult {
  if (!roomTargetIds.includes(targetId)) {
    return {
      valid: false,
      violation: `Target ${targetId} is not assigned to this room`,
      code: 'TARGET_NOT_IN_ROOM',
    };
  }
  
  return { valid: true };
}

/**
 * Check if target is already assigned to a room
 */
export function isTargetAlreadyAssigned(
  targetId: string,
  rooms: Array<{ id: string; targetIds: string[] }>,
  excludeRoomId?: string
): RuleResult {
  for (const room of rooms) {
    // Skip the room we're assigning to
    if (excludeRoomId && room.id === excludeRoomId) {
      continue;
    }
    
    if (room.targetIds.includes(targetId)) {
      return {
        valid: false,
        violation: `Target is already assigned to another room`,
        code: 'TARGET_ALREADY_ASSIGNED',
      };
    }
  }
  
  return { valid: true };
}

/**
 * Calculate next order index for a new room
 */
export function calculateNextOrderIndex(existingRooms: RoomSummary[]): number {
  if (existingRooms.length === 0) {
    return 0;
  }
  
  // Find the maximum order index and add 1
  // Note: This assumes rooms have an order property, but RoomSummary doesn't include it
  // In practice, this would be passed in or calculated from actual room data
  return existingRooms.length;
}

/**
 * Normalize room orders to be sequential starting from 0
 */
export function normalizeRoomOrders(
  rooms: Array<{ id: string; order_index: number }>
): Array<{ id: string; order_index: number }> {
  // Sort by current order
  const sorted = [...rooms].sort((a, b) => a.order_index - b.order_index);
  
  // Reassign sequential indices
  return sorted.map((room, index) => ({
    id: room.id,
    order_index: index,
  }));
}

/**
 * Check if room name meets naming requirements
 */
export function isValidRoomName(name: string): RuleResult {
  const trimmed = name.trim();
  
  if (trimmed.length < ROOM_CONSTRAINTS.NAME_MIN_LENGTH) {
    return {
      valid: false,
      violation: 'Room name is required',
      code: 'NAME_TOO_SHORT',
    };
  }
  
  if (trimmed.length > ROOM_CONSTRAINTS.NAME_MAX_LENGTH) {
    return {
      valid: false,
      violation: `Room name must be ${ROOM_CONSTRAINTS.NAME_MAX_LENGTH} characters or less`,
      code: 'NAME_TOO_LONG',
    };
  }
  
  // Check for invalid characters (optional, can be customized)
  const invalidChars = /[<>{}]/;
  if (invalidChars.test(trimmed)) {
    return {
      valid: false,
      violation: 'Room name contains invalid characters',
      code: 'INVALID_CHARACTERS',
    };
  }
  
  return { valid: true };
}



