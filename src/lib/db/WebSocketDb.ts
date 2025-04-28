
import { BaseDb } from './BaseDb';
import type { MockWebSocket, MockBackendEvents } from '../types';

export class WebSocketDb extends BaseDb {
  // We don't need to redefine emitter since it's already in BaseDb
  
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
            this.emit('hit', {
              targetId: message.targetId,
              score: Math.floor(Math.random() * 50) + 50
            });
          } else if (message.action === 'score_update') {
            // Simulate a score update event
            this.emit('score_update', {
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
          data: JSON.stringify({ type: 'hit', targetId: data.targetId, score: data.score })
        } as any);
      }
    });
    
    this.emitter.on('score_update', (data) => {
      if (socket.onmessage) {
        socket.onmessage({
          data: JSON.stringify({ 
            type: 'score_update', 
            userId: data.userId, 
            hits: data.hits, 
            accuracy: data.accuracy 
          })
        } as any);
      }
    });
    
    // Return the mock socket
    return socket;
  }
  
  // Method to allow direct emit of events (useful for testing)
  simulateEvent(type: keyof MockBackendEvents, data: any) {
    this.emit(type, data);
  }
  
  // Instead of redefining on/off methods which conflict with BaseDb properties,
  // we'll remove them since they're already available from BaseDb
}
