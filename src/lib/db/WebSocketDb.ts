
import { BaseDb } from './BaseDb';
import type { MockWebSocket } from '../types';
import mitt from 'mitt';

export class WebSocketDb extends BaseDb {
  private emitter = mitt();
  
  createWebSocket(): MockWebSocket {
    // Create a mock websocket connection
    const socket: MockWebSocket = {
      onopen: null,
      onmessage: null,
      onclose: null,
      onerror: null,
      
      send: (data: string) => {
        console.log('WebSocket message sent:', data);
        // Handle any special commands
        try {
          const message = JSON.parse(data);
          if (message.action === 'hit') {
            // Simulate a hit event
            this.emitter.emit('hit', {
              targetId: message.targetId,
              score: Math.floor(Math.random() * 50) + 50
            });
          } else if (message.action === 'score_update') {
            // Simulate a score update event
            this.emitter.emit('score_update', {
              userId: message.userId || 'player-' + Math.floor(Math.random() * 1000),
              hits: message.hits || Math.floor(Math.random() * 100),
              accuracy: message.accuracy || Math.floor(Math.random() * 100)
            });
          }
        } catch (e) {
          console.error('Error parsing WebSocket message:', e);
        }
      },
      
      close: () => {
        if (socket.onclose) socket.onclose({} as any);
      }
    };
    
    // Trigger onopen after a short delay to simulate connection time
    setTimeout(() => {
      if (socket.onopen) socket.onopen({} as any);
    }, 100);
    
    // Set up event forwarding from emitter to socket
    this.emitter.on('hit', (data) => {
      if (socket.onmessage) {
        socket.onmessage({
          data: JSON.stringify({ type: 'hit', ...data })
        } as any);
      }
    });
    
    this.emitter.on('score_update', (data) => {
      if (socket.onmessage) {
        socket.onmessage({
          data: JSON.stringify({ type: 'score_update', ...data })
        } as any);
      }
    });
    
    // Return the mock socket
    return socket;
  }
  
  // Method to allow direct emit of events (useful for testing)
  simulateEvent(type: string, data: any) {
    this.emitter.emit(type, data);
  }
  
  // Add event listener methods
  on(type: string, handler: any) {
    this.emitter.on(type, handler);
    return () => this.emitter.off(type, handler);
  }
  
  off(type: string, handler: any) {
    this.emitter.off(type, handler);
  }
}
