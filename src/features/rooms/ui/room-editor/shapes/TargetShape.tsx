import React from 'react';
import { Group, Circle, Line, Text } from 'react-konva';
import type { PlacedTargetData } from '../lib/types';
import { TARGET_RADIUS, TARGET_LABEL_OFFSET, EDITOR_COLORS } from '../lib/constants';
import { snapToGrid } from '../lib/geometry';

interface TargetShapeProps {
  target: PlacedTargetData;
  isSelected: boolean;
  gridSize: number;
  onSelect: (id: string) => void;
  onDragEnd: (id: string, x: number, y: number) => void;
}

const TargetShape: React.FC<TargetShapeProps> = ({
  target,
  isSelected,
  gridSize,
  onSelect,
  onDragEnd,
}) => {
  const r = TARGET_RADIUS;

  return (
    <Group
      x={target.x}
      y={target.y}
      rotation={target.rotation}
      draggable
      onClick={() => onSelect(target.id)}
      onTap={() => onSelect(target.id)}
      onDragEnd={(e) => {
        const pos = e.target.position();
        const snappedX = snapToGrid(pos.x, gridSize);
        const snappedY = snapToGrid(pos.y, gridSize);
        e.target.position({ x: snappedX, y: snappedY });
        onDragEnd(target.id, snappedX, snappedY);
      }}
    >
      {/* Outer circle */}
      <Circle
        radius={r}
        fill={EDITOR_COLORS.targetFill}
        stroke={isSelected ? EDITOR_COLORS.selectionStroke : EDITOR_COLORS.targetStroke}
        strokeWidth={isSelected ? 2 : 1.5}
      />

      {/* Crosshair — horizontal */}
      <Line
        points={[-r * 0.6, 0, -2, 0]}
        stroke={EDITOR_COLORS.targetStroke}
        strokeWidth={1}
      />
      <Line
        points={[2, 0, r * 0.6, 0]}
        stroke={EDITOR_COLORS.targetStroke}
        strokeWidth={1}
      />

      {/* Crosshair — vertical */}
      <Line
        points={[0, -r * 0.6, 0, -2]}
        stroke={EDITOR_COLORS.targetStroke}
        strokeWidth={1}
      />
      <Line
        points={[0, 2, 0, r * 0.6]}
        stroke={EDITOR_COLORS.targetStroke}
        strokeWidth={1}
      />

      {/* Center dot */}
      <Circle
        radius={2}
        fill={EDITOR_COLORS.targetCenterDot}
      />

      {/* Label */}
      <Text
        text={target.label}
        x={-40}
        y={TARGET_LABEL_OFFSET}
        width={80}
        align="center"
        fontFamily="Raleway"
        fontSize={10}
        fill={EDITOR_COLORS.targetLabelColor}
      />
    </Group>
  );
};

export default React.memo(TargetShape);
