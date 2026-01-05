/**
 * @deprecated LEGACY CODE - Moved to _legacy on 2026-01-05
 * 
 * REASON: This file was never imported or used anywhere in the codebase.
 * The rooms feature uses validators from @/domain/rooms/validators but
 * these mappers were speculative/scaffolded and never wired into the service layer.
 * 
 * REPLACEMENT: None - the feature works without these mappers.
 * The rooms repo (src/features/rooms/repo.ts) handles data transformation inline.
 * 
 * ORIGINAL LOCATION: src/domain/rooms/mappers.ts
 * 
 * POTENTIAL FUTURE USE: If strict domain-driven design is adopted, these mappers
 * could be wired into the rooms service to separate concerns.
 */

import type { CreateRoomInput, UpdateRoomInput, RoomOrderItem } from '../../domain/rooms/validators';

/**
 * Room domain model (internal representation)
 */
export type RoomDomainModel = {
  id: string;
  name: string;
  roomType: string;
  icon: string;
  orderIndex: number;
  targetCount: number;
  createdAt: Date;
  updatedAt: Date;
};

/**
 * Room with targets domain model
 */
export type RoomWithTargetsDomainModel = RoomDomainModel & {
  targetIds: string[];
};

/**
 * Database room row (snake_case)
 */
export type RoomDbRow = {
  id: string;
  name: string;
  room_type: string;
  icon: string | null;
  order_index: number;
  target_count?: number;
  created_at: string;
  updated_at: string;
};

/**
 * Edge function room response
 */
export type EdgeRoomResponse = {
  id: string;
  name: string;
  order: number;
  icon?: string | null;
  room_type?: string | null;
  targetCount: number;
  targets: Array<{ id: string }>;
};

/**
 * Map database row to domain model
 */
export function mapDbRowToDomain(row: RoomDbRow): RoomDomainModel {
  return {
    id: row.id,
    name: row.name,
    roomType: row.room_type,
    icon: row.icon ?? 'home',
    orderIndex: row.order_index,
    targetCount: row.target_count ?? 0,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

/**
 * Map domain model to database row (for inserts/updates)
 */
export function mapDomainToDbRow(domain: Partial<RoomDomainModel>): Partial<RoomDbRow> {
  const row: Partial<RoomDbRow> = {};
  
  if (domain.id !== undefined) row.id = domain.id;
  if (domain.name !== undefined) row.name = domain.name;
  if (domain.roomType !== undefined) row.room_type = domain.roomType;
  if (domain.icon !== undefined) row.icon = domain.icon;
  if (domain.orderIndex !== undefined) row.order_index = domain.orderIndex;
  
  return row;
}

/**
 * Map edge function response to domain model
 */
export function mapEdgeResponseToDomain(response: EdgeRoomResponse): RoomWithTargetsDomainModel {
  return {
    id: response.id,
    name: response.name,
    roomType: response.room_type ?? 'custom',
    icon: response.icon ?? 'home',
    orderIndex: response.order,
    targetCount: response.targetCount,
    targetIds: response.targets.map((t) => t.id),
    createdAt: new Date(), // Edge response may not include these
    updatedAt: new Date(),
  };
}

/**
 * Map create input to database insert data
 */
export function mapCreateInputToDbInsert(
  input: CreateRoomInput,
  userId: string
): Record<string, unknown> {
  return {
    user_id: userId,
    name: input.name,
    room_type: input.room_type,
    icon: input.icon ?? 'home',
    order_index: input.order_index,
  };
}

/**
 * Map update input to database update data
 */
export function mapUpdateInputToDbUpdate(input: UpdateRoomInput): Record<string, unknown> {
  const update: Record<string, unknown> = {};
  
  if (input.name !== undefined) update.name = input.name;
  if (input.room_type !== undefined) update.room_type = input.room_type;
  if (input.icon !== undefined) update.icon = input.icon;
  if (input.order_index !== undefined) update.order_index = input.order_index;
  
  return update;
}

/**
 * Map room order items to database update format
 */
export function mapRoomOrderToDbUpdates(
  orders: RoomOrderItem[]
): Array<{ id: string; order_index: number }> {
  return orders.map((order) => ({
    id: order.id,
    order_index: order.order_index,
  }));
}

/**
 * Create room display name (for UI)
 */
export function createRoomDisplayName(room: RoomDomainModel): string {
  return room.name.trim();
}

/**
 * Create room summary string (for UI)
 */
export function createRoomSummary(room: RoomDomainModel): string {
  const targetText = room.targetCount === 1 ? '1 target' : `${room.targetCount} targets`;
  return `${room.name} (${targetText})`;
}

