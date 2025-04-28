// Define event types for the mock backend
export type MockBackendEvents = { 
  hit: { targetId: number; score: number }; 
  connectionStatus: { connected: boolean };
  score_update: { userId: string; hits: number; accuracy: number };
};

// Define the MockWebSocket interface
export interface MockWebSocket {
  onopen: ((ev: any) => any) | null;
  onmessage: ((ev: any) => any) | null;
  onclose: ((ev: any) => any) | null;
  onerror: ((ev: any) => any) | null;
  send: (data: string) => void;
  close: () => void;
}

// Define API response types
export interface RoomLayoutResponse {
  targets: { id: number; x: number; y: number }[];
  groups: { id: number; name: string; targetIds: number[] }[];
}

export interface InviteResponse {
  token: string;
}

// Define leaderboard entry type
export interface LeaderboardEntry {
  day: string;
  hits: number;
}

// Update DB type to include leaderboards
export interface DB extends Record<string, any> {
  users: Array<{
    id: string;
    email: string;
    pass: string;
    name: string;
    phone: string;
  }>;
  targets: Array<{
    id: number;
    name: string;
    roomId: number;
    status: string;
    battery: number;
  }>;
  rooms: Array<{
    id: number;
    name: string;
    order: number;
    targetCount: number;
  }>;
  layouts: Array<{
    roomId: number;
    targets: Array<{ id: number; x: number; y: number }>;
    groups: Array<{ id: number; name: string; targetIds: number[] }>;
  }>;
  leaderboards: LeaderboardEntry[];
}
