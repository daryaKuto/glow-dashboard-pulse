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


const controllerId = import.meta.env.VITE_TB_CONTROLLER_ID as string;

// Export the WebSocket type for compatibility
export type MockWebSocket = ReturnType<typeof openTelemetryWS>;

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
  // sign-out: invalidate server session, clear local storage helpers
  async signOut() {
    await logout();
    localStorage.removeItem('tb_access');
    localStorage.removeItem('tb_refresh');
  },

  /* ----------  DEVICES  ---------- */
  /** "Targets" page = ThingsBoard devices filtered by user assignments */
  getTargets: async () => {
    // Check cache first
    const cached = cache.get(CACHE_KEYS.TARGETS);
    if (cached) {
      console.log('Using cached targets data:', cached);
      return cached;
    }

    try {
      // Check if ThingsBoard is properly configured
      const tbBaseUrl = import.meta.env.VITE_TB_BASE_URL;
      if (!tbBaseUrl) {
        throw new Error('ThingsBoard not configured. Please set VITE_TB_BASE_URL in .env');
      }
      
      // Get current user from Supabase auth
      const { supabase } = await import('@/integrations/supabase/client');
      const { data: { user }, error } = await supabase.auth.getUser();
      
      if (error || !user) {
        throw new Error('User not authenticated with Supabase');
      }
      
      const userEmail = user.email;
      console.log('🔐 Attempting ThingsBoard authentication for user:', userEmail);
      
      try {
        // First, authenticate with ThingsBoard using current user's email
        const thingsBoardService = (await import('@/services/thingsboard')).default;
        
        // Check if we already have a valid token for this user
        const currentToken = localStorage.getItem('tb_access');
        const tokenUser = localStorage.getItem('tb_user_email');
        
        if (currentToken && tokenUser === userEmail && thingsBoardService.isAuthenticated()) {
          console.log('✅ Already authenticated with ThingsBoard for user:', userEmail);
        } else {
          // Clear old tokens if they're for a different user
          if (tokenUser && tokenUser !== userEmail) {
            console.log('🔄 Different user detected, clearing old ThingsBoard tokens');
            localStorage.removeItem('tb_access');
            localStorage.removeItem('tb_refresh');
            localStorage.removeItem('tb_user_email');
          }
          
          // Use user's email as ThingsBoard username, with a common password
          const username = userEmail;
          const password = import.meta.env.VITE_TB_PASSWORD || 'dryfire2025';
          
          const authResult = await thingsBoardService.login(username, password);
          console.log('✅ ThingsBoard authentication successful for user:', userEmail);
          
          // Store user email with the token for validation
          localStorage.setItem('tb_user_email', userEmail);
        }
        
        // Fetch devices from ThingsBoard
        const devices = await listDevices();
      console.log('🔍 Raw devices from ThingsBoard API:', {
        count: devices.length,
        devices: devices.map(d => ({
          name: d.name,
          id: d.id?.id || d.id,
          type: d.type,
          additionalInfo: d.additionalInfo,
          hasRoomId: !!d.additionalInfo?.roomId
        }))
      });
      
      // Filter to show legitimate target devices (exclude test devices and system devices)
      const targetDevices = devices.filter(device => {
        // Include devices that are clearly targets
        const isTargetDevice = 
          device.name.startsWith('Dryfire-') || 
          device.name === 'GAME-MANAGER' ||
          device.name === 'GAME-HISTORY' ||
          device.type === 'dryfire-provision' ||
          (device.additionalInfo && device.additionalInfo.roomId);
        
        // Exclude test devices and temporary devices
        const isTestDevice = 
          device.name.includes('TestDevice_') ||
          device.name.includes('Telemetry-test');
        
        // Special case: "Test Device {{$timestamp}}" should be included if it has roomId
        const isSpecialTestDevice = device.name.includes('Test Device') && 
          (!device.additionalInfo || !device.additionalInfo.roomId);
        
        const shouldInclude = isTargetDevice && !isTestDevice && !isSpecialTestDevice;
        
        if (shouldInclude) {
          console.log('Including device:', { 
            name: device.name, 
            type: device.type, 
            roomId: device.additionalInfo?.roomId,
            isTargetDevice,
            isTestDevice,
            isSpecialTestDevice
          });
        }
        
        return shouldInclude;
      });
      
      console.log('🔍 Filtered target devices:', {
        count: targetDevices.length,
        devices: targetDevices.map(d => ({ 
          name: d.name, 
          type: d.type, 
          roomId: d.additionalInfo?.roomId,
          hasRoomId: !!d.additionalInfo?.roomId
        }))
      });
      
      // Map the devices to include room information from our database
      const mappedDevices = await mapDevicesToRooms(targetDevices);
      console.log('✅ Final mapped devices with room info:', mappedDevices);
      
        cache.set(CACHE_KEYS.TARGETS, mappedDevices, 30000);
        return mappedDevices;
        
      } catch (tbError) {
        console.warn('⚠️ ThingsBoard authentication/data fetch failed for user:', userEmail, tbError.message);
        console.log('ℹ️ This is normal for new users who don\'t have ThingsBoard accounts yet');
        
        // Return empty array with helpful message for new users
        const emptyResult = [{
          id: 'no-tb-data',
          name: 'No ThingsBoard Data',
          type: 'info',
          roomId: null,
          isNoDataMessage: true,
          message: `No ThingsBoard data is associated with this account.`,
          createdTime: Date.now(),
          additionalInfo: {}
        }];
        
        cache.set(CACHE_KEYS.TARGETS, emptyResult, 30000);
        return emptyResult;
      }
    } catch (error) {
      console.error('Error fetching targets:', error);
      throw error;
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
      
      // Convert numeric ID to string (ThingsBoard uses string IDs)
      const deviceId = id.toString();
      
      // Update the device name in ThingsBoard
      await thingsBoardService.updateDevice(deviceId, { name });
      
      // Clear the cache to force refresh
      clearTargetsCache();
      
      console.log(`Successfully renamed device ${deviceId} to "${name}"`);
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
      console.log('🔐 Fetching user-specific rooms from Supabase...');
      
      // Use Supabase service to get user-specific rooms
      const { supabaseRoomsService } = await import('@/services/supabase-rooms');
      
      try {
        const userRooms = await supabaseRoomsService.getUserRooms();
        
        console.log('🔍 User-specific rooms from Supabase:', {
          count: userRooms.length,
          rooms: userRooms.map(r => ({
            id: r.id,
            name: r.name,
            target_count: r.target_count
          }))
        });
        
        // Check if user has no rooms
        if (!userRooms || userRooms.length === 0) {
          console.log('ℹ️ No rooms assigned to user - returning empty array with helpful message');
          const emptyResult = [{
            id: 'no-rooms',
            name: 'No rooms assigned',
            order: 1,
            targetCount: 0,
            icon: 'home',
            thingsBoardId: 'no-rooms',
            isNoDataMessage: true,
            message: 'No rooms have been assigned to your account yet. Please contact an administrator to create rooms for your account.'
          }];
          
          return emptyResult;
        }
        
        // Transform Supabase rooms to match the expected format
        const rooms = userRooms.map((room, index) => ({
          id: parseInt(room.id) || index + 1, // Convert UUID to number or use index
          name: room.name,
          order: room.order_index || index + 1,
          targetCount: room.target_count || 0,
          icon: room.icon || 'home',
          thingsBoardId: room.id // Keep the UUID for ThingsBoard integration
        }));
        
        console.log('✅ Final transformed rooms:', rooms);
        return rooms;
        
      } catch (supabaseError) {
        console.error('❌ Error fetching user-specific rooms from Supabase:', supabaseError);
        
        // Return a helpful message instead of throwing an error
        const errorResult = [{
          id: 'error-loading-rooms',
          name: 'Unable to load rooms',
          order: 1,
          targetCount: 0,
          icon: 'home',
          thingsBoardId: 'error-loading-rooms',
          isErrorMessage: true,
          message: 'There was an error loading your rooms. Please try refreshing the page or contact support if the issue persists.'
        }];
        
        return errorResult;
      }
    } catch (error) {
      console.error('Error fetching user-specific rooms:', error);
      throw error;
    }
  },
  
  createRoom: async (name: string, icon: string = 'home') => {
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
      console.log('🔐 Calculating user-specific stats...');
      
      // Get the current user's targets (now user-specific)
      const targets = await API.getTargets();
      console.log('User targets for stats:', targets.length);
      
      // Get rooms for the current user (now user-specific)
      const rooms = await API.getRooms();
      console.log('User rooms for stats:', rooms.length);
      
      // Filter out "no data" messages from counts
      const actualTargets = targets.filter(t => !t.isNoDataMessage && !t.isErrorMessage);
      const actualRooms = rooms.filter(r => !r.isNoDataMessage && !r.isErrorMessage);
      
      const stats = {
        targets: { online: actualTargets.length },
        rooms: { count: actualRooms.length },
        sessions: { latest: { score: 0 } },
        invites: [],
        hasNoData: actualTargets.length === 0 && actualRooms.length === 0,
        noDataMessage: actualTargets.length === 0 && actualRooms.length === 0 
          ? 'No data has been assigned to your account yet. Please contact an administrator to get started.'
          : null
      };
      
      console.log('✅ User-specific stats calculated:', stats);
      cache.set(CACHE_KEYS.STATS, stats, 15000); // Cache for 15 seconds
      return stats;
    } catch (error) {
      console.error('Error fetching user-specific stats:', error);
      
      // Return safe default stats instead of throwing
      const safeStats = {
        targets: { online: 0 },
        rooms: { count: 0 },
        sessions: { latest: { score: 0 } },
        invites: [],
        hasError: true,
        errorMessage: 'Unable to load statistics. Please try refreshing the page.'
      };
      
      cache.set(CACHE_KEYS.STATS, safeStats, 5000); // Shorter cache for errors
      return safeStats;
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
