
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
  updateRoomTargetCount: (roomId: string) => Promise<void>;
}

export const useRooms = create<RoomsState>((set, get) => ({
  rooms: [],
  isLoading: false,
  error: null,
  
  fetchRooms: async () => {
    set({ isLoading: true, error: null });
    try {
      console.log('🔄 useRooms: Fetching rooms with target counts from Supabase...');
      const userRooms = await supabaseRoomsService.getRoomsWithTargetCounts();
      console.log('✅ useRooms: Fetched rooms with counts:', userRooms.length);
      
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
      console.log(`🎯 [ASSIGNMENT] State: Starting assignment of target ${targetId} to ${roomId ? `room ${roomId}` : 'unassigned'}`);
      console.log(`🔍 [ID-CHECK] State: Target ID format: ${targetId} (type: ${typeof targetId})`);
      console.log(`🔍 [ID-CHECK] State: Room ID format: ${roomId} (type: ${typeof roomId})`);
      
      // Update Supabase only - no ThingsBoard posting
      if (roomId === null) {
        console.log('🎯 [ASSIGNMENT] State: Unassigning target from all rooms...');
        await supabaseRoomsService.unassignTargets([targetId]);
      } else {
        console.log('🎯 [ASSIGNMENT] State: Assigning target to room...');
        await supabaseRoomsService.assignTargetsToRoom(roomId, [targetId]);
      }
      
      console.log('🔄 [REFRESH] State: Refreshing rooms to get updated target counts...');
      // Refresh rooms to get updated target counts
      const { fetchRooms } = get();
      await fetchRooms();
      
      console.log('🔄 [REFRESH] State: Clearing targets cache...');
      // Clear cache to force fresh data
      const { clearTargetsCache } = await import('@/lib/api');
      clearTargetsCache();
      
      console.log(`✅ [SUCCESS] State: Target assignment completed in Supabase: ${targetId} → ${roomId ? `Room ${roomId}` : 'Unassigned'}`);
      
      if (roomId === null) {
        toast.success('Target unassigned from room successfully');
      } else {
        toast.success('Target assigned to room successfully');
      }
    } catch (error) {
      console.error('❌ [ERROR] State: Error assigning/unassigning target to room:', error);
      console.error('❌ [ERROR] State: Error details:', {
        message: error.message,
        stack: error.stack,
        targetId,
        roomId
      });
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
      console.log('🔄 [REFRESH] State: Fetching all targets with assignments...');
      const result = await supabaseRoomsService.getAllTargetsWithAssignments();
      console.log(`📊 [DATA] State: Retrieved ${result.length} targets with assignments`);
      console.log('📊 [DATA] State: Sample targets:', result.slice(0, 3).map(t => ({
        name: t.name,
        roomId: t.roomId,
        id: t.id
      })));
      return result;
    } catch (error) {
      console.error('❌ [ERROR] State: Error fetching targets with assignments:', error);
      console.error('❌ [ERROR] State: Error details:', {
        message: error.message,
        stack: error.stack
      });
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
      
      console.log(`✅ Updated target count for room ${roomId}: ${newCount}`);
    } catch (error) {
      console.error(`Error updating target count for room ${roomId}:`, error);
    }
  }
}));
