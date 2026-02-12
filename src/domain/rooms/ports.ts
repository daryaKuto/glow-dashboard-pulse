/**
 * Rooms Domain Ports
 *
 * Repository interfaces for data access.
 * Pure types - no React or Supabase imports.
 */

import type { ApiResponse } from '@/shared/lib/api-response';

export type RoomRecord = {
  id: string;
  name: string;
  room_type: string;
  icon: string | null;
  order_index: number;
  created_at: string;
  updated_at: string;
  target_count?: number;
};

export type RoomWithTargets<TTarget = unknown> = {
  rooms: Array<{
    id: string;
    name: string;
    order: number;
    icon?: string | null;
    room_type?: string | null;
    targetCount: number;
    targets: TTarget[];
  }>;
  unassignedTargets: TTarget[];
  cached: boolean;
};

export type CreateRoomRequest = {
  name: string;
  room_type: string;
  icon?: string;
  order_index: number;
  assignedTargets?: string[];
};

export type UpdateRoomRequest = {
  name?: string;
  room_type?: string;
  icon?: string;
  order_index?: number;
};

export type RoomOrderRequest = Array<{
  id: string;
  order_index: number;
}>;

export type AssignTargetRequest = {
  targetId: string;
  roomId: string | null;
  targetName?: string;
};

export interface RoomRepository<TTarget = unknown> {
  getRooms: (force?: boolean) => Promise<ApiResponse<RoomWithTargets<TTarget>>>;
  createRoom: (roomData: CreateRoomRequest) => Promise<ApiResponse<RoomRecord>>;
  updateRoom: (roomId: string, updates: UpdateRoomRequest) => Promise<ApiResponse<RoomRecord>>;
  deleteRoom: (roomId: string) => Promise<ApiResponse<void>>;
  updateRoomOrder: (roomOrders: RoomOrderRequest) => Promise<ApiResponse<void>>;
  assignTargetToRoom: (data: AssignTargetRequest) => Promise<ApiResponse<void>>;
  assignTargetsToRoom: (
    roomId: string,
    targetIds: string[],
    targetNames?: Map<string, string>
  ) => Promise<ApiResponse<void>>;
  unassignTargets: (targetIds: string[]) => Promise<ApiResponse<void>>;
  getRoomTargets: (roomId: string) => Promise<ApiResponse<string[]>>;
}
