import React, { useMemo } from 'react';
import { Layer, Line } from 'react-konva';
import { EDITOR_COLORS } from '../lib/constants';

interface GridLayerProps {
  width: number;
  height: number;
  gridSize: number;
}

const GridLayer: React.FC<GridLayerProps> = ({ width, height, gridSize }) => {
  const lines = useMemo(() => {
    const result: Array<{ key: string; points: number[] }> = [];

    // Vertical lines
    for (let x = 0; x <= width; x += gridSize) {
      result.push({
        key: `v-${x}`,
        points: [x, 0, x, height],
      });
    }

    // Horizontal lines
    for (let y = 0; y <= height; y += gridSize) {
      result.push({
        key: `h-${y}`,
        points: [0, y, width, y],
      });
    }

    return result;
  }, [width, height, gridSize]);

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
