import { mockBackend } from './mockBackend';
import { connectWebSocket } from './websocket';
import { MockWebSocket } from './types';

// Environment check for using mock or real API
const useMocks = true; // We're fully switching to mocks as per requirements

// Unified API interface that works with both real and mock backends
export const fetcher = async (endpoint: string, options = {}) => {
  if (useMocks) {
    // Route the request to our mock backend
    const path = endpoint.split('/').filter(p => p);
    
    // Extract token from options if present
    const token = (options as any).headers?.Authorization?.split(' ')[1] || 'dummy_token';
    
    try {
      // Route requests to appropriate mock backend methods
      switch (path[0]) {
        case 'targets':
          if (path.length === 1) {
            return mockBackend.getTargets();
          } else if (path.length === 2) {
            const targetId = parseInt(path[1]);
            if ((options as any).method === 'PUT') {
              const body = JSON.parse((options as any).body);
              if ('name' in body) {
                return mockBackend.renameTarget(targetId, body.name);
              } else if ('roomId' in body) {
                return mockBackend.assignRoom(targetId, body.roomId);
              }
            } else if ((options as any).method === 'DELETE') {
              return mockBackend.deleteTarget(targetId);
            }
          }
          break;
          
        case 'rooms':
          if (path.length === 1) {
            if ((options as any).method === 'GET') {
              return mockBackend.getRooms();
            } else if ((options as any).method === 'POST') {
              const body = JSON.parse((options as any).body);
              return mockBackend.createRoom(body.name);
            }
          } else if (path.length === 2) {
            const roomId = parseInt(path[1]);
            if ((options as any).method === 'PUT') {
              const body = JSON.parse((options as any).body);
              return mockBackend.updateRoom(roomId, body.name);
            } else if ((options as any).method === 'DELETE') {
              return mockBackend.deleteRoom(roomId);
            } else if (path[1] === 'order') {
              const body = JSON.parse((options as any).body);
              return mockBackend.updateRoomOrder(body);
            }
          } else if (path.length === 3 && path[2] === 'layout') {
            const roomId = parseInt(path[1]);
            if ((options as any).method === 'GET') {
              return mockBackend.getRoomLayout(roomId);
            } else if ((options as any).method === 'PUT') {
              const body = JSON.parse((options as any).body);
              return mockBackend.saveRoomLayout(roomId, body.targets, body.groups);
            }
          }
          break;
          
        case 'stats':
          if (path.length === 1) {
            return mockBackend.getStats();
          } else if (path.length === 2) {
            if (path[1] === 'targets') {
              return { online: mockBackend.getStats().targets.online };
            } else if (path[1] === 'rooms') {
              return { count: mockBackend.getStats().rooms.count };
            } else if (path[1] === 'hits') {
              return mockBackend.getHitStats();
            } else if (path[1] === 'sessions') {
              return { latest: mockBackend.getStats().sessions.latest };
            }
          }
          break;
          
        case 'scenarios':
          return mockBackend.getScenarios();
          
        case 'sessions':
          if (path.length === 1) {
            return mockBackend.getSessions();
          }
          break;
      }
      
      throw new Error(`Unhandled mock endpoint: ${endpoint}`);
    } catch (error) {
      console.error(`Mock API error for ${endpoint}:`, error);
      throw error;
    }
  } else {
    // Original API implementation (for reference, not used)
    try {
      const url = `https://api.fungun.dev${endpoint}`;
      const response = await fetch(url, {
        ...options,
        headers: {
          "Content-Type": "application/json",
          ...(options as any).headers,
        },
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error("API request failed:", error);
      throw error;
    }
  }
};

// Export the mock WebSocket type and connection function
export { MockWebSocket };
export { connectWebSocket };

// API object with convenience methods
export const API = {
  getStats: async (token: string) => {
    const stats = await fetcher("/stats", { headers: { Authorization: `Bearer ${token}` } });
    
    return {
      targets: stats.targets,
      rooms: stats.rooms,
      scenarios: mockBackend.getScenarios(),
      sessions: stats.sessions,
      invites: []
    };
  },

  getHitStats: (token: string) => fetcher("/stats/hits", {
    headers: { Authorization: `Bearer ${token}` }
  }),

  getTargets: (token: string) => fetcher("/targets", {
    headers: { Authorization: `Bearer ${token}` }
  }),

  getRooms: (token: string) => fetcher("/rooms", {
    headers: { Authorization: `Bearer ${token}` }
  }),

  getInvites: (token: string) => [],
};
