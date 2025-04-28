
import React, { useEffect, useState, useRef } from 'react';
import { 
  DndContext, 
  useSensor, 
  useSensors, 
  MouseSensor, 
  TouchSensor, 
  KeyboardSensor, 
  DragEndEvent, 
  DragStartEvent,
  useDroppable
} from '@dnd-kit/core';
import { restrictToParentElement } from '@dnd-kit/modifiers';
import { useRoomDesigner } from '@/store/useRoomDesigner';
import { useLocation } from 'react-router-dom';
import TargetIcon from './TargetIcon';
import GroupBox from './GroupBox';

const RoomCanvas: React.FC = () => {
  const location = useLocation();
  const token = new URLSearchParams(location.search).get('token') || 'dummy_token';
  const canvasRef = useRef<HTMLDivElement>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 });
  
  const { 
    layout, 
    groups, 
    selectedIds,
    selectedGroupId,
    moveTarget, 
    selectTargets,
    selectGroup
  } = useRoomDesigner();
  
  // Set up DnD sensors
  const mouseSensor = useSensor(MouseSensor, {
    activationConstraint: {
      distance: 5, // 5px of movement before drag starts
    },
  });
  
  const touchSensor = useSensor(TouchSensor, {
    activationConstraint: {
      delay: 200, // 200ms delay for touch
      tolerance: 5, // 5px of movement during delay
    },
  });
  
  const keyboardSensor = useSensor(KeyboardSensor);
  
  const sensors = useSensors(mouseSensor, touchSensor, keyboardSensor);
  
  // Set up droppable area
  const { setNodeRef } = useDroppable({
    id: 'canvas',
  });
  
  // Update canvas size when window resizes
  useEffect(() => {
    const updateCanvasSize = () => {
      if (canvasRef.current) {
        setCanvasSize({
          width: canvasRef.current.offsetWidth,
          height: canvasRef.current.offsetHeight,
        });
      }
    };
    
    updateCanvasSize();
    window.addEventListener('resize', updateCanvasSize);
    
    return () => {
      window.removeEventListener('resize', updateCanvasSize);
    };
  }, []);
  
  // Handle drag start
  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    
    // Clear selections on drag unless multi-select key is pressed
    // DragStartEvent doesn't have shiftKey directly, check if it exists in original event
    const originalEvent = event.active.data.current?.originalEvent as MouseEvent | TouchEvent | KeyboardEvent | undefined;
    const isShiftPressed = originalEvent && 'shiftKey' in originalEvent ? originalEvent.shiftKey : false;
    
    if (!isShiftPressed) {
      selectTargets([]);
      selectGroup(null);
    }
    
    // If dragging a target, select it
    if (active.id.toString().startsWith('target-')) {
      const targetId = parseInt(active.id.toString().replace('target-', ''));
      if (!selectedIds.includes(targetId)) {
        selectTargets([...selectedIds, targetId]);
      }
    }
    
    // If dragging a group, select it
    if (active.id.toString().startsWith('group-')) {
      const groupId = parseInt(active.id.toString().replace('group-', ''));
      selectGroup(groupId);
    }
  };
  
  // Handle drag end
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, delta } = event;
    
    if (active.id.toString().startsWith('target-')) {
      const targetId = parseInt(active.id.toString().replace('target-', ''));
      const targetLayout = layout.find(t => t.id === targetId);
      
      if (targetLayout) {
        // Move the target
        moveTarget(targetId, {
          x: targetLayout.x + delta.x,
          y: targetLayout.y + delta.y
        }, token);
      }
    }
    
    if (active.id.toString().startsWith('group-')) {
      const groupId = parseInt(active.id.toString().replace('group-', ''));
      const group = groups.find(g => g.id === groupId);
      
      if (group) {
        // Move all targets in the group
        group.targetIds.forEach(targetId => {
          const targetLayout = layout.find(t => t.id === targetId);
          if (targetLayout) {
            moveTarget(targetId, {
              x: targetLayout.x + delta.x,
              y: targetLayout.y + delta.y
            }, token);
          }
        });
      }
    }
  };
  
  // Handle canvas click (deselect)
  const handleCanvasClick = (e: React.MouseEvent) => {
    // Only deselect if clicking directly on canvas (not a target)
    if (e.target === canvasRef.current) {
      selectTargets([]);
      selectGroup(null);
    }
  };
  
  // Shift+Click to multi-select
  const handleTargetClick = (e: React.MouseEvent, targetId: number) => {
    e.stopPropagation();
    
    if (e.shiftKey) {
      // Multi-select: toggle target selection
      if (selectedIds.includes(targetId)) {
        selectTargets(selectedIds.filter(id => id !== targetId));
      } else {
        selectTargets([...selectedIds, targetId]);
      }
    } else {
      // Single select
      selectTargets([targetId]);
      selectGroup(null);
    }
  };
  
  const handleGroupClick = (e: React.MouseEvent, groupId: number) => {
    e.stopPropagation();
    selectGroup(groupId);
    selectTargets([]);
  };
  
  // Check if canvas has any targets placed
  const hasTargets = layout.length > 0;
  
  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      modifiers={[restrictToParentElement]}
    >
      <div
        ref={(node) => {
          setNodeRef(node);
          if (canvasRef) {
            // @ts-ignore - this is a valid assignment
            canvasRef.current = node;
          }
        }}
        className="w-full h-full relative bg-brand-indigo overflow-auto"
        onClick={handleCanvasClick}
      >
        {/* Empty state */}
        {!hasTargets && (
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center">
            <div className="w-40 h-40 mx-auto border-2 border-dashed border-brand-lavender rounded-md flex items-center justify-center mb-4">
              <p className="text-brand-lavender text-sm">Drag targets here</p>
            </div>
            <p className="text-brand-fg-secondary">
              Drag targets from the Palette panel to place them on the canvas
            </p>
          </div>
        )}
        
        {/* Render targets */}
        {layout.map(target => {
          // Skip targets that are part of a group when rendering individually
          const isInGroup = groups.some(g => g.targetIds.includes(target.id));
          if (isInGroup) return null;
          
          return (
            <div
              key={`target-${target.id}`}
              style={{
                position: 'absolute',
                left: `${target.x}px`,
                top: `${target.y}px`,
              }}
              onClick={(e) => handleTargetClick(e, target.id)}
            >
              <TargetIcon
                id={target.id}
                isSelected={selectedIds.includes(target.id)}
              />
            </div>
          );
        })}
        
        {/* Render groups */}
        {groups.map(group => (
          <GroupBox
            key={`group-${group.id}`}
            group={group}
            targets={layout.filter(t => group.targetIds.includes(t.id))}
            isSelected={selectedGroupId === group.id}
            onClick={handleGroupClick}
          />
        ))}
      </div>
    </DndContext>
  );
};

export default RoomCanvas;
