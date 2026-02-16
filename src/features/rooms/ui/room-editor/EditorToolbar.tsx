import React, { useState } from 'react';
import { ArrowLeft, Save, Undo2, Redo2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { useRoomEditorStore } from './hooks/use-room-editor-store';

interface EditorToolbarProps {
  onSave: () => Promise<void>;
  isSaving: boolean;
  roomId?: string;
}

const EditorToolbar: React.FC<EditorToolbarProps> = ({ onSave, isSaving, roomId }) => {
  const navigate = useNavigate();
  const roomName = useRoomEditorStore((s) => s.roomName);
  const setRoomName = useRoomEditorStore((s) => s.setRoomName);
  const isDirty = useRoomEditorStore((s) => s.isDirty);
  const walls = useRoomEditorStore((s) => s.walls);
  const targets = useRoomEditorStore((s) => s.targets);
  const undo = useRoomEditorStore((s) => s.undo);
  const redo = useRoomEditorStore((s) => s.redo);
  const canUndo = useRoomEditorStore((s) => s.canUndo);
  const canRedo = useRoomEditorStore((s) => s.canRedo);
  const [isNavigating, setIsNavigating] = useState(false);
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);

  const hasContent = walls.length > 0 || targets.length > 0;

  const handleBack = () => {
    if (isDirty && hasContent) {
      setShowLeaveDialog(true);
      return;
    }
    navigate('/dashboard/rooms');
  };

  const handleSaveAndLeave = async () => {
    setIsNavigating(true);
    try {
      await onSave();
    } catch {
      if (!window.confirm('Failed to save. Leave anyway?')) {
        setIsNavigating(false);
        setShowLeaveDialog(false);
        return;
      }
    }
    navigate('/dashboard/rooms');
  };

  const handleDiscard = () => {
    try {
      localStorage.removeItem(`room-editor-draft-${roomId ?? 'new'}`);
    } catch { /* ignore */ }
    navigate('/dashboard/rooms');
  };

  return (
    <>
      <div className="h-14 bg-white border-b border-[rgba(28,25,43,0.08)] shadow-sm flex items-center justify-between px-4 shrink-0">
        {/* Left — Back + Room Name */}
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={handleBack}
            disabled={isNavigating}
            className="text-brand-dark/60 hover:bg-[rgba(206,62,10,0.08)]"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>

          <input
            type="text"
            value={roomName}
            onChange={(e) => setRoomName(e.target.value)}
            placeholder="Untitled Room"
            className="font-heading text-base font-semibold text-brand-dark bg-transparent border-none outline-none focus:ring-0 w-48 placeholder:text-brand-dark/30"
          />
        </div>

        {/* Right — Save + Undo/Redo */}
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={undo}
            disabled={!canUndo()}
            className="text-brand-dark/50 hover:bg-[rgba(206,62,10,0.08)] disabled:opacity-40"
          >
            <Undo2 className="w-4 h-4" />
          </Button>

          <Button
            variant="ghost"
            size="icon-sm"
            onClick={redo}
            disabled={!canRedo()}
            className="text-brand-dark/50 hover:bg-[rgba(206,62,10,0.08)] disabled:opacity-40"
          >
            <Redo2 className="w-4 h-4" />
          </Button>

          <Button
            onClick={onSave}
            disabled={isSaving || !isDirty}
            className="bg-brand-primary hover:bg-brand-primary/90 text-white relative"
            size="sm"
          >
            <Save className="w-4 h-4 mr-1.5" />
            {isSaving || isNavigating ? 'Saving...' : 'Save'}
            {isDirty && !isSaving && (
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-red-500" />
            )}
          </Button>
        </div>
      </div>

      {/* Unsaved changes confirmation */}
      <AlertDialog open={showLeaveDialog} onOpenChange={setShowLeaveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-heading">Unsaved Changes</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes to your room layout. Would you like to save before leaving?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0">
            <AlertDialogCancel disabled={isNavigating}>Cancel</AlertDialogCancel>
            <Button
              variant="destructive"
              onClick={handleDiscard}
              disabled={isNavigating}
              className="rounded-full"
            >
              Discard
            </Button>
            <AlertDialogAction
              onClick={handleSaveAndLeave}
              disabled={isNavigating}
              className="bg-brand-primary hover:bg-brand-primary/90"
            >
              {isNavigating ? 'Saving...' : 'Save & Leave'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default EditorToolbar;
