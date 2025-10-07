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
import { supabase } from '@/integrations/supabase/client';
import { unifiedDataService } from '@/services/unified-data';


const controllerId = import.meta.env.VITE_TB_CONTROLLER_ID as string;

// Export the WebSocket type for compatibility
export type MockWebSocket = ReturnType<typeof openTelemetryWS>;

// Helper function to ensure user-specific ThingsBoard authentication
async function ensureUserThingsBoardAuth() {
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  
  if (userError || !user) {
    throw new Error('No authenticated user found. Please log in first.');
  }
  
  console.log('🔐 Ensuring ThingsBoard auth for user:', user.email);
  
  // Use unified data service for user-specific ThingsBoard authentication
  const thingsBoardData = await unifiedDataService.getThingsBoardData(user.email);
  
  // Always return data, even if ThingsBoard is not connected
  return { user, thingsBoardData };
}

// Helper function to map ThingsBoard devices to room assignments from our database
async function mapDevicesToRooms(devices: any[]) {
  try {
    console.log('Mapping devices to rooms. Total devices:', devices.length);
    
    // Map devices and fetch additional data
    const mappedDevices = await Promise.all(devices.map(async (device) => {
      const deviceId = device.id?.id || device.id;
      // Get roomId directly from device additionalInfo (ThingsBoard approach)
      const roomId = device.additionalInfo?.roomId || null;
      
      console.log('Mapping device:', { 
        name: device.name, 
        deviceId,
        roomId, 
        additionalInfo: device.additionalInfo 
      });
      
      // Fetch latest telemetry data for this device
      let telemetryData = {};
      try {
        const thingsBoardService = (await import('@/services/thingsboard')).default;
        if (thingsBoardService.isAuthenticated()) {
          const telemetry = await thingsBoardService.getLatestTelemetry(deviceId, [
            'event', 'gameId', 'game_name', 'hits', 'device_name', 'created_at', 'method', 'params'
          ]);
          
          // Extract the latest values
          Object.entries(telemetry).forEach(([key, values]) => {
            if (values && values.length > 0) {
              telemetryData[key] = values[values.length - 1].value;
            }
          });
        }
      } catch (error) {
        console.log(`Could not fetch telemetry for device ${deviceId}:`, error.message);
      }

      return {
        ...device,
        roomId,
        telemetry: telemetryData,
        // Extract useful telemetry data
        lastEvent: telemetryData.event || null,
        lastGameId: telemetryData.gameId || telemetryData.game_id || null,
        lastGameName: telemetryData.game_name || null,
        lastHits: telemetryData.hits ? parseInt(telemetryData.hits) : null,
        lastActivity: telemetryData.created_at || null,
        deviceName: telemetryData.device_name || device.name,
        // Additional metadata
        deviceType: device.type,
        createdTime: device.createdTime,
        additionalInfo: device.additionalInfo || {},
      };
    }));

    console.log('Mapped devices with room info:', mappedDevices.map(d => ({ 
      name: d.name, 
      roomId: d.roomId, 
      roomName: d.additionalInfo?.roomName 
    })));
    
    return mappedDevices;
  } catch (error) {
    console.error('Error mapping devices to rooms:', error);
    return devices;
  }
}

