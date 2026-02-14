/**
 * Room Editor data model types
 * Matches the RoomLayout JSONB schema persisted in user_room_layouts.layout_data
 */

/** Top-level layout document stored as JSONB */
export interface RoomLayout {
  version: 1;
  canvasWidth: number;
  canvasHeight: number;
  gridSize: number;
  walls: WallData[];
  doors: DoorData[];
  windows: WindowData[];
  targets: PlacedTargetData[];
}

export interface WallData {
  id: string;
  points: number[]; // Flat [x1,y1, x2,y2, ...] — Konva Line format
  thickness: number;
  closed: boolean;
}

export interface DoorData {
  id: string;
  wallId: string;
  positionOnWall: number; // 0-1 normalized along wall segment
  segmentIndex: number;
  width: number; // grid units
  swingDirection: 'inward' | 'outward';
  swingAngle: number; // degrees (default 90)
  hingeSide: 'left' | 'right';
  type: 'single' | 'double' | 'sliding';
}

export interface WindowData {
  id: string;
  wallId: string;
  positionOnWall: number;
  segmentIndex: number;
  width: number; // grid units
  type: 'single' | 'double' | 'bay';
}

export interface PlacedTargetData {
  id: string; // editor element ID (crypto.randomUUID)
  targetDeviceId: string; // ThingsBoard device ID
  x: number;
  y: number;
  rotation: number; // degrees
  label: string;
}

/** Viewport state for session continuity */
export interface ViewportState {
  scale: number;
  x: number;
  y: number;
}

/** Document snapshot for undo/redo history */
export interface DocumentSnapshot {
  walls: WallData[];
  doors: DoorData[];
  windows: WindowData[];
  targets: PlacedTargetData[];
}

/** Point helper */
export interface Point {
  x: number;
  y: number;
}

/** Wall snap result from snap-to-wall utility */
export interface WallSnapResult {
  wallId: string;
  segmentIndex: number;
  positionOnWall: number; // 0-1
  snapPoint: Point;
  wallAngle: number; // radians
}
