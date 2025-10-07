import { create } from 'zustand';
import API, { clearTargetsCache } from '@/lib/api';

export interface Target {
  id: string;
  name: string;
  status: 'online' | 'offline';
  battery?: number;
  roomId?: number | null;
  // New telemetry data from ThingsBoard
  telemetry?: Record<string, any>;
  lastEvent?: string | null;
  lastGameId?: string | null;
  lastGameName?: string | null;
  lastHits?: number | null;
  lastActivity?: string | null;
  deviceName?: string;
  deviceType?: string;
  createdTime?: number;
  additionalInfo?: Record<string, any>;
  // Properties for no data/error messages
  type?: string;
  isNoDataMessage?: boolean;
  isErrorMessage?: boolean;
  message?: string;
}

interface TargetsState {
  targets:    Target[];
  isLoading:  boolean;
  error:      Error | null;
  refresh:    () => Promise<void>;
  clearCache: () => void;
}

export const useTargets = create<TargetsState>((set) => ({
  targets:   [],
  isLoading: false,
  error:     null,

  refresh: async () => {
    set({ isLoading: true, error: null });
    try {
      const devices = await API.getTargets();
      console.log('Raw devices from API:', devices);
      
      set({
        targets: devices.map((d: any) => ({
          id: d.id?.id || d.id,
          name: d.name,
          status: d.status || 'online', // Default to online if not specified
          battery: d.battery || 100, // Default battery level
          roomId: d.roomId || null,
          // Map telemetry data
          telemetry: d.telemetry || {},
          lastEvent: d.lastEvent || null,
          lastGameId: d.lastGameId || null,
          lastGameName: d.lastGameName || null,
          lastHits: d.lastHits || null,
          lastActivity: d.lastActivity || null,
          deviceName: d.deviceName || d.name,
          deviceType: d.deviceType || 'default',
          createdTime: d.createdTime || null,
          additionalInfo: d.additionalInfo || {},
          // Map special properties for no data and error states
          isNoDataMessage: d.isNoDataMessage || false,
          isErrorMessage: d.isErrorMessage || false,
          message: d.message || undefined,
        })),
        isLoading: false,
      });
    } catch (err) {
      console.error('Error in useTargets refresh:', err);
      set({ error: err as Error, isLoading: false });
    }
  },

  clearCache: () => {
    clearTargetsCache();
  },
}));
