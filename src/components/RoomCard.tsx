
import React, { useState } from 'react';
import { 
  Card, 
  CardContent, 
  CardHeader,
  CardTitle,
  CardFooter
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Edit, 
  Trash, 
  Users,
  Sofa,
  Utensils,
  ChefHat,
  Bed,
  Briefcase,
  Home,
  Building,
  Car,
  TreePine,
  Gamepad2,
  Dumbbell,
  Music,
  BookOpen
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

  // Get icon component based on icon name
  const getRoomIcon = (iconName?: string) => {
    switch (iconName) {
      case 'sofa': return <Sofa className="h-6 w-6" />;
      case 'utensils': return <Utensils className="h-6 w-6" />;
      case 'chef-hat': return <ChefHat className="h-6 w-6" />;
      case 'bed': return <Bed className="h-6 w-6" />;
      case 'briefcase': return <Briefcase className="h-6 w-6" />;
      case 'home': return <Home className="h-6 w-6" />;
      case 'building': return <Building className="h-6 w-6" />;
      case 'car': return <Car className="h-6 w-6" />;
      case 'tree-pine': return <TreePine className="h-6 w-6" />;
      case 'gamepad2': return <Gamepad2 className="h-6 w-6" />;
      case 'dumbbell': return <Dumbbell className="h-6 w-6" />;
      case 'music': return <Music className="h-6 w-6" />;
      case 'book-open': return <BookOpen className="h-6 w-6" />;
      case 'basement': return <Building className="h-6 w-6" />;
      default: return <Home className="h-6 w-6" />;
    }
  };

  return (
    <Card className={`w-full bg-white border-brand-brown/20 shadow-sm hover:shadow-md transition-shadow duration-200 ${
      isDragging ? 'opacity-50 scale-95' : ''
    }`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-brand-brown/10 rounded-lg">
              {getRoomIcon(room.icon)}
            </div>
            <div>
              <CardTitle className="text-lg font-heading text-brand-dark">
                {room.name}
              </CardTitle>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline" className="border-brand-brown/30 text-brand-dark font-body">
                  Room
                </Badge>
                <span className="text-sm text-brand-dark/70 font-body">
                  {room.targetCount} targets
                </span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRename}
              className="text-brand-brown hover:text-brand-dark hover:bg-brand-brown/10"
            >
              <Edit className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDelete(room.id)}
              className="text-red-600 hover:text-red-700 hover:bg-red-600 hover:text-white"
            >
              <Trash className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Stats */}
        <div className="grid grid-cols-1 gap-4">
          <div className="text-center p-3 bg-brand-brown/5 rounded-lg">
            <div className="text-2xl font-heading text-brand-dark">{room.targetCount}</div>
            <div className="text-sm text-brand-dark/70 font-body">Targets</div>
          </div>
        </div>
      </CardContent>
      
      <CardFooter className="pt-0">
        <Link to={`/targets?roomId=${room.id}`} className="w-full">
          <Button 
            variant="outline" 
            className="w-full border-brand-brown text-brand-brown hover:bg-brand-brown hover:text-white transition-colors duration-200 rounded-lg"
          >
            View Targets
          </Button>
        </Link>
      </CardFooter>
    </Card>
  );
};

export default RoomCard;
