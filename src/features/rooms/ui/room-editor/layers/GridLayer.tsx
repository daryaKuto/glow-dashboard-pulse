import React, { useMemo } from 'react';
import { Layer, Line } from 'react-konva';
import { EDITOR_COLORS } from '../lib/constants';

interface GridLayerProps {
  width: number;
  height: number;
  gridSize: number;
  stageScale: number;
  stagePosition: { x: number; y: number };
}

const GridLayer: React.FC<GridLayerProps> = ({ width, height, gridSize, stageScale, stagePosition }) => {
  const lines = useMemo(() => {
    const result: Array<{ key: string; points: number[] }> = [];

    // Convert visible viewport bounds to canvas coordinates (accounting for zoom/pan)
    const visibleLeft = -stagePosition.x / stageScale;
    const visibleTop = -stagePosition.y / stageScale;
    const visibleRight = visibleLeft + width / stageScale;
    const visibleBottom = visibleTop + height / stageScale;

    // Snap to grid boundaries with padding
    const startX = Math.floor(visibleLeft / gridSize) * gridSize - gridSize;
    const endX = Math.ceil(visibleRight / gridSize) * gridSize + gridSize;
    const startY = Math.floor(visibleTop / gridSize) * gridSize - gridSize;
    const endY = Math.ceil(visibleBottom / gridSize) * gridSize + gridSize;

    // Vertical lines
    for (let x = startX; x <= endX; x += gridSize) {
      result.push({
        key: `v-${x}`,
        points: [x, startY, x, endY],
      });
    }

    // Horizontal lines
    for (let y = startY; y <= endY; y += gridSize) {
      result.push({
        key: `h-${y}`,
        points: [startX, y, endX, y],
      });
    }

    return result;
  }, [width, height, gridSize, stageScale, stagePosition]);

  return (
    <Layer listening={false}>
      {lines.map((line) => (
        <Line
          key={line.key}
          points={line.points}
          stroke={EDITOR_COLORS.gridStroke}
          strokeWidth={1}
          listening={false}
        />
      ))}
    </Layer>
  );
};

export default React.memo(GridLayer);
