
import { WebSocket, Server } from 'mock-socket';

// Mock session WebSocket server
export const createSessionMockServer = (sessionId: string) => {
  const mockServer = new Server(`wss://mock.fungun.dev/session/${sessionId}`);
  
  // Fake player data
  const players = [
    { userId: 'current-user', name: 'You', hits: 0, accuracy: 0 },
    { userId: 'user1', name: 'Alex', hits: 0, accuracy: 0 },
    { userId: 'user2', name: 'Sarah', hits: 0, accuracy: 0 },
    { userId: 'user3', name: 'Mike', hits: 0, accuracy: 0 }
  ];

  // Emit mock score updates every 2 seconds
  const interval = setInterval(() => {
    players.forEach(player => {
      // Random hit increment
      const hitIncrement = Math.floor(Math.random() * 3);
      if (hitIncrement > 0) {
        player.hits += hitIncrement;
        player.accuracy = Math.min(100, player.accuracy + Math.floor(Math.random() * 5) - 2);
        
        mockServer.emit('message', JSON.stringify({
          type: 'score_update',
          userId: player.userId,
          hits: player.hits,
          accuracy: player.accuracy,
          timestamp: new Date().toISOString()
        }));
      }
    });
  }, 2000);

  // Clean up on close
  mockServer.on('close', () => clearInterval(interval));
  
  return mockServer;
};

// Create a mock WebSocket connection for a session
export const createSessionWebSocket = (sessionId: string) => {
  return new WebSocket(`wss://mock.fungun.dev/session/${sessionId}`);
};
