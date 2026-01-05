
import React from 'react';
import { useRoomDesigner } from '@/state/useRoomDesigner';
import { useLocation } from 'react-router-dom';
import TargetIcon from '@/pages/targets/TargetIcon';
import type { Target } from '@/features/targets/schema';

interface PalettePanelProps {
  targets: Target[];
}

const PalettePanel: React.FC<PalettePanelProps> = ({ targets }) => {
  const location = useLocation();
  // TODO: Get proper token from auth context
  const token = ''; // We need to implement proper token handling
  const { layout, moveTarget } = useRoomDesigner();
  
  // Filter targets that are not placed on the canvas
  const unplacedTargets = targets.filter(
    target => !layout.some(t => t.id === target.id)
  );
  
  // Handle dropping a target onto the canvas
  const handleDragEnd = (targetId: number, clientOffset: { x: number, y: number }) => {
    // Get canvas element
    const canvas = document.querySelector('[data-droppable-id="canvas"]');
    
    if (canvas) {
      const canvasRect = canvas.getBoundingClientRect();
      
      // Calculate position relative to canvas
      const x = clientOffset.x - canvasRect.left;
      const y = clientOffset.y - canvasRect.top;
      
      // Add target to layout
      moveTarget(targetId, { x, y }, token);
    }
  };
  
  return (
    <div className="h-full p-4 overflow-y-auto">
      <h3 className="text-sm font-medium text-brand-lavender mb-4">Available Targets</h3>
      
      {unplacedTargets.length === 0 ? (
        <div className="text-center py-8 text-brand-fg-secondary">
          All targets have been placed on the canvas
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {unplacedTargets.map(target => (
            <div key={target.id} className="flex flex-col items-center">
              <TargetIcon 
                id={target.id}
                isPlaceholder
              />
              <span className="text-xs text-brand-fg-secondary mt-1">
                {target.name}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PalettePanel;
