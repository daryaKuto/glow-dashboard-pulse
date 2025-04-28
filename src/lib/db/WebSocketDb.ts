
import { BaseDb } from './BaseDb';
import mitt from 'mitt';
import type { MockWebSocket } from '../types';

type Events = {
  hit: { targetId: number; score: number };
  score_update: { userId: string; hits: number; accuracy: number };
  target_update: { id: number; status: string };
  user_connected: { userId: string };
  user_disconnected: { userId: string };
  friend_request: { fromUserId: string; toUserId: string; requestId: string; status: string };
  [key: string]: any;
};

export class WebSocketDb extends BaseDb {
  protected emitter = mitt<Events>();
  
  constructor() {
    super();
  }
  
  // Event methods
  on<K extends keyof Events>(type: K, handler: (event: Events[K]) => void) {
    this.emitter.on(type, handler);
    return this;
  }
  
  off<K extends keyof Events>(type: K, handler: (event: Events[K]) => void) {
    this.emitter.off(type, handler);
    return this;
  }
  
  emit<K extends keyof Events>(type: K, event: Events[K]) {
    this.emitter.emit(type, event);
    return this;
  }
  
  // Create a mock WebSocket for the frontend
  createWebSocket(): MockWebSocket {
    const socket: MockWebSocket = {
      onopen: null,
      onclose: null,
      onmessage: null,
      onerror: null,
      
      send: (data: string) => {
        console.log('WebSocket message sent:', data);
      },
      
      close: () => {
        if (socket.onclose) socket.onclose({} as any);
      }
    };
    
    // Trigger connection event after a short delay
    setTimeout(() => {
      if (socket.onopen) socket.onopen({} as any);
    }, 100);
    
    return socket;
  }
  
  // Simulate websocket connection methods
  connectUser(userId: string) {
    console.log(`User ${userId} connected to WebSocket`);
    this.emit('user_connected', { userId });
    return true;
  }
  
  disconnectUser(userId: string) {
    console.log(`User ${userId} disconnected from WebSocket`);
    this.emit('user_disconnected', { userId });
    return true;
  }
  
  // Friend request simulation
  sendFriendRequest(fromUserId: string, toUserId: string) {
    console.log(`Friend request from ${fromUserId} to ${toUserId}`);
    
    // In a real app, this would store the request in a database
    // and send a notification through the WebSocket
    
    this.emit('friend_request', {
      fromUserId,
      toUserId,
      requestId: `req_${Date.now()}`,
      status: 'pending'
    });
    
    return true;
  }

  // Friend management methods
  getFriends() {
    if (!this.db || !this.db.friends) {
      return [];
    }
    return [...this.db.friends];
  }
  
  addFriend(friendId: string) {
    if (!this.db.friends) {
      this.db.friends = [];
    }
    
    const existingFriend = this.db.friends.find(f => f.id === friendId);
    if (existingFriend) {
      return existingFriend;
    }
    
    const newFriend = {
      id: friendId,
      name: `Friend ${friendId}`,
      status: 'accepted',
      score: Math.floor(Math.random() * 1000),
      avatar: `https://i.pravatar.cc/150?u=${friendId}`
    };
    
    this.db.friends.push(newFriend);
    this.persist();
    
    return newFriend;
  }
  
  // Leaderboard methods
  getLeaderboard(scope: 'global' | 'friends' = 'global') {
    if (!this.db || !this.db.leaderboards) {
      return [];
    }
    
    return scope === 'global' 
      ? this.db.leaderboards.global || []
      : this.db.leaderboards.weekly || [];
  }
}
