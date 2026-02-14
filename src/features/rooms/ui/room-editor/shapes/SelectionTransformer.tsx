import React, { useEffect, useRef } from 'react';
import { Transformer } from 'react-konva';
import type Konva from 'konva';
import { EDITOR_COLORS } from '../lib/constants';

interface SelectionTransformerProps {
  selectedNodes: Konva.Node[];
}

const SelectionTransformer: React.FC<SelectionTransformerProps> = ({
  selectedNodes,
}) => {
  const trRef = useRef<Konva.Transformer>(null);

  useEffect(() => {
    if (trRef.current) {
      trRef.current.nodes(selectedNodes);
      trRef.current.getLayer()?.batchDraw();
    }
  }, [selectedNodes]);

  if (selectedNodes.length === 0) return null;

  return (
    <Transformer
      ref={trRef}
      anchorStroke={EDITOR_COLORS.transformerAnchorStroke}
      anchorFill={EDITOR_COLORS.transformerAnchorFill}
      anchorSize={8}
      borderStroke={EDITOR_COLORS.selectionStroke}
      borderDash={[4, 4]}
      rotateEnabled={true}
      enabledAnchors={['middle-left', 'middle-right']}
      boundBoxFunc={(oldBox, newBox) => {
        // Limit minimum size
        if (newBox.width < 10 || newBox.height < 10) return oldBox;
        return newBox;
      }}
    />
  );
};

export default SelectionTransformer;
