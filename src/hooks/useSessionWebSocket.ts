
import { useEffect, useRef, useState } from 'react';
import { useSessions } from '@/store/useSessions';
import { toast } from '@/components/ui/sonner';
import { MockWebSocket } from '@/lib/api';

// Import the mock function directly since we're refactoring to use the mock backend
import { mockBackend } from '@/lib/mockBackend';

export const useSessionWebSocket = (sessionId: string | null) => {
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<MockWebSocket | null>(null);
  const { updatePlayerScore } = useSessions();

  useEffect(() => {
    // Clean up previous connection
    if (socketRef.current) {
      socketRef.current.close();
    }

    if (!sessionId) {
      setConnected(false);
      return;
    }

    // Create a mock websocket for the session
    const socket: MockWebSocket = {
      onopen: null,
      onclose: null,
      onmessage: null,
      onerror: null,
      
      send: (data: string) => {
        console.log('Session WebSocket message sent:', data);
      },
      
      close: () => {
        mockBackend.off('score_update', handleScoreUpdate);
        if (socket.onclose) socket.onclose({} as any);
        setConnected(false);
      }
    };
    
    // Handle score updates
    const handleScoreUpdate = (data: { userId: string, hits: number, accuracy: number }) => {
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
    };
    
    // Register for score update events
    mockBackend.on('score_update', handleScoreUpdate);
    
    // Set socket refs and trigger connection
    socketRef.current = socket;
    
    // Trigger connected state
    setTimeout(() => {
      setConnected(true);
      if (socket.onopen) socket.onopen({} as any);
    }, 100);

    socket.onopen = () => {
      setConnected(true);
      toast.success("Connected to session");
    };

    socket.onclose = () => {
      setConnected(false);
      toast.error("Disconnected from session");
    };

    socket.onerror = (error) => {
      console.error('WebSocket error:', error);
      toast.error("Error connecting to session");
      setConnected(false);
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'score_update') {
          // Update player score in the store
          updatePlayerScore(data.userId, data.hits, data.accuracy);
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    // Clean up
    return () => {
      if (socketRef.current) {
        socketRef.current.close();
      }
      socketRef.current = null;
      setConnected(false);
    };
  }, [sessionId, updatePlayerScore]);

  return {
    connected
  };
};
