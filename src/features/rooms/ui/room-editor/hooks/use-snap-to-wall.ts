import { useCallback } from 'react';
import { useRoomEditorStore } from './use-room-editor-store';
import { findNearestWallSegment } from '../lib/geometry';
import type { Point, WallSnapResult } from '../lib/types';

/**
 * Hook for snapping doors/windows to the nearest wall segment.
 */
export function useSnapToWall() {
  const walls = useRoomEditorStore((s) => s.walls);

  const snapToWall = useCallback(
    (point: Point, maxDistance = 30): WallSnapResult | null => {
      return findNearestWallSegment(point, walls, maxDistance);
    },
    [walls]
  );

  return { snapToWall };
}
