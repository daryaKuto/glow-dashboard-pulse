
import { WebSocket, Server } from 'mock-socket';

export const createMockWebSocket = (userId: string) => {
  const mockServer = new Server(`wss://mock.fungun.dev/hits/${userId}`);
  
  // Emit mock hit events every 3 seconds
  const interval = setInterval(() => {
    mockServer.emit('message', JSON.stringify({
      type: 'hit',
      targetId: `target-${Math.floor(Math.random() * 100)}`,
      score: Math.floor(Math.random() * 100),
      timestamp: new Date().toISOString()
    }));
  }, 3000);

  // Clean up on close
  mockServer.on('close', () => clearInterval(interval));

  return new WebSocket(`wss://mock.fungun.dev/hits/${userId}`);
};
