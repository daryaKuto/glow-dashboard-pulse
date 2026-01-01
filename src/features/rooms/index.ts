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

