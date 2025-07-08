
import { create } from 'zustand';
import API from '@/lib/api';
import { toast } from "@/components/ui/sonner";

export type Room = {
  id: number;
  name: string;
  order: number;
  targetCount: number;
  icon?: string;
};

interface RoomsState {
  rooms: Room[];
  isLoading: boolean;
  error: string | null;
  fetchRooms: (token: string) => Promise<void>;
  createRoom: (name: string, token: string) => Promise<void>;
  updateRoom: (id: number, name: string, token: string) => Promise<void>;
  deleteRoom: (id: number, token: string) => Promise<void>;
  updateRoomOrder: (orderedRooms: { id: number, order: number }[], token: string) => Promise<void>;
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
      // Rooms not implemented yet, use mock data for development
      console.log('Rooms not implemented with ThingsBoard yet, using mock data');
      set({ 
        rooms: [
          { id: 1, name: 'Living Room', order: 1, targetCount: 3, icon: 'sofa' },
          { id: 2, name: 'Dining Room', order: 2, targetCount: 2, icon: 'utensils' },
          { id: 3, name: 'Kitchen', order: 3, targetCount: 2, icon: 'chef-hat' },
          { id: 4, name: 'Bedroom', order: 4, targetCount: 1, icon: 'bed' },
          { id: 5, name: 'Office', order: 5, targetCount: 2, icon: 'briefcase' },
          { id: 6, name: 'Basement', order: 6, targetCount: 4, icon: 'basement' }
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
      // Create room not implemented yet, add to mock data for development
      console.log('Create room not implemented with ThingsBoard yet, adding to mock data');
      const newId = Math.max(...get().rooms.map(r => r.id), 0) + 1;
      const newOrder = Math.max(...get().rooms.map(r => r.order), 0) + 1;
      
      const newRoom: Room = {
        id: newId,
        name,
        order: newOrder,
        targetCount: 0,
        icon
      };
      
      set(state => ({
        rooms: [...state.rooms, newRoom]
      }));
      
      toast.success('Room created successfully');
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
      
      // toast.success('Room updated successfully'); // Disabled notifications
    } catch (error) {
      toast.error('Update room not implemented with ThingsBoard yet');
    }
  },
  
  deleteRoom: async (id: number, token: string) => {
    try {
      await API.deleteRoom(id);
      
      // Remove the room from state
      set(state => ({
        rooms: state.rooms.filter(room => room.id !== id)
      }));
      
      // toast.success('Room deleted'); // Disabled notifications
    } catch (error) {
      toast.error('Delete room not implemented with ThingsBoard yet');
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
      
    } catch (error) {
      toast.error('Update room order not implemented with ThingsBoard yet');
    }
  }
}));
