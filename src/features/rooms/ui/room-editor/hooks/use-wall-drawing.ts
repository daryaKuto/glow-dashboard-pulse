import { useCallback } from 'react';
import type Konva from 'konva';
import { useRoomEditorStore } from './use-room-editor-store';
import { snapToGrid } from '../lib/geometry';
import { WALL_STROKE_WIDTH } from '../lib/constants';
import type { WallData } from '../lib/types';

/**
 * Wall drawing hook — 2-click model.
 *
 * Click 1: set start point (draft begins, preview line follows cursor)
 * Click 2: set end point → wall created as a single segment
 *
 * After a wall is created, the tool stays active so the user can
 * immediately start another wall. Press Escape or switch tools to stop.
 */
export function useWallDrawing() {
  const activeTool = useRoomEditorStore((s) => s.activeTool);
  const isDrawingWall = useRoomEditorStore((s) => s.isDrawingWall);
  const wallDraftPoints = useRoomEditorStore((s) => s.wallDraftPoints);
  const gridSize = useRoomEditorStore((s) => s.gridSize);
  const setIsDrawingWall = useRoomEditorStore((s) => s.setIsDrawingWall);
  const setWallDraftPoints = useRoomEditorStore((s) => s.setWallDraftPoints);
  const clearWallDraft = useRoomEditorStore((s) => s.clearWallDraft);
  const addWall = useRoomEditorStore((s) => s.addWall);

  const handleCanvasClick = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      if (activeTool !== 'wall') return;

      const stage = e.target.getStage();
      if (!stage) return;

      const pointer = stage.getRelativePointerPosition();
      if (!pointer) return;

      const snappedX = snapToGrid(pointer.x, gridSize);
      const snappedY = snapToGrid(pointer.y, gridSize);

      if (!isDrawingWall) {
        // First click — set start point
        setIsDrawingWall(true);
        setWallDraftPoints([snappedX, snappedY]);
        return;
      }

      // Second click — create the wall segment
      const startX = wallDraftPoints[0];
      const startY = wallDraftPoints[1];

      // Don't create zero-length walls
      if (snappedX === startX && snappedY === startY) return;

      const wall: WallData = {
        id: crypto.randomUUID(),
        points: [startX, startY, snappedX, snappedY],
        thickness: WALL_STROKE_WIDTH,
        closed: false,
      };

      addWall(wall);

      // Stay in drawing mode — start a new wall from the end point
      // so the user can chain walls
      setWallDraftPoints([snappedX, snappedY]);
    },
    [
      activeTool,
      isDrawingWall,
      wallDraftPoints,
      gridSize,
      setIsDrawingWall,
      setWallDraftPoints,
      addWall,
    ]
  );

  const handleCanvasDoubleClick = useCallback(() => {
    if (activeTool !== 'wall' || !isDrawingWall) return;
    // Double-click finishes drawing — stop chaining
    clearWallDraft();
  }, [activeTool, isDrawingWall, clearWallDraft]);

  return {
    handleCanvasClick,
    handleCanvasDoubleClick,
    isDrawingWall,
    wallDraftPoints,
  };
}
