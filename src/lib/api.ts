import { staticDb } from './staticDb';
import type { MockWebSocket, RoomLayoutResponse, LeaderboardEntry } from './types';

// Export the mock WebSocket type
export type { MockWebSocket };

// WebSocket connection helper now uses our static database
export const connectWebSocket = (token: string): MockWebSocket => {
  return staticDb.createWebSocket();
};

// Type guard to check if response is a RoomLayoutResponse
const isRoomLayoutResponse = (obj: any): obj is RoomLayoutResponse => {
  return obj && 
    typeof obj === 'object' && 
    'targets' in obj && 
    'groups' in obj &&
    Array.isArray(obj.targets) &&
    Array.isArray(obj.groups);
};

// Unified API interface that works with our static database
export const fetcher = async (endpoint: string, options = {}) => {
  console.log('Fetching:', endpoint, options);
  
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
        console.log('Room request path:', path, 'method:', (options as any).method);
        if (path.length === 1) {
          if ((options as any).method === 'POST') {
            const body = JSON.parse((options as any).body);
            return staticDb.createRoom(body.name);
          }
          // Handle GET requests for rooms
          return staticDb.getRooms();
        } else if (path.length === 2) {
          if (path[1] === 'order') {
            const body = JSON.parse((options as any).body);
            return staticDb.updateRoomOrder(body);
          } else {
            const roomId = parseInt(path[1]);
            if ((options as any).method === 'PUT') {
              const body = JSON.parse((options as any).body);
              return staticDb.updateRoom(roomId, body.name);
            } else if ((options as any).method === 'DELETE') {
              return staticDb.deleteRoom(roomId);
            }
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
        console.log('Sessions request:', path, (options as any).method);
        if (path.length === 1) {
          if ((options as any).method === 'GET') {
            // Ensure we're properly calling getSessions
            const sessions = staticDb.getSessions();
            console.log('Fetched sessions:', sessions);
            return sessions;
          } else if ((options as any).method === 'POST') {
            const body = JSON.parse((options as any).body);
            return staticDb.startSession(body.scenarioId, body.includedRoomIds);
          }
        } else if (path.length === 3 && path[2] === 'end') {
          const sessionId = parseInt(path[1]);
          return staticDb.endSession(sessionId);
        }
        break;
        
      case 'invites':
        if (path.length === 1 && (options as any).method === 'POST') {
          const body = JSON.parse((options as any).body);
          // In static mode, just return a dummy token
          return { token: `mock-invite-${Date.now()}` };
        }
        break;

      case 'friends':
        if (path.length === 1) {
          return staticDb.getFriends();
        } else if (path.length === 2) {
          if ((options as any).method === 'POST') {
            const friendId = path[1];
            return staticDb.addFriend(friendId);
          }
        }
        break;

      case 'leaderboard':
        if (path.length === 1) {
          const scope = (options as any).params?.scope || 'global';
          return staticDb.getLeaderboard(scope);
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
    const stats = await staticDb.getStats();
    const trend = staticDb.getHits7d();
    
    return {
      targets: stats.targets,
      rooms: stats.rooms,
      scenarios: staticDb.getScenarios(),
      sessions: stats.sessions,
      invites: [],
      trend
    };
  },

  getTrend7d: () => staticDb.getHits7d(),

  getHitStats: (token: string) => staticDb.getHitStats(),
  getTargets: (token: string) => staticDb.getTargets(),
  getRooms: (token: string) => staticDb.getRooms(),
  getInvites: (token: string) => [],
  
  // Add a specific method for getting sessions
  getSessions: (token: string) => staticDb.getSessions(),
  
  // Auth methods
  signUp: (email: string, password: string, userData?: any) => 
    staticDb.signUp(email, password, userData),
    
  signIn: (email: string, password: string) => 
    staticDb.signIn(email, password),
    
  signOut: () => staticDb.signOut(),
  
  updateUser: (id: string, data: any) => 
    staticDb.updateUser(id, data),

  // Add friends methods
  getFriends: (token: string) => staticDb.getFriends(),
  addFriend: (token: string, friendId: string) => staticDb.addFriend(friendId),
  getLeaderboard: (token: string, scope: 'global' | 'friends' = 'global') => staticDb.getLeaderboard(scope)
};
