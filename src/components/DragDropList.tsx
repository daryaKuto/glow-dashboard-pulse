import React, { useState } from 'react';
import { motion } from 'framer-motion';
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
  UniqueIdentifier,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '@/lib/utils';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.1 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } },
};

interface SortableItemProps<T extends { id: string | number }> {
  id: string | number;
  item: T;
  renderItem: (item: T, isDragging: boolean) => React.ReactNode;
}

// Component for each sortable item
const SortableItem = <T extends { id: string | number }>({
  id,
  item,
  renderItem,
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
    <motion.div
      ref={setNodeRef}
      style={style}
      className={cn('relative', isDragging && 'opacity-75')}
      variants={itemVariants}
      whileHover={{ y: -2 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      {...attributes}
      {...listeners}
    >
      {renderItem(item, isDragging)}
    </motion.div>
  );
};

interface DragDropListProps<T extends { id: string | number }> {
  items: T[];
  renderItem: (item: T, isDragging: boolean) => React.ReactNode;
  onReorder: (items: T[]) => void;
  activationConstraint?: { delay?: number; tolerance?: number; distance?: number };
}

// Main drag and drop list component
export default function DragDropList<T extends { id: string | number }>({
  items,
  renderItem,
  onReorder,
  activationConstraint,
}: DragDropListProps<T>) {
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint,
    }),
    useSensor(TouchSensor, {
      activationConstraint,
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = items.findIndex((item) => item.id === active.id);
      const newIndex = items.findIndex((item) => item.id === over.id);

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
        items={items.map((item) => ({ id: item.id }))}
        strategy={verticalListSortingStrategy}
      >
        <motion.div
          className="grid grid-cols-1 sm:grid-cols-2 gap-2 md:gap-4 lg:gap-5"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {items.map((item) => (
            <SortableItem
              key={item.id}
              id={item.id}
              item={item}
              renderItem={renderItem}
            />
          ))}
        </motion.div>
      </SortableContext>
    </DndContext>
  );
}
