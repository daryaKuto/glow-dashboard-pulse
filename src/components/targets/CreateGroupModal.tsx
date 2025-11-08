import React, { useCallback, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Plus, Target } from 'lucide-react';
import type { Target as TargetType } from '@/store/useTargets';
import type { Room } from '@/store/useRooms';

interface CreateGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateGroup: (groupData: {
    name: string;
    roomId?: string | null;
    targetIds: string[];
  }) => void;
  availableTargets: Array<{
    id: string;
    name: string;
    status: TargetType['status'] | null | undefined;
    activityStatus?: TargetType['activityStatus'] | null;
  }>;
  rooms: Room[];
}

const CreateGroupModal: React.FC<CreateGroupModalProps> = ({
  isOpen,
  onClose,
  onCreateGroup,
  availableTargets,
  rooms
}) => {
  const [groupName, setGroupName] = useState('');
  const [selectedRoomId, setSelectedRoomId] = useState<string>('none');
  const [selectedTargets, setSelectedTargets] = useState<string[]>([]);
  const [validationError, setValidationError] = useState<string>('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    if (!groupName.trim()) {
      setValidationError('Group name is required');
      return;
    }

    if (selectedTargets.length < 2) {
      setValidationError('A group must have at least 2 targets');
      return;
    }

    setValidationError('');

    onCreateGroup({
      name: groupName.trim(),
      roomId: selectedRoomId === 'none' ? null : selectedRoomId,
      targetIds: selectedTargets
    });

    // Reset form
    setGroupName('');
    setSelectedRoomId('none');
    setSelectedTargets([]);
    setValidationError('');
    onClose();
  };

  const handleTargetToggle = (targetId: string) => {
    setSelectedTargets(prev => {
      const newSelection = prev.includes(targetId) 
        ? prev.filter(id => id !== targetId)
        : [...prev, targetId];
      
      // Clear validation error when user selects targets
      if (newSelection.length >= 2) {
        setValidationError('');
      }
      
      return newSelection;
    });
  };

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
            Create New Group
          </DialogTitle>
          <DialogDescription className="text-brand-dark/70">
            Create a group of 2+ targets to organize your shooting practice.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Group Name */}
          <div className="space-y-2">
            <Label htmlFor="group-name" className="text-sm font-medium text-brand-dark">
              Group Name *
            </Label>
            <Input
              id="group-name"
              placeholder="Enter group name (e.g., Training Group 1, Competition Set)"
              value={groupName}
              onChange={(e) => {
                setGroupName(e.target.value);
                setValidationError('');
              }}
              className="bg-white border-gray-200 text-brand-dark"
              required
            />
          </div>

          {/* Room Assignment (Optional) */}
          <div className="space-y-2">
            <Label htmlFor="group-room" className="text-sm font-medium text-brand-dark">
              Assign to Room (Optional)
            </Label>
            <Select value={selectedRoomId} onValueChange={setSelectedRoomId}>
              <SelectTrigger className="bg-white border-gray-200 text-brand-dark">
                <SelectValue placeholder="Select a room (optional)" />
              </SelectTrigger>
              <SelectContent className="bg-white border-gray-200">
                <SelectItem value="none" className="bg-white hover:bg-gray-50">
                  No Room
                </SelectItem>
                {rooms.map((room) => (
                  <SelectItem key={room.id} value={room.id} className="bg-white hover:bg-gray-50">
                    {room.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-brand-dark/70">
              You can assign this group to a room, or leave it unassigned.
            </p>
          </div>

          {/* Target Selection */}
          <div className="space-y-3">
            <Label className="text-sm font-medium text-brand-dark">
              Select Targets *
            </Label>
            <p className="text-xs text-brand-dark/70">
              Select at least 2 targets to create a group.
            </p>
            
            {validationError && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-2">
                {validationError}
              </div>
            )}
            
            {availableTargets.length === 0 ? (
              <div className="text-center py-6 bg-brand-secondary/5 rounded-lg border border-gray-200">
                <Target className="h-8 w-8 text-brand-primary/50 mx-auto mb-2" />
                <p className="text-sm text-brand-dark/70">No targets available</p>
                <p className="text-xs text-brand-dark/50">Add targets before creating a group</p>
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
              <div className={`text-sm ${
                selectedTargets.length < 2 ? 'text-red-600' : 'text-brand-primary'
              }`}>
                {selectedTargets.length} target{selectedTargets.length !== 1 ? 's' : ''} selected
                {selectedTargets.length < 2 && ' (minimum 2 required)'}
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
              disabled={!groupName.trim() || selectedTargets.length < 2}
              className="bg-brand-primary hover:bg-brand-primary/90 text-white shadow-lg"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Group
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CreateGroupModal;

