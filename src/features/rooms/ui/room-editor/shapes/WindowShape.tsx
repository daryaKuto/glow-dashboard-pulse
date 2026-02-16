import React from 'react';
import { Group, Line, Rect } from 'react-konva';
import type Konva from 'konva';
import type { WindowData, WallData } from '../lib/types';
import { EDITOR_COLORS, WALL_STROKE_WIDTH } from '../lib/constants';
import { getPositionOnWall } from '../lib/geometry';

interface WindowShapeProps {
  window: WindowData;
  wall: WallData | undefined;
  isSelected: boolean;
  gridSize: number;
  onSelect: (id: string, e: Konva.KonvaEventObject<MouseEvent>) => void;
}

const WindowShape: React.FC<WindowShapeProps> = ({
  window: win,
  wall,
  isSelected,
  gridSize,
  onSelect,
}) => {
  if (!wall) return null;

  const { point, angle } = getPositionOnWall(wall, win.segmentIndex, win.positionOnWall);
  const windowWidthPx = win.width * gridSize;
  const rotation = (angle * 180) / Math.PI;
  const halfWidth = windowWidthPx / 2;
  const wallThick = wall.thickness || WALL_STROKE_WIDTH;
  const frameSpread = wallThick / 2 + 2; // frame lines sit just outside wall edges
  const strokeColor = isSelected ? EDITOR_COLORS.wallSelectedStroke : EDITOR_COLORS.windowStroke;

  return (
    <Group
      x={point.x}
      y={point.y}
      rotation={rotation}
      onClick={(e) => onSelect(win.id, e)}
      onTap={(e) => onSelect(win.id, e as unknown as Konva.KonvaEventObject<MouseEvent>)}
    >
      {/* Wall gap — canvas-colored rect to mask the wall underneath */}
      <Rect
        x={-halfWidth}
        y={-(wallThick / 2 + 1)}
        width={windowWidthPx}
        height={wallThick + 2}
        fill={EDITOR_COLORS.canvasBackground}
        listening={false}
      />
      {/* Frame — outer parallel lines, spread beyond wall thickness */}
      <Line
        points={[-halfWidth, -frameSpread, halfWidth, -frameSpread]}
        stroke={strokeColor}
        strokeWidth={2.5}
        lineCap="round"
      />
      <Line
        points={[-halfWidth, frameSpread, halfWidth, frameSpread]}
        stroke={strokeColor}
        strokeWidth={2.5}
        lineCap="round"
      />
      {/* Glass — center line */}
      <Line
        points={[-halfWidth, 0, halfWidth, 0]}
        stroke={strokeColor}
        strokeWidth={1}
        opacity={0.4}
      />
    </Group>
  );
};

export default React.memo(WindowShape);
