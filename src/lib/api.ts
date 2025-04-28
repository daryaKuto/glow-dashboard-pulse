
import { staticDb } from './staticDb';
import type { MockWebSocket } from './staticDb';

// Export the mock WebSocket type
export type { MockWebSocket };

// WebSocket connection helper now uses our static database
export const connectWebSocket = (token: string): MockWebSocket => {
  return staticDb.createWebSocket();
};

// Unified API interface that works with our static database
export const fetcher = async (endpoint: string, options = {}) => {
  // Extract path components
  const path = endpoint.split('/').filter(p => p);
  
  // Extract token from options if present (not used in static mode but kept for API compatibility)
  const token = (options as any).headers?.Authorization?.split(' ')[1] || 'dummy_token';
  
  try {
    // Route requests to appropriate static DB methods
    switch (path[0]) {
      case 'targets':
        if (path.length === 1) {
          return staticDb.getTargets();
        } else if (path.length === 2) {
          const targetId = parseInt(path[1]);
          if ((options as any).method === 'PUT') {
            const body = JSON.parse((options as any).body);
            if ('name' in body) {
              return staticDb.renameTarget(targetId, body.name);
            } else if ('roomId' in body) {
              return staticDb.assignRoom(targetId, body.roomId);
            }
          } else if ((options as any).method === 'DELETE') {
            return staticDb.deleteTarget(targetId);
          }
        }
        break;
        
      case 'rooms':
        if (path.length === 1) {
          if ((options as any).method === 'GET') {
            return staticDb.getRooms();
          } else if ((options as any).method === 'POST') {
            const body = JSON.parse((options as any).body);
            return staticDb.createRoom(body.name);
          }
        } else if (path.length === 2) {
          const roomId = parseInt(path[1]);
          if ((options as any).method === 'PUT') {
            const body = JSON.parse((options as any).body);
            return staticDb.updateRoom(roomId, body.name);
          } else if ((options as any).method === 'DELETE') {
            return staticDb.deleteRoom(roomId);
          } else if (path[1] === 'order') {
            const body = JSON.parse((options as any).body);
            return staticDb.updateRoomOrder(body);
          }
        } else if (path.length === 3 && path[2] === 'layout') {
          const roomId = parseInt(path[1]);
          if ((options as any).method === 'GET') {
            return staticDb.getRoomLayout(roomId);
          } else if ((options as any).method === 'PUT') {
            const body = JSON.parse((options as any).body);
            return staticDb.saveRoomLayout(roomId, body.targets, body.groups);
          }
        }
        break;
        
      case 'stats':
        if (path.length === 1) {
          return staticDb.getStats();
        } else if (path.length === 2) {
          if (path[1] === 'targets') {
            return { online: staticDb.getStats().targets.online };
          } else if (path[1] === 'rooms') {
            return { count: staticDb.getStats().rooms.count };
          } else if (path[1] === 'hits') {
            return staticDb.getHitStats();
          } else if (path[1] === 'sessions') {
            return { latest: staticDb.getStats().sessions.latest };
          }
        }
        break;
        
      case 'scenarios':
        return staticDb.getScenarios();
        
      case 'sessions':
        if (path.length === 1) {
          if ((options as any).method === 'GET') {
            return staticDb.getSessions();
          } else if ((options as any).method === 'POST') {
            const body = JSON.parse((options as any).body);
            return staticDb.startSession(body.scenarioId, body.includedRoomIds);
          }
        } else if (path.length === 3 && path[2] === 'end') {
          const sessionId = parseInt(path[1]);
          return staticDb.endSession(sessionId);
        }
        break;
    }
    
    throw new Error(`Unhandled static endpoint: ${endpoint}`);
  } catch (error) {
    console.error(`Static API error for ${endpoint}:`, error);
    throw error;
  }
};

// API object with convenience methods
export const API = {
  getStats: async (token: string) => {
    const stats = await fetcher("/stats", { headers: { Authorization: `Bearer ${token}` } });
    
    return {
      targets: stats.targets,
      rooms: stats.rooms,
      scenarios: staticDb.getScenarios(),
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
  
  // Auth methods
  signUp: (email: string, password: string, userData?: any) => 
    staticDb.signUp(email, password, userData),
    
  signIn: (email: string, password: string) => 
    staticDb.signIn(email, password),
    
  signOut: () => staticDb.signOut(),
  
  updateUser: (id: string, data: any) => 
    staticDb.updateUser(id, data)
};
