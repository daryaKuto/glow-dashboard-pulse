
import { create } from 'zustand';
import { fetcher } from '@/lib/api';
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
      const rooms = await fetcher('/rooms', {
        headers: { Authorization: `Bearer ${token}` }
      });
      set({ rooms: rooms as Room[], isLoading: false });
    } catch (error) {
      set({ error: 'Failed to fetch rooms', isLoading: false });
      // toast.error('Failed to fetch rooms'); // Disabled notifications
    }
  },
  
  createRoom: async (name: string, token: string) => {
    try {
      const newRoom = await fetcher('/rooms', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name })
      }) as Room;
      
      // Add the new room to state
      set(state => ({
        rooms: [...state.rooms, newRoom]
      }));
      
      // toast.success('Room created successfully'); // Disabled notifications
    } catch (error) {
      // toast.error('Failed to create room'); // Disabled notifications
    }
  },
  
  updateRoom: async (id: number, name: string, token: string) => {
    try {
      await fetcher(`/rooms/${id}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name })
      });
      
      // Update the room in state
      set(state => ({
        rooms: state.rooms.map(room => 
          room.id === id ? { ...room, name } : room
        )
      }));
      
      // toast.success('Room updated successfully'); // Disabled notifications
    } catch (error) {
      // toast.error('Failed to update room'); // Disabled notifications
    }
  },
  
  deleteRoom: async (id: number, token: string) => {
    try {
      await fetcher(`/rooms/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Remove the room from state
      set(state => ({
        rooms: state.rooms.filter(room => room.id !== id)
      }));
      
      // toast.success('Room deleted'); // Disabled notifications
    } catch (error) {
      // toast.error('Failed to delete room'); // Disabled notifications
    }
  },
  
  updateRoomOrder: async (orderedRooms: { id: number, order: number }[], token: string) => {
    try {
      await fetcher('/rooms/order', {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify(orderedRooms)
      });
      
      // Update room order in state
      set(state => ({
        rooms: state.rooms.map(room => {
          const updatedRoom = orderedRooms.find(or => or.id === room.id);
          return updatedRoom ? { ...room, order: updatedRoom.order } : room;
        }).sort((a, b) => a.order - b.order)
      }));
      
    } catch (error) {
      // toast.error('Failed to update room order'); // Disabled notifications
    }
  }
}));
