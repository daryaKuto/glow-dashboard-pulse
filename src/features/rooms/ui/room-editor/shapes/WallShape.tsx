import React from 'react';
import { Line, Circle, Group } from 'react-konva';
import type { WallData } from '../lib/types';
import {
  WALL_STROKE_WIDTH,
  WALL_HIT_STROKE_WIDTH,
  CORNER_ANCHOR_RADIUS,
  EDITOR_COLORS,
} from '../lib/constants';
import { snapToGrid } from '../lib/geometry';

interface WallShapeProps {
  wall: WallData;
  isSelected: boolean;
  isHovered: boolean;
  gridSize: number;
  onSelect: (id: string) => void;
  onCornerDrag: (wallId: string, pointIndex: number, x: number, y: number) => void;
}

const WallShape: React.FC<WallShapeProps> = ({
  wall,
  isSelected,
  isHovered,
  gridSize,
  onSelect,
  onCornerDrag,
}) => {
  const strokeColor = isSelected
    ? EDITOR_COLORS.wallSelectedStroke
    : EDITOR_COLORS.wallStroke;

  // Extract corner points for anchors
  const corners: Array<{ x: number; y: number; idx: number }> = [];
  for (let i = 0; i < wall.points.length; i += 2) {
    corners.push({ x: wall.points[i], y: wall.points[i + 1], idx: i });
  }

  return (
    <Group>
      {/* Main wall line */}
      <Line
        points={wall.points}
        closed={wall.closed}
        stroke={strokeColor}
        strokeWidth={wall.thickness || WALL_STROKE_WIDTH}
        lineCap="round"
        lineJoin="round"
        hitStrokeWidth={WALL_HIT_STROKE_WIDTH}
        onClick={() => onSelect(wall.id)}
        onTap={() => onSelect(wall.id)}
      />

      {/* Hover highlight */}
      {isHovered && !isSelected && (
        <Line
          points={wall.points}
          closed={wall.closed}
          stroke={EDITOR_COLORS.wallSelectedStroke}
          strokeWidth={(wall.thickness || WALL_STROKE_WIDTH) + 2}
          lineCap="round"
          lineJoin="round"
          opacity={0.3}
          listening={false}
        />
      )}

      {/* Corner anchors — visible when selected */}
      {isSelected &&
        corners.map((corner) => (
          <Circle
            key={`anchor-${wall.id}-${corner.idx}`}
            x={corner.x}
            y={corner.y}
            radius={CORNER_ANCHOR_RADIUS}
            fill={EDITOR_COLORS.cornerAnchorFill}
            stroke={EDITOR_COLORS.cornerAnchorSelectedStroke}
            strokeWidth={2}
            draggable
            onDragMove={(e) => {
              const pos = e.target.position();
              const snappedX = snapToGrid(pos.x, gridSize);
              const snappedY = snapToGrid(pos.y, gridSize);
              e.target.position({ x: snappedX, y: snappedY });
              onCornerDrag(wall.id, corner.idx, snappedX, snappedY);
            }}
          />
        ))}
    </Group>
  );
};

export default React.memo(WallShape);
