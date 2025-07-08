
import { create } from 'zustand';
import API from '@/lib/api';
import { toast } from "@/components/ui/sonner";

export type Room = {
  id: number;
  name: string;
  order: number;
  targetCount: number;
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
      // Rooms not implemented yet, set empty array
      set({ rooms: [], isLoading: false });
      console.log('Rooms not implemented with ThingsBoard yet');
    }
  },
  
  createRoom: async (name: string, token: string) => {
    try {
      const newRoom = await API.createRoom(name);
      
      // Add the new room to state
      set(state => ({
        rooms: [...state.rooms, newRoom]
      }));
      
      // toast.success('Room created successfully'); // Disabled notifications
    } catch (error) {
      toast.error('Create room not implemented with ThingsBoard yet');
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
