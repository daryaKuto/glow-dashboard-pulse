import React, { useRef, useCallback, useMemo, useState } from 'react';
import { toast } from '@/components/ui/sonner';
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
  const gridSize = useRoomEditorStore((s) => s.gridSize);
  const stageScale = useRoomEditorStore((s) => s.stageScale);
  const stagePosition = useRoomEditorStore((s) => s.stagePosition);
  const selectedIds = useRoomEditorStore((s) => s.selectedIds);
  const activeTool = useRoomEditorStore((s) => s.activeTool);
  const hoveredId = useRoomEditorStore((s) => s.hoveredId);

  const setSelectedIds = useRoomEditorStore((s) => s.setSelectedIds);
  const toggleSelection = useRoomEditorStore((s) => s.toggleSelection);
  const clearSelection = useRoomEditorStore((s) => s.clearSelection);
  const setStageScale = useRoomEditorStore((s) => s.setStageScale);
  const setStagePosition = useRoomEditorStore((s) => s.setStagePosition);
  const updateWall = useRoomEditorStore((s) => s.updateWall);
  const updateTarget = useRoomEditorStore((s) => s.updateTarget);
  const addDoor = useRoomEditorStore((s) => s.addDoor);
  const addWindow = useRoomEditorStore((s) => s.addWindow);
  const deleteSelected = useRoomEditorStore((s) => s.deleteSelected);
  const moveSelected = useRoomEditorStore((s) => s.moveSelected);

  // Move tool drag state — live offset for smooth visual feedback
  const dragAnchor = useRef<{ x: number; y: number } | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isMouseDownDragging, setIsMouseDownDragging] = useState(false);
  const isDraggingGroup = dragOffset.x !== 0 || dragOffset.y !== 0;

  const { handleCanvasClick, handleCanvasDoubleClick, isDrawingWall, wallDraftPoints } =
    useWallDrawing();
  const { snapToWall } = useSnapToWall();

  // Wall map for door/window lookup
  const wallMap = useMemo(
    () => new Map(walls.map((w) => [w.id, w])),
    [walls]
  );

  // Selection handler — supports shift-click multi-select for select & move tools
  const handleSelect = useCallback(
    (id: string, e: Konva.KonvaEventObject<MouseEvent>) => {
      if (activeTool === 'delete') {
        setSelectedIds([id]);
        deleteSelected();
        return;
      }
      if (activeTool !== 'select' && activeTool !== 'move') return;
      if (e.evt.shiftKey) {
        toggleSelection(id);
      } else {
        setSelectedIds([id]);
      }
    },
    [activeTool, setSelectedIds, toggleSelection, deleteSelected]
  );

  // Corner drag handler for walls
  // Closed 4-point walls (pre-built rooms) use proportional resize:
  // the opposite corner stays fixed, adjacent corners adjust to keep rectangle shape.
  // Open walls use independent point dragging.
  const handleCornerDrag = useCallback(
    (wallId: string, pointIndex: number, x: number, y: number) => {
      const wall = wallMap.get(wallId);
      if (!wall) return;
      const newPoints = [...wall.points];

      // Closed 4-point wall = rectangle → proportional resize
      if (wall.closed && wall.points.length === 8) {
        const cornerIdx = pointIndex / 2; // 0, 1, 2, or 3
        // Corner layout: 0=TL, 1=TR, 2=BR, 3=BL
        // Dragging corner i: opposite (i+2)%4 stays fixed,
        // adjacent corners share one coordinate with dragged and one with opposite.
        const oppositeIdx = (cornerIdx + 2) % 4;
        const adjCW = (cornerIdx + 1) % 4;   // clockwise neighbor
        const adjCCW = (cornerIdx + 3) % 4;  // counter-clockwise neighbor

        // Set dragged corner
        newPoints[cornerIdx * 2] = x;
        newPoints[cornerIdx * 2 + 1] = y;

        // Clockwise neighbor shares x with dragged corner's "other axis"
        // For TL(0)→TR(1)→BR(2)→BL(3):
        //   TL & BL share x, TR & BR share x
        //   TL & TR share y, BL & BR share y
        // adjCW gets: x from the axis it doesn't share with dragged, y from the axis it does
        // Simpler: adjCW shares one axis with dragged, one with opposite
        if (cornerIdx === 0 || cornerIdx === 2) {
          // Dragging TL or BR
          // adjCW (TR or BL): x from dragged row-partner → actually:
          // TL drag → adjCW=TR: TR.x stays (same as opposite BR), TR.y = TL.y (dragged)
          // BR drag → adjCW=BL: BL.x stays (same as opposite TL), BL.y = BR.y (dragged)
          newPoints[adjCW * 2] = newPoints[oppositeIdx * 2]; // x from opposite
          newPoints[adjCW * 2 + 1] = y;                       // y from dragged
          newPoints[adjCCW * 2] = x;                           // x from dragged
          newPoints[adjCCW * 2 + 1] = newPoints[oppositeIdx * 2 + 1]; // y from opposite
        } else {
          // Dragging TR or BL
          // TR drag → adjCW=BR: BR.x = TR.x (dragged), BR.y stays (same as opposite BL)
          // BL drag → adjCW=TL: TL.x = BL.x (dragged), TL.y stays (same as opposite TR)
          newPoints[adjCW * 2] = x;                           // x from dragged
          newPoints[adjCW * 2 + 1] = newPoints[oppositeIdx * 2 + 1]; // y from opposite
          newPoints[adjCCW * 2] = newPoints[oppositeIdx * 2]; // x from opposite
          newPoints[adjCCW * 2 + 1] = y;                       // y from dragged
        }
      } else {
        // Open wall — independent point dragging
        newPoints[pointIndex] = x;
        newPoints[pointIndex + 1] = y;
      }

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

  // Mouse move — track cursor for wall preview + live move offset
  const handleMouseMove = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      // Move tool — update live drag offset for smooth visual feedback
      if (dragAnchor.current) {
        const stage = e.target.getStage();
        if (!stage) return;
        const pointer = stage.getRelativePointerPosition();
        if (!pointer) return;
        const rawDx = pointer.x - dragAnchor.current.x;
        const rawDy = pointer.y - dragAnchor.current.y;
        setDragOffset({
          x: snapToGrid(rawDx, gridSize),
          y: snapToGrid(rawDy, gridSize),
        });
        return;
      }

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

  // Move tool — mousedown to start drag
  const handleMouseDown = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      if (activeTool !== 'move' || selectedIds.length === 0) return;
      const isStageBackground = e.target === e.target.getStage();
      if (isStageBackground) return;
      const stage = e.target.getStage();
      if (!stage) return;
      const pointer = stage.getRelativePointerPosition();
      if (!pointer) return;
      dragAnchor.current = { x: pointer.x, y: pointer.y };
      setDragOffset({ x: 0, y: 0 });
      setIsMouseDownDragging(true);
    },
    [activeTool, selectedIds.length]
  );

  // Move tool — mouseup to commit the move
  const handleMouseUp = useCallback(
    () => {
      if (!dragAnchor.current) return;
      const dx = dragOffset.x;
      const dy = dragOffset.y;
      dragAnchor.current = null;
      setDragOffset({ x: 0, y: 0 });
      setIsMouseDownDragging(false);
      if (dx !== 0 || dy !== 0) {
        moveSelected(dx, dy);
      }
    },
    [dragOffset, moveSelected]
  );

  // Compute offset-adjusted data for selected elements during drag
  const selSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const displayWalls = useMemo(() => {
    if (!isDraggingGroup) return walls;
    return walls.map((w) => {
      if (!selSet.has(w.id)) return w;
      return {
        ...w,
        points: w.points.map((v, i) => v + (i % 2 === 0 ? dragOffset.x : dragOffset.y)),
      };
    });
  }, [walls, isDraggingGroup, selSet, dragOffset]);

  const displayTargets = useMemo(() => {
    if (!isDraggingGroup) return targets;
    return targets.map((t) => {
      if (!selSet.has(t.id)) return t;
      return { ...t, x: t.x + dragOffset.x, y: t.y + dragOffset.y };
    });
  }, [targets, isDraggingGroup, selSet, dragOffset]);

  // Wall map uses displayWalls so doors/windows on moved walls render correctly
  const displayWallMap = useMemo(
    () => new Map(displayWalls.map((w) => [w.id, w])),
    [displayWalls]
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

      // Door/window tool — clicks anywhere (including on walls) snap to nearest wall
      if (activeTool === 'door' || activeTool === 'window') {
        const stage = e.target.getStage();
        if (!stage) return;
        const pointer = stage.getRelativePointerPosition();
        if (!pointer) return;
        const snap = snapToWall(pointer);
        if (!snap) {
          if (walls.length === 0) {
            toast.info(`Draw a wall first — ${activeTool}s are placed on walls.`);
          } else {
            toast.info(`Click closer to a wall to place the ${activeTool}.`);
          }
          return;
        }

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

      // Select/Move — deselect on background click
      if (isStageBackground && (activeTool === 'select' || activeTool === 'move')) {
        clearSelection();
      }
    },
    [activeTool, handleCanvasClick, clearSelection, snapToWall, addDoor, addWindow, walls]
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
  const cursorStyle =
    activeTool === 'wall' ? 'crosshair'
    : activeTool === 'delete' ? 'not-allowed'
    : activeTool === 'move' ? (isMouseDownDragging ? 'grabbing' : 'grab')
    : 'default';

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
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onWheel={handleWheel}
      draggable={activeTool === 'select' && selectedIds.length === 0}
      onDragEnd={(e) => {
        if (e.target === stageRef.current) {
          setStagePosition(e.target.position());
        }
      }}
      style={{ backgroundColor: EDITOR_COLORS.canvasBackground, cursor: cursorStyle, touchAction: 'none' }}
    >
      {/* Grid layer — covers full visible viewport, accounts for zoom/pan */}
      <GridLayer width={containerWidth} height={containerHeight} gridSize={gridSize} stageScale={stageScale} stagePosition={stagePosition} />

      {/* Elements layer — walls, doors, windows, targets */}
      <Layer>
        {/* Walls — use displayWalls for live drag offset */}
        {displayWalls.map((wall) => (
          <WallShape
            key={wall.id}
            wall={wall}
            isSelected={selSet.has(wall.id)}
            isHovered={hoveredId === wall.id}
            gridSize={gridSize}
            onSelect={handleSelect}
            onCornerDrag={handleCornerDrag}
          />
        ))}

        {/* Doors — use displayWallMap so doors follow moved walls */}
        {doors.map((door) => (
          <DoorShape
            key={door.id}
            door={door}
            wall={displayWallMap.get(door.wallId)}
            isSelected={selSet.has(door.id)}
            gridSize={gridSize}
            onSelect={handleSelect}
          />
        ))}

        {/* Windows — use displayWallMap so windows follow moved walls */}
        {windows.map((win) => (
          <WindowShape
            key={win.id}
            window={win}
            wall={displayWallMap.get(win.wallId)}
            isSelected={selSet.has(win.id)}
            gridSize={gridSize}
            onSelect={handleSelect}
          />
        ))}

        {/* Targets — use displayTargets for live drag offset */}
        {displayTargets.map((target) => (
          <TargetShape
            key={target.id}
            target={target}
            isSelected={selSet.has(target.id)}
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
