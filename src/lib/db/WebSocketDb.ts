
import { BaseDb } from './BaseDb';
import mitt from 'mitt';

type Events = {
  hit: { targetId: number; score: number };
  score_update: { userId: string; hits: number; accuracy: number };
  target_update: { id: number; status: string };
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
}
