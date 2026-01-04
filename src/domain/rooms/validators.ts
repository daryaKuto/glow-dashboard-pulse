/**
 * Rooms Domain Validators
 * 
 * Business validation rules for room operations.
 * Pure functions - no React or Supabase imports.
 */

import { z } from 'zod';
import { validateWithSchema, type ValidationResult, isValidUuid, isNonEmptyString } from '../shared/validation-helpers';

/**
 * Room validation constants
 */
export const ROOM_CONSTRAINTS = {
  NAME_MIN_LENGTH: 1,
  NAME_MAX_LENGTH: 100,
  MAX_ROOMS_PER_USER: 50,
  MAX_TARGETS_PER_ROOM: 100,
  VALID_ROOM_TYPES: ['living_room', 'bedroom', 'garage', 'basement', 'outdoor', 'custom'] as const,
  VALID_ICONS: ['home', 'building', 'warehouse', 'trees', 'target', 'crosshair'] as const,
} as const;

/**
 * Room type enum
 */
export type RoomType = typeof ROOM_CONSTRAINTS.VALID_ROOM_TYPES[number];

/**
 * Domain-level room schema (stricter than feature schema)
 */
export const roomDomainSchema = z.object({
  id: z.string().uuid(),
  name: z.string()
    .min(ROOM_CONSTRAINTS.NAME_MIN_LENGTH, 'Room name is required')
    .max(ROOM_CONSTRAINTS.NAME_MAX_LENGTH, 'Room name is too long'),
  room_type: z.string().min(1, 'Room type is required'),
  icon: z.string().default('home'),
  order_index: z.number().int().min(0),
});

/**
 * Create room input validation schema
 */
export const createRoomInputSchema = z.object({
  name: z.string()
    .min(ROOM_CONSTRAINTS.NAME_MIN_LENGTH, 'Room name is required')
    .max(ROOM_CONSTRAINTS.NAME_MAX_LENGTH, 'Room name is too long')
    .transform((val) => val.trim()),
  room_type: z.string().min(1, 'Room type is required'),
  icon: z.string().default('home'),
  order_index: z.number().int().min(0),
  assignedTargets: z.array(z.string().uuid()).optional(),
});

/**
 * Update room input validation schema
 */
export const updateRoomInputSchema = z.object({
  name: z.string()
    .min(ROOM_CONSTRAINTS.NAME_MIN_LENGTH, 'Room name cannot be empty')
    .max(ROOM_CONSTRAINTS.NAME_MAX_LENGTH, 'Room name is too long')
    .transform((val) => val.trim())
    .optional(),
  room_type: z.string().min(1).optional(),
  icon: z.string().optional(),
  order_index: z.number().int().min(0).optional(),
});

/**
 * Room order item schema
 */
export const roomOrderItemSchema = z.object({
  id: z.string().uuid('Invalid room ID'),
  order_index: z.number().int().min(0, 'Order index must be non-negative'),
});

/**
 * Room order array schema
 */
export const roomOrderArraySchema = z.array(roomOrderItemSchema).min(1, 'At least one room order is required');

/**
 * Target assignment schema
 */
export const targetAssignmentSchema = z.object({
  targetId: z.string().uuid('Invalid target ID'),
  roomId: z.string().uuid().nullable(),
  targetName: z.string().optional(),
});

/**
 * Batch target assignment schema
 */
export const batchTargetAssignmentSchema = z.object({
  targetIds: z.array(z.string().uuid()).min(1, 'At least one target ID is required'),
  roomId: z.string().uuid().nullable(),
  targetNames: z.record(z.string(), z.string()).optional(),
});

// Inferred types
export type CreateRoomInput = z.infer<typeof createRoomInputSchema>;
export type UpdateRoomInput = z.infer<typeof updateRoomInputSchema>;
export type RoomOrderItem = z.infer<typeof roomOrderItemSchema>;
export type TargetAssignment = z.infer<typeof targetAssignmentSchema>;
export type BatchTargetAssignment = z.infer<typeof batchTargetAssignmentSchema>;

/**
 * Validate create room input
 */
export function validateCreateRoomInput(data: unknown): ValidationResult<CreateRoomInput> {
  return validateWithSchema(createRoomInputSchema, data);
}

/**
 * Validate update room input
 */
export function validateUpdateRoomInput(data: unknown): ValidationResult<UpdateRoomInput> {
  return validateWithSchema(updateRoomInputSchema, data);
}

/**
 * Validate room order array
 */
export function validateRoomOrderArray(data: unknown): ValidationResult<RoomOrderItem[]> {
  return validateWithSchema(roomOrderArraySchema, data);
}

/**
 * Validate target assignment
 */
export function validateTargetAssignment(data: unknown): ValidationResult<TargetAssignment> {
  return validateWithSchema(targetAssignmentSchema, data);
}

/**
 * Validate batch target assignment
 */
export function validateBatchTargetAssignment(data: unknown): ValidationResult<BatchTargetAssignment> {
  return validateWithSchema(batchTargetAssignmentSchema, data);
}

/**
 * Validate room ID
 */
export function validateRoomId(roomId: unknown): ValidationResult<string> {
  if (!isNonEmptyString(roomId)) {
    return {
      success: false,
      errors: [{ field: 'roomId', message: 'Room ID is required', code: 'required' }],
    };
  }
  
  if (!isValidUuid(roomId)) {
    return {
      success: false,
      errors: [{ field: 'roomId', message: 'Invalid room ID format', code: 'invalid_uuid' }],
    };
  }
  
  return { success: true, data: roomId };
}

/**
 * Validate target ID
 */
export function validateTargetId(targetId: unknown): ValidationResult<string> {
  if (!isNonEmptyString(targetId)) {
    return {
      success: false,
      errors: [{ field: 'targetId', message: 'Target ID is required', code: 'required' }],
    };
  }
  
  if (!isValidUuid(targetId)) {
    return {
      success: false,
      errors: [{ field: 'targetId', message: 'Invalid target ID format', code: 'invalid_uuid' }],
    };
  }
  
  return { success: true, data: targetId };
}

/**
 * Validate nullable room ID (for unassignment)
 */
export function validateNullableRoomId(roomId: unknown): ValidationResult<string | null> {
  if (roomId === null) {
    return { success: true, data: null };
  }
  
  const result = validateRoomId(roomId);
  if (result.success) {
    return { success: true, data: result.data };
  }
  
  return result as ValidationResult<string | null>;
}

