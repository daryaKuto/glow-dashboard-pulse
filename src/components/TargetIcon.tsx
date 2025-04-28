
import React from 'react';
import { useDraggable } from '@dnd-kit/core';
import { Target } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTargets } from '@/store/useTargets';

interface TargetIconProps {
  id: number;
  isSelected?: boolean;
  isDragging?: boolean;
  isPlaceholder?: boolean;
}

const TargetIcon: React.FC<TargetIconProps> = ({ 
  id,
  isSelected = false,
  isPlaceholder = false
}) => {
  const { targets } = useTargets();
  const target = targets.find(t => t.id === id);
  
  // Set up draggable
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `target-${id}`,
    disabled: isPlaceholder
  });
  
  const classes = cn(
    'flex flex-col items-center justify-center w-16 h-16 rounded-md transition-all transform',
    isSelected && 'outline outline-2 outline-brand-orange',
    isDragging && 'opacity-50',
    isPlaceholder ? 'cursor-grab' : 'cursor-move'
  );
  
  return (
    <div 
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={classes}
      style={{
        touchAction: 'none' // Prevents touch scroll/zoom during drag
      }}
    >
      <Target 
        size={32}
        className="text-brand-lavender hover:text-brand-orange transition-colors" 
      />
      {target?.name && (
        <span className="text-xs text-brand-fg-secondary mt-1 overflow-hidden text-ellipsis whitespace-nowrap max-w-full px-1">
          {target.name}
        </span>
      )}
    </div>
  );
};

export default TargetIcon;
