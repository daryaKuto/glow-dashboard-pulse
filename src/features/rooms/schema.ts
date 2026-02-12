import { z } from 'zod';

/**
 * Zod schemas for Rooms feature
 * 
 * Defines contracts for all Room-related operations.
 * Types are inferred from these schemas to ensure consistency.
 */

export const roomSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1, 'Room name is required'),
  room_type: z.string().min(1, 'Room type is required'),
  icon: z.string().default('home'),
  order_index: z.number().int().min(0),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
  target_count: z.number().int().min(0).optional(),
});

export const createRoomDataSchema = z.object({
  name: z.string().min(1, 'Room name is required').max(100, 'Room name is too long'),
  room_type: z.string().min(1, 'Room type is required'),
  icon: z.string().default('home'),
  order_index: z.number().int().min(0),
  assignedTargets: z.array(z.string().uuid()).optional(),
});

export const updateRoomDataSchema = createRoomDataSchema.partial().extend({
  name: z.string().min(1).max(100).optional(),
});

export const roomOrderSchema = z.array(
  z.object({
    id: z.string().uuid(),
    order_index: z.number().int().min(0),
  })
);

export const assignTargetToRoomSchema = z.object({
  targetId: z.string().uuid(),
  roomId: z.string().uuid().nullable(),
  targetName: z.string().optional(),
});

export const assignTargetsToRoomBatchSchema = z.object({
  targetIds: z.array(z.string().uuid()).min(1),
  roomId: z.string().uuid().nullable(),
  targetNames: z.record(z.string(), z.string()).optional(), // Record instead of Map for Zod
});

// Inferred types
export type Room = z.infer<typeof roomSchema>;
export type CreateRoomData = z.infer<typeof createRoomDataSchema>;
export type UpdateRoomData = z.infer<typeof updateRoomDataSchema>;
export type RoomOrder = z.infer<typeof roomOrderSchema>;
export type AssignTargetToRoomData = z.infer<typeof assignTargetToRoomSchema>;
export type AssignTargetsToRoomBatchData = z.infer<typeof assignTargetsToRoomBatchSchema>;

