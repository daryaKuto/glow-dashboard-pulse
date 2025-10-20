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
import { getThingsBoardCredentials } from '@/services/profile';

// Request deduplication - prevent multiple simultaneous calls to same endpoint
const pendingRequests = new Map<string, Promise<any>>();

// Cache for API responses with TTL
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

const responseCache = new Map<string, CacheEntry<any>>();

// Default TTL values for different types of requests
const CACHE_TTL = {
  TARGETS: 30000,        // 30 seconds for targets
  ROOMS: 60000,          // 1 minute for rooms
  SESSIONS: 30000,       // 30 seconds for sessions
  STATS: 60000,          // 1 minute for stats
  DEFAULT: 30000         // 30 seconds default
};

// Helper function for request deduplication with caching
async function deduplicateRequest<T>(key: string, requestFn: () => Promise<T>, ttl: number = CACHE_TTL.DEFAULT): Promise<T> {
  // Check cache first
  const cached = responseCache.get(key);
  if (cached && Date.now() - cached.timestamp < cached.ttl) {
    console.log(`✅ [CACHE] Returning cached response for: ${key} (age: ${Date.now() - cached.timestamp}ms)`);
    return cached.data;
  }

  // If request is already in progress, return the existing promise
  if (pendingRequests.has(key)) {
    console.log(`🔄 [DEDUP] Reusing existing request for: ${key}`);
    return pendingRequests.get(key)!;
  }

  // Create new request
  console.log(`🔄 [DEDUP] Starting new request for: ${key}`);
  const promise = requestFn().then(result => {
    // Cache the result
    responseCache.set(key, {
      data: result,
      timestamp: Date.now(),
      ttl: ttl
    });
    console.log(`✅ [CACHE] Cached response for: ${key} (TTL: ${ttl}ms)`);
    return result;
  }).finally(() => {
    // Clean up when request completes
    pendingRequests.delete(key);
    console.log(`✅ [DEDUP] Completed request for: ${key}`);
  });

  pendingRequests.set(key, promise);
  return promise;
}

// Helper function to clear cache for specific patterns
export function clearCache(pattern?: string): void {
  if (pattern) {
    // Clear cache entries matching pattern
    const keysToDelete = Array.from(responseCache.keys()).filter(key => key.includes(pattern));
    keysToDelete.forEach(key => responseCache.delete(key));
    console.log(`🧹 [CACHE] Cleared ${keysToDelete.length} cache entries matching: ${pattern}`);
  } else {
    // Clear all cache
    responseCache.clear();
    console.log(`🧹 [CACHE] Cleared all cache entries`);
  }
}

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
  const thingsBoardData = await unifiedDataService.getThingsBoardData(user.id, user.email);
  
  // Always return data, even if ThingsBoard is not connected
  return { user, thingsBoardData };
}

