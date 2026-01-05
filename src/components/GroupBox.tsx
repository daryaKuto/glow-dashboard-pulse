
import React from 'react';
import { useDraggable } from '@dnd-kit/core';
import { cn } from '@/lib/utils';
import { TargetGroup, TargetLayout } from '@/state/useRoomDesigner';

interface GroupBoxProps {
  group: TargetGroup;
  targets: TargetLayout[];
  isSelected?: boolean;
  onClick: (e: React.MouseEvent, groupId: number) => void;
}

const GroupBox: React.FC<GroupBoxProps> = ({ 
  group, 
  targets,
  isSelected = false,
  onClick
}) => {
  // Calculate group position based on targets
  const minX = Math.min(...targets.map(t => t.x));
  const minY = Math.min(...targets.map(t => t.y));
  const maxX = Math.max(...targets.map(t => t.x + 16)); // Assuming target width is 16px
  const maxY = Math.max(...targets.map(t => t.y + 16)); // Assuming target height is 16px
  
  const width = maxX - minX + 20; // Add padding
  const height = maxY - minY + 20; // Add padding
  
  // Set up draggable
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `group-${group.id}`,
  });
  
  const groupClasses = cn(
    'absolute border-2 border-dashed rounded-md transition-all transform',
    isSelected ? 'border-brand-orange' : 'border-brand-lavender',
    isDragging && 'opacity-50'
  );
  
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={groupClasses}
      style={{
        left: minX - 10, // Account for padding
        top: minY - 10,  // Account for padding
        width: `${width}px`,
        height: `${height}px`,
        touchAction: 'none' // Prevents touch scroll/zoom during drag
      }}
      onClick={(e) => onClick(e, group.id)}
    >
      <div className="absolute top-0 left-0 transform -translate-y-full px-2 py-1 bg-brand-surface rounded-t-md">
        <span className="text-xs text-brand-lavender font-medium">
          {group.name}
        </span>
      </div>
    </div>
  );
};

export default GroupBox;
