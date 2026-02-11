import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { useRemoveTargetCustomName, useSetTargetCustomName } from '@/features/targets';
import { toast } from '@/components/ui/sonner';

interface RenameTargetDialogProps {
  isOpen: boolean;
  onClose: () => void;
  targetId: string;
  originalName: string;
  currentCustomName?: string | null;
  onRename: (targetId: string, customName: string) => Promise<void>;
}

const RenameTargetDialog: React.FC<RenameTargetDialogProps> = ({
  isOpen,
  onClose,
  targetId,
  originalName,
  currentCustomName,
  onRename
}) => {
  const [customName, setCustomName] = useState(currentCustomName || '');
  const [isSaving, setIsSaving] = useState(false);
  const setCustomNameMutation = useSetTargetCustomName();
  const removeCustomNameMutation = useRemoveTargetCustomName();

  useEffect(() => {
    if (isOpen) {
      setCustomName(currentCustomName || '');
    }
  }, [isOpen, currentCustomName]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!customName.trim()) {
      toast.error('Target name cannot be empty');
      return;
    }

    if (customName.trim() === originalName) {
      // If custom name matches original, remove custom name
      try {
        setIsSaving(true);
        await removeCustomNameMutation.mutateAsync({ targetId });
        await onRename(targetId, originalName);
        toast.success('Target name reset to original');
        onClose();
      } catch (error) {
        console.error('Error removing custom name:', error);
        toast.error('Failed to reset target name');
      } finally {
        setIsSaving(false);
      }
      return;
    }

    try {
      setIsSaving(true);
      await setCustomNameMutation.mutateAsync({
        targetId,
        originalName,
        customName: customName.trim(),
      });
      await onRename(targetId, customName.trim());
      toast.success('Target renamed successfully');
      onClose();
    } catch (error) {
      console.error('Error renaming target:', error);
      toast.error('Failed to rename target');
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = async () => {
    try {
      setIsSaving(true);
      await removeCustomNameMutation.mutateAsync({ targetId });
      await onRename(targetId, originalName);
      toast.success('Target name reset to original');
      onClose();
    } catch (error) {
      console.error('Error resetting target name:', error);
      toast.error('Failed to reset target name');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="font-heading">Rename Target</DialogTitle>
          <DialogDescription className="text-brand-dark/70">
            Set a custom name for this target. This name will only be visible to you.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="original-name" className="text-sm font-medium text-brand-dark">
              Original Name
            </Label>
            <Input
              id="original-name"
              value={originalName}
              disabled
              className="bg-gray-50 border-gray-200 text-brand-dark/70"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="custom-name" className="text-sm font-medium text-brand-dark">
              Custom Name *
            </Label>
            <Input
              id="custom-name"
              placeholder="Enter custom name"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              className="bg-white border-gray-200 text-brand-dark"
              required
              autoFocus
            />
          </div>
          <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2">
            {currentCustomName && (
              <Button
                type="button"
                variant="outline"
                onClick={handleReset}
                disabled={isSaving}
                className="border-gray-200 text-brand-dark hover:bg-gray-50"
              >
                Reset to Original
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSaving}
              className="border-gray-200 text-brand-dark hover:bg-gray-50"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!customName.trim() || isSaving}
              className="bg-brand-primary hover:bg-brand-primary/90 text-white"
            >
              {isSaving ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default RenameTargetDialog;
