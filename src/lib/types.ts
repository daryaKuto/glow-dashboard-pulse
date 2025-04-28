
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
