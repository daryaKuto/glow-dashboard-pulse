import { create } from 'zustand';
import API from '@/lib/api';

export interface Target {
  id: string;
  name: string;
  status: 'online' | 'offline';
  battery?: number;          // add when available
}

interface TargetsState {
  targets:    Target[];
  isLoading:  boolean;
  error:      Error | null;
  refresh:    () => Promise<void>;
}

export const useTargets = create<TargetsState>((set) => ({
  targets:   [],
  isLoading: false,
  error:     null,

  refresh: async () => {
    set({ isLoading: true, error: null });
    try {
      const devices = await API.getTargets();
      set({
        targets: devices.map((d: any) => ({
          id: d.id.id,
          name: d.name,
          status: 'online',      // TODO: map ThingsBoard "active" field
        })),
        isLoading: false,
      });
    } catch (err) {
      set({ error: err as Error, isLoading: false });
    }
  },
}));
