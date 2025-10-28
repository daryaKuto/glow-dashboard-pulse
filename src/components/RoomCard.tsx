
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
  BookOpen,
  Target,
  Eye
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Room } from '@/store/useRooms';

interface RoomCardProps {
  room: Room;
  isDragging?: boolean;
  onRename: (id: string, name: string) => void;
  onDelete: (room: Room) => void;
  onAssignTargets: () => void;
  onViewDetails: () => void;
}

const RoomCard: React.FC<RoomCardProps> = ({ 
  room, 
  isDragging, 
  onRename, 
  onDelete,
  onAssignTargets,
  onViewDetails
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(room.name);

  const handleRename = () => {
    if (isEditing) {
      onRename(room.id, editName);
      setIsEditing(false);
    } else {
      setIsEditing(true);
    }
  };

  const handleCancel = () => {
    setEditName(room.name);
    setIsEditing(false);
  };

  const getRoomIcon = (icon?: string) => {
    const iconMap: { [key: string]: React.ReactNode } = {
      'home': <Home className="h-5 w-5" />,
      'sofa': <Sofa className="h-5 w-5" />,
      'utensils': <Utensils className="h-5 w-5" />,
      'chef-hat': <ChefHat className="h-5 w-5" />,
      'bed': <Bed className="h-5 w-5" />,
      'briefcase': <Briefcase className="h-5 w-5" />,
      'building': <Building className="h-5 w-5" />,
      'car': <Car className="h-5 w-5" />,
      'tree-pine': <TreePine className="h-5 w-5" />,
      'gamepad2': <Gamepad2 className="h-5 w-5" />,
      'dumbbell': <Dumbbell className="h-5 w-5" />,
      'music': <Music className="h-5 w-5" />,
      'book-open': <BookOpen className="h-5 w-5" />
    };
    return iconMap[icon || 'home'] || <Home className="h-5 w-5" />;
  };

  return (
    <Card className={`w-full bg-white border-gray-200 shadow-sm hover:shadow-md transition-shadow duration-200 ${
      isDragging ? 'opacity-50 scale-95' : ''
    }`}>
      <CardHeader className="pb-2 md:pb-3 p-3 md:p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 md:gap-3">
            <div className="p-1.5 md:p-2 bg-brand-secondary/10 rounded-lg">
              {getRoomIcon(room.icon)}
            </div>
            <div>
              <CardTitle className="text-sm md:text-base lg:text-lg font-heading text-brand-dark">
                {room.name}
              </CardTitle>
              <div className="flex items-center gap-1.5 md:gap-2 mt-1">
                <Badge variant="outline" className="border-gray-200 text-brand-dark font-body text-xs">
                  Room
                </Badge>
                <span className="text-xs md:text-sm text-brand-dark/70 font-body">
                  {room.targetCount} targets
                </span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-1 md:gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={onAssignTargets}
              className="text-brand-primary hover:text-brand-dark hover:bg-brand-secondary/10 p-1.5 md:p-2"
              title="Assign targets to this room"
            >
              <Target className="h-3 w-3 md:h-4 md:w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRename}
              className="text-brand-primary hover:text-brand-dark hover:bg-brand-secondary/10 p-1.5 md:p-2"
            >
              <Edit className="h-3 w-3 md:h-4 md:w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDelete(room)}
              className="text-red-600 hover:bg-red-600 hover:text-white p-1.5 md:p-2"
              title="Delete this room"
            >
              <Trash className="h-3 w-3 md:h-4 md:w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      
      {isEditing && (
        <CardContent className="pt-0 p-3 md:p-4">
          <div className="flex gap-1.5 md:gap-2">
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="flex-1 px-2 md:px-3 py-1.5 md:py-2 border border-gray-200 rounded-md text-brand-dark bg-white text-xs md:text-sm"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleRename();
                } else if (e.key === 'Escape') {
                  handleCancel();
                }
              }}
              autoFocus
            />
            <Button
              size="sm"
              onClick={handleRename}
              className="bg-brand-brown hover:bg-brand-secondary/90 text-white text-xs md:text-sm"
            >
              Save
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleCancel}
              className="border-gray-200 text-brand-dark text-xs md:text-sm"
            >
              Cancel
            </Button>
          </div>
        </CardContent>
      )}
      
      <CardFooter className="pt-2 md:pt-3 p-3 md:p-4">
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-1.5 md:gap-2">
            <Users className="h-3 w-3 md:h-4 md:w-4 text-brand-primary" />
            <span className="text-xs md:text-sm text-brand-dark/70 font-body">
              {room.targetCount} target{room.targetCount !== 1 ? 's' : ''} assigned
            </span>
          </div>
          
          <Button
            variant="outline"
            size="sm"
            onClick={onViewDetails}
            className="border-gray-200 text-brand-dark hover:bg-brand-secondary/10 text-xs md:text-sm"
          >
            <Eye className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2" />
            View Details
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
};

export default RoomCard;
