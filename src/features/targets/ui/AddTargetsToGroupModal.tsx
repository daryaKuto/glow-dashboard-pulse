import React, { useCallback, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Plus, Target } from 'lucide-react';
import type { Target as TargetType } from '@/features/targets/schema';
import { getStatusDisplay } from '@/shared/constants/target-status';

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
            Add Targets to {groupName}
          </DialogTitle>
          <DialogDescription className="text-brand-dark/70">
            Select targets to add to this group.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Target Selection */}
          <div className="space-y-3">
            <Label className="text-label text-brand-secondary font-body uppercase tracking-wide">
              Select Targets
            </Label>
            
            {availableTargets.length === 0 ? (
              <div className="text-center py-6 rounded-[var(--radius)] shadow-subtle">
                <Target className="h-8 w-8 text-brand-dark/40 mx-auto mb-2" />
                <p className="text-sm text-brand-dark/40 font-body">No targets available</p>
                <p className="text-xs text-brand-dark/40 font-body">All targets are already in this group</p>
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
              <div className="text-sm text-brand-primary">
                {selectedTargets.length} target{selectedTargets.length !== 1 ? 's' : ''} selected
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
              disabled={selectedTargets.length === 0}
              className="bg-brand-primary hover:bg-brand-primary/90 text-white"
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
