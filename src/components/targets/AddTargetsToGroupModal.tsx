import React, { useCallback, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Plus, Target } from 'lucide-react';
import type { Target as TargetType } from '@/features/targets/schema';

interface AddTargetsToGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddTargets: (targetIds: string[]) => void;
  availableTargets: Array<{
    id: string;
    name: string;
    status: TargetType['status'] | null | undefined;
    activityStatus?: TargetType['activityStatus'] | null;
  }>;
  groupName: string;
}

const AddTargetsToGroupModal: React.FC<AddTargetsToGroupModalProps> = ({
  isOpen,
  onClose,
  onAddTargets,
  availableTargets,
  groupName
}) => {
  const [selectedTargets, setSelectedTargets] = useState<string[]>([]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (selectedTargets.length === 0) {
      return;
    }

    onAddTargets(selectedTargets);

    // Reset form
    setSelectedTargets([]);
    onClose();
  };

  const handleTargetToggle = (targetId: string) => {
    setSelectedTargets(prev => {
      const newSelection = prev.includes(targetId) 
        ? prev.filter(id => id !== targetId)
        : [...prev, targetId];
      
      return newSelection;
    });
  };

  const resolveStatusDisplay = useCallback(
    (status: TargetType['status'] | null | undefined, _activityStatus?: TargetType['activityStatus'] | null) => {
      const normalizedStatus = status ?? 'offline';

      if (normalizedStatus === 'offline') {
        return {
          label: 'Offline',
          className: 'bg-gray-100 text-gray-600',
        };
      }

      if (normalizedStatus === 'online') {
        return {
          label: 'Active',
          className: 'bg-green-100 text-green-800',
        };
      }

      // standby = powered on & idle
      return {
        label: 'Ready',
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
            Add Targets to {groupName}
          </DialogTitle>
          <DialogDescription className="text-brand-dark/70">
            Select targets to add to this group.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Target Selection */}
          <div className="space-y-3">
            <Label className="text-sm font-medium text-brand-dark">
              Select Targets
            </Label>
            
            {availableTargets.length === 0 ? (
              <div className="text-center py-6 bg-brand-secondary/5 rounded-lg border border-gray-200">
                <Target className="h-8 w-8 text-brand-primary/50 mx-auto mb-2" />
                <p className="text-sm text-brand-dark/70">No targets available</p>
                <p className="text-xs text-brand-dark/50">All targets are already in this group</p>
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
              disabled={selectedTargets.length === 0}
              className="bg-brand-primary hover:bg-brand-primary/90 text-white shadow-lg"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add {selectedTargets.length > 0 ? `${selectedTargets.length} ` : ''}Target{selectedTargets.length !== 1 ? 's' : ''}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddTargetsToGroupModal;
