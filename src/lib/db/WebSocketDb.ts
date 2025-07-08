
import { BaseDb } from './BaseDb';
import { EventEmitter } from '../utils/EventEmitter';
import type { MockWebSocket } from '../types';

export class WebSocketDb extends BaseDb {
  private emitter = new EventEmitter();
  private sockets: MockWebSocket[] = [];

  // Add event emitter methods
  on(event: string, listener: (...args: any[]) => void) {
    this.emitter.on(event, listener);
    return this;
  }

  off(event: string, listener: (...args: any[]) => void) {
    this.emitter.off(event, listener);
    return this;
  }

  emit(event: string, ...args: any[]) {
    this.emitter.emit(event, ...args);
    return this;
  }

  createWebSocket(): MockWebSocket {
    // Create a mock WebSocket
    const socket: MockWebSocket = {
      onopen: null,
      onclose: null,
      onmessage: null,
      onerror: null,
      
      send: (data: string) => {
        console.log('WebSocket message sent:', data);
      },
      
      close: () => {
        this.sockets = this.sockets.filter(s => s !== socket);
        if (socket.onclose) socket.onclose({} as any);
      }
    };
    
    this.sockets.push(socket);
    
    // Set up event handlers
    this.on('hit', (event: { targetId: number, score: number }) => {
      if (socket.onmessage) {
        socket.onmessage({
          data: JSON.stringify({
            type: 'hit',
            targetId: event.targetId,
            score: event.score
          })
        } as any);
      }
    });
    
    // Trigger initial connection
    setTimeout(() => {
      if (socket.onopen) socket.onopen({} as any);
    }, 100);

    // this.simulateHits(); // Simulated hits disabled

    return socket;
  }

  recordHit(targetId: number) {
    const day = new Date().toISOString().split('T')[0];
    if (!this.db.chartLeaderboards) {
      this.db.chartLeaderboards = [];
    }
    
    const stat = this.db.chartLeaderboards.find(l => l.day === day) ||
      this.db.chartLeaderboards[this.db.chartLeaderboards.push({ day, hits: 0 }) - 1];
    stat.hits += 1;
    this.persist();
  }

  getFriends() {
    if (!this.db.friends) {
      this.db.friends = [];
    }
    return [...this.db.friends];
  }

  addFriend(friendId: string) {
    if (!this.db.friends) {
      this.db.friends = [];
    }
    
    const existingFriend = this.db.friends.find(f => f.id === friendId);
    if (!existingFriend) {
      this.db.friends.push({
        id: friendId,
        name: `Friend ${friendId}`,
        status: "pending",
        score: Math.floor(Math.random() * 500) + 500,
        avatar: `https://i.pravatar.cc/150?u=${friendId}`
      });
    }
    
    this.persist();
    return this.db.friends;
  }

  getLeaderboard(scope: 'global' | 'friends' = 'global') {
    if (scope === 'global') {
      return [
        { id: "global1", name: "Top Player", score: 985, avatar: "https://i.pravatar.cc/150?u=global1" },
        { id: "global2", name: "Runner Up", score: 940, avatar: "https://i.pravatar.cc/150?u=global2" },
        { id: "global3", name: "Third Place", score: 915, avatar: "https://i.pravatar.cc/150?u=global3" }
      ];
    } else {
      return this.getFriends().filter(f => f.status === "accepted");
    }
  }
}
