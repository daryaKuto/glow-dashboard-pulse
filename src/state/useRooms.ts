
/**
 * @deprecated This store is deprecated. Use React Query hooks from @/features/rooms instead.
 * 
 * Migration guide:
 * - Replace `useRooms()` with `useRooms()` from '@/features/rooms'
 * - Replace `createRoom()` with `useCreateRoom()` mutation hook
 * - Replace `updateRoom()` with `useUpdateRoom()` mutation hook
 * - Replace `deleteRoom()` with `useDeleteRoom()` mutation hook
 * 
 * This file will be removed in a future version.
 */

import { create } from 'zustand';
import { supabaseRoomsService, type UserRoom, type CreateRoomData } from '@/features/rooms/lib/supabase-rooms';
import { fetchRoomsData } from '@/lib/edge';
import { useTargets, type Target } from '@/state/useTargets';
import { toast } from "@/components/ui/sonner";

export type Room = {
  id: string; // Changed from number to string (UUID)
  name: string;
  order: number;
  targetCount: number;
  icon?: string;
  room_type?: string;
  thingsBoardId?: string; // ThingsBoard device group ID (legacy)
  targets?: Target[];
};

interface RoomsState {
  rooms: Room[];
  unassignedTargets: Target[];
  isLoading: boolean;
  error: string | null;
  fetchRooms: () => Promise<void>;
  createRoom: (roomData: CreateRoomData) => Promise<void>;
  updateRoom: (id: string, updates: Partial<CreateRoomData>) => Promise<void>;
  deleteRoom: (id: string) => Promise<void>;
  updateRoomOrder: (orderedRooms: { id: string, order: number }[]) => Promise<void>;
  assignTargetToRoom: (targetId: string, roomId: string | null) => Promise<void>;
  assignTargetsToRoomBatch: (targetIds: string[], roomId: string | null) => Promise<void>;
  getRoomTargets: (roomId: string) => Promise<any[]>;
  getUnassignedTargets: () => Promise<any[]>;
  getAllTargetsWithAssignments: (forceRefresh?: boolean) => Promise<any[]>;
  updateRoomTargetCount: (roomId: string) => Promise<void>;
  setRooms: (rooms: Room[], unassignedTargets?: Target[]) => void;
}

