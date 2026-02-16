import React from 'react';
import { Group, Line, Arc, Rect } from 'react-konva';
import type Konva from 'konva';
import type { DoorData, WallData } from '../lib/types';
import { EDITOR_COLORS, WALL_STROKE_WIDTH } from '../lib/constants';
import { getPositionOnWall } from '../lib/geometry';

interface DoorShapeProps {
  door: DoorData;
  wall: WallData | undefined;
  isSelected: boolean;
  gridSize: number;
  onSelect: (id: string, e: Konva.KonvaEventObject<MouseEvent>) => void;
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
  const wallThick = wall.thickness || WALL_STROKE_WIDTH;

  // Door gap spans from hinge point (0) to end of door opening along the wall
  const gapStart = Math.min(0, hingeDir * doorWidthPx);
  const gapLength = Math.abs(doorWidthPx);

  return (
    <Group
      x={point.x}
      y={point.y}
      rotation={rotation}
      onClick={(e) => onSelect(door.id, e)}
      onTap={(e) => onSelect(door.id, e as unknown as Konva.KonvaEventObject<MouseEvent>)}
    >
      {/* Wall gap — canvas-colored rect to mask the wall underneath */}
      <Rect
        x={0}
        y={gapStart}
        width={wallThick + 2}
        height={gapLength}
        offsetX={(wallThick + 2) / 2}
        fill={EDITOR_COLORS.canvasBackground}
        listening={false}
      />

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
