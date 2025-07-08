
import React, { useState } from 'react';
import { 
  DndContext, 
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  UniqueIdentifier
} from '@dnd-kit/core';
import { 
  arrayMove,
  SortableContext, 
  sortableKeyboardCoordinates, 
  verticalListSortingStrategy 
} from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '@/lib/utils';
import { Grip } from 'lucide-react';

interface SortableItemProps<T extends { id: number }> {
  id: number;
  item: T;
  renderItem: (item: T, isDragging: boolean) => React.ReactNode;
}

// Component for each sortable item
const SortableItem = <T extends { id: number }>({ 
  id, 
  item, 
  renderItem 
}: SortableItemProps<T>) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 1,
  };

  return (
    <div 
      ref={setNodeRef}
      style={style}
      className={cn(
        "relative",
        isDragging && "opacity-75"
      )}
    >
      <div 
        {...attributes}
        {...listeners}
        className="absolute top-1/2 left-2 -translate-y-1/2 cursor-move touch-none"
      >
        <Grip className="h-4 w-4 text-brand-lavender/70" />
      </div>
      {renderItem(item, isDragging)}
    </div>
  );
};

interface DragDropListProps<T extends { id: number }> {
  items: T[];
  renderItem: (item: T, isDragging: boolean) => React.ReactNode;
  onReorder: (items: T[]) => void;
  activationConstraint?: { delay: number; tolerance: number };
}

// Main drag and drop list component
export default function DragDropList<T extends { id: number }>({ 
  items, 
  renderItem, 
  onReorder,
  activationConstraint
}: DragDropListProps<T>) {
  const [activeId, setActiveId] = useState<number | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { 
      activationConstraint 
    }),
    useSensor(TouchSensor, { 
      activationConstraint 
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as number);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    
    if (over && active.id !== over.id) {
      const oldIndex = items.findIndex(item => item.id === active.id);
      const newIndex = items.findIndex(item => item.id === over.id);
      
      const reordered = arrayMove(items, oldIndex, newIndex);
      onReorder(reordered);
    }
    
    setActiveId(null);
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={items.map(item => ({ id: item.id }))}
        strategy={verticalListSortingStrategy}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {items.map((item) => (
            <SortableItem
              key={item.id}
              id={item.id}
              item={item}
              renderItem={renderItem}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
