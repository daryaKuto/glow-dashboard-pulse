import { create } from 'zustand';
import { fetcher } from '@/lib/api';
import { toast } from "@/components/ui/sonner";

export type Target = {
  id: number;
  name: string;
  roomId: number | null;
  status: 'online' | 'offline';
  battery: number;
};

interface TargetsState {
  targets: Target[];
  isLoading: boolean;
  error: string | null;
  fetchTargets: (token: string) => Promise<void>;
  renameTarget: (id: number, name: string, token: string) => Promise<void>;
  locateTarget: (id: number, token: string) => Promise<void>;
  updateFirmware: (id: number, token: string) => Promise<void>;
  deleteTarget: (id: number, token: string) => Promise<void>;
  assignRoom: (targetId: number, roomId: number | null, token: string) => Promise<void>;
}

export const useTargets = create<TargetsState>((set, get) => ({
  targets: [],
  isLoading: false,
  error: null,
  
  fetchTargets: async (token: string) => {
    set({ isLoading: true, error: null });
    try {
      const targets = await fetcher('/targets', {
        headers: { Authorization: `Bearer ${token}` }
      });
      set({ targets: targets as Target[], isLoading: false });
    } catch (error) {
      set({ error: 'Failed to fetch targets', isLoading: false });
      toast.error('Failed to fetch targets');
    }
  },
  
  renameTarget: async (id: number, name: string, token: string) => {
    try {
      const response = await fetcher(`/targets/${id}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name })
      });
      
      set(state => ({
        targets: state.targets.map(target => 
          target.id === id ? { ...target, name } : target
        )
      }));
      
      toast.success('Target renamed successfully');
    } catch (error) {
      toast.error('Failed to rename target');
    }
  },
  
  locateTarget: async (id: number, token: string) => {
    try {
      await fetcher(`/targets/${id}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({ locate: true })
      });
      
      toast.success('Target flashing');
    } catch (error) {
      toast.error('Failed to locate target');
    }
  },
  
  updateFirmware: async (id: number, token: string) => {
    try {
      await fetcher(`/targets/${id}/firmware`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      
      toast.success('Firmware update started');
    } catch (error) {
      toast.error('Failed to update firmware');
    }
  },
  
  deleteTarget: async (id: number, token: string) => {
    try {
      await fetcher(`/targets/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      
      set(state => ({
        targets: state.targets.filter(target => target.id !== id)
      }));
      
      toast.success('Target deleted');
    } catch (error) {
      toast.error('Failed to delete target');
    }
  },
  
  assignRoom: async (targetId: number, roomId: number | null, token: string) => {
    try {
      const response = await fetcher(`/targets/${targetId}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({ roomId })
      });
      
      set(state => ({
        targets: state.targets.map(target => 
          target.id === targetId ? { ...target, roomId } : target
        )
      }));
      
      toast.success('Target assigned to room');
    } catch (error) {
      toast.error('Failed to assign target to room');
    }
  }
}));
