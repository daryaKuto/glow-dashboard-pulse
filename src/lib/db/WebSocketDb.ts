
import { BaseDb } from './BaseDb';
import type { MockWebSocket } from '../types';

export class WebSocketDb extends BaseDb {
  createWebSocket(): MockWebSocket {
    const socket: MockWebSocket = {
      onopen: null,
      onmessage: null,
      onclose: null,
      onerror: null,
      
      send: (data: string) => {
        console.log('Static WebSocket message sent:', data);
      },
      
      close: () => {
        this.off('hit', handleHit);
        this.off('connectionStatus', handleConnection);
        if (socket.onclose) socket.onclose({} as any);
      }
    };
    
    const handleHit = (event: { targetId: number; score: number }) => {
      if (socket.onmessage) {
        socket.onmessage({
          data: JSON.stringify({
            type: 'hit',
            targetId: event.targetId,
            score: event.score
          })
        } as any);
      }
    };
    
    const handleConnection = (event: { connected: boolean }) => {
      if (event.connected) {
        if (socket.onopen) socket.onopen({} as any);
      } else {
        if (socket.onclose) socket.onclose({} as any);
      }
    };
    
    this.on('hit', handleHit);
    this.on('connectionStatus', handleConnection);
    
    setTimeout(() => {
      this.emit('connectionStatus', { connected: true });
    }, 100);
    
    return socket;
  }
}