// Helper function to map ThingsBoard devices to room assignments from Supabase
async function mapDevicesToRooms(devices: any[]) {
  try {
    console.log('🔍 [API] mapDevicesToRooms() called with', devices.length, 'devices');
    
    // Get room assignments from Supabase (UUID-based)
    const { supabaseRoomsService } = await import('@/services/supabase-rooms');
    const assignments = await supabaseRoomsService.getAllTargetRoomAssignments();
    
    console.log('🔍 [API] Room assignments from Supabase:', assignments?.length || 0, 'assignments');
    console.log('🔍 [API] Room assignments data:', assignments?.map(a => ({
      target_id: a.target_id,
      room_id: a.room_id
    })) || []);
    
    // Create a map of deviceId -> roomId (UUID)
    const deviceRoomMap = new Map<string, string>();
    assignments?.forEach((assignment: any) => {
      deviceRoomMap.set(assignment.target_id, assignment.room_id);
    });
    
    console.log('🔍 [API] Device room mapping:', Object.fromEntries(deviceRoomMap));
    
    // Map devices with proper Supabase room UUIDs
    const mappedDevices = devices.map((device) => {
      const deviceId = device.id?.id || device.id;
      const roomId = deviceRoomMap.get(deviceId) || null;
      
      console.log(`🔍 [API] Mapping device ${device.name} (${deviceId}) to room: ${roomId || 'unassigned'}`);
      
      return {
        ...device,
        roomId, // Now this is a UUID string from Supabase (or null)
        telemetry: {}, // Empty telemetry - will be fetched when needed
        // Basic device info without telemetry
        lastEvent: null,
        lastGameId: null,
        lastGameName: null,
        lastHits: null,
        lastActivity: null,
        deviceName: device.name,
        // Additional metadata
        deviceType: device.type,
        createdTime: device.createdTime,
        additionalInfo: device.additionalInfo || {},
      };
    });
    
    console.log('🔍 [API] Final mapped devices:', mappedDevices.map(d => ({
      name: d.name,
      id: d.id?.id || d.id,
      roomId: d.roomId,
      deviceName: d.deviceName,
      deviceType: d.deviceType
    })));
    
    return mappedDevices;
  } catch (error) {
    console.error('❌ [API] Error mapping devices to rooms:', error);
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
    console.log('🔍 [API] getTargets() called');
    
    // Use enhanced deduplication with caching
    return deduplicateRequest('getTargets', async () => {
      try {
        // Check if we have a valid ThingsBoard token first
        const tbToken = localStorage.getItem('tb_access');
        if (!tbToken) {
          console.log('🔍 [API] No ThingsBoard token, returning empty targets');
          // Don't cache empty results - let it retry when token becomes available
          return [];
        }

        // Get current user
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError || !user) {
          console.log('🔍 [API] No authenticated user, returning empty targets');
          // Don't cache empty results - let it retry when user becomes available
          return [];
        }
        
        console.log('🔍 [API] Authenticated user:', user.email);

        // Try to use existing ThingsBoard service without re-authentication
        const thingsBoardService = (await import('@/services/thingsboard')).default;
        
        // Verify token is still valid by making a test call
        let isTokenValid = false;
        try {
          console.log('🔍 [API] Testing existing ThingsBoard token validity...');
          await thingsBoardService.getDevices(1, 0, undefined, undefined, undefined, undefined, false); // Fetch 1 device as validation (no telemetry)
          isTokenValid = true;
          console.log('🔍 [API] Existing token is valid, using it');
        } catch (error) {
          console.log('🔍 [API] Token invalid, will need re-authentication:', error.message);
        }

        if (!isTokenValid) {
          // Fall back to full authentication if token is invalid
          console.log('🔍 [API] Token invalid, falling back to full auth');
          const { user: authUser, thingsBoardData } = await ensureUserThingsBoardAuth();
          
          if (!thingsBoardData.isConnected || thingsBoardData.targets.length === 0) {
          console.log('🔍 [API] No data available after auth for user:', authUser.email);
          cache.set(CACHE_KEYS.TARGETS, [], 300000); // Increased cache time to 5 minutes
          return [];
          }
          
          console.log('🔍 [API] Raw ThingsBoard targets after auth:', thingsBoardData.targets.length, 'devices');
          console.log('🔍 [API] Raw targets data:', thingsBoardData.targets.map(t => ({
            id: t.id?.id || t.id,
            name: t.name,
            type: t.type,
            status: t.status
          })));
          
          // Map the devices to include room information from our database
          const mappedDevices = await mapDevicesToRooms(thingsBoardData.targets);
          console.log('🔍 [API] Mapped devices result (after auth):', {
            originalCount: thingsBoardData.targets.length,
            mappedCount: mappedDevices.length,
            mappedDevices: mappedDevices.map(d => ({
              name: d.name,
              id: d.id?.id || d.id,
              status: d.status,
              roomId: d.roomId
            }))
          });
          
          cache.set(CACHE_KEYS.TARGETS, mappedDevices, 300000); // Increased cache time to 5 minutes
          return mappedDevices;
        }

        // Token is valid, fetch data directly
        console.log('🔍 [API] Fetching data with valid token for user:', user.email);
        
        // Fetch devices directly from ThingsBoard
        const devicesResponse = await thingsBoardService.getDevices(100, 0, undefined, undefined, undefined, undefined, true);
        const devices = devicesResponse.data || [];
        
        console.log('🔍 [API] Raw ThingsBoard devices response:', {
          totalDevices: devices.length,
          devices: devices.map(d => ({
            id: d.id?.id || d.id,
            name: d.name,
            type: d.type,
            status: d.status,
            additionalInfo: d.additionalInfo
          }))
        });
        
        // Map the devices to include room information from our database
        console.log('🔍 [API] Mapping devices to rooms...');
        const mappedDevices = await mapDevicesToRooms(devices);
        
        console.log('🔍 [API] Final mapped devices result:', {
          originalCount: devices.length,
          mappedCount: mappedDevices.length,
          mappedDevices: mappedDevices.map(d => ({
            name: d.name,
            id: d.id?.id || d.id,
            status: d.status,
            roomId: d.roomId,
            deviceName: d.deviceName,
            deviceType: d.deviceType
          }))
        });
        
        return mappedDevices;
      } catch (error) {
        console.log('🔍 API.getTargets - Error, returning empty targets:', error.message);
        return [];
      }
    }, CACHE_TTL.TARGETS);
  },

  /** Wrapper for live telemetry WebSocket */
  connectWebSocket: async (token: string) => {
    const { openTelemetryWS } = await import('@/services/thingsboard');
    return openTelemetryWS(token);
  },

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
    return deduplicateRequest('getRooms', async () => {
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
    }, CACHE_TTL.ROOMS);
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
        // Get current user from Supabase
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          throw new Error('No authenticated user');
        }

        // Fetch ThingsBoard credentials from Supabase
        const credentials = await getThingsBoardCredentials(user.id);
        if (!credentials) {
          throw new Error('ThingsBoard credentials not found in user profile');
        }
        
        await thingsBoardService.login(credentials.email, credentials.password);
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
    return deduplicateRequest('getStats', async () => {
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
      return stats;
      } catch (error) {
        console.error('Error fetching stats from ThingsBoard:', error);
        throw error;
      }
    }, CACHE_TTL.STATS);
  },
  /** 7-day hit trend – fetch historical hit data from ThingsBoard */
  async getTrend7d() {
    return deduplicateRequest('trend7d', async () => {
      try {
        const { thingsBoardService } = await import('@/services/thingsboard');

        const devicesResponse = await thingsBoardService.getDevices(100, 0, undefined, undefined, undefined, undefined, false);
        const devices = devicesResponse.data || [];

        if (devices.length === 0) {
          return [];
        }

        const endTime = Date.now();
        const startTime = endTime - 7 * 24 * 60 * 60 * 1000;

        const dailyHits: Record<string, number> = {};
        for (let i = 0; i < 7; i++) {
          const date = new Date(endTime - i * 24 * 60 * 60 * 1000);
          const dayKey = date.toISOString().split('T')[0];
          dailyHits[dayKey] = 0;
        }

        const trendPromises = devices.map(async (device) => {
          try {
            const deviceId = device.id?.id || device.id;
            const telemetry = await thingsBoardService.getHistoricalTelemetry(
              deviceId,
              ['hits'],
              startTime,
              endTime,
              1000
            );

            return telemetry?.hits || [];
          } catch (error) {
            console.warn(`Failed to fetch historical data for device ${device.id}:`, error);
            return [];
          }
        });

        const results = await Promise.allSettled(trendPromises);

        results.forEach((result) => {
          if (result.status === 'fulfilled' && result.value.length > 0) {
            result.value.forEach((hit: any) => {
              const hitDate = new Date(hit.ts).toISOString().split('T')[0];
              if (dailyHits[hitDate] !== undefined) {
                dailyHits[hitDate] += hit.value || 0;
              }
            });
          }
        });

        return Object.entries(dailyHits)
          .map(([day, hits]) => ({ day, hits }))
          .sort((a, b) => a.day.localeCompare(b.day));
      } catch (error) {
        console.error('Error fetching 7-day trend:', error);
        return [];
      }
    }, 60 * 60 * 1000);
  },
};

// Get targets with telemetry for display purposes
API.getTargetsWithTelemetry = async (): Promise<any[]> => {
  try {
    const { thingsBoardService } = await import('@/services/thingsboard');
    const devicesResponse = await thingsBoardService.getDevices(); // Default fetchTelemetry=true
    return devicesResponse.data || [];
  } catch (error) {
    console.error('Error fetching targets with telemetry:', error);
    return [];
  }
};

export default API;

// Cache management functions
export const invalidateCache = (key: string) => {
  cache.delete(key);
};

// Specific function to clear targets cache
export const clearTargetsCache = () => {
  // Clear old cache system
  cache.delete(CACHE_KEYS.TARGETS);
  
  // Clear new responseCache for all target-related requests
  clearCache('getTargets');
  clearCache('targets');
  
  console.log('Targets cache cleared (both old and new cache systems)');
};
