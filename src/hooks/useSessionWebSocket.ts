
import { useEffect, useRef, useState } from 'react';
import { useSessions, Player } from '@/store/useSessions';
import { createSessionWebSocket } from '@/mocks/mockSocket';
import { toast } from '@/components/ui/sonner';

export const useSessionWebSocket = (sessionId: string | null) => {
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<WebSocket | null>(null);
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

    // Create new WebSocket connection
    const socket = createSessionWebSocket(sessionId);
    socketRef.current = socket;

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
      socket.close();
      socketRef.current = null;
      setConnected(false);
    };
  }, [sessionId, updatePlayerScore]);

  return {
    connected
  };
};
