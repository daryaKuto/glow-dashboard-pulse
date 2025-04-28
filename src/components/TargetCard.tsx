
import React from 'react';
import { 
  Card, 
  CardContent, 
  CardHeader,
  CardTitle,
  CardFooter
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Edit, 
  Trash, 
  Circle, 
  CheckCircle 
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Target } from '@/store/useTargets';

interface TargetCardProps {
  target: Target;
  roomName?: string | null;
  onRename: (id: number, name: string) => void;
  onLocate: (id: number) => void;
  onFirmwareUpdate: (id: number) => void;
  onDelete: (id: number) => void;
}

const TargetCard: React.FC<TargetCardProps> = ({
  target,
  roomName,
  onRename,
  onLocate,
  onFirmwareUpdate,
  onDelete
}) => {
  // Handle rename with a simple inline prompt
  const handleRename = () => {
    const newName = window.prompt('Rename target:', target.name);
    if (newName && newName.trim() !== '' && newName !== target.name) {
      onRename(target.id, newName);
    }
  };

  return (
    <Card className="w-full bg-brand-surface border-brand-lavender/30 shadow-md hover:shadow-lg transition-shadow">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-lg font-semibold text-white flex items-center gap-2">
          {target.status === 'online' ? (
            <CheckCircle size={16} className="text-green-400" />
          ) : (
            <Circle size={16} className="text-gray-400" />
          )}
          {target.name}
        </CardTitle>
        <div className={cn(
          "px-2 py-1 rounded-full text-xs font-medium",
          target.status === 'online' 
            ? "bg-green-900/40 text-green-400" 
            : "bg-gray-700/40 text-gray-400"
        )}>
          {target.status}
        </div>
      </CardHeader>
      <CardContent className="pb-2">
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="text-brand-fg-secondary">Room:</div>
          <div className="text-white">{roomName || 'Unassigned'}</div>
          <div className="text-brand-fg-secondary">Battery:</div>
          <div className="text-white">
            <div className="w-full bg-gray-700 rounded-full h-2.5">
              <div 
                className={cn(
                  "h-2.5 rounded-full",
                  target.battery > 70 ? "bg-green-500" : 
                  target.battery > 30 ? "bg-yellow-500" : "bg-red-500"
                )}
                style={{ width: `${target.battery}%` }}
              ></div>
            </div>
            <span className="text-xs mt-1">{target.battery}%</span>
          </div>
        </div>
      </CardContent>
      <CardFooter className="pt-2 flex justify-between">
        <Button 
          variant="outline" 
          size="sm" 
          className="text-brand-lavender hover:text-white hover:bg-brand-lavender/20"
          onClick={handleRename}
        >
          <Edit className="h-4 w-4 mr-1" />
          Rename
        </Button>
        <Button 
          variant="outline" 
          size="sm"
          className="text-brand-lavender hover:text-white hover:bg-brand-lavender/20"
          onClick={() => onLocate(target.id)}
        >
          Locate
        </Button>
        <Button 
          variant="outline" 
          size="sm"
          className="text-red-500 hover:text-white hover:bg-red-900/30"
          onClick={() => onDelete(target.id)}
        >
          <Trash className="h-4 w-4 mr-1" />
          Delete
        </Button>
      </CardFooter>
    </Card>
  );
};

export default TargetCard;
