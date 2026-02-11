import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Building2, Clock3, Crosshair, Gamepad2, Play, Loader2 } from 'lucide-react';
import type { NormalizedGameDevice } from '@/features/games/hooks/use-game-devices';
import type { Target } from '@/features/targets/schema';

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

  // Status helpers
  deriveIsOnline: (device: NormalizedGameDevice) => boolean;

  // Actions
  onOpenStartDialog: () => void;
  onRequestSavePreset: () => void;
};

// Displays the Step 3 setup card: review summary grid (Room, Targets, Duration, Goal Shots),
// Save as Preset button, and Start Game button.
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
  deriveIsOnline,
  onOpenStartDialog,
  onRequestSavePreset,
}) => {
  return (
    <Card className="bg-white border-gray-200 shadow-sm rounded-md md:rounded-lg">
      <CardContent className="p-[10px] space-y-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center rounded-full bg-brand-primary/10 px-2.5 py-0.5 text-xs font-semibold text-brand-primary">
              Step 3
            </span>
            <span className="text-xs font-medium uppercase tracking-wide text-brand-dark/60">
              Review & Launch
            </span>
          </div>
          <h2 className="font-heading text-lg text-brand-dark text-left">Review selections & start game</h2>
          <p className="text-xs text-brand-dark/60 text-left">Confirm the selection before starting the game.</p>
        </div>
        <div className="space-y-4">
          <div className="flex flex-col gap-3 text-left items-stretch md:grid md:grid-cols-4 md:gap-4 md:overflow-visible md:pb-0">
            <div className="md:min-w-0">
              <div className="h-full rounded-md border border-gray-200 bg-gray-50 px-[10px] py-[10px] text-left">
                <div className="flex items-start gap-3">
                  <div className="rounded-md bg-white p-3 text-brand-primary shadow-sm">
                    <Building2 className="h-6 w-6" />
                  </div>
                  <div className="flex-1 space-y-1 text-sm text-left">
                    <p className="text-xs font-medium uppercase tracking-wide text-brand-dark/60">Room</p>
                    <p className="font-medium text-brand-dark">
                      {sessionRoomName ?? 'No room selected'}
                    </p>
                    {!sessionRoomName && (
                      <p className="text-xs text-brand-dark/60">
                        Assign a room in Step 1 to keep device groups organized.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
            <div className="md:min-w-0">
              <div className="h-full rounded-md border border-gray-200 bg-gray-50 px-[10px] py-[10px] text-left">
                <div className="flex flex-col gap-3 text-sm text-left">
                  <div className="flex items-start gap-3">
                    <div className="rounded-md bg-white p-3 text-brand-primary shadow-sm">
                      <Crosshair className="h-6 w-6" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-medium uppercase tracking-wide text-brand-dark/60">Targets</p>
                      <span className="text-xs font-semibold text-brand-dark">
                        {selectedDevices.length} selected
                      </span>
                    </div>
                  </div>
                  {selectedDevices.length === 0 ? (
                    <div className="text-xs text-brand-dark/60">
                      No targets staged yet. Select at least one in Step 1.
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2 md:min-w-0">
                      {reviewTargets.map((device) => {
                        const isOnline = deriveIsOnline(device);
                        return (
                          <span
                            key={`review-${device.deviceId}`}
                            className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium ${
                              isOnline
                                ? 'border-gray-200 bg-white text-brand-dark'
                                : 'border-red-200 bg-red-50 text-red-600'
                            }`}
                          >
                            {device.name ?? device.deviceId}
                            {!isOnline && (
                              <span className="text-[10px] font-semibold uppercase">Offline</span>
                            )}
                          </span>
                        );
                      })}
                      {remainingReviewTargetCount > 0 && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-brand-dark/60">
                          +{remainingReviewTargetCount} more target
                          {remainingReviewTargetCount === 1 ? '' : 's'}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="md:min-w-0">
              <div className="h-full rounded-md border border-gray-200 bg-gray-50 px-[10px] py-[10px] text-left">
                <div className="flex items-start gap-3">
                  <div className="rounded-md bg-white p-3 text-brand-primary shadow-sm">
                    <Clock3 className="h-6 w-6" />
                  </div>
                  <div className="flex-1 space-y-1 text-sm text-left">
                    <p className="text-xs font-medium uppercase tracking-wide text-brand-dark/60">Duration</p>
                    <p className="font-medium text-brand-dark">{formattedDurationLabel}</p>
                    {!canAdvanceToReview && (
                      <p className="text-xs text-brand-dark/60">
                        Choose a duration in Step 2 or enable no time limit.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
            <div className="md:min-w-0">
              <div className="h-full rounded-md border border-gray-200 bg-gray-50 px-[10px] py-[10px] text-left">
                <div className="flex flex-col gap-3 text-sm text-left">
                  <div className="flex items-start gap-3">
                    <div className="rounded-md bg-white p-3 text-brand-primary shadow-sm">
                      <Gamepad2 className="h-6 w-6" />
                    </div>
                    <div className="flex-1 space-y-1">
                      <p className="text-xs font-medium uppercase tracking-wide text-brand-dark/60">Goal Shots</p>
                      <p className="text-xs text-brand-dark/60">
                        Optional: Set target goals
                      </p>
                    </div>
                  </div>
                  {selectedDevices.length === 0 ? (
                    <div className="text-xs text-brand-dark/60">
                      Select targets first
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {selectedDevices.slice(0, 5).map((device) => {
                        const goalValue = goalShotsPerTarget[device.deviceId] ?? '';
                        const targetRecord = targetById.get(device.deviceId);
                        const displayName = targetRecord?.customName || device.name || device.deviceId;
                        return (
                          <div key={`goal-${device.deviceId}`} className="flex items-center gap-2">
                            <Label htmlFor={`goal-${device.deviceId}`} className="text-xs text-brand-dark/70 min-w-[80px] truncate">
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
                        <p className="text-xs text-brand-dark/60 italic">
                          +{selectedDevices.length - 5} more targets
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-between sm:items-center">
          <Button
            variant="destructive"
            size="sm"
            onClick={onRequestSavePreset}
            disabled={isSessionLocked || selectedDevices.length === 0}
          >
            Save as preset
          </Button>
          <Button
            onClick={onOpenStartDialog}
            disabled={!canLaunchGame || isStarting || loadingDevices}
            className="bg-green-600 hover:bg-green-700 text-white w-full sm:w-auto"
          >
            {isStarting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Starting...
              </>
            ) : (
              <>
                <Play className="mr-2 h-4 w-4" />
                Start Game
              </>
            )}
          </Button>
        </div>
        {!canLaunchGame && (
          <p className="text-xs text-brand-dark/60">
            Complete the previous steps with at least one online or standby target to enable launch.
          </p>
        )}
      </CardContent>
    </Card>
  );
};

export const SetupStepThree = React.memo(_SetupStepThree);
SetupStepThree.displayName = 'SetupStepThree';
