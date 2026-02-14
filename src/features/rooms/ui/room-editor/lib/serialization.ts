/**
 * Serialization — convert between Zustand store state and JSONB layout data
 */

import type { RoomLayout, DocumentSnapshot, ViewportState } from './types';
import { DEFAULT_CANVAS_WIDTH, DEFAULT_CANVAS_HEIGHT, DEFAULT_GRID_SIZE } from './constants';

/**
 * Create an empty RoomLayout document
 */
export function createEmptyLayout(): RoomLayout {
  return {
    version: 1,
    canvasWidth: DEFAULT_CANVAS_WIDTH,
    canvasHeight: DEFAULT_CANVAS_HEIGHT,
    gridSize: DEFAULT_GRID_SIZE,
    walls: [],
    doors: [],
    windows: [],
    targets: [],
  };
}

/**
 * Serialize document state into a RoomLayout for persistence.
 */
export function serializeLayout(
  snapshot: DocumentSnapshot,
  canvasWidth: number,
  canvasHeight: number,
  gridSize: number
): RoomLayout {
  return {
    version: 1,
    canvasWidth,
    canvasHeight,
    gridSize,
    walls: snapshot.walls,
    doors: snapshot.doors,
    windows: snapshot.windows,
    targets: snapshot.targets,
  };
}

/**
 * Deserialize a RoomLayout JSONB into document snapshot + canvas dimensions.
 */
export function deserializeLayout(layout: RoomLayout): {
  snapshot: DocumentSnapshot;
  canvasWidth: number;
  canvasHeight: number;
  gridSize: number;
} {
  return {
    snapshot: {
      walls: layout.walls ?? [],
      doors: layout.doors ?? [],
      windows: layout.windows ?? [],
      targets: layout.targets ?? [],
    },
    canvasWidth: layout.canvasWidth ?? DEFAULT_CANVAS_WIDTH,
    canvasHeight: layout.canvasHeight ?? DEFAULT_CANVAS_HEIGHT,
    gridSize: layout.gridSize ?? DEFAULT_GRID_SIZE,
  };
}

/**
 * Create a default viewport state
 */
export function createDefaultViewport(): ViewportState {
  return {
    scale: 1,
    x: 0,
    y: 0,
  };
}
