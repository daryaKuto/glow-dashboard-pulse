import React, { useState } from 'react';
import {
  Card,
  CardContent,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Edit,
  Trash,
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
  Eye,
  PenTool,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { Room } from '@/features/rooms/schema';

interface TargetInfo {
  name: string;
  status?: 'online' | 'standby' | 'offline' | null;
}

interface RoomCardProps {
  room: Room;
  targetNames?: string[];
  targets?: TargetInfo[];
  isDragging?: boolean;
  onRename: (id: string, name: string) => void;
  onDelete: (room: Room) => void;
  onAssignTargets: () => void;
  onViewDetails: () => void;
}

const RoomCard: React.FC<RoomCardProps> = ({
  room,
  targetNames = [],
  targets = [],
  isDragging,
  onRename,
  onDelete,
  onAssignTargets,
  onViewDetails,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(room.name);
  const navigate = useNavigate();

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
      'home': <Home className="w-4 h-4" />,
      'sofa': <Sofa className="w-4 h-4" />,
      'utensils': <Utensils className="w-4 h-4" />,
      'chef-hat': <ChefHat className="w-4 h-4" />,
      'bed': <Bed className="w-4 h-4" />,
      'briefcase': <Briefcase className="w-4 h-4" />,
      'building': <Building className="w-4 h-4" />,
      'car': <Car className="w-4 h-4" />,
      'tree-pine': <TreePine className="w-4 h-4" />,
      'gamepad2': <Gamepad2 className="w-4 h-4" />,
      'dumbbell': <Dumbbell className="w-4 h-4" />,
      'music': <Music className="w-4 h-4" />,
      'book-open': <BookOpen className="w-4 h-4" />,
    };
    return iconMap[icon || 'home'] || <Home className="w-4 h-4" />;
  };

  const targetCount = room.target_count ?? 0;

  return (
    <Card
      className={`w-full shadow-card hover:shadow-card-hover transition-all duration-200 bg-gradient-to-br from-white via-white to-brand-secondary/[0.05] ${
        isDragging ? 'opacity-50 scale-95' : ''
      }`}
    >
      <CardContent className="p-3 md:p-4 lg:p-5">
        {/* Header — Icon + Name + Target count + Actions */}
        <div className="flex items-start justify-between gap-1.5 md:gap-2">
          <div className="flex items-center gap-2.5 md:gap-3 min-w-0">
            <div className="w-9 h-9 md:w-10 md:h-10 rounded-[var(--radius)] bg-brand-primary/10 flex items-center justify-center shrink-0">
              <div className="text-brand-primary">
                {getRoomIcon(room.icon)}
              </div>
            </div>
            <div className="min-w-0">
              <span className="text-[13px] md:text-sm font-semibold text-brand-dark font-body truncate block">
                {room.name}
              </span>
              <span className="text-[10px] md:text-label text-brand-dark/55 font-body uppercase tracking-wide mt-0.5">
                {targetCount} target{targetCount !== 1 ? 's' : ''}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-0 md:gap-0.5 shrink-0">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={handleRename}
              className="text-brand-dark/50 hover:text-brand-dark hover:bg-brand-dark/[0.06] h-7 w-7 md:h-8 md:w-8"
              title="Rename"
            >
              <Edit className="w-3 h-3 md:w-3.5 md:h-3.5" />
            </Button>
            {(room as any).hasLayout && (
              <Button
                size="icon-sm"
                variant="ghost"
                className="hidden lg:inline-flex text-brand-dark/50 hover:text-brand-dark hover:bg-brand-dark/[0.06]"
                onClick={() => navigate(`/dashboard/rooms/${room.id}/layout`)}
                title="Edit layout"
              >
                <PenTool className="w-3.5 h-3.5" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => onDelete(room)}
              className="text-brand-dark/50 hover:text-red-600 hover:bg-red-600/[0.08] h-7 w-7 md:h-8 md:w-8"
              title="Delete"
            >
              <Trash className="w-3 h-3 md:w-3.5 md:h-3.5" />
            </Button>
          </div>
        </div>

        {/* Inline rename edit */}
        {isEditing && (
          <div className="mt-2 md:mt-3 space-y-2 md:space-y-0 md:flex md:gap-2">
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="w-full md:flex-1 px-3 py-2 border border-[rgba(28,25,43,0.1)] rounded-[var(--radius)] text-brand-dark bg-white focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary/30 font-body h-9 md:h-10 text-sm"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleRename();
                } else if (e.key === 'Escape') {
                  handleCancel();
                }
              }}
              autoFocus
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={handleRename}
                className="bg-brand-primary hover:bg-brand-primary/90 text-white flex-1 md:flex-none h-9 md:h-8"
              >
                Save
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={handleCancel}
                className="flex-1 md:flex-none h-9 md:h-8"
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Target pills with status colors */}
        {(targets.length > 0 || targetNames.length > 0) && (
          <div className="mt-2 md:mt-3 flex flex-wrap gap-1 md:gap-1.5">
            {(targets.length > 0 ? targets : targetNames.map(n => ({ name: n }))).map((t) => {
              const status = 'status' in t ? t.status : undefined;
              const dotColor = status === 'online' ? 'bg-green-500'
                : status === 'standby' ? 'bg-amber-400'
                : 'bg-gray-400';
              const pillStyle = status === 'online'
                ? 'bg-green-50 text-green-700 ring-1 ring-green-200/60'
                : status === 'standby'
                ? 'bg-amber-50 text-amber-700 ring-1 ring-amber-200/60'
                : 'bg-gray-100 text-gray-500 ring-1 ring-gray-200/60';
              return (
                <span
                  key={t.name}
                  className={`inline-flex items-center rounded-full px-2 md:px-2.5 py-0.5 text-[10px] md:text-[11px] font-medium font-body ${pillStyle}`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full mr-1.5 shrink-0 ${dotColor}`} />
                  {t.name}
                </span>
              );
            })}
          </div>
        )}

        {/* Footer */}
        <div className="mt-2.5 md:mt-3 pt-2 md:pt-2.5 border-t border-[rgba(28,25,43,0.06)] flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={onViewDetails}
            className="text-brand-dark/60 hover:text-brand-dark hover:bg-brand-dark/[0.06] -ml-2 h-8 md:h-8 text-xs md:text-sm px-2 md:px-3"
          >
            <Eye className="w-3 h-3 md:w-3.5 md:h-3.5 mr-1 md:mr-1.5" />
            <span className="hidden sm:inline">View </span>Details
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onAssignTargets}
            className="text-brand-primary font-medium hover:bg-[rgba(206,62,10,0.08)] h-8 md:h-8 text-xs md:text-sm px-2 md:px-3"
          >
            <Target className="w-3 h-3 md:w-3.5 md:h-3.5 mr-1 md:mr-1.5" />
            Assign
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default RoomCard;
