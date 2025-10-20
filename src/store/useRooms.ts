
import { create } from 'zustand';
import { supabaseRoomsService, type UserRoom, type CreateRoomData } from '@/services/supabase-rooms';
import { toast } from "@/components/ui/sonner";

export type Room = {
  id: string; // Changed from number to string (UUID)
  name: string;
  order: number;
  targetCount: number;
  icon?: string;
  room_type?: string;
  thingsBoardId?: string; // ThingsBoard device group ID (legacy)
};

interface RoomsState {
  rooms: Room[];
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
  setRooms: (rooms: Room[]) => void;
}

export const useRooms = create<RoomsState>((set, get) => ({
  rooms: [],
  isLoading: false,
  error: null,
  
  fetchRooms: async () => {
    set({ isLoading: true, error: null });
    try {
      const userRooms = await supabaseRoomsService.getRoomsWithTargetCounts();
      
      // Transform to Room format
      const rooms: Room[] = userRooms.map(room => ({
        id: room.id,
        name: room.name,
        order: room.order_index,
        targetCount: room.target_count || 0, // Use pre-calculated count
        icon: room.icon,
        room_type: room.room_type
      }));
      
      set({ rooms, isLoading: false, error: null });
    } catch (error) {
      console.error('❌ useRooms: Error fetching rooms:', error);
      
      set({ 
        rooms: [],
        error: error instanceof Error ? error.message : 'Failed to fetch rooms',
        isLoading: false 
      });
      
      toast.error('Failed to load rooms from database');
    }
  },
  
  createRoom: async (roomData: CreateRoomData) => {
    try {
      const newUserRoom = await supabaseRoomsService.createRoom(roomData);
      
      const newRoom: Room = {
        id: newUserRoom.id,
        name: newUserRoom.name,
        order: newUserRoom.order_index,
        targetCount: newUserRoom.target_count || 0,
        icon: newUserRoom.icon,
        room_type: newUserRoom.room_type
      };
      
      // Add the new room to state
      set(state => ({
        rooms: [...state.rooms, newRoom]
      }));
      
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
      
      // Light refresh - only fetch updated data
      const { fetchRooms, getAllTargetsWithAssignments } = get();
      await Promise.all([
        fetchRooms(),
        getAllTargetsWithAssignments(false) // Use data if fresh
      ]);
      
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
      const { fetchRooms, getAllTargetsWithAssignments } = get();
      await Promise.all([
        fetchRooms(),
        getAllTargetsWithAssignments(true)
      ]);
      
      toast.success(`${targetIds.length} target${targetIds.length > 1 ? 's' : ''} ${roomId === null ? 'unassigned' : 'assigned'} successfully`);
    } catch (error) {
      console.error('❌ [BATCH] State: Error in batch assignment:', error);
      toast.error(`Failed to ${roomId === null ? 'unassign' : 'assign'} targets`);
      throw error;
    }
  },
  
  getRoomTargets: async (roomId: string) => {
    try {
      return await supabaseRoomsService.getRoomTargets(roomId);
    } catch (error) {
      console.error('Error fetching room targets:', error);
      return [];
    }
  },
  
  getUnassignedTargets: async () => {
    try {
      return await supabaseRoomsService.getUnassignedTargets();
    } catch (error) {
      console.error('Error fetching unassigned targets:', error);
      return [];
    }
  },

  getAllTargetsWithAssignments: async (forceRefresh: boolean = false) => {
    try {
      const result = await supabaseRoomsService.getAllTargetsWithAssignments(forceRefresh);
      return result;
    } catch (error) {
      console.error('❌ [ERROR] State: Error fetching targets with assignments:', error);
      return [];
    }
  },

  // Update target count for a specific room (optimized)
  updateRoomTargetCount: async (roomId: string) => {
    try {
      const roomTargets = await supabaseRoomsService.getRoomTargets(roomId);
      const newCount = roomTargets.length;
      
      // Update the room in state with new target count
      set(state => ({
        rooms: state.rooms.map(room => 
          room.id === roomId ? { ...room, targetCount: newCount } : room
        )
      }));
    } catch (error) {
      console.error(`Error updating target count for room ${roomId}:`, error);
    }
  },

  setRooms: (rooms: Room[]) => {
    set({ rooms, isLoading: false, error: null });
  }
}));
