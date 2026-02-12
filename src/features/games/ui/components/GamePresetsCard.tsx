import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Gamepad2, CheckCircle2, Trash2, Loader2, Building2, Clock3, Crosshair } from 'lucide-react';
import type { GamePreset } from '@/features/games';
import { renderPresetDuration } from '@/features/games/lib/telemetry-utils';

export type GamePresetsCardProps = {
  presets: GamePreset[];
  isLoading: boolean;
  isSessionLocked: boolean;
  applyingId: string | null;
  deletingId: string | null;
  onApply: (preset: GamePreset) => void;
  onDelete: (preset: GamePreset) => void;
};

// Presents available presets with quick apply/delete actions so operators can stage sessions instantly.
const _GamePresetsCard: React.FC<GamePresetsCardProps> = ({
  presets,
  isLoading,
  isSessionLocked,
  applyingId,
  deletingId,
  onApply,
  onDelete,
}) => {
  return (
    <Card className="bg-white border-gray-200 shadow-sm rounded-md md:rounded-lg">
      <CardContent className="p-[10px] space-y-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-brand-primary/10 text-brand-primary">
                <Gamepad2 className="h-4 w-4" />
              </span>
              <h2 className="font-heading text-lg text-brand-dark">Game Presets</h2>
            </div>
            <p className="text-xs text-brand-dark/60">
              Stage saved configurations with the same quick-glance layout as Step 3.
            </p>
          </div>
        </div>
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div
                key={index}
                className="rounded-md border border-gray-200 bg-gray-50 px-[10px] py-[10px] space-y-4"
              >
                <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-8 w-8 rounded-full bg-gray-200" />
                      <Skeleton className="h-5 w-48 bg-gray-200" />
                    </div>
                    <Skeleton className="h-3 w-40 bg-gray-200" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-9 w-24 rounded-md bg-gray-200" />
                    <Skeleton className="h-9 w-24 rounded-md bg-gray-200" />
                  </div>
                </div>
                <div className="grid gap-3 md:grid-cols-3">
                  {Array.from({ length: 3 }).map((__, innerIndex) => (
                    <div
                      key={innerIndex}
                      className="rounded-md border border-gray-200 bg-white px-[10px] py-[10px] flex items-start gap-3"
                    >
                      <Skeleton className="h-8 w-8 rounded-md bg-gray-200" />
                      <div className="space-y-2">
                        <Skeleton className="h-3 w-24 bg-gray-200" />
                        <Skeleton className="h-4 w-36 bg-gray-200" />
                      </div>
                    </div>
                  ))}
                </div>
                <Skeleton className="h-3 w-48 bg-gray-200" />
              </div>
            ))}
          </div>
        ) : presets.length === 0 ? (
          <div className="rounded-md border border-dashed border-brand-primary/40 bg-brand-primary/10 px-[10px] py-[10px] text-sm text-brand-dark/80 text-center">
            No presets yet
          </div>
        ) : (
          <div className="space-y-3">
            {presets.map((preset) => {
              const isApplyLoading = applyingId === preset.id;
              const isDeleteLoading = deletingId === preset.id;
              return (
                <div
                  key={preset.id}
                  className="rounded-md border border-gray-200 bg-gray-50 px-[10px] py-[10px] space-y-4 transition hover:border-brand-primary/40"
                >
                  <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                    <div className="space-y-1">
                      <p className="font-heading text-sm text-brand-dark text-left">{preset.name}</p>
                      <div className="text-[11px] uppercase tracking-wide text-brand-dark/50">
                        Saved {new Date(preset.updatedAt).toLocaleString()}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        className="bg-green-600 hover:bg-green-700 text-white"
                        onClick={() => onApply(preset)}
                        disabled={isSessionLocked || isApplyLoading}
                      >
                        {isApplyLoading ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Applying...
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="mr-2 h-4 w-4" />
                            Apply
                          </>
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onDelete(preset)}
                        disabled={isSessionLocked || isDeleteLoading}
                      >
                        {isDeleteLoading ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Deleting...
                          </>
                        ) : (
                          <>
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </>
                        )}
                      </Button>
                    </div>
                  </div>

                  <div className={`grid gap-3 ${preset.settings?.goalShotsPerTarget && Object.keys(preset.settings.goalShotsPerTarget as Record<string, number>).length > 0 ? 'md:grid-cols-4' : 'md:grid-cols-3'}`}>
                    <div className="rounded-md border border-gray-200 bg-white px-[10px] py-[10px] flex items-start gap-3">
                      <div className="rounded-md bg-brand-primary/10 p-2 text-brand-primary shadow-sm">
                        <Building2 className="h-4 w-4" />
                      </div>
                      <div className="flex flex-row items-baseline gap-2 md:flex-col md:space-y-1 text-sm">
                        <p className="text-xs font-medium uppercase tracking-wide text-brand-dark/60">Room</p>
                        <p className="font-medium text-brand-dark">
                          {preset.roomName ?? preset.roomId ?? 'Not included'}
                        </p>
                      </div>
                    </div>
                    <div className="rounded-md border border-gray-200 bg-white px-[10px] py-[10px] flex items-start gap-3">
                      <div className="rounded-md bg-brand-primary/10 p-2 text-brand-primary shadow-sm">
                        <Clock3 className="h-4 w-4" />
                      </div>
                      <div className="flex flex-row items-baseline gap-2 md:flex-col md:space-y-1 text-sm">
                        <p className="text-xs font-medium uppercase tracking-wide text-brand-dark/60">Duration</p>
                        <p className="font-medium text-brand-dark">
                          {renderPresetDuration(preset.durationSeconds)}
                        </p>
                      </div>
                    </div>
                    <div className="rounded-md border border-gray-200 bg-white px-[10px] py-[10px] flex items-start gap-3">
                      <div className="rounded-md bg-brand-primary/10 p-2 text-brand-primary shadow-sm">
                        <Crosshair className="h-4 w-4" />
                      </div>
                      <div className="flex flex-row items-baseline gap-2 md:flex-col md:space-y-1 text-sm">
                        <p className="text-xs font-medium uppercase tracking-wide text-brand-dark/60">Targets</p>
                        <p className="font-medium text-brand-dark">{preset.targetIds.length}</p>
                      </div>
                    </div>
                    {preset.settings?.goalShotsPerTarget &&
                     typeof preset.settings.goalShotsPerTarget === 'object' &&
                     !Array.isArray(preset.settings.goalShotsPerTarget) &&
                     Object.keys(preset.settings.goalShotsPerTarget as Record<string, number>).length > 0 && (
                      <div className="rounded-md border border-gray-200 bg-white px-[10px] py-[10px] flex items-start gap-3">
                        <div className="rounded-md bg-brand-primary/10 p-2 text-brand-primary shadow-sm">
                          <Gamepad2 className="h-4 w-4" />
                        </div>
                        <div className="flex flex-row items-baseline gap-2 md:flex-col md:space-y-1 text-sm">
                          <p className="text-xs font-medium uppercase tracking-wide text-brand-dark/60">Goal Shots</p>
                          <p className="font-medium text-brand-dark">
                            {(() => {
                              const goalShots = preset.settings.goalShotsPerTarget as Record<string, number>;
                              const goalValues = Object.values(goalShots);
                              if (goalValues.length === 0) return '—';
                              // If all targets have the same goal, show that number
                              const uniqueGoals = [...new Set(goalValues)];
                              if (uniqueGoals.length === 1) {
                                return uniqueGoals[0].toString();
                              }
                              // Otherwise show range or count
                              const min = Math.min(...goalValues);
                              const max = Math.max(...goalValues);
                              return min === max ? min.toString() : `${min}-${max}`;
                            })()}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  {preset.description && (
                    <p className="text-xs text-brand-dark/60">{preset.description}</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export const GamePresetsCard = React.memo(_GamePresetsCard);
GamePresetsCard.displayName = 'GamePresetsCard';