// Helper function to update room target count (ThingsBoard approach)
async function updateRoomTargetCount(roomId: string) {
  try {
    // Get all devices and count those assigned to this room
    const thingsBoardService = (await import('@/services/thingsboard')).default;
    if (!thingsBoardService.isAuthenticated()) {
      return;
    }
    
    const devicesResponse = await fetch(`${import.meta.env.VITE_TB_BASE_URL}/api/tenant/devices?pageSize=100&page=0`, {
      headers: {
        'Authorization': `Bearer ${thingsBoardService.getAccessToken()}`,
      },
    });

    if (!devicesResponse.ok) {
      console.error('Error fetching devices for room count:', devicesResponse.status);
      return;
    }

    const devicesData = await devicesResponse.json();
    const devices = devicesData.data || devicesData;
    
    // Count devices assigned to this room
    const targetCount = devices.filter((device: any) => 
      device.additionalInfo?.roomId === parseInt(roomId)
    ).length;
    
    console.log(`Room ${roomId} has ${targetCount} targets`);
    return targetCount;
  } catch (error) {
    console.error('Error updating room target count:', error);
  }
}

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
      console.log('Using cached targets data:', cached);
      return cached;
    }

    try {
      // Ensure user-specific ThingsBoard authentication
      const { user, thingsBoardData } = await ensureUserThingsBoardAuth();
      
      console.log('✅ Got user-specific ThingsBoard data:', {
        targetsCount: thingsBoardData.targets.length,
        devicesCount: thingsBoardData.devices.length,
        user: user.email,
        isConnected: thingsBoardData.isConnected
      });
      
      // If no ThingsBoard connection, return empty array
      if (!thingsBoardData.isConnected || thingsBoardData.targets.length === 0) {
        console.log('ℹ️ No ThingsBoard data available for user:', user.email);
        cache.set(CACHE_KEYS.TARGETS, [], 30000);
        return [];
      }
      
      // Map the devices to include room information from our database
      const mappedDevices = await mapDevicesToRooms(thingsBoardData.targets);
      console.log('Mapped devices with room info:', mappedDevices);
      
      cache.set(CACHE_KEYS.TARGETS, mappedDevices, 30000);
      return mappedDevices;
    } catch (error) {
      console.log('ℹ️ ThingsBoard not available, returning empty targets:', error.message);
      cache.set(CACHE_KEYS.TARGETS, [], 30000);
      return [];
    }
  },

  /** Wrapper for live telemetry WebSocket */
  connectWebSocket: (token: string) => openTelemetryWS(token),

  /* ----------  TARGET MANAGEMENT  ---------- */
  createTarget: async (name: string, roomId: number | null) => {
    throw new Error('Target creation not implemented yet');
  },
  
  renameTarget: async (id: number, name: string) => {
    try {
      // Ensure user-specific ThingsBoard authentication
      const { user, thingsBoardData } = await ensureUserThingsBoardAuth();
      
      // If no ThingsBoard connection, return error
      if (!thingsBoardData.isConnected) {
        throw new Error('ThingsBoard not available. Cannot rename target.');
      }
      
      // Get the ThingsBoard service
      const thingsBoardService = (await import('@/services/thingsboard')).default;
      
      // Convert numeric ID to string (ThingsBoard uses string IDs)
      const deviceId = id.toString();
      
      // Update the device name in ThingsBoard
      await thingsBoardService.updateDevice(deviceId, { name });
      
      // Clear the cache to force refresh
      clearTargetsCache();
      
      console.log(`Successfully renamed device ${deviceId} to "${name}" for user: ${user.email}`);
      return { success: true };
    } catch (error) {
      console.error('Error renaming target:', error);
      throw new Error(`Failed to rename target: ${error.message}`);
    }
  },
  
  deleteTarget: async (id: number) => {
    throw new Error('Target deletion not implemented yet');
  },
  
  assignRoom: async (targetId: number, roomId: number | null) => {
    throw new Error('Room assignment not implemented yet');
  },
  
  updateFirmware: async (id: number) => {
    throw new Error('Firmware updates not implemented yet');
  },

  /* ----------  ROOM MANAGEMENT  ---------- */
  getRooms: async () => {
    try {
      // Ensure user-specific ThingsBoard authentication
      const { user, thingsBoardData } = await ensureUserThingsBoardAuth();
      
      // If no ThingsBoard connection, return empty array
      if (!thingsBoardData.isConnected) {
        console.log('ℹ️ No ThingsBoard data available for rooms, returning empty array');
        return [];
      }
      
      // Get the ThingsBoard service
      const thingsBoardService = (await import('@/services/thingsboard')).default;
      
      // Fetch all devices from ThingsBoard
      const devicesResponse = await fetch(`${import.meta.env.VITE_TB_BASE_URL}/api/tenant/devices?pageSize=100&page=0`, {
        headers: {
          'Authorization': `Bearer ${thingsBoardService.getAccessToken()}`,
        },
      });

      if (!devicesResponse.ok) {
        throw new Error(`Failed to fetch devices: ${devicesResponse.status}`);
      }

      const devicesData = await devicesResponse.json();
      const devices = devicesData.data || devicesData;
      
      console.log('All devices from ThingsBoard:', devices.map((d: any) => ({ 
        name: d.name, 
        roomId: d.additionalInfo?.roomId, 
        roomName: d.additionalInfo?.roomName 
      })));
      
      // Extract unique roomIds from devices
      const roomIds = new Set<number>();
      devices.forEach((device: any) => {
        if (device.additionalInfo?.roomId) {
          roomIds.add(device.additionalInfo.roomId);
        }
      });
      
      console.log('Found roomIds in devices:', Array.from(roomIds));
      
      // Create rooms based on roomIds found in devices
      const rooms = Array.from(roomIds).map((roomId, index) => {
        // Find a device with this roomId to get the room name
        const roomDevice = devices.find((device: any) => device.additionalInfo?.roomId === roomId);
        const roomName = roomDevice?.additionalInfo?.roomName || `Room ${roomId}`;
        const targetCount = devices.filter((device: any) => device.additionalInfo?.roomId === roomId).length;
        
        console.log(`Room ${roomId} (${roomName}) has ${targetCount} targets`);
        
        return {
          id: roomId,
          name: roomName,
          order: index + 1,
          targetCount,
          icon: 'home',
          thingsBoardId: roomId.toString()
        };
      });
      
      // If no rooms found, create a default room
      if (rooms.length === 0) {
        rooms.push({
          id: 1,
          name: 'Default Room',
          order: 1,
          targetCount: devices.length,
          icon: 'home',
          thingsBoardId: '1'
        });
      }

      console.log('Fetched rooms from ThingsBoard devices:', rooms);
      return rooms;
    } catch (error) {
      console.error('Error fetching rooms from ThingsBoard:', error);
      throw error;
    }
  },
  
  createRoom: async (name: string, icon: string = 'home') => {
    try {
      // Ensure user-specific ThingsBoard authentication
      const { user } = await ensureUserThingsBoardAuth();
      
      // Get the ThingsBoard service
      const thingsBoardService = (await import('@/services/thingsboard')).default;
      
      // Get existing rooms to determine new room ID
      const existingRooms = await API.getRooms();
      const newRoomId = Math.max(...existingRooms.map(r => r.id), 0) + 1;
      
      // Create a new room by creating a placeholder device with the roomId
      const response = await fetch(`${import.meta.env.VITE_TB_BASE_URL}/api/device`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${thingsBoardService.getAccessToken()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: `Room-${newRoomId}-${name}`,
          type: 'default',
          additionalInfo: {
            roomId: newRoomId,
            roomName: name,
            icon: icon,
            isRoomPlaceholder: true
          }
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to create room: ${response.status}`);
      }

      const newRoom = {
        id: newRoomId,
        name: name,
        order: existingRooms.length + 1,
        targetCount: 0,
        icon: icon,
        thingsBoardId: newRoomId.toString()
      };
      
      console.log('Created room in ThingsBoard:', newRoom);
      return newRoom;
    } catch (error) {
      console.error('Error creating room:', error);
      throw error;
    }
  },
  
  updateRoom: async (id: number, name: string) => {
    try {
      // Ensure user-specific ThingsBoard authentication
      const { user } = await ensureUserThingsBoardAuth();
      
      // Get the ThingsBoard service
      const thingsBoardService = (await import('@/services/thingsboard')).default;
      
      // Find all devices that belong to this room and update their roomName attribute
      const devicesResponse = await fetch(`${import.meta.env.VITE_TB_BASE_URL}/api/tenant/devices?pageSize=100&page=0`, {
        headers: {
          'Authorization': `Bearer ${thingsBoardService.getAccessToken()}`,
        },
      });

      if (!devicesResponse.ok) {
        throw new Error(`Failed to fetch devices: ${devicesResponse.status}`);
      }

      const devicesData = await devicesResponse.json();
      const devices = devicesData.data || devicesData;
      
      // Find devices that belong to this room
      const roomDevices = devices.filter((device: any) => device.additionalInfo?.roomId === id);
      
      // Update each device's roomName attribute
      for (const device of roomDevices) {
        const updateResponse = await fetch(`${import.meta.env.VITE_TB_BASE_URL}/api/device/${device.id.id}`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${thingsBoardService.getAccessToken()}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ...device,
            additionalInfo: {
              ...device.additionalInfo,
              roomName: name
            }
          }),
        });
        
        if (!updateResponse.ok) {
          console.error(`Failed to update device ${device.name}: ${updateResponse.status}`);
        }
      }

      console.log('Updated room in ThingsBoard:', name);
      return { success: true };
    } catch (error) {
      console.error('Error updating room:', error);
      throw error;
    }
  },
  
  deleteRoom: async (id: number) => {
    try {
      // Ensure user-specific ThingsBoard authentication
      const { user } = await ensureUserThingsBoardAuth();
      
      // Get the ThingsBoard service
      const thingsBoardService = (await import('@/services/thingsboard')).default;
      
      // Find all devices that belong to this room and remove their roomId
      const devicesResponse = await fetch(`${import.meta.env.VITE_TB_BASE_URL}/api/tenant/devices?pageSize=100&page=0`, {
        headers: {
          'Authorization': `Bearer ${thingsBoardService.getAccessToken()}`,
        },
      });

      if (!devicesResponse.ok) {
        throw new Error(`Failed to fetch devices: ${devicesResponse.status}`);
      }

      const devicesData = await devicesResponse.json();
      const devices = devicesData.data || devicesData;
      
      // Find devices that belong to this room
      const roomDevices = devices.filter((device: any) => device.additionalInfo?.roomId === id);
      
      // Remove roomId from each device
      for (const device of roomDevices) {
        const { roomId, roomName, ...additionalInfo } = device.additionalInfo || {};
        const updateResponse = await fetch(`${import.meta.env.VITE_TB_BASE_URL}/api/device/${device.id.id}`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${thingsBoardService.getAccessToken()}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ...device,
            additionalInfo
          }),
        });
        
        if (!updateResponse.ok) {
          console.error(`Failed to update device ${device.name}: ${updateResponse.status}`);
        }
      }

      console.log('Deleted room from ThingsBoard devices:', id);
      return { success: true };
    } catch (error) {
      console.error('Error deleting room:', error);
      throw error;
    }
  },
  
  updateRoomOrder: async (order: { id: number, order: number }[]) => {
    try {
      // Ensure user-specific ThingsBoard authentication
      const { user } = await ensureUserThingsBoardAuth();
      
      // Get the ThingsBoard service
      const thingsBoardService = (await import('@/services/thingsboard')).default;
      
      // Update order in ThingsBoard device groups
      // Note: ThingsBoard doesn't have built-in ordering, so we'll store it in additionalInfo
      for (const roomOrder of order) {
        const rooms = await API.getRooms();
        const room = rooms.find(r => r.id === roomOrder.id);
        
        if (room) {
          const response = await fetch(`${import.meta.env.VITE_TB_BASE_URL}/api/entityGroup/${room.thingsBoardId}`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${thingsBoardService.getAccessToken()}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              name: room.name,
              additionalInfo: {
                ...room.additionalInfo,
                order: roomOrder.order
              }
            }),
          });

          if (!response.ok) {
            console.error(`Failed to update room order for ${room.name}: ${response.status}`);
          }
        }
      }
      
      console.log('Updated room order in ThingsBoard');
      return { success: true };
    } catch (error) {
      console.error('Error updating room order:', error);
      throw error;
    }
  },
  
  assignTargetToRoom: async (targetId: string, roomId: string | null) => {
    try {
      // Ensure user-specific ThingsBoard authentication
      const { user } = await ensureUserThingsBoardAuth();
      
      // Get the ThingsBoard service
      const thingsBoardService = (await import('@/services/thingsboard')).default;
      
      // First, get the current device to preserve existing additionalInfo
      const deviceResponse = await fetch(`${import.meta.env.VITE_TB_BASE_URL}/api/device/${targetId}`, {
        headers: {
          'Authorization': `Bearer ${thingsBoardService.getAccessToken()}`,
        },
      });

      if (!deviceResponse.ok) {
        throw new Error(`Failed to get device: ${deviceResponse.status}`);
      }

      const device = await deviceResponse.json();
      const currentAdditionalInfo = device.additionalInfo || {};
      
      if (roomId === null) {
        // Unassign target from all rooms by updating device attributes
        const { roomId: _, roomName: __, ...updatedAdditionalInfo } = currentAdditionalInfo;
        
        const response = await fetch(`${import.meta.env.VITE_TB_BASE_URL}/api/device/${targetId}`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${thingsBoardService.getAccessToken()}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ...device,
            additionalInfo: updatedAdditionalInfo
          }),
        });

        if (!response.ok) {
          throw new Error(`Failed to unassign target from room: ${response.status}`);
        }

        console.log(`Unassigned target ${targetId} from all rooms in ThingsBoard`);
        return { success: true };
      } else {
        // Get room name from Supabase for better display
        let roomName = `Room ${roomId}`;
        try {
          const { supabaseRoomsService } = await import('@/services/supabase-rooms');
          const rooms = await supabaseRoomsService.getUserRooms();
          const room = rooms.find(r => r.id === roomId);
          if (room) {
            roomName = room.name;
          }
        } catch (error) {
          console.warn('Could not fetch room name, using default:', error);
        }
        
        // Assign target to room by updating device attributes
        const updatedAdditionalInfo = {
          ...currentAdditionalInfo,
          roomId: parseInt(roomId),
          roomName: roomName
        };
        
        const response = await fetch(`${import.meta.env.VITE_TB_BASE_URL}/api/device/${targetId}`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${thingsBoardService.getAccessToken()}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ...device,
            additionalInfo: updatedAdditionalInfo
          }),
        });

        if (!response.ok) {
          throw new Error(`Failed to assign target to room: ${response.status}`);
        }

        console.log(`Assigned target ${targetId} to room ${roomId} in ThingsBoard`);
        return { success: true };
      }
    } catch (error) {
      console.error('Error assigning/unassigning target to room:', error);
      throw error;
    }
  },
  
  getRoomTargets: async (roomId: string) => {
    try {
      // Get the ThingsBoard service
      const thingsBoardService = (await import('@/services/thingsboard')).default;
      
      // Ensure we're authenticated
      if (!thingsBoardService.isAuthenticated()) {
        const username = import.meta.env.VITE_TB_USERNAME;
        const password = import.meta.env.VITE_TB_PASSWORD;
        
        if (!username || !password) {
          throw new Error('ThingsBoard credentials not configured. Please set VITE_TB_USERNAME and VITE_TB_PASSWORD in .env.local');
        }
        
        await thingsBoardService.login(username, password);
      }
      
      // Get all devices and filter by roomId
      const devicesResponse = await fetch(`${import.meta.env.VITE_TB_BASE_URL}/api/tenant/devices?pageSize=100&page=0`, {
        headers: {
          'Authorization': `Bearer ${thingsBoardService.getAccessToken()}`,
        },
      });

      if (!devicesResponse.ok) {
        throw new Error(`Failed to get devices: ${devicesResponse.status}`);
      }

      const devicesData = await devicesResponse.json();
      const devices = devicesData.data || devicesData;
      
      // Filter devices that belong to this room
      const roomDevices = devices.filter((device: any) => 
        device.additionalInfo?.roomId === parseInt(roomId)
      );
      
      console.log(`Fetched ${roomDevices.length} targets for room ${roomId}`);
      return roomDevices;
    } catch (error) {
      console.error('Error fetching room targets:', error);
      throw error;
    }
  },
  
  getRoomLayout: async (roomId: number) => {
    throw new Error('Room layout not implemented yet');
  },
  
  saveRoomLayout: async (roomId: number, targets: any[], groups: any[]) => {
    throw new Error('Room layout saving not implemented yet');
  },
  
  createGroup: async (roomId: number, groupData: any) => {
    throw new Error('Group creation not implemented yet');
  },
  
  updateGroup: async (roomId: number, groupData: any) => {
    throw new Error('Group updates not implemented yet');
  },
  
  deleteGroup: async (roomId: number, groupData: any) => {
    throw new Error('Group deletion not implemented yet');
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
    throw new Error('Sessions not implemented yet');
  },
  
  getFriends: async () => {
    throw new Error('Friends not implemented yet');
  },
  
  getLeaderboard: async () => {
    throw new Error('Leaderboard not implemented yet');
  },
  
  getInvites: async () => {
    throw new Error('Invites not implemented yet');
  },
  
  listScenarios: async () => {
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
        throw new Error('ThingsBoard not configured. Please set VITE_TB_BASE_URL in .env');
      }
      
      // Get the current user's targets (same as getTargets function)
      const targets = await API.getTargets();
      console.log('User targets for stats:', targets.length);
      
      // Get rooms for the current user
      const rooms = await API.getRooms();
      console.log('User rooms for stats:', rooms.length);
      
      const stats = {
        targets: { online: targets.length },
        rooms: { count: rooms.length },
        sessions: { latest: { score: 0 } },
        invites: [],
      };
      
      console.log('Stats calculated for current user:', stats);
      cache.set(CACHE_KEYS.STATS, stats, 15000); // Cache for 15 seconds
      return stats;
    } catch (error) {
      console.error('Error fetching stats from ThingsBoard:', error);
      throw error;
    }
  },
  /** 7-day hit trend – stub empty array until we wire TB aggregate API */
  getTrend7d: async () => [],
};

export default API;

// Cache management functions
export const clearCache = () => {
  cache.clear();
};

export const invalidateCache = (key: string) => {
  cache.delete(key);
};

// Specific function to clear targets cache
export const clearTargetsCache = () => {
  cache.delete(CACHE_KEYS.TARGETS);
  console.log('Targets cache cleared');
};
