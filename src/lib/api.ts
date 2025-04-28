// API helper functions
import { toast } from "@/components/ui/sonner";

const useMocks = import.meta.env.VITE_USE_MOCK === 'true';
const API_BASE_URL = useMocks ? 'https://api.fungun.dev' : 'https://api.fungun.dev';

// Fetcher function for API calls
export const fetcher = async (endpoint: string, options = {}) => {
  try {
    const url = `${API_BASE_URL}${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options as any).headers,
      },
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error("API request failed:", error);
    toast.error("Failed to fetch data. Please try again.");
    throw error;
  }
};

// WebSocket connection helper
export const connectWebSocket = (token: string) => {
  const socket = new WebSocket(`${API_BASE_URL.replace('http', 'ws')}/ws?token=${token}`);
  
  socket.onopen = () => {
    console.log("WebSocket connected");
  };

  socket.onerror = (error) => {
    console.error("WebSocket error:", error);
    toast.error("WebSocket connection error. Reconnecting...");
  };

  return socket;
};

// API endpoints
export const API = {
  getStats: async (token: string) => {
    const [targets, rooms, scenarios, sessions, invites] = await Promise.all([
      fetcher("/stats/targets", { headers: { Authorization: `Bearer ${token}` } }),
      fetcher("/stats/rooms", { headers: { Authorization: `Bearer ${token}` } }),
      fetcher("/stats/scenarios", { headers: { Authorization: `Bearer ${token}` } }),
      fetcher("/sessions/latest", { headers: { Authorization: `Bearer ${token}` } }),
      fetcher("/invites/pending", { headers: { Authorization: `Bearer ${token}` } })
    ]);

    return { targets, rooms, scenarios, sessions, invites };
  },

  getHitStats: (token: string) => fetcher("/stats/hits", {
    headers: { Authorization: `Bearer ${token}` }
  }),

  getTargets: (token: string) => fetcher("/targets", {
    headers: { Authorization: `Bearer ${token}` }
  }),

  getRooms: (token: string) => fetcher("/rooms", {
    headers: { Authorization: `Bearer ${token}` }
  }),

  getInvites: (token: string) => fetcher("/invites", {
    headers: { Authorization: `Bearer ${token}` }
  }),
};
