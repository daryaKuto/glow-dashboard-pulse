import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/components/ui/sonner';
import { useAuth } from '@/shared/hooks';
import {
  getRoomsWithTargets,
  createRoomService,
  createRoomWithPermissionService,
  updateRoomService,
  updateRoomWithPermissionService,
  deleteRoomService,
  deleteRoomWithPermissionService,
  updateRoomOrderService,
  assignTargetToRoomService,
  assignTargetsToRoomService,
  assignTargetsToRoomWithPermissionService,
  getRoomLayoutService,
  saveRoomLayoutService,
  createRoomWithLayoutService,
  updateTargetPositionsService,
  type UserContext,
  type RoomContext,
  type RoomLayoutRow,
} from './service';
import type {
  Room,
  CreateRoomData,
  UpdateRoomData,
  RoomOrder,
  AssignTargetToRoomData,
} from './schema';
import type { RoomsWithTargets } from './repo';

/**
 * Helper to build UserContext from auth user
 */
function buildUserContext(userId: string | undefined): UserContext | null {
  if (!userId) return null;
  return {
    userId,
    // subscriptionTier could be fetched from user profile if needed
    // For now, we use default (free) tier
  };
}

/**
 * React Query hooks for Rooms feature
 * 
 * Replaces Zustand store usage with React Query for server state management.
 */

// Query keys
export const roomsKeys = {
  all: ['rooms'] as const,
  lists: () => [...roomsKeys.all, 'list'] as const,
  list: (force?: boolean) => [...roomsKeys.lists(), force] as const,
  detail: (id: string) => [...roomsKeys.all, 'detail', id] as const,
};

/**
 * Get all rooms with targets
 */
export function useRooms(force = false) {
  return useQuery({
    queryKey: roomsKeys.list(force),
    queryFn: async () => {
      const result = await getRoomsWithTargets(force);
      if (!result.ok) {
        throw new Error(result.error.message);
      }
      return result.data;
    },
    staleTime: 60 * 1000, // 60 seconds - increased to reduce refetches
    refetchOnMount: false, // Don't refetch if data exists and is fresh
  });
}

/**
 * Create a new room
 */
export function useCreateRoom() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (roomData: CreateRoomData) => {
      const result = await createRoomService(roomData);
      if (!result.ok) {
        throw new Error(result.error.message);
      }
      return result.data;
    },
    onSuccess: () => {
      // Invalidate rooms list to refetch
      queryClient.invalidateQueries({ queryKey: roomsKeys.lists() });
      toast.success('Room created successfully');
    },
    onError: (error: Error) => {
      toast.error(`Failed to create room: ${error.message}`);
    },
  });
}

/**
 * Update an existing room
 */
export function useUpdateRoom() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ roomId, updates }: { roomId: string; updates: UpdateRoomData }) => {
      const result = await updateRoomService(roomId, updates);
      if (!result.ok) {
        throw new Error(result.error.message);
      }
      return result.data;
    },
    onSuccess: (_, variables) => {
      // Invalidate rooms list and specific room
      queryClient.invalidateQueries({ queryKey: roomsKeys.lists() });
      queryClient.invalidateQueries({ queryKey: roomsKeys.detail(variables.roomId) });
      toast.success('Room updated successfully');
    },
    onError: (error: Error) => {
      toast.error(`Failed to update room: ${error.message}`);
    },
  });
}

/**
 * Delete a room
 */
