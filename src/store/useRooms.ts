
import { create } from 'zustand';
import API from '@/lib/api';
import { toast } from "@/components/ui/sonner";

export type Room = {
  id: number;
  name: string;
  order: number;
  targetCount: number;
  icon?: string;
  thingsBoardId?: string; // ThingsBoard device group ID
};

interface RoomsState {
  rooms: Room[];
  isLoading: boolean;
  error: string | null;
  fetchRooms: (token: string) => Promise<void>;
  createRoom: (name: string, token: string, icon?: string) => Promise<void>;
  updateRoom: (id: number, name: string, token: string) => Promise<void>;
  deleteRoom: (id: number, token: string) => Promise<void>;
  updateRoomOrder: (orderedRooms: { id: number, order: number }[], token: string) => Promise<void>;
  assignTargetToRoom: (targetId: string, roomId: string | null) => Promise<void>;
  getRoomTargets: (roomId: string) => Promise<any[]>;
}

export const useRooms = create<RoomsState>((set, get) => ({
  rooms: [],
  isLoading: false,
  error: null,
  
  fetchRooms: async (token: string) => {
    set({ isLoading: true, error: null });
    try {
      const rooms = await API.getRooms();
      set({ rooms: rooms as Room[], isLoading: false });
    } catch (error) {
      console.error('Error fetching rooms:', error);
      set({ 
        rooms: [
          { id: 1, name: 'Living Room', order: 1, targetCount: 3, icon: 'sofa' },
          { id: 2, name: 'Dining Room', order: 2, targetCount: 2, icon: 'utensils' },
          { id: 3, name: 'Kitchen', order: 3, targetCount: 2, icon: 'chef-hat' },
          { id: 4, name: 'Bedroom', order: 4, targetCount: 1, icon: 'bed' },
          { id: 5, name: 'Office', order: 5, targetCount: 2, icon: 'briefcase' },
          { id: 6, name: 'Basement', order: 6, targetCount: 4, icon: 'building' }
        ], 
        isLoading: false 
      });
    }
  },
  
  createRoom: async (name: string, token: string, icon: string = 'home') => {
    try {
      const newRoom = await API.createRoom(name, icon);
      
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
  
  updateRoom: async (id: number, name: string, token: string) => {
    try {
      await API.updateRoom(id, name);
      
      // Update the room in state
      set(state => ({
        rooms: state.rooms.map(room => 
          room.id === id ? { ...room, name } : room
        )
      }));
      
      toast.success('Room updated successfully');
    } catch (error) {
      console.error('Error updating room:', error);
      toast.error('Failed to update room');
    }
  },
  
  deleteRoom: async (id: number, token: string) => {
    try {
      await API.deleteRoom(id);
      
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
  
  updateRoomOrder: async (orderedRooms: { id: number, order: number }[], token: string) => {
    try {
      await API.updateRoomOrder(orderedRooms);
      
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
      await API.assignTargetToRoom(targetId, roomId);
      
      // Refresh rooms to get updated target counts
      const { fetchRooms } = get();
      // TODO: Get proper token from auth context
      await fetchRooms(''); // We need to implement proper token handling
      
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
      return await API.getRoomTargets(roomId);
    } catch (error) {
      console.error('Error fetching room targets:', error);
      return [];
    }
  }
}));
