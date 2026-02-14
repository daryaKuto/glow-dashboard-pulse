/**
 * Public API for Rooms feature
 * 
 * Exports only what other features/pages need to use.
 * Internal implementation details are kept private.
 */

// Hooks (main API)
export {
  useRooms,
  useCreateRoom,
  useUpdateRoom,
  useDeleteRoom,
  useUpdateRoomOrder,
  useAssignTargetToRoom,
  useAssignTargetsToRoom,
  // Permission-aware hooks
  useCreateRoomWithPermission,
  useUpdateRoomWithPermission,
  useDeleteRoomWithPermission,
  useAssignTargetsToRoomWithPermission,
  // Layout hooks
  useRoomLayout,
  useSaveRoomLayout,
  useCreateRoomWithLayout,
  useUpdateTargetPositions,
  roomsKeys,
} from './hooks';

// Types
export type {
  Room,
  CreateRoomData,
  UpdateRoomData,
  RoomOrder,
  AssignTargetToRoomData,
} from './schema';

export type { RoomsWithTargets, EdgeRoom } from './repo';

// Permission types
export type { UserContext, RoomContext } from './hooks';