export function useDeleteRoom() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (roomId: string) => {
      const result = await deleteRoomService(roomId);
      if (!result.ok) {
        throw new Error(result.error.message);
      }
    },
    onSuccess: () => {
      // Invalidate rooms list
      queryClient.invalidateQueries({ queryKey: roomsKeys.lists() });
      toast.success('Room deleted successfully');
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete room: ${error.message}`);
    },
  });
}

/**
 * Update room order
 */
export function useUpdateRoomOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (roomOrders: RoomOrder) => {
      const result = await updateRoomOrderService(roomOrders);
      if (!result.ok) {
        throw new Error(result.error.message);
      }
    },
    onSuccess: () => {
      // Invalidate rooms list
      queryClient.invalidateQueries({ queryKey: roomsKeys.lists() });
    },
    onError: (error: Error) => {
      toast.error(`Failed to update room order: ${error.message}`);
    },
  });
}

/**
 * Assign target to room
 */
export function useAssignTargetToRoom() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: AssignTargetToRoomData) => {
      const result = await assignTargetToRoomService(data);
      if (!result.ok) {
        throw new Error(result.error.message);
      }
    },
    onSuccess: () => {
      // Invalidate rooms list to refresh target assignments
      queryClient.invalidateQueries({ queryKey: roomsKeys.lists() });
      // Also invalidate targets if that query exists
      queryClient.invalidateQueries({ queryKey: ['targets'] });
    },
    onError: (error: Error) => {
      toast.error(`Failed to assign target: ${error.message}`);
    },
  });
}

/**
 * Assign multiple targets to room
 */
export function useAssignTargetsToRoom() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      targetIds,
      roomId,
      targetNames,
    }: {
      targetIds: string[];
      roomId: string | null;
      targetNames?: Map<string, string>;
    }) => {
      const result = await assignTargetsToRoomService(targetIds, roomId, targetNames);
      if (!result.ok) {
        throw new Error(result.error.message);
      }
    },
    onSuccess: () => {
      // Invalidate rooms list to refresh target assignments
      queryClient.invalidateQueries({ queryKey: roomsKeys.lists() });
      // Also invalidate targets if that query exists
      queryClient.invalidateQueries({ queryKey: ['targets'] });
    },
    onError: (error: Error) => {
      toast.error(`Failed to assign targets: ${error.message}`);
    },
  });
}

// ============================================================================
// Permission-Aware Hooks
// These hooks enforce permission checks before performing operations.
// Use these when you need to respect subscription tier limits and ownership.
// ============================================================================

/**
 * Create a new room with permission check
 * Validates user can create rooms based on subscription tier and current room count.
 */
export function useCreateRoomWithPermission() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      roomData,
      currentRoomCount,
    }: {
      roomData: CreateRoomData;
      currentRoomCount: number;
    }) => {
      const userContext = buildUserContext(user?.id);
      if (!userContext) {
        throw new Error('User must be authenticated to create rooms');
      }

      const result = await createRoomWithPermissionService(
        userContext,
        roomData,
        currentRoomCount
      );
      if (!result.ok) {
        throw new Error(result.error.message);
      }
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: roomsKeys.lists() });
      toast.success('Room created successfully');
    },
    onError: (error: Error) => {
      toast.error(`Failed to create room: ${error.message}`);
    },
  });
}

/**
 * Update a room with permission check
 * Validates user owns the room before allowing updates.
 */
export function useUpdateRoomWithPermission() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      room,
      updates,
    }: {
      room: RoomContext;
      updates: UpdateRoomData;
    }) => {
      const userContext = buildUserContext(user?.id);
      if (!userContext) {
        throw new Error('User must be authenticated to update rooms');
      }

      const result = await updateRoomWithPermissionService(userContext, room, updates);
      if (!result.ok) {
        throw new Error(result.error.message);
      }
      return result.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: roomsKeys.lists() });
      queryClient.invalidateQueries({ queryKey: roomsKeys.detail(variables.room.roomId) });
      toast.success('Room updated successfully');
    },
    onError: (error: Error) => {
      toast.error(`Failed to update room: ${error.message}`);
    },
  });
}

/**
 * Delete a room with permission check
 * Validates user owns the room before allowing deletion.
 */
export function useDeleteRoomWithPermission() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (room: RoomContext) => {
      const userContext = buildUserContext(user?.id);
      if (!userContext) {
        throw new Error('User must be authenticated to delete rooms');
      }

      const result = await deleteRoomWithPermissionService(userContext, room);
      if (!result.ok) {
        throw new Error(result.error.message);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: roomsKeys.lists() });
      toast.success('Room deleted successfully');
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete room: ${error.message}`);
    },
  });
}

