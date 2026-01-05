/**
 * Legacy Types
 *
 * Types preserved for backward compatibility with older code.
 * These should be gradually migrated to feature-specific schemas.
 *
 * @migrated from src/lib/types.ts, src/types/game.ts, src/types/scenario-data.ts
 * @see src/_legacy/README.md for migration details
 *
 * Removed unused types during cleanup:
 * - WebSocketEvents (unused)
 * - InviteResponse (unused)
 * - ChartLeaderboardEntry (unused)
 * - LeaderboardEntry (local definition exists in leaderboard-page.tsx)
 * - DB (mock test data, unused)
 */

/**
 * MockWebSocket interface for WebSocket simulation
 * Used by: src/state/useStats.ts
 */
export interface MockWebSocket {
  onopen: ((ev: unknown) => unknown) | null;
  onmessage: ((ev: unknown) => unknown) | null;
  onclose: ((ev: unknown) => unknown) | null;
  onerror: ((ev: unknown) => unknown) | null;
  send: (data: string) => void;
  close: () => void;
}

/**
 * Room layout API response type
 * Used by: src/state/useRoomDesigner.ts
 */
export interface RoomLayoutResponse {
  targets: { id: number; x: number; y: number }[];
  groups: { id: number; name: string; targetIds: number[] }[];
}
