
import React, { useState } from 'react';
import { 
  Card, 
  CardContent, 
  CardHeader,
  CardTitle,
  CardFooter
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  edit, 
  trash, 
  users
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Room } from '@/store/useRooms';

interface RoomCardProps {
  room: Room;
  isDragging?: boolean;
  onRename: (id: number, name: string) => void;
  onDelete: (id: number) => void;
}

const RoomCard: React.FC<RoomCardProps> = ({
  room,
  isDragging = false,
  onRename,
  onDelete
}) => {
  // Handle rename with a simple inline prompt
  const handleRename = () => {
    const newName = window.prompt('Rename room:', room.name);
    if (newName && newName.trim() !== '' && newName !== room.name) {
      onRename(room.id, newName);
    }
  };

  return (
    <Card className={`w-full bg-brand-surface border-brand-lavender/30 shadow-md hover:shadow-lg transition-shadow ${isDragging ? 'opacity-75' : ''}`}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-lg font-semibold text-white">
          {room.name}
        </CardTitle>
        <div className="flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-brand-lavender/20 text-brand-lavender">
          <users size={12} />
          <span>{room.targetCount} targets</span>
        </div>
      </CardHeader>
      <CardContent className="pb-2">
        <p className="text-sm text-brand-fg-secondary">
          Room #{room.id} • Order: {room.order}
        </p>
      </CardContent>
      <CardFooter className="pt-2 flex justify-between">
        <Button 
          variant="outline" 
          size="sm" 
          className="text-brand-lavender hover:text-white hover:bg-brand-lavender/20"
          onClick={handleRename}
        >
          <edit className="h-4 w-4 mr-1" />
          Rename
        </Button>
        <Link to={`/targets?roomId=${room.id}`}>
          <Button 
            variant="outline" 
            size="sm"
            className="text-brand-lavender hover:text-white hover:bg-brand-lavender/20"
          >
            View Targets
          </Button>
        </Link>
        <Button 
          variant="outline" 
          size="sm"
          className="text-red-500 hover:text-white hover:bg-red-900/30"
          onClick={() => onDelete(room.id)}
        >
          <trash className="h-4 w-4 mr-1" />
          Delete
        </Button>
      </CardFooter>
    </Card>
  );
};

export default RoomCard;
