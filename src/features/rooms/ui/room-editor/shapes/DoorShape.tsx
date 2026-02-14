import React from 'react';
import { Group, Line, Arc } from 'react-konva';
import type { DoorData, WallData } from '../lib/types';
import { EDITOR_COLORS, DEFAULT_GRID_SIZE } from '../lib/constants';
import { getPositionOnWall } from '../lib/geometry';

interface DoorShapeProps {
  door: DoorData;
  wall: WallData | undefined;
  isSelected: boolean;
  gridSize: number;
  onSelect: (id: string) => void;
}

const DoorShape: React.FC<DoorShapeProps> = ({
  door,
  wall,
  isSelected,
  gridSize,
  onSelect,
}) => {
  if (!wall) return null;

  const { point, angle } = getPositionOnWall(wall, door.segmentIndex, door.positionOnWall);
  const doorWidthPx = door.width * gridSize;
  const rotation = (angle * 180) / Math.PI;
  const hingeDir = door.hingeSide === 'left' ? -1 : 1;
  const swingDir = door.swingDirection === 'inward' ? 1 : -1;

  return (
    <Group
      x={point.x}
      y={point.y}
      rotation={rotation}
      onClick={() => onSelect(door.id)}
      onTap={() => onSelect(door.id)}
    >
      {/* Door leaf */}
      <Line
        points={[
          0, 0,
          0, hingeDir * doorWidthPx,
        ]}
        stroke={isSelected ? EDITOR_COLORS.wallSelectedStroke : EDITOR_COLORS.doorStroke}
        strokeWidth={2}
        lineCap="round"
      />

      {/* Swing arc */}
      <Arc
        x={0}
        y={0}
        innerRadius={doorWidthPx - 2}
        outerRadius={doorWidthPx}
        angle={door.swingAngle}
        rotation={hingeDir === -1 ? -door.swingAngle : 0}
        stroke={EDITOR_COLORS.doorArcStroke}
        strokeWidth={1}
        dash={EDITOR_COLORS.doorArcDash as unknown as number[]}
        fill="transparent"
      />
    </Group>
  );
};

export default React.memo(DoorShape);
