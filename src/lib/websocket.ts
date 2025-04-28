
import { MockWebSocket } from './types';
import { mockBackend } from './mockBackend';

// WebSocket connection helper now uses our mock events
export const connectWebSocket = (token: string): MockWebSocket => {
  // Create a fake WebSocket-like object backed by our mock events
  const fakeSocket: MockWebSocket = {
    onopen: null,
    onmessage: null,
    onclose: null,
    onerror: null,
    
    send: (data: string) => {
      console.log('Mock WebSocket message sent:', data);
    },
    
    close: () => {
      mockBackend.off('hit', handleHit);
      mockBackend.off('connectionStatus', handleConnection);
      if (fakeSocket.onclose) fakeSocket.onclose({} as any);
    }
  };
  
  // Set up event handlers
  const handleHit = (event: { targetId: number; score: number }) => {
    if (fakeSocket.onmessage) {
      fakeSocket.onmessage({
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
      if (fakeSocket.onopen) fakeSocket.onopen({} as any);
    } else {
      if (fakeSocket.onclose) fakeSocket.onclose({} as any);
    }
  };
  
  // Register event handlers
  mockBackend.on('hit', handleHit);
  mockBackend.on('connectionStatus', handleConnection);
  
  // Trigger initial connection status
  setTimeout(() => {
    if (fakeSocket.onopen) fakeSocket.onopen({} as any);
  }, 100);
  
  return fakeSocket;
};
