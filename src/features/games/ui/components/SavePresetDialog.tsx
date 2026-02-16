import React from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Loader2 } from 'lucide-react';
import { renderPresetDuration } from '@/features/games/lib/telemetry-utils';

export type SavePresetDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isSaving: boolean;
  name: string;
  onNameChange: (value: string) => void;
  description: string;
  onDescriptionChange: (value: string) => void;
  targetCount: number;
  includeRoom: boolean;
  canIncludeRoom: boolean;
  onIncludeRoomChange: (next: boolean) => void;
  durationValue: string;
  onDurationValueChange: (value: string) => void;
  onSubmit: () => void;
  roomName: string | null;
};

const _SavePresetDialog: React.FC<SavePresetDialogProps> = ({
  open,
  onOpenChange,
  isSaving,
  name,
  onNameChange,
  description,
  onDescriptionChange,
  targetCount,
  includeRoom,
  canIncludeRoom,
  onIncludeRoomChange,
  durationValue,
  onDurationValueChange,
  onSubmit,
  roomName,
}) => {
  const trimmedDurationValue = durationValue.trim();
  const parsedDuration = Number(trimmedDurationValue);
  const hasDurationInput = trimmedDurationValue.length > 0;
  const hasValidDuration = Number.isFinite(parsedDuration) && parsedDuration > 0;
  const durationSeconds = hasValidDuration ? parsedDuration : null;
  const formattedDuration = renderPresetDuration(durationSeconds);
  const disableSave =
    isSaving ||
    name.trim().length === 0 ||
    targetCount === 0 ||
    (hasDurationInput && !hasValidDuration);
  const durationInputId = 'preset-duration';
  const roomToggleId = 'preset-include-room';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100vw-30px)] sm:max-w-lg mx-auto px-4 py-4 sm:px-6 sm:py-6 shadow-elevated rounded-[var(--radius-lg)] border-0">
        <DialogHeader className="space-y-1 sm:space-y-1.5">
          <DialogTitle className="text-lg sm:text-xl font-heading">
            Save Session As Preset
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            Capture the current target selection so operators can reapply it from the presets list.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 sm:space-y-4">
          <div className="space-y-2">
            <Label htmlFor="preset-name" className="text-label text-brand-secondary uppercase tracking-wide font-body">
              Preset name
            </Label>
            <Input
              id="preset-name"
              placeholder="Example: Rapid Drill Alpha"
              value={name}
              onChange={(event) => onNameChange(event.target.value)}
              autoFocus
              disabled={isSaving}
              className="w-full"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="preset-description" className="text-label text-brand-secondary uppercase tracking-wide font-body">
              Description (optional)
            </Label>
            <Textarea
              id="preset-description"
              placeholder="Add context or instructions for operators."
              value={description}
              onChange={(event) => onDescriptionChange(event.target.value)}
              disabled={isSaving}
              rows={3}
              className="w-full resize-none"
            />
          </div>

          <div className="rounded-[var(--radius)] bg-brand-primary/[0.05] px-3 py-2 text-xs sm:text-sm text-brand-dark/70 font-body">
            {targetCount > 0 ? `${targetCount} target${targetCount === 1 ? '' : 's'} will be included in this preset.` : 'Select targets before saving the preset.'}
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-[var(--radius)] bg-brand-primary/[0.03] px-3 py-3">
            <div className="space-y-1 text-sm text-brand-dark/80 flex-1">
              <p className="font-medium font-body">Attach room to preset</p>
              <p className="text-xs text-brand-dark/60 font-body">
                {roomName ? `Current room: ${roomName}` : 'No room assigned to this selection yet.'}
              </p>
            </div>
            <Switch
              id={roomToggleId}
              checked={includeRoom && canIncludeRoom}
              onCheckedChange={(value) => onIncludeRoomChange(Boolean(value))}
              disabled={isSaving || !canIncludeRoom}
              className="shrink-0"
            />
          </div>

          <div className="space-y-2 rounded-[var(--radius)] bg-brand-primary/[0.03] px-3 py-3">
            <div className="space-y-1 text-sm text-brand-dark/80">
              <p className="font-medium font-body">Duration (seconds)</p>
            </div>
            <Input
              id={durationInputId}
              type="number"
              inputMode="numeric"
              min={10}
              step={10}
              value={durationValue}
              onChange={(event) => onDurationValueChange(event.target.value)}
              placeholder="120"
              disabled={isSaving}
              className="w-full"
            />
            <p className="text-[11px] text-brand-dark/60">Formatted: {formattedDuration}</p>
          </div>

        </div>

        <DialogFooter className="mt-4 sm:mt-6 flex-col sm:flex-row gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
            className="w-full sm:w-auto"
          >
            Cancel
          </Button>
          <Button
            onClick={onSubmit}
            disabled={disableSave}
            className="w-full sm:w-auto bg-brand-primary hover:bg-brand-primary/90"
          >
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              'Save preset'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export const SavePresetDialog = React.memo(_SavePresetDialog);
SavePresetDialog.displayName = 'SavePresetDialog';
