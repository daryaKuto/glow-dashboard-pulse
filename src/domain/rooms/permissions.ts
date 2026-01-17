/**
 * Rooms Domain Permissions
 * 
 * Permission checks for room operations.
 * Pure functions - no React or Supabase imports.
 */

import { ROOM_CONSTRAINTS } from './validators';

/**
 * Permission check result
 */
export type PermissionResult = 
  | { allowed: true }
  | { allowed: false; reason: string; code: string };

/**
 * User context for permission checks
 */
export type UserContext = {
  userId: string;
  isAdmin?: boolean;
  subscriptionTier?: 'free' | 'pro' | 'enterprise';
};

/**
 * Room context for permission checks
 */
export type RoomContext = {
  roomId: string;
  ownerId: string;
  targetCount?: number;
};

/**
 * Check if user can create a room
 */
export function canCreateRoom(
  user: UserContext,
  currentRoomCount: number
): PermissionResult {
  // Admin can always create rooms
  if (user.isAdmin) {
    return { allowed: true };
  }
  
  // Check room limit based on subscription
  const maxRooms = getMaxRoomsForTier(user.subscriptionTier);
  
  if (currentRoomCount >= maxRooms) {
    return {
      allowed: false,
      reason: `You have reached the maximum number of rooms (${maxRooms}) for your subscription tier`,
      code: 'ROOM_LIMIT_REACHED',
    };
  }
  
  return { allowed: true };
}

/**
 * Check if user can update a room
 */
export function canUpdateRoom(
  user: UserContext,
  room: RoomContext
): PermissionResult {
  // Admin can update any room
  if (user.isAdmin) {
    return { allowed: true };
  }
  
  // Only owner can update their room
  if (room.ownerId !== user.userId) {
    return {
      allowed: false,
      reason: 'You do not have permission to update this room',
      code: 'NOT_OWNER',
    };
  }
  
  return { allowed: true };
}

/**
 * Check if user can delete a room
 */
export function canDeleteRoom(
  user: UserContext,
  room: RoomContext
): PermissionResult {
  // Admin can delete any room
  if (user.isAdmin) {
    return { allowed: true };
  }
  
  // Only owner can delete their room
  if (room.ownerId !== user.userId) {
    return {
      allowed: false,
      reason: 'You do not have permission to delete this room',
      code: 'NOT_OWNER',
    };
  }
  
  return { allowed: true };
}

/**
 * Check if user can assign targets to a room
 */
export function canAssignTargetsToRoom(
  user: UserContext,
  room: RoomContext,
  targetCount: number
): PermissionResult {
  // Admin can assign to any room
  if (user.isAdmin) {
    return { allowed: true };
  }
  
  // Only owner can assign targets to their room
  if (room.ownerId !== user.userId) {
    return {
      allowed: false,
      reason: 'You do not have permission to assign targets to this room',
      code: 'NOT_OWNER',
    };
  }
  
  // Check target limit per room
  const currentTargets = room.targetCount ?? 0;
  const newTotal = currentTargets + targetCount;
  
  if (newTotal > ROOM_CONSTRAINTS.MAX_TARGETS_PER_ROOM) {
    return {
      allowed: false,
      reason: `Cannot assign more than ${ROOM_CONSTRAINTS.MAX_TARGETS_PER_ROOM} targets to a room`,
      code: 'TARGET_LIMIT_REACHED',
    };
  }
  
  return { allowed: true };
}

/**
 * Check if user can view a room
 */
export function canViewRoom(
  user: UserContext,
  room: RoomContext
): PermissionResult {
  // Admin can view any room
  if (user.isAdmin) {
    return { allowed: true };
  }
  
  // Only owner can view their room
  if (room.ownerId !== user.userId) {
    return {
      allowed: false,
      reason: 'You do not have permission to view this room',
      code: 'NOT_OWNER',
    };
  }
  
  return { allowed: true };
}

/**
 * Get maximum rooms allowed for subscription tier
 */
export function getMaxRoomsForTier(tier?: 'free' | 'pro' | 'enterprise'): number {
  switch (tier) {
    case 'enterprise':
      return 200;
    case 'pro':
      return 100;
    case 'free':
    default:
      return ROOM_CONSTRAINTS.MAX_ROOMS_PER_USER;
  }
}

/**
 * Get maximum targets per room for subscription tier
 */
export function getMaxTargetsPerRoomForTier(tier?: 'free' | 'pro' | 'enterprise'): number {
  switch (tier) {
    case 'enterprise':
      return 500;
    case 'pro':
      return 200;
    case 'free':
    default:
      return ROOM_CONSTRAINTS.MAX_TARGETS_PER_ROOM;
  }
}



