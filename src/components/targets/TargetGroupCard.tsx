import React, { useState, useEffect } from 'react';
import { 
  Card, 
  CardContent, 
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Edit, 
  Trash2, 
  Users,
  Target,
  MapPin,
  X,
  Plus
} from 'lucide-react';
import { Group } from '@/store/useTargetGroups';
import type { Room } from '@/store/useRooms';
import type { Target as TargetType } from '@/store/useTargets';

interface TargetGroupCardProps {
  group: Group;
  room?: Room | null;
  onEdit: (groupId: string, newName: string) => void;
  onDelete: () => void;
  onRemoveTarget?: (groupId: string, targetId: string) => void;
  onAddTarget?: (groupId: string) => void;
  onManageTargets?: () => void;
}

const TargetGroupCard: React.FC<TargetGroupCardProps> = ({ 
  group, 
  room,
  onEdit, 
  onDelete,
  onRemoveTarget,
  onAddTarget,
  onManageTargets
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(group.name);

  useEffect(() => {
    if (!isEditing) {
      setEditName(group.name);
    }
  }, [group.name, isEditing]);

  const handleRename = () => {
    if (isEditing && editName.trim() && editName !== group.name) {
      onEdit(group.id, editName.trim());
      setIsEditing(false);
    } else {
      setIsEditing(true);
    }
  };

  const handleCancel = () => {
    setEditName(group.name);
    setIsEditing(false);
  };

  const handleRemoveTarget = (targetId: string) => {
    if (onRemoveTarget) {
      onRemoveTarget(group.id, targetId);
    }
  };

  const getStatusColor = (status: TargetType['status'] | null | undefined) => {
    if (status === 'online') return 'bg-green-500';
    if (status === 'standby') return 'bg-amber-500';
    return 'bg-gray-400';
  };

  return (
    <Card className="bg-white border-gray-200 shadow-sm hover:shadow-md transition-shadow duration-200">
      <CardHeader className="pb-2 md:pb-3 p-3 md:p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 md:gap-3 flex-1 min-w-0">
            <div className="p-1.5 md:p-2 bg-brand-secondary/10 rounded-lg flex-shrink-0">
              <Users className="h-4 w-4 md:h-5 md:w-5 text-brand-primary" />
            </div>
            <div className="flex-1 min-w-0">
              {isEditing ? (
                <div className="flex gap-1.5 md:gap-2">
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="flex-1 px-2 md:px-3 py-1.5 md:py-2 border border-gray-200 rounded-md text-brand-dark bg-white text-xs md:text-sm"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && editName.trim()) {
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
                    className="bg-brand-primary hover:bg-brand-primary/90 text-white text-xs md:text-sm"
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
              ) : (
                <>
                  <CardTitle className="text-sm md:text-base lg:text-lg font-heading text-brand-dark truncate">
                    {group.name}
                  </CardTitle>
                  <div className="flex items-center gap-1.5 md:gap-2 mt-1 flex-wrap">
                    <Badge variant="outline" className="border-gray-200 text-brand-dark font-body text-xs">
                      Group
                    </Badge>
                    <span className="text-xs md:text-sm text-brand-dark/70 font-body">
                      {group.targetCount} target{group.targetCount !== 1 ? 's' : ''}
                    </span>
                    {room && (
                      <div className="flex items-center gap-1 text-xs md:text-sm text-brand-dark/70">
                        <MapPin className="h-3 w-3 md:h-4 md:w-4 text-brand-primary" />
                        <span className="font-body">{room.name}</span>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
          
          {!isEditing && (
            <div className="flex items-center gap-1 md:gap-2 flex-shrink-0">
              {onManageTargets && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onManageTargets}
                  className="text-brand-primary hover:text-brand-dark hover:bg-brand-secondary/10 p-1.5 md:p-2"
                  title="Manage targets in this group"
                >
                  <Target className="h-3 w-3 md:h-4 md:w-4" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRename}
                className="text-brand-primary hover:text-brand-dark hover:bg-brand-secondary/10 p-1.5 md:p-2"
                title="Rename group"
              >
                <Edit className="h-3 w-3 md:h-4 md:w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={onDelete}
                className="text-red-600 hover:bg-red-600 hover:text-white p-1.5 md:p-2"
                title="Delete this group"
              >
                <Trash2 className="h-3 w-3 md:h-4 md:w-4" />
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      
      {group.targets && group.targets.length > 0 && (
        <CardContent className="pt-0 p-3 md:p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 md:gap-3">
            {group.targets.map((target) => {
              const displayName = target.displayName || target.name;
              return (
                <div
                  key={target.id}
                  className="flex items-center justify-between gap-2 p-2 md:p-3 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <div className={`w-2 h-2 md:w-3 md:h-3 rounded-full flex-shrink-0 ${getStatusColor(target.status)}`}></div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <Target className="h-3 w-3 md:h-4 md:w-4 text-brand-primary/70" />
                    </div>
                    <span 
                      className="text-xs md:text-sm font-medium text-brand-dark truncate flex-1"
                      title={displayName}
                    >
                      {displayName}
                    </span>
                  </div>
                  {onRemoveTarget && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveTarget(target.id)}
                      className="h-6 w-6 md:h-7 md:w-7 p-0 text-gray-400 hover:text-red-600 hover:bg-red-50 flex-shrink-0"
                      title={`Remove ${displayName} from group`}
                    >
                      <X className="h-3 w-3 md:h-4 md:w-4" />
                    </Button>
                  )}
                </div>
              );
            })}
            {onAddTarget && (
              <button
                onClick={() => onAddTarget(group.id)}
                className="flex items-center justify-center gap-2 p-2 md:p-3 bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg hover:bg-gray-100 hover:border-brand-primary/50 transition-colors text-brand-dark/70 hover:text-brand-primary"
                title="Add target to group"
              >
                <Plus className="h-4 w-4 md:h-5 md:w-5" />
                <span className="text-xs md:text-sm font-medium">Add Target</span>
              </button>
            )}
          </div>
        </CardContent>
      )}
      {(!group.targets || group.targets.length === 0) && onAddTarget && (
        <CardContent className="pt-0 p-3 md:p-4">
          <button
            onClick={() => onAddTarget(group.id)}
            className="w-full flex items-center justify-center gap-2 p-4 md:p-6 bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg hover:bg-gray-100 hover:border-brand-primary/50 transition-colors text-brand-dark/70 hover:text-brand-primary"
            title="Add target to group"
          >
            <Plus className="h-5 w-5 md:h-6 md:w-6" />
            <span className="text-sm md:text-base font-medium">Add Target to Group</span>
          </button>
        </CardContent>
      )}
    </Card>
  );
};

export default TargetGroupCard;

