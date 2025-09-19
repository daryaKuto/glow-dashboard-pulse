
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
  getRoomTargets: (roomId: string) => Promise<any[]>;
  getUnassignedTargets: () => Promise<any[]>;
  getAllTargetsWithAssignments: () => Promise<any[]>;
}

export const useRooms = create<RoomsState>((set, get) => ({
  rooms: [],
  isLoading: false,
  error: null,
  
  fetchRooms: async () => {
    set({ isLoading: true, error: null });
    try {
      console.log('🔄 useRooms: Fetching rooms from Supabase...');
      const userRooms = await supabaseRoomsService.getUserRooms();
      console.log('✅ useRooms: Fetched rooms:', userRooms.length);
      
      // Get target counts from Supabase assignments for each room
      const rooms: Room[] = await Promise.all(
        userRooms.map(async (room) => {
          try {
            const roomTargets = await supabaseRoomsService.getRoomTargets(room.id);
            return {
              id: room.id,
              name: room.name,
              order: room.order_index,
              targetCount: roomTargets.length, // Use actual count from Supabase
              icon: room.icon,
              room_type: room.room_type
            };
          } catch (error) {
            console.error(`Error getting target count for room ${room.id}:`, error);
            return {
              id: room.id,
              name: room.name,
              order: room.order_index,
              targetCount: 0, // Fallback to 0 if error
              icon: room.icon,
              room_type: room.room_type
            };
          }
        })
      );
      
      set({ rooms, isLoading: false, error: null });
      console.log('✅ useRooms: Rooms loaded successfully:', rooms.length);
    } catch (error) {
      console.error('❌ useRooms: Error fetching rooms:', error);
      
      set({ 
        rooms: [],
        error: error instanceof Error ? error.message : 'Failed to fetch rooms',
        isLoading: false 
      });
      
      console.log('❌ useRooms: Failed to load rooms from Supabase');
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
      console.log(`🔄 Assigning target ${targetId} to ${roomId ? `room ${roomId}` : 'unassigned'} in Supabase only...`);
      
      // Update Supabase only - no ThingsBoard posting
      if (roomId === null) {
        await supabaseRoomsService.unassignTargets([targetId]);
      } else {
        await supabaseRoomsService.assignTargetsToRoom(roomId, [targetId]);
      }
      
      // Refresh rooms to get updated target counts
      const { fetchRooms } = get();
      await fetchRooms();
      
      // Clear cache to force fresh data
      const { clearTargetsCache } = await import('@/lib/api');
      clearTargetsCache();
      
      console.log(`✅ Target assignment completed in Supabase: ${targetId} → ${roomId ? `Room ${roomId}` : 'Unassigned'}`);
      
      if (roomId === null) {
        toast.success('Target unassigned from room successfully');
      } else {
        toast.success('Target assigned to room successfully');
      }
    } catch (error) {
      console.error('Error assigning/unassigning target to room:', error);
      toast.error(roomId === null ? 'Failed to unassign target from room' : 'Failed to assign target to room');
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

  getAllTargetsWithAssignments: async () => {
    try {
      return await supabaseRoomsService.getAllTargetsWithAssignments();
    } catch (error) {
      console.error('Error fetching targets with assignments:', error);
      return [];
    }
  }
}));
