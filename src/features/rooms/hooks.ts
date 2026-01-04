import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/components/ui/sonner';
import {
  getRoomsWithTargets,
  createRoomService,
  updateRoomService,
  deleteRoomService,
  updateRoomOrderService,
  assignTargetToRoomService,
  assignTargetsToRoomService,
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
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/833eaf25-0547-420d-a570-1d7cab6b5873',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'rooms/hooks.ts:41',message:'useRooms queryFn start',data:{force},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H3'})}).catch(()=>{});
      // #endregion
      const result = await getRoomsWithTargets(force);
      if (!result.ok) {
        throw new Error(result.error.message);
      }
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/833eaf25-0547-420d-a570-1d7cab6b5873',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'rooms/hooks.ts:46',message:'useRooms queryFn complete',data:{force,hasData:!!result.data},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H3'})}).catch(()=>{});
      // #endregion
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

