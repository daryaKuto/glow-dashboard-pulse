import { create } from 'zustand';
import API, { clearTargetsCache } from '@/lib/api';

export interface Target {
  id: string;
  name: string;
  status: 'online' | 'offline';
  battery?: number | null;          // Real battery or null
  wifiStrength?: number | null;     // Real WiFi or null
  roomId?: number | null;
  // New telemetry data from ThingsBoard
  telemetry?: Record<string, any>;
  lastEvent?: string | null;
  lastGameId?: string | null;
  lastGameName?: string | null;
  lastHits?: number | null;
  lastActivity?: string | null;
  lastActivityTime?: number | null;
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
  setTargets: (targets: Target[]) => void;
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
      console.log('🔍 useTargets.refresh - Raw devices from API:', {
        count: devices.length,
        devices: devices.map(d => ({
          name: d.name,
          id: d.id?.id || d.id,
          status: d.status,
          type: d.type,
          roomId: d.roomId
        }))
      });
      
      const mappedTargets = devices.map((d: any) => ({
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
      }));
      
      console.log('🔍 useTargets.refresh - Mapped targets for store:', {
        count: mappedTargets.length,
        targets: mappedTargets.map(t => ({
          name: t.name,
          id: t.id,
          status: t.status,
          type: t.deviceType,
          roomId: t.roomId
        }))
      });
      
      set({
        targets: mappedTargets,
        isLoading: false,
      });
    } catch (err) {
      console.error('🔍 useTargets.refresh - Error:', err);
      set({ error: err as Error, isLoading: false });
    }
  },

  setTargets: (targets: Target[]) => {
    console.log('🔍 useTargets.setTargets - Setting targets in store:', {
      count: targets.length,
      targets: targets.map(t => ({
        name: t.name,
        id: t.id,
        status: t.status,
        roomId: t.roomId
      }))
    });
    set({ targets, isLoading: false, error: null });
    console.log('🔍 useTargets.setTargets - Store updated successfully');
  },

  clearCache: () => {
    clearTargetsCache();
  },
}));