export const useRooms = create<RoomsState>((set, get) => ({
  rooms: [],
  unassignedTargets: [],
  isLoading: false,
  error: null,
  
  fetchRooms: async () => {
    set({ isLoading: true, error: null });
    try {
      const { rooms: edgeRooms, unassignedTargets, cached } = await fetchRoomsData(true);

      const rooms: Room[] = edgeRooms.map(room => ({
        id: room.id,
        name: room.name,
        order: room.order,
        targetCount: room.targetCount,
        icon: room.icon ?? undefined,
        room_type: room.room_type ?? undefined,
        targets: room.targets,
      }));

      set({ rooms, unassignedTargets, isLoading: false, error: null });
    } catch (error) {
      console.error('❌ useRooms: Error fetching rooms:', error);
      
      set({ 
        rooms: [],
        unassignedTargets: [],
        error: error instanceof Error ? error.message : 'Failed to fetch rooms',
        isLoading: false 
      });
      
      toast.error('Failed to load rooms from database');
    }
  },
  
  createRoom: async (roomData: CreateRoomData) => {
    try {
      await supabaseRoomsService.createRoom(roomData);

      await get().fetchRooms();

      const targetsStore = useTargets.getState();
      targetsStore.clearCache();
      await targetsStore.refresh();

      toast.success('Room created successfully');
    } catch (error) {
      console.error('Error creating room:', error);
      toast.error('Failed to create room');
    }
  },
  
  updateRoom: async (id: string, updates: Partial<CreateRoomData>) => {
    try {
      await supabaseRoomsService.updateRoom(id, updates);
      
      // Update the room in state
      set(state => ({
        rooms: state.rooms.map(room => 
          room.id === id ? { ...room, ...updates } : room
        )
      }));

      const targetsStore = useTargets.getState();
      targetsStore.clearCache();
      try {
        await targetsStore.refresh();
      } catch (error) {
        console.warn('⚠️ useRooms: Failed to refresh targets after room update', error);
      }
      
      toast.success('Room updated successfully');
    } catch (error) {
      console.error('Error updating room:', error);
      toast.error('Failed to update room');
    }
  },
  
  deleteRoom: async (id: string) => {
    try {
      await supabaseRoomsService.deleteRoom(id);
      
      // Remove the room from state
      set(state => ({
        rooms: state.rooms.filter(room => room.id !== id)
      }));

      const targetsStore = useTargets.getState();
      targetsStore.clearCache();
      try {
        await targetsStore.refresh();
      } catch (error) {
        console.warn('⚠️ useRooms: Failed to refresh targets after room deletion', error);
      }
      
      toast.success('Room deleted successfully');
    } catch (error) {
      console.error('Error deleting room:', error);
      toast.error('Failed to delete room');
    }
  },
  
  updateRoomOrder: async (orderedRooms: { id: string, order: number }[]) => {
    try {
      const roomOrders = orderedRooms.map(room => ({
        id: room.id,
        order_index: room.order
      }));
      
      await supabaseRoomsService.updateRoomOrder(roomOrders);
      
      // Update room order in state
      set(state => ({
        rooms: state.rooms.map(room => {
          const updatedRoom = orderedRooms.find(or => or.id === room.id);
          return updatedRoom ? { ...room, order: updatedRoom.order } : room;
        }).sort((a, b) => a.order - b.order)
      }));
      
      toast.success('Room order updated');
    } catch (error) {
      console.error('Error updating room order:', error);
      toast.error('Failed to update room order');
    }
  },
  
  assignTargetToRoom: async (targetId: string, roomId: string | null) => {
    try {
      // Update Supabase only
      if (roomId === null) {
        await supabaseRoomsService.unassignTargets([targetId]);
      } else {
        await supabaseRoomsService.assignTargetsToRoom(roomId, [targetId]);
      }
      
      await get().fetchRooms();
      const targetsStore = useTargets.getState();
      targetsStore.clearCache();
      try {
        await targetsStore.refresh();
      } catch (error) {
        console.warn('⚠️ useRooms: Failed to refresh targets after assignment', error);
      }
      
      toast.success(`Target ${roomId === null ? 'unassigned' : 'assigned'} successfully`);
    } catch (error) {
      console.error('❌ [ERROR] State: Error assigning target:', error);
      toast.error(`Failed to ${roomId === null ? 'unassign' : 'assign'} target`);
      throw error;
    }
  },
  
  assignTargetsToRoomBatch: async (targetIds: string[], roomId: string | null) => {
    if (targetIds.length === 0) return;
    
    try {
      // Single Supabase operation for all targets
      if (roomId === null) {
        await supabaseRoomsService.unassignTargets(targetIds);
      } else {
        await supabaseRoomsService.assignTargetsToRoom(roomId, targetIds);
      }
      
      // Single refresh operation for all assignments
      await get().fetchRooms();
      const targetsStore = useTargets.getState();
      targetsStore.clearCache();
      try {
        await targetsStore.refresh();
      } catch (error) {
        console.warn('⚠️ useRooms: Failed to refresh targets after batch assignment', error);
      }
      
      toast.success(`${targetIds.length} target${targetIds.length > 1 ? 's' : ''} ${roomId === null ? 'unassigned' : 'assigned'} successfully`);
    } catch (error) {
      console.error('❌ [BATCH] State: Error in batch assignment:', error);
      toast.error(`Failed to ${roomId === null ? 'unassign' : 'assign'} targets`);
      throw error;
    }
  },
  
  getRoomTargets: async (roomId: string) => {
    try {
      const state = get();
      const room = state.rooms.find(r => r.id === roomId);
      if (room?.targets) {
        return room.targets;
      }
      await state.fetchRooms();
      return get().rooms.find(r => r.id === roomId)?.targets ?? [];
    } catch (error) {
      console.error('Error fetching room targets:', error);
      return [];
    }
  },
  
  getUnassignedTargets: async () => {
    try {
      const state = get();
      if (state.unassignedTargets.length === 0) {
        await state.fetchRooms();
      }
      return get().unassignedTargets;
    } catch (error) {
      console.error('Error fetching unassigned targets:', error);
      return [];
    }
  },

  getAllTargetsWithAssignments: async (forceRefresh: boolean = false) => {
    try {
      if (forceRefresh || get().rooms.length === 0) {
        await get().fetchRooms();
      }

      const state = get();
      const assignedTargets = state.rooms.flatMap(room =>
        (room.targets ?? []).map(target => ({ ...target, roomId: room.id }))
      );

      return [...assignedTargets, ...state.unassignedTargets];
    } catch (error) {
      console.error('❌ [ERROR] State: Error fetching targets with assignments:', error);
      return [];
    }
  },

  // Update target count for a specific room (optimized)
  updateRoomTargetCount: async (roomId: string) => {
    const state = get();
    const room = state.rooms.find(r => r.id === roomId);
    if (!room) return;
    const newCount = room.targets?.length ?? room.targetCount;
    set(s => ({
      rooms: s.rooms.map(existing => 
        existing.id === roomId ? { ...existing, targetCount: newCount } : existing
      )
    }));
  },

  setRooms: (rooms: Room[], unassignedTargets: Target[] = []) => {
    set({ rooms, unassignedTargets, isLoading: false, error: null });
  }
}));
