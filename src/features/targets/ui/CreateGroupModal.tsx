import React, { useCallback, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Plus, Target } from 'lucide-react';
import type { Target as TargetType } from '@/features/targets/schema';
import { getStatusDisplay } from '@/shared/constants/target-status';
import type { Room } from '@/features/rooms/schema';

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
    (status: TargetType['status'] | null | undefined, _activityStatus?: TargetType['activityStatus'] | null) => {
      const cfg = getStatusDisplay(status);
      return { label: cfg.label, className: cfg.badgeClassName };
    },
    [],
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 text-brand-dark font-heading">
            <Plus className="h-5 w-5 text-brand-primary" />
            Create New Group
          </DialogTitle>
          <DialogDescription className="text-brand-dark/70">
            Create a group of 2+ targets to organize your shooting practice.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Group Name */}
          <div className="space-y-2">
            <Label htmlFor="group-name" className="text-label text-brand-secondary font-body uppercase tracking-wide">
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
              className="bg-white border border-[rgba(28,25,43,0.1)] rounded-[var(--radius)] text-brand-dark placeholder:text-brand-dark/40 focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary/30 font-body h-10"
              required
            />
          </div>

          {/* Room Assignment (Optional) */}
          <div className="space-y-2">
            <Label htmlFor="group-room" className="text-label text-brand-secondary font-body uppercase tracking-wide">
              Assign to Room (Optional)
            </Label>
            <Select value={selectedRoomId} onValueChange={setSelectedRoomId}>
              <SelectTrigger className="bg-white border border-[rgba(28,25,43,0.1)] rounded-[var(--radius)] text-brand-dark">
                <SelectValue placeholder="Select a room (optional)" />
              </SelectTrigger>
              <SelectContent className="bg-white shadow-lg border-0">
                <SelectItem value="none">
                  No Room
                </SelectItem>
                {rooms.map((room) => (
                  <SelectItem key={room.id} value={room.id}>
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
            <Label className="text-label text-brand-secondary font-body uppercase tracking-wide">
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
              <div className="text-center py-6 rounded-[var(--radius)] shadow-subtle">
                <Target className="h-8 w-8 text-brand-dark/40 mx-auto mb-2" />
                <p className="text-sm text-brand-dark/40 font-body">No targets available</p>
                <p className="text-xs text-brand-dark/40 font-body">Add targets before creating a group</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto rounded-[var(--radius)] p-3 bg-white shadow-subtle">
                {availableTargets.map((target) => {
                  const statusDisplay = resolveStatusDisplay(target.status, target.activityStatus);
                  return (
                    <div
                    key={target.id}
                    className={`flex items-center justify-between p-3 rounded-[var(--radius)] cursor-pointer transition-all duration-200 ${
                      selectedTargets.includes(target.id)
                        ? 'bg-brand-primary/5 shadow-subtle'
                        : 'hover:bg-brand-primary/5'
                    }`}
                    onClick={() => handleTargetToggle(target.id)}
                  >
                    <div className="flex items-center gap-3">
                      <Target className="h-4 w-4 text-brand-primary flex-shrink-0" />
                      <div>
                        <p className="font-medium text-brand-dark text-sm font-body">{target.name}</p>
                        <span className={`text-xs font-body ${statusDisplay.className}`}>
                          {statusDisplay.label}
                        </span>
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
              variant="secondary"
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!groupName.trim() || selectedTargets.length < 2}
              className="bg-brand-primary hover:bg-brand-primary/90 text-white"
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
