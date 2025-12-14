
// Define event types for WebSocket connections
export type WebSocketEvents = { 
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

// Floor plan layout types
export interface Wall {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  thickness?: number;
  color?: string;
}

export interface RoomShape {
  id: string;
  name?: string;
  points: Array<{ x: number; y: number }>;
  fillColor?: string;
  strokeColor?: string;
  rotation?: number;
}

export interface Door {
  id: string;
  x: number;
  y: number;
  width: number;
  rotation?: number;
  type?: 'single' | 'double';
}

export interface Window {
  id: string;
  x: number;
  y: number;
  width: number;
  rotation?: number;
}

export interface FloorPlanLayout {
  walls?: Wall[];
  rooms?: RoomShape[];
  doors?: Door[];
  windows?: Window[];
}

export interface RoomLayoutData {
  layout: FloorPlanLayout;
  canvasWidth?: number;
  canvasHeight?: number;
  viewportScale?: number;
  viewportX?: number;
  viewportY?: number;
}

// Define API response types
export interface RoomLayoutResponse {
  targets: { id: string; x: number; y: number }[];
  groups: { id: string; name: string; targetIds: string[] }[];
  floorPlan?: RoomLayoutData;
}

export interface InviteResponse {
  token: string;
}

// Define different types of leaderboard entries
export interface ChartLeaderboardEntry {
  day: string;
  hits: number;
}

// Define the actual leaderboard entry type for player rankings
export interface LeaderboardEntry {
  id: string;
  name: string;
  score: number;
  avatar: string;
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
