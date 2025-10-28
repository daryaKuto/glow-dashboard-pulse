import React, { useCallback, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Plus, Home, Sofa, Utensils, ChefHat, Bed, Briefcase, Building, Car, TreePine, Gamepad2, Dumbbell, Music, BookOpen, Target } from 'lucide-react';
import type { Target as TargetType } from '@/store/useTargets';

interface CreateRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateRoom: (roomData: {
    name: string;
    icon: string;
    type: string;
    assignedTargets: string[];
  }) => void;
  availableTargets: Array<{
    id: string;
    name: string;
    status: TargetType['status'] | null | undefined;
    activityStatus?: TargetType['activityStatus'] | null;
  }>;
}

const CreateRoomModal: React.FC<CreateRoomModalProps> = ({
  isOpen,
  onClose,
  onCreateRoom,
  availableTargets
}) => {
  const [roomName, setRoomName] = useState('');
  const [roomIcon, setRoomIcon] = useState('home');
  const [roomType, setRoomType] = useState('');
  const [selectedTargets, setSelectedTargets] = useState<string[]>([]);

  // Available room types
  const roomTypes = [
    { value: 'living-room', label: 'Living Room' },
    { value: 'bedroom', label: 'Bedroom' },
    { value: 'kitchen', label: 'Kitchen' },
    { value: 'dining-room', label: 'Dining Room' },
    { value: 'bathroom', label: 'Bathroom' },
    { value: 'office', label: 'Office/Study' },
    { value: 'basement', label: 'Basement' },
    { value: 'garage', label: 'Garage' },
    { value: 'attic', label: 'Attic' },
    { value: 'laundry-room', label: 'Laundry Room' }
  ];

  // Available room icons
  const roomIcons = [
    { value: 'home', label: 'Home', icon: <Home className="h-4 w-4" /> },
    { value: 'sofa', label: 'Living Room', icon: <Sofa className="h-4 w-4" /> },
    { value: 'utensils', label: 'Dining Room', icon: <Utensils className="h-4 w-4" /> },
    { value: 'chef-hat', label: 'Kitchen', icon: <ChefHat className="h-4 w-4" /> },
    { value: 'bed', label: 'Bedroom', icon: <Bed className="h-4 w-4" /> },
    { value: 'briefcase', label: 'Office', icon: <Briefcase className="h-4 w-4" /> },
    { value: 'building', label: 'Basement', icon: <Building className="h-4 w-4" /> },
    { value: 'car', label: 'Garage', icon: <Car className="h-4 w-4" /> },
    { value: 'tree-pine', label: 'Garden', icon: <TreePine className="h-4 w-4" /> },
    { value: 'gamepad2', label: 'Game Room', icon: <Gamepad2 className="h-4 w-4" /> },
    { value: 'dumbbell', label: 'Gym', icon: <Dumbbell className="h-4 w-4" /> },
    { value: 'music', label: 'Music Room', icon: <Music className="h-4 w-4" /> },
    { value: 'book-open', label: 'Library', icon: <BookOpen className="h-4 w-4" /> }
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomName.trim() || !roomType) return;

    onCreateRoom({
      name: roomName.trim(),
      icon: roomIcon,
      type: roomType,
      assignedTargets: selectedTargets
    });

    // Reset form
    setRoomName('');
    setRoomIcon('home');
    setRoomType('');
    setSelectedTargets([]);
    onClose();
  };

  const handleTargetToggle = (targetId: string) => {
    setSelectedTargets(prev => 
      prev.includes(targetId) 
        ? prev.filter(id => id !== targetId)
        : [...prev, targetId]
    );
  };

  const selectedIcon = roomIcons.find(icon => icon.value === roomIcon);

  const resolveStatusDisplay = useCallback(
    (status: TargetType['status'] | null | undefined, activityStatus?: TargetType['activityStatus'] | null) => {
      const normalizedStatus = status ?? 'offline';

      if (normalizedStatus === 'offline') {
        return {
          label: 'Offline',
          className: 'bg-gray-100 text-gray-800',
        };
      }

      if (activityStatus === 'active') {
        return {
          label: 'Active',
          className: 'bg-green-100 text-green-800',
        };
      }

      if (activityStatus === 'recent') {
        return {
          label: 'Recently Active',
          className: 'bg-blue-100 text-blue-800',
        };
      }

      return {
        label: 'Standby',
        className: 'bg-amber-100 text-amber-700',
      };
    },
    [],
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 text-brand-dark font-heading">
            <div className="p-2 bg-brand-primary/10 rounded-lg">
              <Plus className="h-5 w-5 text-brand-primary" />
            </div>
            Create New Room
          </DialogTitle>
          <DialogDescription className="text-brand-dark/70">
            Set up a new room with targets and configure its properties.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Room Name */}
          <div className="space-y-2">
            <Label htmlFor="room-name" className="text-sm font-medium text-brand-dark">
              Room Name *
            </Label>
            <Input
              id="room-name"
              placeholder="Enter room name (e.g., Master Bedroom, Living Room)"
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
              className="bg-white border-gray-200 text-brand-dark"
              required
            />
          </div>

          {/* Room Type */}
          <div className="space-y-2">
            <Label htmlFor="room-type" className="text-sm font-medium text-brand-dark">
              Room Type *
            </Label>
            <Select value={roomType} onValueChange={setRoomType} required>
              <SelectTrigger className="bg-white border-gray-200 text-brand-dark">
                <SelectValue placeholder="Select room type" />
              </SelectTrigger>
              <SelectContent className="bg-white border-gray-200">
                {roomTypes.map((type) => (
                  <SelectItem key={type.value} value={type.value} className="bg-white hover:bg-gray-50">
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Room Icon */}
          <div className="space-y-2">
            <Label htmlFor="room-icon" className="text-sm font-medium text-brand-dark">
              Room Icon
            </Label>
            <Select value={roomIcon} onValueChange={setRoomIcon}>
              <SelectTrigger className="bg-white border-gray-200 text-brand-dark">
                <SelectValue placeholder="Select icon">
                  {selectedIcon && (
                    <div className="flex items-center gap-2">
                      {selectedIcon.icon}
                      <span>{selectedIcon.label}</span>
                    </div>
                  )}
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="bg-white border-gray-200">
                {roomIcons.map((icon) => (
                  <SelectItem key={icon.value} value={icon.value} className="bg-white hover:bg-gray-50">
                    <div className="flex items-center gap-2">
                      {icon.icon}
                      <span>{icon.label}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Available Targets */}
          <div className="space-y-3">
            <Label className="text-sm font-medium text-brand-dark">
              Assign Targets (Optional)
            </Label>
            <p className="text-xs text-brand-dark/70">
              Select targets to assign to this room. You can also assign them later.
            </p>
            
            {availableTargets.length === 0 ? (
              <div className="text-center py-6 bg-brand-secondary/5 rounded-lg border border-gray-200">
                <Target className="h-8 w-8 text-brand-primary/50 mx-auto mb-2" />
                <p className="text-sm text-brand-dark/70">No unassigned targets available</p>
                <p className="text-xs text-brand-dark/50">All targets are already assigned to rooms</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto border border-gray-200 rounded-lg p-3 bg-white">
                {availableTargets.map((target) => {
                  const statusDisplay = resolveStatusDisplay(target.status, target.activityStatus);
                  return (
                    <div
                    key={target.id}
                    className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedTargets.includes(target.id)
                        ? 'border-brand-primary bg-brand-primary/5'
                        : 'border-gray-200 hover:border-brand-primary/50 hover:bg-brand-primary/5'
                    }`}
                    onClick={() => handleTargetToggle(target.id)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-1.5 bg-brand-secondary/10 rounded-lg">
                        <Target className="h-4 w-4 text-brand-primary" />
                      </div>
                      <div>
                        <p className="font-medium text-brand-dark text-sm">{target.name}</p>
                        <Badge 
                          variant="outline"
                          className={`text-xs ${statusDisplay.className}`}
                        >
                          {statusDisplay.label}
                        </Badge>
                      </div>
                    </div>
                    <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
                      selectedTargets.includes(target.id)
                        ? 'border-brand-primary bg-brand-primary'
                        : 'border-gray-300'
                    }`}>
                      {selectedTargets.includes(target.id) && (
                        <div className="w-2 h-2 bg-white rounded-full" />
                      )}
                    </div>
                    </div>
                  );
                })}
              </div>
            )}
            
            {selectedTargets.length > 0 && (
              <div className="text-sm text-brand-primary">
                {selectedTargets.length} target{selectedTargets.length !== 1 ? 's' : ''} selected
              </div>
            )}
          </div>

          <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="border-gray-200 text-brand-dark hover:bg-gray-50"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!roomName.trim() || !roomType}
              className="bg-brand-primary hover:bg-brand-primary/90 text-white shadow-lg"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Room
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CreateRoomModal;
