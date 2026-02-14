import React from 'react';
import { Group, Line } from 'react-konva';
import type { WindowData, WallData } from '../lib/types';
import { EDITOR_COLORS } from '../lib/constants';
import { getPositionOnWall } from '../lib/geometry';

interface WindowShapeProps {
  window: WindowData;
  wall: WallData | undefined;
  isSelected: boolean;
  gridSize: number;
  onSelect: (id: string) => void;
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
  const strokeColor = isSelected ? EDITOR_COLORS.wallSelectedStroke : EDITOR_COLORS.windowStroke;

  return (
    <Group
      x={point.x}
      y={point.y}
      rotation={rotation}
      onClick={() => onSelect(win.id)}
      onTap={() => onSelect(win.id)}
    >
      {/* Frame — outer parallel lines */}
      <Line
        points={[-halfWidth, -3, halfWidth, -3]}
        stroke={strokeColor}
        strokeWidth={1.5}
      />
      <Line
        points={[-halfWidth, 3, halfWidth, 3]}
        stroke={strokeColor}
        strokeWidth={1.5}
      />
      {/* Glass — center line */}
      <Line
        points={[-halfWidth, 0, halfWidth, 0]}
        stroke={strokeColor}
        strokeWidth={0.5}
        opacity={0.5}
      />
    </Group>
  );
};

export default React.memo(WindowShape);
