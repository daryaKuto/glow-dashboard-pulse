import React, { useRef, useCallback, useMemo, useState } from 'react';
import { Stage, Layer, Line, Circle } from 'react-konva';
import type Konva from 'konva';
import { useRoomEditorStore } from './hooks/use-room-editor-store';
import { useWallDrawing } from './hooks/use-wall-drawing';
import { useSnapToWall } from './hooks/use-snap-to-wall';
import GridLayer from './layers/GridLayer';
import WallShape from './shapes/WallShape';
import DoorShape from './shapes/DoorShape';
import WindowShape from './shapes/WindowShape';
import TargetShape from './shapes/TargetShape';
import { EDITOR_COLORS, MIN_ZOOM, MAX_ZOOM } from './lib/constants';
import { snapToGrid } from './lib/geometry';
import type { DoorData, WindowData } from './lib/types';

interface EditorCanvasProps {
  containerWidth: number;
  containerHeight: number;
}

const EditorCanvas: React.FC<EditorCanvasProps> = ({
  containerWidth,
  containerHeight,
}) => {
  const stageRef = useRef<Konva.Stage>(null);
  // Track mouse position for wall preview line
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);

  // Store state
  const walls = useRoomEditorStore((s) => s.walls);
  const doors = useRoomEditorStore((s) => s.doors);
  const windows = useRoomEditorStore((s) => s.windows);
  const targets = useRoomEditorStore((s) => s.targets);
  const canvasWidth = useRoomEditorStore((s) => s.canvasWidth);
  const canvasHeight = useRoomEditorStore((s) => s.canvasHeight);
  const gridSize = useRoomEditorStore((s) => s.gridSize);
  const stageScale = useRoomEditorStore((s) => s.stageScale);
  const stagePosition = useRoomEditorStore((s) => s.stagePosition);
  const selectedIds = useRoomEditorStore((s) => s.selectedIds);
  const activeTool = useRoomEditorStore((s) => s.activeTool);
  const hoveredId = useRoomEditorStore((s) => s.hoveredId);

  const setSelectedIds = useRoomEditorStore((s) => s.setSelectedIds);
  const clearSelection = useRoomEditorStore((s) => s.clearSelection);
  const setStageScale = useRoomEditorStore((s) => s.setStageScale);
  const setStagePosition = useRoomEditorStore((s) => s.setStagePosition);
  const updateWall = useRoomEditorStore((s) => s.updateWall);
  const updateTarget = useRoomEditorStore((s) => s.updateTarget);
  const addDoor = useRoomEditorStore((s) => s.addDoor);
  const addWindow = useRoomEditorStore((s) => s.addWindow);
  const deleteSelected = useRoomEditorStore((s) => s.deleteSelected);

  const { handleCanvasClick, handleCanvasDoubleClick, isDrawingWall, wallDraftPoints } =
    useWallDrawing();
  const { snapToWall } = useSnapToWall();

  // Wall map for door/window lookup
  const wallMap = useMemo(
    () => new Map(walls.map((w) => [w.id, w])),
    [walls]
  );

  // Selection handler
  const handleSelect = useCallback(
    (id: string) => {
      if (activeTool === 'delete') {
        setSelectedIds([id]);
        deleteSelected();
        return;
      }
      if (activeTool !== 'select') return;
      setSelectedIds([id]);
    },
    [activeTool, setSelectedIds, deleteSelected]
  );

  // Corner drag handler for walls
  const handleCornerDrag = useCallback(
    (wallId: string, pointIndex: number, x: number, y: number) => {
      const wall = wallMap.get(wallId);
      if (!wall) return;
      const newPoints = [...wall.points];
      newPoints[pointIndex] = x;
      newPoints[pointIndex + 1] = y;
      updateWall(wallId, { points: newPoints });
    },
    [wallMap, updateWall]
  );

  // Target drag handler
  const handleTargetDragEnd = useCallback(
    (id: string, x: number, y: number) => {
      updateTarget(id, { x, y });
    },
    [updateTarget]
  );

  // Mouse move — track cursor for wall preview line
  const handleMouseMove = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      if (activeTool !== 'wall' || !isDrawingWall) {
        if (cursorPos) setCursorPos(null);
        return;
      }
      const stage = e.target.getStage();
      if (!stage) return;
      const pointer = stage.getRelativePointerPosition();
      if (!pointer) return;
      setCursorPos({
        x: snapToGrid(pointer.x, gridSize),
        y: snapToGrid(pointer.y, gridSize),
      });
    },
    [activeTool, isDrawingWall, gridSize, cursorPos]
  );

  // Stage click — route to appropriate tool handler
  const handleStageClick = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      const isStageBackground = e.target === e.target.getStage();

      // Wall tool — always forward clicks (both on background and shapes)
      if (activeTool === 'wall') {
        handleCanvasClick(e);
        return;
      }

      // Door/window tool — only on background, needs a wall nearby
      if (isStageBackground && (activeTool === 'door' || activeTool === 'window')) {
        const stage = e.target.getStage();
        if (!stage) return;
        const pointer = stage.getRelativePointerPosition();
        if (!pointer) return;
        const snap = snapToWall(pointer);
        if (!snap) return;

        if (activeTool === 'door') {
          const door: DoorData = {
            id: crypto.randomUUID(),
            wallId: snap.wallId,
            positionOnWall: snap.positionOnWall,
            segmentIndex: snap.segmentIndex,
            width: 3,
            swingDirection: 'inward',
            swingAngle: 90,
            hingeSide: 'left',
            type: 'single',
          };
          addDoor(door);
        } else {
          const win: WindowData = {
            id: crypto.randomUUID(),
            wallId: snap.wallId,
            positionOnWall: snap.positionOnWall,
            segmentIndex: snap.segmentIndex,
            width: 3,
            type: 'single',
          };
          addWindow(win);
        }
        return;
      }

      // Select/default — deselect on background click
      if (isStageBackground) {
        clearSelection();
      }
    },
    [activeTool, handleCanvasClick, clearSelection, snapToWall, addDoor, addWindow]
  );

  // Zoom on wheel
  const handleWheel = useCallback(
    (e: Konva.KonvaEventObject<WheelEvent>) => {
      e.evt.preventDefault();
      const stage = stageRef.current;
      if (!stage) return;

      const scaleBy = 1.08;
      const oldScale = stageScale;
      const pointer = stage.getPointerPosition();
      if (!pointer) return;

      const mousePointTo = {
        x: (pointer.x - stagePosition.x) / oldScale,
        y: (pointer.y - stagePosition.y) / oldScale,
      };

      const direction = e.evt.deltaY > 0 ? -1 : 1;
      const newScale = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, oldScale * scaleBy ** direction));

      setStageScale(newScale);
      setStagePosition({
        x: pointer.x - mousePointTo.x * newScale,
        y: pointer.y - mousePointTo.y * newScale,
      });
    },
    [stageScale, stagePosition, setStageScale, setStagePosition]
  );

  // Build wall preview line points (from start point to cursor)
  const previewLinePoints = useMemo(() => {
    if (!isDrawingWall || wallDraftPoints.length < 2 || !cursorPos) return null;
    return [wallDraftPoints[0], wallDraftPoints[1], cursorPos.x, cursorPos.y];
  }, [isDrawingWall, wallDraftPoints, cursorPos]);

  // Cursor style
  const cursorStyle = activeTool === 'wall' ? 'crosshair' : activeTool === 'delete' ? 'not-allowed' : 'default';

  return (
    <Stage
      ref={stageRef}
      width={containerWidth}
      height={containerHeight}
      scaleX={stageScale}
      scaleY={stageScale}
      x={stagePosition.x}
      y={stagePosition.y}
      onClick={handleStageClick}
      onDblClick={handleCanvasDoubleClick}
      onMouseMove={handleMouseMove}
      onWheel={handleWheel}
      draggable={activeTool === 'select' && selectedIds.length === 0}
      onDragEnd={(e) => {
        if (e.target === stageRef.current) {
          setStagePosition(e.target.position());
        }
      }}
      style={{ backgroundColor: EDITOR_COLORS.canvasBackground, cursor: cursorStyle, touchAction: 'none' }}
    >
      {/* Grid layer — static, non-interactive */}
      <GridLayer width={canvasWidth} height={canvasHeight} gridSize={gridSize} />

      {/* Elements layer — walls, doors, windows, targets */}
      <Layer>
        {/* Walls */}
        {walls.map((wall) => (
          <WallShape
            key={wall.id}
            wall={wall}
            isSelected={selectedIds.includes(wall.id)}
            isHovered={hoveredId === wall.id}
            gridSize={gridSize}
            onSelect={handleSelect}
            onCornerDrag={handleCornerDrag}
          />
        ))}

        {/* Doors */}
        {doors.map((door) => (
          <DoorShape
            key={door.id}
            door={door}
            wall={wallMap.get(door.wallId)}
            isSelected={selectedIds.includes(door.id)}
            gridSize={gridSize}
            onSelect={handleSelect}
          />
        ))}

        {/* Windows */}
        {windows.map((win) => (
          <WindowShape
            key={win.id}
            window={win}
            wall={wallMap.get(win.wallId)}
            isSelected={selectedIds.includes(win.id)}
            gridSize={gridSize}
            onSelect={handleSelect}
          />
        ))}

        {/* Targets */}
        {targets.map((target) => (
          <TargetShape
            key={target.id}
            target={target}
            isSelected={selectedIds.includes(target.id)}
            gridSize={gridSize}
            onSelect={handleSelect}
            onDragEnd={handleTargetDragEnd}
          />
        ))}

        {/* Wall preview line — dashed line from start point to cursor */}
        {previewLinePoints && (
          <Line
            points={previewLinePoints}
            stroke={EDITOR_COLORS.wallDraftStroke}
            strokeWidth={3}
            lineCap="round"
            lineJoin="round"
            dash={[8, 6]}
            listening={false}
          />
        )}

        {/* Start point indicator — small circle at the first click */}
        {isDrawingWall && wallDraftPoints.length >= 2 && (
          <Circle
            x={wallDraftPoints[0]}
            y={wallDraftPoints[1]}
            radius={5}
            fill={EDITOR_COLORS.wallDraftStroke}
            stroke="#FFFFFF"
            strokeWidth={2}
            listening={false}
          />
        )}

        {/* Cursor snap indicator — show where the next point will be placed */}
        {isDrawingWall && cursorPos && (
          <Circle
            x={cursorPos.x}
            y={cursorPos.y}
            radius={4}
            fill="transparent"
            stroke={EDITOR_COLORS.wallDraftStroke}
            strokeWidth={1.5}
            dash={[3, 3]}
            listening={false}
          />
        )}
      </Layer>
    </Stage>
  );
};

export default EditorCanvas;
