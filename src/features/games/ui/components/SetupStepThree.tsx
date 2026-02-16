import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Building2, Clock3, Crosshair, Play, Loader2, BookmarkPlus, Save } from 'lucide-react';
import type { NormalizedGameDevice } from '@/features/games/hooks/use-game-devices';
import type { Target } from '@/features/targets/schema';
import { deriveConnectionStatus } from '@/features/games/lib/device-status-utils';
import { getStatusDisplay } from '@/shared/constants/target-status';

export type SetupStepThreeProps = {
  // Review data
  sessionRoomName: string | null;
  selectedDevices: NormalizedGameDevice[];
  reviewTargets: NormalizedGameDevice[];
  remainingReviewTargetCount: number;
  formattedDurationLabel: string;
  canAdvanceToReview: boolean;
  canLaunchGame: boolean;
  isSessionLocked: boolean;
  isStarting: boolean;
  loadingDevices: boolean;

  // Goal shots
  goalShotsPerTarget: Record<string, number>;
  setGoalShotsPerTarget: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  targetById: Map<string, Target>;

  // Preset update
  activePresetName: string | null;
  isUpdatingPreset: boolean;

  // Actions
  onOpenStartDialog: () => void;
  onRequestSavePreset: () => void;
  onUpdatePreset: () => void;
};

// Step 3 content: review summary, goal shots, and launch button.
// Rendered inside the SetupStep accordion wrapper in games-page.tsx.
const _SetupStepThree: React.FC<SetupStepThreeProps> = ({
  sessionRoomName,
  selectedDevices,
  reviewTargets,
  remainingReviewTargetCount,
  formattedDurationLabel,
  canAdvanceToReview,
  canLaunchGame,
  isSessionLocked,
  isStarting,
  loadingDevices,
  goalShotsPerTarget,
  setGoalShotsPerTarget,
  targetById,
  activePresetName,
  isUpdatingPreset,
  onOpenStartDialog,
  onRequestSavePreset,
  onUpdatePreset,
}) => {
  return (
    <div className="space-y-4">
      {/* Summary strip */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm font-body text-brand-dark/70">
        <span className="flex items-center gap-1.5">
          <Crosshair className="h-3.5 w-3.5 text-brand-primary" />
          <span className="font-medium text-brand-dark">{selectedDevices.length}</span> targets
        </span>
        <span className="flex items-center gap-1.5">
          <Building2 className="h-3.5 w-3.5 text-brand-primary" />
          {sessionRoomName ?? 'No room'}
        </span>
        <span className="flex items-center gap-1.5">
          <Clock3 className="h-3.5 w-3.5 text-brand-primary" />
          {formattedDurationLabel}
        </span>
      </div>

      {/* Target chips */}
      {selectedDevices.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {reviewTargets.map((device) => {
            const connStatus = deriveConnectionStatus(device);
            const cfg = getStatusDisplay(connStatus);
            return (
              <span
                key={`review-${device.deviceId}`}
                className="inline-flex items-center gap-1.5 rounded-full bg-brand-primary/[0.05] px-3 py-1 text-xs font-medium text-brand-dark font-body"
              >
                <span className={`w-1.5 h-1.5 rounded-full ${cfg.dotColor}`} />
                {device.name ?? device.deviceId}
              </span>
            );
          })}
          {remainingReviewTargetCount > 0 && (
            <span className="text-xs text-brand-dark/40 font-body self-center">
              +{remainingReviewTargetCount} more
            </span>
          )}
        </div>
      )}

      {/* Goal shots */}
      {selectedDevices.length > 0 && (
        <div className="space-y-2">
          <p className="text-label text-brand-secondary font-body uppercase tracking-wide">
            Goal Shots (optional)
          </p>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {selectedDevices.slice(0, 5).map((device) => {
              const goalValue = goalShotsPerTarget[device.deviceId] ?? '';
              const targetRecord = targetById.get(device.deviceId);
              const displayName = targetRecord?.customName || device.name || device.deviceId;
              return (
                <div key={`goal-${device.deviceId}`} className="flex items-center gap-2">
                  <Label htmlFor={`goal-${device.deviceId}`} className="text-xs text-brand-dark/70 min-w-[80px] truncate font-body">
                    {displayName}
                  </Label>
                  <Input
                    id={`goal-${device.deviceId}`}
                    type="number"
                    min="1"
                    step="1"
                    value={goalValue}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value === '') {
                        setGoalShotsPerTarget((prev) => {
                          const next = { ...prev };
                          delete next[device.deviceId];
                          return next;
                        });
                      } else {
                        const numValue = parseInt(value, 10);
                        if (!isNaN(numValue) && numValue > 0) {
                          setGoalShotsPerTarget((prev) => ({
                            ...prev,
                            [device.deviceId]: numValue,
                          }));
                        }
                      }
                    }}
                    disabled={isSessionLocked}
                    placeholder="—"
                    className="h-7 text-xs"
                  />
                </div>
              );
            })}
            {selectedDevices.length > 5 && (
              <p className="text-xs text-brand-dark/60 italic font-body">
                +{selectedDevices.length - 5} more targets
              </p>
            )}
          </div>
        </div>
      )}

      {/* Action row */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="text-brand-primary text-xs h-8 px-4 whitespace-nowrap"
            onClick={onRequestSavePreset} disabled={isSessionLocked || selectedDevices.length === 0}>
            <BookmarkPlus className="h-3.5 w-3.5" />
            Save current setup
          </Button>
          {activePresetName && (
            <Button variant="ghost" size="sm" className="text-brand-primary text-xs h-8 px-4 whitespace-nowrap"
              onClick={onUpdatePreset} disabled={isSessionLocked || selectedDevices.length === 0 || isUpdatingPreset}>
              {isUpdatingPreset ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              Update &ldquo;{activePresetName}&rdquo;
            </Button>
          )}
        </div>
        <Button
          size="lg"
          onClick={onOpenStartDialog}
          disabled={!canLaunchGame || isStarting || loadingDevices}
          className="shadow-[0_4px_16px_rgba(206,62,10,0.3)] uppercase tracking-wide text-sm h-12 px-8 ml-auto shrink-0"
        >
          {isStarting ? (
            <><Loader2 className="h-4 w-4 animate-spin" />Starting...</>
          ) : (
            <><Play className="h-4 w-4" />Start Session</>
          )}
        </Button>
      </div>

      {!canLaunchGame && (
        <p className="text-xs text-brand-dark/40 font-body">
          Complete the previous steps with at least one online or standby target to enable launch.
        </p>
      )}
    </div>
  );
};

export const SetupStepThree = React.memo(_SetupStepThree);
SetupStepThree.displayName = 'SetupStepThree';
