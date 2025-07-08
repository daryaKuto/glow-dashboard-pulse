// src/lib/api.ts
import {
  login,
  logout,
  listDevices,
  latestTelemetry,
  openTelemetryWS,
} from '@/services/thingsboard';
import tbClient from './tbClient';
import { cache, CACHE_KEYS } from './cache';

const controllerId = import.meta.env.VITE_TB_CONTROLLER_ID as string;

// Export the WebSocket type for compatibility
export type MockWebSocket = ReturnType<typeof openTelemetryWS>;

/* ----------  AUTH  ---------- */
export const API = {
  // sign-in: returns token + refreshToken just like before
  async signIn(email: string, password: string) {
    return login(email, password);
  },

  // sign-out: invalidate server session, clear local storage helpers
  async signOut() {
    await logout();
    localStorage.removeItem('tb_access');
    localStorage.removeItem('tb_refresh');
  },

  /* ----------  DEVICES  ---------- */
  /** "Targets" page = ThingsBoard devices */
  getTargets: async () => {
    // Check cache first
    const cached = cache.get(CACHE_KEYS.TARGETS);
    if (cached) {
      console.log('Using cached targets data');
      return cached;
    }

    try {
      // Check if ThingsBoard is properly configured
      const tbBaseUrl = import.meta.env.VITE_TB_BASE_URL;
      if (!tbBaseUrl) {
        // Fallback to mock data when ThingsBoard is not configured
        console.log('ThingsBoard not configured, using mock targets');
        const mockTargets = [
          { id: { id: '1' }, name: 'Target Alpha', status: 'online', battery: 95, roomId: 1 },
          { id: { id: '2' }, name: 'Target Beta', status: 'online', battery: 78, roomId: 1 },
          { id: { id: '3' }, name: 'Target Gamma', status: 'offline', battery: 12, roomId: 2 },
          { id: { id: '4' }, name: 'Target Delta', status: 'online', battery: 65, roomId: null },
        ];
        cache.set(CACHE_KEYS.TARGETS, mockTargets, 30000); // Cache for 30 seconds
        return mockTargets;
      }
      
      const devices = await listDevices();
      cache.set(CACHE_KEYS.TARGETS, devices, 30000); // Cache for 30 seconds
      return devices;
    } catch (error) {
      console.error('Error fetching targets from ThingsBoard, using mock data:', error);
      // Fallback to mock data on error
      const mockTargets = [
        { id: { id: '1' }, name: 'Target Alpha', status: 'online', battery: 95, roomId: 1 },
        { id: { id: '2' }, name: 'Target Beta', status: 'online', battery: 78, roomId: 1 },
        { id: { id: '3' }, name: 'Target Gamma', status: 'offline', battery: 12, roomId: 2 },
        { id: { id: '4' }, name: 'Target Delta', status: 'online', battery: 65, roomId: null },
      ];
      cache.set(CACHE_KEYS.TARGETS, mockTargets, 30000); // Cache for 30 seconds
      return mockTargets;
    }
  },

  /** Wrapper for live telemetry WebSocket */
  connectWebSocket: (token: string) => openTelemetryWS(token),

  /* ----------  TARGET MANAGEMENT  ---------- */
  createTarget: async (name: string, roomId: number | null) => {
    // TODO: Implement with ThingsBoard device creation
    throw new Error('createTarget → not implemented with ThingsBoard yet');
  },
  
  renameTarget: async (id: number, name: string) => {
    // TODO: Implement with ThingsBoard device update
    throw new Error('renameTarget → not implemented with ThingsBoard yet');
  },
  
  deleteTarget: async (id: number) => {
    // TODO: Implement with ThingsBoard device deletion
    throw new Error('deleteTarget → not implemented with ThingsBoard yet');
  },
  
  assignRoom: async (targetId: number, roomId: number | null) => {
    // TODO: Implement with ThingsBoard device attributes
    throw new Error('assignRoom → not implemented with ThingsBoard yet');
  },
  
  updateFirmware: async (id: number) => {
    // TODO: Implement with ThingsBoard device firmware update
    throw new Error('updateFirmware → not implemented with ThingsBoard yet');
  },

  /* ----------  ROOM MANAGEMENT  ---------- */
  getRooms: async () => {
    // TODO: Implement with ThingsBoard device groups or custom entities
    throw new Error('getRooms → not implemented with ThingsBoard yet');
  },
  
  createRoom: async (name: string, icon: string = 'home') => {
    // TODO: Implement with ThingsBoard device groups
    throw new Error('createRoom → not implemented with ThingsBoard yet');
  },
  
  updateRoom: async (id: number, name: string) => {
    // TODO: Implement with ThingsBoard device groups
    throw new Error('updateRoom → not implemented with ThingsBoard yet');
  },
  
  deleteRoom: async (id: number) => {
    // TODO: Implement with ThingsBoard device groups
    throw new Error('deleteRoom → not implemented with ThingsBoard yet');
  },
  
  updateRoomOrder: async (order: any) => {
    // TODO: Implement with ThingsBoard device groups
    throw new Error('updateRoomOrder → not implemented with ThingsBoard yet');
  },
  
  getRoomLayout: async (roomId: number) => {
    // TODO: Implement with ThingsBoard device attributes
    throw new Error('getRoomLayout → not implemented with ThingsBoard yet');
  },
  
  saveRoomLayout: async (roomId: number, targets: any[], groups: any[]) => {
    // TODO: Implement with ThingsBoard device attributes
    throw new Error('saveRoomLayout → not implemented with ThingsBoard yet');
  },
  
  createGroup: async (roomId: number, groupData: any) => {
    // TODO: Implement with ThingsBoard device groups
    throw new Error('createGroup → not implemented with ThingsBoard yet');
  },
  
  updateGroup: async (roomId: number, groupData: any) => {
    // TODO: Implement with ThingsBoard device groups
    throw new Error('updateGroup → not implemented with ThingsBoard yet');
  },
  
  deleteGroup: async (roomId: number, groupData: any) => {
    // TODO: Implement with ThingsBoard device groups
    throw new Error('deleteGroup → not implemented with ThingsBoard yet');
  },

  /* ----------  SCENARIO RUNTIME  ---------- */
  /**
   * Push scenario config to backend – stores under a special device's
   * SHARED_SCOPE attributes so firmware can pick it up.
   */
  pushScenarioConfig: async (cfg: {
    scenarioId: string;
    targetIds:  string[];
    shotsPerTarget:number;
    timeLimitMs:number;
    startedAt:number;
  }) => {
    if (!controllerId) {
      throw new Error('VITE_TB_CONTROLLER_ID environment variable not set');
    }
    return tbClient.post(`/plugins/telemetry/DEVICE/${controllerId}/SHARED_SCOPE`, cfg);
  },

  /* ----------  PLACE-HOLDERS (not yet mapped) ---------- */
  getSessions: async () => {
    // TODO: Implement with ThingsBoard custom entities
    throw new Error('getSessions → not implemented with ThingsBoard yet');
  },
  
  getFriends: async () => {
    // TODO: Implement with ThingsBoard custom entities
    throw new Error('getFriends → not implemented with ThingsBoard yet');
  },
  
  getLeaderboard: async () => {
    // TODO: Implement with ThingsBoard custom entities
    throw new Error('getLeaderboard → not implemented with ThingsBoard yet');
  },
  
  getInvites: async () => {
    // TODO: Implement with ThingsBoard custom entities
    throw new Error('getInvites → not implemented with ThingsBoard yet');
  },
  
  listScenarios: async () => {
    // TODO: Implement with ThingsBoard custom entities
    return [] as { id: string; name: string; targetCount: number }[];
  },

  /* Stats & trend helpers used by dashboard hero bar */
  async getStats() {
    // Check cache first
    const cached = cache.get(CACHE_KEYS.STATS);
    if (cached) {
      console.log('Using cached stats data');
      return cached;
    }

    try {
      // Check if ThingsBoard is properly configured
      const tbBaseUrl = import.meta.env.VITE_TB_BASE_URL;
      if (!tbBaseUrl) {
        // Fallback to mock data when ThingsBoard is not configured
        console.log('ThingsBoard not configured, using mock stats');
        const mockStats = {
          targets: { online: 3, total: 4 }, // Mock data from handlers.ts
          rooms: { count: 3 },
          sessions: { latest: { score: 920 } },
          invites: [],
        };
        cache.set(CACHE_KEYS.STATS, mockStats, 15000); // Cache for 15 seconds
        return mockStats;
      }
      
      const devices = await listDevices();
      const stats = {
        targets: { online: devices.length },
        rooms: { count: 0 },
        sessions: { latest: { score: 0 } },
        invites: [],
      };
      cache.set(CACHE_KEYS.STATS, stats, 15000); // Cache for 15 seconds
      return stats;
    } catch (error) {
      console.error('Error fetching stats from ThingsBoard, using mock data:', error);
      // Fallback to mock data on error
      const mockStats = {
        targets: { online: 3, total: 4 },
        rooms: { count: 3 },
        sessions: { latest: { score: 920 } },
        invites: [],
      };
      cache.set(CACHE_KEYS.STATS, mockStats, 15000); // Cache for 15 seconds
      return mockStats;
    }
  },
  /** 7-day hit trend – stub empty array until we wire TB aggregate API */
  getTrend7d: async () => [],
};

export default API;

// Cache management functions
export const clearCache = () => {
  cache.clear();
  console.log('Cache cleared');
};

export const invalidateCache = (key: string) => {
  cache.delete(key);
  console.log(`Cache invalidated for key: ${key}`);
};