/**
 * Assign multiple targets to room with permission check
 * Validates user owns the room and respects target limits.
 */
export function useAssignTargetsToRoomWithPermission() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      room,
      targetIds,
      targetNames,
    }: {
      room: RoomContext;
      targetIds: string[];
      targetNames?: Map<string, string>;
    }) => {
      const userContext = buildUserContext(user?.id);
      if (!userContext) {
        throw new Error('User must be authenticated to assign targets');
      }

      const result = await assignTargetsToRoomWithPermissionService(
        userContext,
        room,
        targetIds,
        targetNames
      );
      if (!result.ok) {
        throw new Error(result.error.message);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: roomsKeys.lists() });
      queryClient.invalidateQueries({ queryKey: ['targets'] });
      toast.success('Targets assigned successfully');
    },
    onError: (error: Error) => {
      toast.error(`Failed to assign targets: ${error.message}`);
    },
  });
}

// ============================================================================
// Layout Hooks
// ============================================================================

/**
 * Get room layout for a specific room
 */
export function useRoomLayout(roomId: string | undefined) {
  return useQuery({
    queryKey: [...roomsKeys.all, 'layout', roomId],
    queryFn: async () => {
      if (!roomId) return null;
      const result = await getRoomLayoutService(roomId);
      if (!result.ok) {
        throw new Error(result.error.message);
      }
      return result.data;
    },
    enabled: !!roomId,
    staleTime: 60 * 1000,
  });
}

/**
 * Save room layout
 */
export function useSaveRoomLayout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      roomId,
      layoutData,
      viewport,
      canvasWidth,
      canvasHeight,
    }: {
      roomId: string;
      layoutData: Record<string, unknown>;
      viewport: { scale: number; x: number; y: number };
      canvasWidth: number;
      canvasHeight: number;
    }) => {
      const result = await saveRoomLayoutService(
        roomId,
        layoutData,
        viewport,
        canvasWidth,
        canvasHeight
      );
      if (!result.ok) {
        throw new Error(result.error.message);
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: [...roomsKeys.all, 'layout', variables.roomId],
      });
      queryClient.invalidateQueries({ queryKey: roomsKeys.lists() });
    },
    onError: (error: Error) => {
      toast.error(`Failed to save layout: ${error.message}`);
    },
  });
}

/**
 * Create a new room with layout
 */
export function useCreateRoomWithLayout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      roomData,
      layoutData,
      viewport,
      canvasWidth,
      canvasHeight,
    }: {
      roomData: CreateRoomData;
      layoutData: Record<string, unknown>;
      viewport: { scale: number; x: number; y: number };
      canvasWidth: number;
      canvasHeight: number;
    }) => {
      const result = await createRoomWithLayoutService(
        roomData,
        layoutData,
        viewport,
        canvasWidth,
        canvasHeight
      );
      if (!result.ok) {
        throw new Error(result.error.message);
      }
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: roomsKeys.lists() });
      toast.success('Room created with layout');
    },
    onError: (error: Error) => {
      toast.error(`Failed to create room: ${error.message}`);
    },
  });
}

/**
 * Update target positions from canvas
 */
export function useUpdateTargetPositions() {
  return useMutation({
    mutationFn: async ({
      roomId,
      positions,
    }: {
      roomId: string;
      positions: Array<{ targetId: string; x: number; y: number }>;
    }) => {
      const result = await updateTargetPositionsService(roomId, positions);
      if (!result.ok) {
        throw new Error(result.error.message);
      }
    },
    onError: (error: Error) => {
      toast.error(`Failed to update positions: ${error.message}`);
    },
  });
}

// Re-export types for consumers
export type { UserContext, RoomContext } from './service';

