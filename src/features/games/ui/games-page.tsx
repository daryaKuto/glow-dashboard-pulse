import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
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
import { Gamepad2, Play, AlertCircle, CheckCircle2, Trash2, Loader2, Building2, Clock3, Crosshair } from 'lucide-react';
import Header from '@/components/shared/Header';
import Sidebar from '@/components/shared/Sidebar';
import MobileDrawer from '@/components/shared/MobileDrawer';
import { useIsMobile } from '@/hooks/use-mobile';
import { toast } from '@/components/ui/sonner';
import { Skeleton } from '@/components/ui/skeleton';
import type {
  DeviceStatus,
  GameHistory,
  SessionHitRecord,
  SessionSplit,
  SessionTransition,
} from '@/services/device-game-flow';
import { useGameDevices, type NormalizedGameDevice, DEVICE_ONLINE_STALE_THRESHOLD_MS } from '@/hooks/useGameDevices';
import { useTargets, type Target } from '@/store/useTargets';
import { useRooms } from '@/store/useRooms';
import { useTargetGroups } from '@/store/useTargetGroups';
import { useGameTelemetry, type SplitRecord, type TransitionRecord } from '@/hooks/useGameTelemetry';
import { useThingsboardToken } from '@/hooks/useThingsboardToken';
import { useDirectTbTelemetry } from '@/hooks/useDirectTbTelemetry';
import {
  ensureTbAuthToken,
  tbSetShared,
  tbSendOneway,
} from '@/services/thingsboard-client';
import {
  fetchAllGameHistory as fetchPersistedGameHistory,
  saveGameHistory,
  mapSummaryToGameHistory,
  type GameHistorySummaryPayload,
} from '@/services/game-history';
import { useSessionActivation } from '@/hooks/useSessionActivation';
import { useAuth } from '@/providers/AuthProvider';
import { getRecentSessionsService } from '@/features/profile/service';
import { throttledLogOnChange, throttledLog } from '@/utils/log-throttle';
import { mark, measure, logPerformanceSummary } from '@/utils/performance-monitor';
import type { RecentSession } from '@/features/profile';
import { useTargetCustomNames } from '@/features/targets';
import {
  LiveSessionCard,
  LiveSessionCardSkeleton,
  TargetSelectionCard,
  TargetSelectionSkeleton,
  RoomSelectionCard,
  RoomSelectionSkeleton,
  GroupSelectionCard,
  GroupSelectionSkeleton,
  StartSessionDialog,
} from '@/components/games';
import type { LiveSessionSummary } from '@/components/games/types';

import { useSessionTimer, formatSessionDuration, type SessionLifecycle, type SessionHitEntry } from '@/components/game-session/sessionState';
import { useGamePresets } from '@/store/useGamePresets';
import type { GamePreset } from '@/lib/edge';

type AxiosErrorLike = {
  isAxiosError?: boolean;
  response?: { status?: unknown };
  code?: string;
  message?: unknown;
};

const StepOneSkeleton: React.FC = () => (
  <Card className="bg-white border-gray-200 shadow-sm rounded-md md:rounded-lg">
    <CardContent className="p-[10px] space-y-4">
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Skeleton className="h-5 w-16 rounded-full bg-gray-200" />
          <Skeleton className="h-4 w-40 bg-gray-200" />
        </div>
        <Skeleton className="h-5 w-52 bg-gray-200" />
        <Skeleton className="h-3 w-60 bg-gray-200" />
      </div>
      <div className="grid gap-4 md:grid-cols-3 md:items-start">
        <RoomSelectionSkeleton />
        <GroupSelectionSkeleton />
        <TargetSelectionSkeleton />
      </div>
    </CardContent>
  </Card>
);

const StepTwoSkeleton: React.FC = () => (
  <Card className="bg-white border-gray-200 shadow-sm rounded-md md:rounded-lg">
    <CardContent className="p-[10px] space-y-4">
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Skeleton className="h-5 w-16 rounded-full bg-gray-200" />
          <Skeleton className="h-4 w-32 bg-gray-200" />
        </div>
        <Skeleton className="h-5 w-48 bg-gray-200" />
        <Skeleton className="h-3 w-56 bg-gray-200" />
      </div>
      <div className="space-y-4 rounded-md border border-gray-200 bg-gray-50 px-[10px] py-[10px]">
        <div className="space-y-2">
          <Skeleton className="h-4 w-32 bg-gray-200" />
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-9 w-16 rounded-md bg-gray-200" />
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <Skeleton className="h-4 w-40 bg-gray-200" />
          <Skeleton className="h-10 w-full rounded-md bg-gray-200" />
          <Skeleton className="h-3 w-48 bg-gray-200" />
        </div>
      </div>
    </CardContent>
  </Card>
);

const StepThreeSkeleton: React.FC = () => (
  <Card className="bg-white border-gray-200 shadow-sm rounded-md md:rounded-lg">
    <CardContent className="p-[10px] space-y-4">
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Skeleton className="h-5 w-16 rounded-full bg-gray-200" />
          <Skeleton className="h-4 w-40 bg-gray-200" />
        </div>
        <Skeleton className="h-5 w-56 bg-gray-200" />
        <Skeleton className="h-3 w-64 bg-gray-200" />
      </div>
      <div className="flex flex-col gap-3 text-left items-stretch md:grid md:grid-cols-4 md:gap-4 md:overflow-visible md:pb-0">
        <div className="md:min-w-0">
          <div className="h-full rounded-md border border-gray-200 bg-gray-50 px-[10px] py-[10px] text-left">
            <div className="flex items-start gap-3">
              <Skeleton className="h-12 w-12 rounded-md bg-gray-200" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3 w-28 bg-gray-200" />
                <Skeleton className="h-4 w-36 bg-gray-200" />
                <Skeleton className="h-3 w-32 bg-gray-200" />
              </div>
            </div>
          </div>
        </div>
        <div className="md:min-w-0">
          <div className="h-full rounded-md border border-gray-200 bg-gray-50 px-[10px] py-[10px] text-left">
            <div className="flex items-start gap-3">
              <Skeleton className="h-12 w-12 rounded-md bg-gray-200" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3 w-28 bg-gray-200" />
                <Skeleton className="h-4 w-36 bg-gray-200" />
                <Skeleton className="h-3 w-40 bg-gray-200" />
              </div>
            </div>
          </div>
        </div>
        <div className="md:min-w-0">
          <div className="h-full rounded-md border border-gray-200 bg-gray-50 px-[10px] py-[10px] text-left">
            <div className="flex items-start gap-3">
              <Skeleton className="h-12 w-12 rounded-md bg-gray-200" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3 w-28 bg-gray-200" />
                <Skeleton className="h-4 w-36 bg-gray-200" />
                <Skeleton className="h-3 w-32 bg-gray-200" />
              </div>
            </div>
          </div>
        </div>
        <div className="md:min-w-0">
          <div className="h-full rounded-md border border-gray-200 bg-gray-50 px-[10px] py-[10px] text-left">
            <div className="flex items-start gap-3">
              <Skeleton className="h-12 w-12 rounded-md bg-gray-200" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3 w-28 bg-gray-200" />
                <Skeleton className="h-4 w-36 bg-gray-200" />
                <Skeleton className="h-3 w-32 bg-gray-200" />
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:justify-between sm:items-center">
        <Skeleton className="h-9 w-full sm:w-40 rounded-md bg-gray-200" />
        <Skeleton className="h-10 w-full sm:w-48 rounded-md bg-gray-200" />
      </div>
      <Skeleton className="h-3 w-64 bg-gray-200" />
    </CardContent>
  </Card>
);

const isAxiosErrorLike = (error: unknown): error is AxiosErrorLike => {
  if (!error || typeof error !== 'object') {
    return false;
  }
  return Boolean((error as { isAxiosError?: unknown }).isAxiosError);
};

const isAxiosNetworkError = (error: unknown): boolean => {
  if (!isAxiosErrorLike(error)) {
    return false;
  }
  const status = error.response?.status;
  if (typeof status === 'number') {
    return false;
  }
  const code = typeof error.code === 'string' ? error.code : null;
  if (code === 'ERR_NETWORK') {
    return true;
  }
  const message = typeof error.message === 'string' ? error.message : '';
  return message.toLowerCase().includes('network error');
};

const resolveHttpStatus = (error: unknown): number | undefined => {
  if (!error || typeof error !== 'object') {
    return undefined;
  }
  if ('status' in error && !(error instanceof Response)) {
    const status = (error as { status?: unknown }).status;
    if (typeof status === 'number') {
      return status;
    }
  }
  if (isAxiosErrorLike(error) && error.response && typeof error.response.status === 'number') {
    return error.response.status as number;
  }
  if (error instanceof Response) {
    return error.status;
  }
  return undefined;
};

// Formats preset duration seconds into mm:ss while tolerating nulls.
const renderPresetDuration = (durationSeconds: number | null): string => {
  if (!Number.isFinite(durationSeconds) || durationSeconds === null || durationSeconds <= 0) {
    return '—';
  }
  return formatSessionDuration(durationSeconds);
};

const resolvePresetDurationSeconds = (preset: GamePreset): number | null => {
  const candidate = preset.durationSeconds;
  if (typeof candidate === 'number' && Number.isFinite(candidate) && candidate > 0) {
    return Math.round(candidate);
  }
  const settingsValue =
    preset.settings != null
      ? (preset.settings as Record<string, unknown>)['desiredDurationSeconds']
      : null;
  if (typeof settingsValue === 'number' && Number.isFinite(settingsValue) && settingsValue > 0) {
    return Math.round(settingsValue);
  }
  return null;
};

const REVIEW_TARGET_DISPLAY_LIMIT = 6;

type GamePresetsCardProps = {
  presets: GamePreset[];
  isLoading: boolean;
  isSessionLocked: boolean;
  applyingId: string | null;
  deletingId: string | null;
  onApply: (preset: GamePreset) => void;
  onDelete: (preset: GamePreset) => void;
};

// Presents available presets with quick apply/delete actions so operators can stage sessions instantly.
const GamePresetsCard: React.FC<GamePresetsCardProps> = ({
  presets,
  isLoading,
  isSessionLocked,
  applyingId,
  deletingId,
  onApply,
  onDelete,
}) => {
  console.debug('[GamePresetsCard] render', {
    at: new Date().toISOString(),
    presetCount: presets.length,
    isLoading,
    applyingId,
    deletingId,
  });
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

type SavePresetDialogProps = {
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

const SavePresetDialog: React.FC<SavePresetDialogProps> = ({
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
  useEffect(() => {
    if (!open) {
      return;
    }
    console.debug('[SavePresetDialog] state', {
      at: new Date().toISOString(),
      isSaving,
      nameLength: name.length,
      targetCount,
      includeRoom,
      durationValue,
    });
  }, [open, isSaving, name.length, targetCount, includeRoom, durationValue]);
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
      <DialogContent className="max-w-[calc(100vw-30px)] sm:max-w-lg mx-auto px-4 py-4 sm:px-6 sm:py-6 rounded-lg sm:rounded-lg">
        <DialogHeader className="space-y-1 sm:space-y-1.5">
          <DialogTitle className="text-lg sm:text-xl font-heading">Save Session As Preset</DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            Capture the current target selection so operators can reapply it from the presets list.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 sm:space-y-4">
          <div className="space-y-2">
            <Label htmlFor="preset-name" className="text-sm font-medium text-brand-dark">
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
            <Label htmlFor="preset-description" className="text-sm font-medium text-brand-dark">
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

          <div className="rounded-md border border-dashed border-brand-secondary/40 bg-brand-secondary/10 px-3 py-2 text-xs sm:text-sm text-brand-dark/70">
            {targetCount > 0 ? `${targetCount} target${targetCount === 1 ? '' : 's'} will be included in this preset.` : 'Select targets before saving the preset.'}
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-md border border-gray-200 bg-white px-3 py-3">
            <div className="space-y-1 text-sm text-brand-dark/80 flex-1">
              <p className="font-medium">Attach room to preset</p>
              <p className="text-xs text-brand-dark/60">
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

          <div className="space-y-2 rounded-md border border-gray-200 bg-white px-3 py-3">
            <div className="space-y-1 text-sm text-brand-dark/80">
              <p className="font-medium">Duration (seconds)</p>
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

const DIRECT_TB_CONTROL_ENABLED = true;
const RECENT_SESSION_STORAGE_KEY = 'glow-dashboard:last-session';

type GameSetupStep = 'select-targets' | 'select-duration' | 'review';

const resolveNumericTelemetryValue = (input: unknown): number | null => {
  if (typeof input === 'number' && Number.isFinite(input)) {
    return input;
  }
  if (typeof input === 'string') {
    const numeric = Number(input);
    return Number.isFinite(numeric) ? numeric : null;
  }
  if (Array.isArray(input) && input.length > 0) {
    const first = input[0];
    if (typeof first === 'number' && Number.isFinite(first)) {
      return first;
    }
    if (first && typeof first === 'object') {
      const firstRecord = first as Record<string, unknown>;
      if ('value' in firstRecord) {
        const candidate = firstRecord.value;
        if (candidate != null) {
          return resolveNumericTelemetryValue(candidate);
        }
      }
    }
  }
  return null;
};

const getTargetTotalShots = (target: Target): number | null => {
  const candidates: Array<unknown> = [
    target.totalShots,
    target.lastHits,
    target.telemetry?.hits,
    target.telemetry?.totalShots,
  ];

  for (const candidate of candidates) {
    const resolved = resolveNumericTelemetryValue(candidate);
    if (typeof resolved === 'number') {
      return resolved;
    }
  }
  return null;
};

const getTargetBestScore = (target: Target): number | null => {
  const candidates: Array<unknown> = [
    target.lastHits,
    target.totalShots,
    target.telemetry?.score,
    target.telemetry?.hits,
  ];

  for (const candidate of candidates) {
    const resolved = resolveNumericTelemetryValue(candidate);
    if (typeof resolved === 'number') {
      return resolved;
    }
  }

  return null;
};

// Main Live Game Control page: orchestrates device state, telemetry streams, and session history for operator control.
const Games: React.FC = () => {
  mark('games-page-render-start');
  const isMobile = useIsMobile();
  const { user } = useAuth();
  // Tracks the shadcn sidebar state so we know whether to render the drawer on small screens.
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Holds the persisted session summaries displayed in the Session History card.
  const [gameHistory, setGameHistory] = useState<GameHistory[]>([]);
  // Mirrors the fetch lifecycle so the history section can show skeletons/spinners.
  const [isHistoryLoading, setIsHistoryLoading] = useState(true);
  const { isLoading: loadingDevices, refresh: refreshGameDevices } = useGameDevices({ immediate: false });
  const targetsSnapshot = useTargets((state) => state.targets);
  const targetsStoreLoading = useTargets((state) => state.isLoading);
  const refreshTargets = useTargets((state) => state.refresh);
  const rooms = useRooms((state) => state.rooms);
  const roomsLoading = useRooms((state) => state.isLoading);
  const fetchRooms = useRooms((state) => state.fetchRooms);
  const groups = useTargetGroups((state) => state.groups);
  const groupsLoading = useTargetGroups((state) => state.isLoading);
  const fetchGroups = useTargetGroups((state) => state.fetchGroups);
  const gamePresets = useGamePresets((state) => state.presets);
  const presetsLoading = useGamePresets((state) => state.isLoading);
  const presetsSaving = useGamePresets((state) => state.isSaving);
  const presetsError = useGamePresets((state) => state.error);
  const fetchPresets = useGamePresets((state) => state.fetchPresets);
  const savePreset = useGamePresets((state) => state.savePreset);
  const deletePresetFromStore = useGamePresets((state) => state.deletePreset);
  // Canonical list of targets decorated with live telemetry that powers the tables and selectors.
  const [availableDevices, setAvailableDevices] = useState<NormalizedGameDevice[]>([]);
  // Surface-level error banner for operator actions (start/stop failures, auth issues).
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // Single source of truth for the popup lifecycle (selecting → launching → running → stopping → finalizing).
  const [sessionLifecycle, setSessionLifecycle] = useState<SessionLifecycle>('idle');
  // Prevents the dialog from re-opening automatically when an operator intentionally dismisses it mid-idle.
  const [isSessionDialogDismissed, setIsSessionDialogDismissed] = useState(false);
  const sessionLifecycleRef = useRef<SessionLifecycle>('idle');
  // Start/stop timestamps anchor timer displays and summary persistence payloads.
  const [gameStartTime, setGameStartTime] = useState<number | null>(null);
  const [gameStopTime, setGameStopTime] = useState<number | null>(null);
  // Live counters and history feed the hit charts plus the popup shot list.
  const [hitCounts, setHitCounts] = useState<Record<string, number>>({});
  const [hitHistory, setHitHistory] = useState<SessionHitRecord[]>([]);
  // Active devices represent the targets we actually armed for the in-progress session.
  const [activeDeviceIds, setActiveDeviceIds] = useState<string[]>([]);
  // Selected devices reflect the operator's current choices in the Target Selection card.
  const [selectedDeviceIds, setSelectedDeviceIds] = useState<string[]>([]);
  // Pending targets are staged in the dialog before the operator confirms Begin Session.
  const [pendingSessionTargets, setPendingSessionTargets] = useState<NormalizedGameDevice[]>([]);
  // Current session targets are locked once the session is running, informing UI badges and telemetry subscriptions.
  const [currentSessionTargets, setCurrentSessionTargets] = useState<NormalizedGameDevice[]>([]);
  // Desired session duration seeded by presets or operator overrides.
  const [sessionDurationSeconds, setSessionDurationSeconds] = useState<number | null>(null);
  // Tracks which room (if any) is currently associated with the staged session.
  const [sessionRoomId, setSessionRoomId] = useState<string | null>(null);
  // Tracks which group (if any) is currently associated with the staged session.
  const [sessionGroupId, setSessionGroupId] = useState<string | null>(null);
  // Goal shots per target - maps deviceId to goal shot count (optional)
  const [goalShotsPerTarget, setGoalShotsPerTarget] = useState<Record<string, number>>({});
  // Use a ref to store goalShotsPerTarget to avoid infinite loops in useEffect dependencies
  const goalShotsPerTargetRef = useRef<Record<string, number>>({});
  useEffect(() => {
    goalShotsPerTargetRef.current = goalShotsPerTarget;
  }, [goalShotsPerTarget]);
  // Tracks which targets have reached their goal and been stopped
  const [stoppedTargets, setStoppedTargets] = useState<Set<string>>(new Set());
  // Use refs to avoid infinite loops in useEffect dependencies
  const stoppedTargetsRef = useRef<Set<string>>(new Set());
  const currentSessionTargetsRef = useRef<NormalizedGameDevice[]>([]);
  useEffect(() => {
    stoppedTargetsRef.current = stoppedTargets;
  }, [stoppedTargets]);
  useEffect(() => {
    currentSessionTargetsRef.current = currentSessionTargets;
  }, [currentSessionTargets]);
  // Refs to track previous telemetry values to prevent infinite loops
  const prevHitCountsRef = useRef<Record<string, number>>({});
  const prevHitHistoryRef = useRef<SessionHitRecord[]>([]);
  // Custom names for targets
  const { data: customNames = new Map() } = useTargetCustomNames();
  // Snapshot of the most recent completed game, displayed in the post-session summary card.
  const [recentSessionSummary, setRecentSessionSummary] = useState<LiveSessionSummary | null>(null);
  useEffect(() => {
    if (!recentSessionSummary) {
      throttledLogOnChange('games-session-summary', 5000, '[Games] Recent session summary cleared', null);
      return;
    }
    throttledLogOnChange('games-session-summary', 5000, '[Games] Recent session summary updated', {
      gameId: recentSessionSummary.gameId,
      gameName: recentSessionSummary.gameName,
      totalHits: recentSessionSummary.totalHits,
      durationSeconds: recentSessionSummary.durationSeconds,
      devices: recentSessionSummary.deviceStats.map((stat) => ({
        deviceId: stat.deviceId,
        deviceName: stat.deviceName,
        hitCount: stat.hitCount,
      })),
      start: new Date(recentSessionSummary.startedAt).toISOString(),
      stop: new Date(recentSessionSummary.stoppedAt).toISOString(),
    });
  }, [recentSessionSummary]);

  useEffect(() => {
    throttledLogOnChange('games-history', 10000, '[Games] Game history refreshed', {
      refreshedAt: new Date().toISOString(),
      totalEntries: gameHistory.length,
      firstEntry: gameHistory[0]
        ? {
            gameId: gameHistory[0].gameId,
            score: gameHistory[0].score,
            startTime: gameHistory[0].startTime,
          }
        : null,
      sample: gameHistory.slice(0, 5).map((entry) => ({
        gameId: entry.gameId,
        score: entry.score,
        startTime: entry.startTime,
        deviceResultCount: entry.deviceResults?.length ?? 0,
      })),
    });
  }, [gameHistory]);

  useEffect(() => {
    throttledLogOnChange('games-devices', 10000, '[Games] Available devices snapshot', {
      fetchedAt: new Date().toISOString(),
      totalDevices: availableDevices.length,
      sample: availableDevices.slice(0, 5).map((device) => ({
        deviceId: device.deviceId,
        name: device.name,
        status: device.gameStatus,
        wifiStrength: device.wifiStrength,
        hitCount: device.hitCount,
      })),
    });
  }, [availableDevices]);

  // directSessionGameId mirrors the ThingsBoard `gameId` string used by the RPC start/stop commands.
  const [directSessionGameId, setDirectSessionGameId] = useState<string | null>(null);
  // directSessionTargets stores `{deviceId, name}` pairs used by the popup telemetry stream and status pills.
  const [directSessionTargets, setDirectSessionTargets] = useState<Array<{ deviceId: string; name: string }>>([]);
  // Indicates whether the direct TB control path is active (needed to gate realtime commands and UI copy).
  const [directFlowActive, setDirectFlowActive] = useState(false);
  // Tracks the per-device RPC start acknowledgement so the dialog can render success/pending/error badges.
  const [directStartStates, setDirectStartStates] = useState<Record<string, 'idle' | 'pending' | 'success' | 'error'>>({});
  // Flag toggled after commands are issued so the dialog knows it can subscribe directly to ThingsBoard.
  const [directTelemetryEnabled, setDirectTelemetryEnabled] = useState(false);
  // Stores the JWT returned by `ensureTbAuthToken` for RPCs and direct WebSocket subscriptions.
  const [directControlToken, setDirectControlToken] = useState<string | null>(null);
  // Populates the dialog error banner whenever the ThingsBoard auth handshake fails.
  const [directControlError, setDirectControlError] = useState<string | null>(null);
  // Spinner state for the authentication request shown while the dialog prepares direct control.
  const [isDirectAuthLoading, setIsDirectAuthLoading] = useState(false);
  // Toggles the retry button state while we resend start commands to failed devices.
  const [isRetryingFailedDevices, setIsRetryingFailedDevices] = useState(false);
  const [applyingPresetId, setApplyingPresetId] = useState<string | null>(null);
  const [deletingPresetId, setDeletingPresetId] = useState<string | null>(null);
  const [isSavePresetDialogOpen, setIsSavePresetDialogOpen] = useState(false);
  const [savePresetName, setSavePresetName] = useState('');
  const [savePresetDescription, setSavePresetDescription] = useState('');
  const [savePresetIncludeRoom, setSavePresetIncludeRoom] = useState(false);
  const [savePresetDurationInput, setSavePresetDurationInput] = useState('');
  const [setupStep, setSetupStep] = useState<GameSetupStep>('select-targets');
  const [durationInputValue, setDurationInputValue] = useState('');
  const [isDurationUnlimited, setIsDurationUnlimited] = useState(true);
  const [stagedPresetId, setStagedPresetId] = useState<string | null>(null);
  const [activePresetId, setActivePresetId] = useState<string | null>(null);
  const isStepSelectTargets = setupStep === 'select-targets';
  const isStepReview = setupStep === 'review';
  const advanceToDurationStep = useCallback(() => {
    setSetupStep('select-duration');
  }, []);
  const advanceToReviewStep = useCallback(() => {
    setSetupStep('review');
  }, []);
  const resetSetupFlow = useCallback(() => {
    setSetupStep('select-targets');
    setStagedPresetId(null);
    setGoalShotsPerTarget({});
    setStoppedTargets(new Set());
  }, []);
  const directStartStatesRef = useRef<Record<string, 'idle' | 'pending' | 'success' | 'error'>>({});
  const updateDirectStartStates = useCallback((
    value:
      | Record<string, 'idle' | 'pending' | 'success' | 'error'>
      | ((
        prev: Record<string, 'idle' | 'pending' | 'success' | 'error'>,
      ) => Record<string, 'idle' | 'pending' | 'success' | 'error'>),
  ) => {
    setDirectStartStates((prev) => {
      const next = typeof value === 'function' ? value(prev) : value;
      directStartStatesRef.current = next;
      console.info('[Games] Direct start state update', next);
      return next;
    });
  }, []);

  // Session timer powers the stopwatch in the popup and elapsed time block in the dashboard cards.
  const {
    seconds: sessionTimerSeconds,
    reset: resetSessionTimer,
    start: startSessionTimer,
    freeze: freezeSessionTimer,
  } = useSessionTimer();
  // Activation metadata helps correlate when we fired the ThingsBoard start command vs. when telemetry confirmed it.
  const {
    triggeredAt: startTriggeredAt,
    confirmedAt: telemetryConfirmedAt,
    isConfirmed: sessionConfirmed,
    markTriggered: markSessionTriggered,
    markTelemetryConfirmed,
    resetActivation: resetSessionActivation,
    activationParams,
  } = useSessionActivation();
  // Lets async callbacks check the latest confirmation state without waiting for React re-render.
  const sessionConfirmedRef = useRef<boolean>(false);
  // Track if we've already called markTelemetryConfirmed to prevent infinite loops
  const hasMarkedTelemetryConfirmedRef = useRef<boolean>(false);

  // currentGameDevicesRef keeps a stable list of armed targets so stop/finalize logic can reference them after state resets.
  const currentGameDevicesRef = useRef<string[]>([]);
  // We mutate the cached devices in effects; this ref ensures selectors don't fight with React batching.
  const availableDevicesRef = useRef<NormalizedGameDevice[]>([]);
  // Indicates whether the operator manually toggled checkboxes (prevents auto-selecting devices mid-refresh).
  const selectionManuallyModifiedRef = useRef(false);
  // Tracks whether the initial ThingsBoard device snapshot has been loaded.
  const hasLoadedDevicesRef = useRef(false);
  const seededDurationSummaryIdRef = useRef<string | null>(null);
  const presetsErrorRef = useRef<string | null>(null);
  const hasFetchedPresetsRef = useRef(false);
  // Centralised token manager so the Games page always has a fresh ThingsBoard JWT for sockets/RPCs.
  const { session: tbSession, refresh: refreshThingsboardSession } = useThingsboardToken();
  // Prevents duplicate auto-stop triggers once the desired duration elapses.
  const autoStopTriggeredRef = useRef(false);
  // Prevents duplicate game termination when all targets reach their goals
  const goalTerminationTriggeredRef = useRef(false);

  const isSelectingLifecycle = sessionLifecycle === 'selecting';
  const isLaunchingLifecycle = sessionLifecycle === 'launching';
  const isRunningLifecycle = sessionLifecycle === 'running';
  const isStoppingLifecycle = sessionLifecycle === 'stopping';
  const isFinalizingLifecycle = sessionLifecycle === 'finalizing';
  const isSessionLocked =
    isLaunchingLifecycle || isRunningLifecycle || isStoppingLifecycle || isFinalizingLifecycle;
  const isSessionDialogVisible = sessionLifecycle !== 'idle' && !isSelectingLifecycle && !isSessionDialogDismissed;
  const isLiveDialogPhase = isRunningLifecycle || isStoppingLifecycle || isFinalizingLifecycle;

  const prevLifecycleRef = useRef<SessionLifecycle>('idle');

  useEffect(() => {
    const previous = prevLifecycleRef.current;
    throttledLogOnChange('games-lifecycle', 2000, '[Games] Session lifecycle transition', {
      previous,
      next: sessionLifecycle,
      timestamp: new Date().toISOString(),
      activeDeviceCount: activeDeviceIds.length,
      selectedDeviceCount: selectedDeviceIds.length,
    });
    prevLifecycleRef.current = sessionLifecycle;
    sessionLifecycleRef.current = sessionLifecycle;
  }, [sessionLifecycle, activeDeviceIds.length, selectedDeviceIds.length]);

  useEffect(() => {
    if (sessionLifecycle === 'idle') {
      setIsSessionDialogDismissed(false);
    }
  }, [sessionLifecycle]);

  useEffect(() => {
    if (!isRunningLifecycle) {
      autoStopTriggeredRef.current = false;
      goalTerminationTriggeredRef.current = false;
    }
  }, [isRunningLifecycle]);

  useEffect(() => {
    if (selectedDeviceIds.length === 0 && !isStepSelectTargets) {
      resetSetupFlow();
    }
  }, [isStepSelectTargets, resetSetupFlow, selectedDeviceIds.length]);

  useEffect(() => {
    if (setupStep !== 'select-duration') {
      return;
    }
    const hasDuration = typeof sessionDurationSeconds === 'number' && sessionDurationSeconds > 0;
    if (!hasDuration) {
      setSessionDurationSeconds(null);
    }
  }, [sessionDurationSeconds, setSessionDurationSeconds, setupStep]);

  useEffect(() => {
    if (typeof sessionDurationSeconds === 'number' && sessionDurationSeconds > 0) {
      setDurationInputValue(String(sessionDurationSeconds));
      setIsDurationUnlimited(false);
    } else {
      setDurationInputValue('');
      setIsDurationUnlimited(true);
    }
  }, [sessionDurationSeconds]);

  useEffect(() => {
    if (!recentSessionSummary) {
      seededDurationSummaryIdRef.current = null;
      return;
    }
    if (seededDurationSummaryIdRef.current === recentSessionSummary.gameId) {
      return;
    }
    const summaryDuration =
      typeof recentSessionSummary.desiredDurationSeconds === 'number' && recentSessionSummary.desiredDurationSeconds > 0
        ? Math.round(recentSessionSummary.desiredDurationSeconds)
        : null;
    if (
      summaryDuration === null ||
      sessionLifecycle !== 'idle' ||
      setupStep !== 'select-targets' ||
      sessionDurationSeconds !== null
    ) {
      return;
    }
    setSessionDurationSeconds(summaryDuration);
    seededDurationSummaryIdRef.current = recentSessionSummary.gameId;
  }, [recentSessionSummary, sessionLifecycle, sessionDurationSeconds, setSessionDurationSeconds, setupStep]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    try {
      const storedValue = window.localStorage.getItem(RECENT_SESSION_STORAGE_KEY);
      if (!storedValue) {
        return;
      }
      const parsedSummary = JSON.parse(storedValue) as LiveSessionSummary;
      setRecentSessionSummary((previous) => previous ?? parsedSummary);
    } catch (storageError) {
      console.warn('[Games] Failed to restore cached session summary', storageError);
    }
  }, [setRecentSessionSummary]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    if (!recentSessionSummary) {
      window.localStorage.removeItem(RECENT_SESSION_STORAGE_KEY);
      return;
    }
    try {
      window.localStorage.setItem(RECENT_SESSION_STORAGE_KEY, JSON.stringify(recentSessionSummary));
    } catch (storageError) {
      console.warn('[Games] Failed to persist session summary cache', storageError);
    }
  }, [recentSessionSummary]);

  useEffect(() => {
    throttledLogOnChange('games-telemetry-state', 3000, '[Games] Direct telemetry state change', {
      enabled: directTelemetryEnabled,
      lifecycle: sessionLifecycle,
      telemetryDevices: currentSessionTargets.map((device) => ({ id: device.deviceId, name: device.name })),
      timestamp: new Date().toISOString(),
    });
  }, [directTelemetryEnabled, sessionLifecycle, currentSessionTargets]);

  useEffect(() => {
    sessionConfirmedRef.current = sessionConfirmed;
    // Reset the flag when sessionConfirmed changes to false (new session starting)
    if (!sessionConfirmed) {
      hasMarkedTelemetryConfirmedRef.current = false;
    }
  }, [sessionConfirmed]);

  const refreshDirectAuthToken = useCallback(async () => {
    try {
      setIsDirectAuthLoading(true);
      const token = await ensureTbAuthToken();
      setDirectControlToken(token);
      setDirectControlError(null);
      return token;
    } catch (authError) {
      const message =
        authError instanceof Error ? authError.message : 'Failed to refresh ThingsBoard authentication.';
      setDirectControlError(message);
      throw authError;
    } finally {
      setIsDirectAuthLoading(false);
    }
  }, []);

  const convertSessionToHistory = useCallback(
    (session: RecentSession): GameHistory => {
      // Throttle log to prevent flooding when converting many sessions
      throttledLogOnChange(`games-convert-session-${session.id}`, 2000, '[Games] Converting Supabase session to history entry', session);
      const ensureNumber = (value: unknown): number | null => {
        if (value === null || value === undefined) {
          return null;
        }
        const numeric = Number(value);
        return Number.isFinite(numeric) ? numeric : null;
      };

      const ensureString = (value: unknown): string | null => {
        if (typeof value === 'string' && value.trim().length > 0) {
          return value;
        }
        if (typeof value === 'number' && Number.isFinite(value)) {
          return String(value);
        }
        return null;
      };

      const ensureStringArray = (value: unknown): string[] => {
        if (!Array.isArray(value)) {
          return [];
        }
        return (value as unknown[])
          .map((entry) => ensureString(entry))
          .filter((entry): entry is string => entry !== null);
      };

      const rawSummary = (session.thingsboardData ?? null) as Record<string, unknown> | null;
      const getSummaryValue = (key: string): unknown =>
        rawSummary && Object.prototype.hasOwnProperty.call(rawSummary, key)
          ? (rawSummary as Record<string, unknown>)[key]
          : undefined;

      const startTimestamp = session.startedAt ? new Date(session.startedAt).getTime() : Date.now();
      const durationMs = typeof session.duration === 'number' && Number.isFinite(session.duration) ? session.duration : 0;
      const summaryStart = ensureNumber(getSummaryValue('startTime'));
      const summaryEnd = ensureNumber(getSummaryValue('endTime'));

      const fallbackEnd = session.endedAt
        ? new Date(session.endedAt).getTime()
        : summaryStart !== null && durationMs > 0
          ? summaryStart + durationMs
          : durationMs > 0
            ? startTimestamp + durationMs
            : startTimestamp;

      const endTimestamp = summaryEnd ?? fallbackEnd;

      const actualDurationSeconds =
        ensureNumber(getSummaryValue('actualDuration')) ??
        (durationMs > 0
          ? Math.max(0, Math.round(durationMs / 1000))
          : Math.max(0, Math.round((endTimestamp - (summaryStart ?? startTimestamp)) / 1000)));

      const totalHits =
        ensureNumber(getSummaryValue('totalHits')) ??
        (typeof session.hitCount === 'number' && Number.isFinite(session.hitCount)
          ? session.hitCount
          : typeof session.totalShots === 'number' && Number.isFinite(session.totalShots)
            ? session.totalShots
            : 0);

      const rawDeviceResults = getSummaryValue('deviceResults');
      const deviceResults = Array.isArray(rawDeviceResults)
        ? rawDeviceResults
            .map((entry) => {
              const record = entry as Record<string, unknown>;
              const deviceId = ensureString(record.deviceId);
              if (!deviceId) {
                return null;
              }
              const deviceName = ensureString(record.deviceName) ?? deviceId;
              const hitCount = ensureNumber(record.hitCount) ?? 0;
              return { deviceId, deviceName, hitCount };
            })
            .filter((value): value is GameHistory['deviceResults'][number] => value !== null)
        : [];

      const rawTargetStats = getSummaryValue('targetStats');
      const targetStats = Array.isArray(rawTargetStats)
        ? rawTargetStats
            .map((entry) => {
              const record = entry as Record<string, unknown>;
              const deviceId = ensureString(record.deviceId);
              if (!deviceId) {
                return null;
              }
              const deviceName = ensureString(record.deviceName) ?? deviceId;
              const hitCount = ensureNumber(record.hitCount) ?? 0;
              const hitTimes = Array.isArray(record.hitTimes)
                ? (record.hitTimes as unknown[])
                    .map((value) => ensureNumber(value))
                    .filter((value): value is number => value !== null)
                : [];
              return {
                deviceId,
                deviceName,
                hitCount,
                hitTimes,
                averageInterval: ensureNumber(record.averageInterval) ?? 0,
                firstHitTime: ensureNumber(record.firstHitTime) ?? 0,
                lastHitTime: ensureNumber(record.lastHitTime) ?? 0,
              };
            })
            .filter((value): value is GameHistory['targetStats'][number] => value !== null)
        : [];

      const crossSummaryValue = getSummaryValue('crossTargetStats');
      const crossSummary =
        crossSummaryValue && typeof crossSummaryValue === 'object'
          ? (crossSummaryValue as Record<string, unknown>)
          : null;

      const crossTargetStats = crossSummary
        ? {
            totalSwitches: ensureNumber(crossSummary.totalSwitches) ?? 0,
            averageSwitchTime: ensureNumber(crossSummary.averageSwitchTime) ?? 0,
            switchTimes: Array.isArray(crossSummary.switchTimes)
              ? (crossSummary.switchTimes as unknown[])
                  .map((value) => ensureNumber(value))
                  .filter((value): value is number => value !== null)
              : [],
          }
        : null;

      const summaryRoomId = ensureString(getSummaryValue('roomId')) ?? session.roomId ?? null;
      const summaryRoomName = ensureString(getSummaryValue('roomName')) ?? session.roomName ?? null;
      const summaryDesiredDurationSeconds = ensureNumber(getSummaryValue('desiredDurationSeconds'));
      const summaryPresetId = ensureString(getSummaryValue('presetId')) ?? null;
      const summaryTargetDeviceIds = ensureStringArray(getSummaryValue('targetDeviceIds'));
      const summaryTargetDeviceNames = ensureStringArray(getSummaryValue('targetDeviceNames'));

      const fallbackTargetIds =
        deviceResults.length > 0
          ? deviceResults.map((result) => result.deviceId)
          : targetStats.map((stat) => stat.deviceId);

      const fallbackNamesById = new Map<string, string>();
      deviceResults.forEach((result) => {
        fallbackNamesById.set(result.deviceId, result.deviceName ?? result.deviceId);
      });
      targetStats.forEach((stat) => {
        fallbackNamesById.set(stat.deviceId, stat.deviceName ?? stat.deviceId);
      });

      const resolvedTargetDeviceIds =
        summaryTargetDeviceIds.length > 0 ? summaryTargetDeviceIds : fallbackTargetIds;
      const useSummaryNames =
        summaryTargetDeviceNames.length > 0 &&
        summaryTargetDeviceNames.length === resolvedTargetDeviceIds.length;
      const resolvedTargetDeviceNames = useSummaryNames
        ? summaryTargetDeviceNames
        : resolvedTargetDeviceIds.map((deviceId) => fallbackNamesById.get(deviceId) ?? deviceId);

      const rawSplits = getSummaryValue('splits');
      const splits = Array.isArray(rawSplits)
        ? rawSplits
            .map((entry) => {
              const record = entry as Record<string, unknown>;
              const deviceId = ensureString(record.deviceId);
              if (!deviceId) {
                return null;
              }
              return {
                deviceId,
                deviceName: ensureString(record.deviceName) ?? deviceId,
                splitNumber: ensureNumber(record.splitNumber) ?? 0,
                time: ensureNumber(record.time) ?? 0,
                timestamp: ensureNumber(record.timestamp) ?? null,
              } satisfies SessionSplit;
            })
            .filter((value): value is SessionSplit => value !== null)
        : [];

      const rawTransitions = getSummaryValue('transitions');
      const transitions = Array.isArray(rawTransitions)
        ? rawTransitions
            .map((entry) => {
              const record = entry as Record<string, unknown>;
              const fromDevice = ensureString(record.fromDevice);
              const toDevice = ensureString(record.toDevice);
              if (!fromDevice || !toDevice) {
                return null;
              }
              return {
                fromDevice,
                toDevice,
                transitionNumber: ensureNumber(record.transitionNumber) ?? 0,
                time: ensureNumber(record.time) ?? 0,
              } satisfies SessionTransition;
            })
            .filter((value): value is SessionTransition => value !== null)
        : [];

      const rawHitHistory = getSummaryValue('hitHistory');
      const hitHistoryRecords = Array.isArray(rawHitHistory)
        ? rawHitHistory
            .map((entry) => {
              const record = entry as Record<string, unknown>;
              const deviceId = ensureString(record.deviceId);
              const timestamp = ensureNumber(record.timestamp);
              if (!deviceId || timestamp === null) {
                return null;
              }
              return {
                deviceId,
                deviceName: ensureString(record.deviceName) ?? deviceId,
                timestamp,
                gameId: ensureString(record.gameId) ?? gameId,
              } satisfies SessionHitRecord;
            })
            .filter((value): value is SessionHitRecord => value !== null)
        : [];

      const averageHitInterval =
        ensureNumber(getSummaryValue('averageHitInterval')) ??
        (totalHits > 0 && actualDurationSeconds > 0 ? actualDurationSeconds / totalHits : null);

      const durationMinutes =
        ensureNumber(getSummaryValue('durationMinutes')) ??
        (durationMs > 0
          ? Math.max(1, Math.round(durationMs / 60000))
          : actualDurationSeconds > 0
            ? Math.max(1, Math.round(actualDurationSeconds / 60))
            : 0);

      const gameId = ensureString(getSummaryValue('gameId')) ?? session.id;
      const gameName =
        ensureString(getSummaryValue('gameName')) ??
        session.scenarioName ??
        session.roomName ??
        gameId;

      const scoreValue =
        ensureNumber(getSummaryValue('score')) ??
        (typeof session.score === 'number' && Number.isFinite(session.score) ? session.score : totalHits);

      const accuracyValue =
        ensureNumber(getSummaryValue('accuracy')) ??
        (typeof session.accuracy === 'number' && Number.isFinite(session.accuracy) ? session.accuracy : null);

      const rawGoalShotsPerTarget = getSummaryValue('goalShotsPerTarget');
      const goalShotsPerTarget: Record<string, number> | undefined =
        rawGoalShotsPerTarget && typeof rawGoalShotsPerTarget === 'object' && rawGoalShotsPerTarget !== null
          ? (rawGoalShotsPerTarget as Record<string, number>)
          : undefined;

      const summaryPayload: GameHistorySummaryPayload = {
        gameId,
        gameName,
        durationMinutes,
        startTime: summaryStart ?? startTimestamp,
        endTime: endTimestamp,
        totalHits,
        actualDuration: actualDurationSeconds,
        averageHitInterval: averageHitInterval ?? undefined,
        score: scoreValue,
        accuracy: accuracyValue,
        scenarioName: session.scenarioName,
        scenarioType: session.scenarioType,
        roomName: summaryRoomName ?? session.roomName ?? null,
        roomId: summaryRoomId,
        desiredDurationSeconds: summaryDesiredDurationSeconds ?? null,
        presetId: summaryPresetId,
        targetDeviceIds: resolvedTargetDeviceIds,
        targetDeviceNames: resolvedTargetDeviceNames,
        deviceResults,
        targetStats,
        crossTargetStats,
        splits,
        transitions,
        hitHistory: hitHistoryRecords,
        goalShotsPerTarget,
      };

      return mapSummaryToGameHistory(summaryPayload);
    },
    []
  );

  // Pulls persisted history rows so the dashboard reflects stored and recent game sessions.
  const isLoadingHistoryRef = useRef(false);
  const hasLoadedHistoryRef = useRef(false);
  const loadGameHistory = useCallback(async () => {
    if (!user?.id) {
      return;
    }

    // Prevent concurrent calls (fix infinite loop)
    if (isLoadingHistoryRef.current) {
      return;
    }

    isLoadingHistoryRef.current = true;
    setIsHistoryLoading(true);
    try {
      const [historyResult, sessionsResult] = await Promise.allSettled([
        fetchPersistedGameHistory(),
        getRecentSessionsService(user.id, 20),
      ]);

      const persistedHistory =
        historyResult.status === 'fulfilled' ? historyResult.value.history ?? [] : [];
      if (historyResult.status === 'rejected') {
        console.warn('[Games] Failed to load persisted game history', historyResult.reason);
      }
      // History fetched successfully (console log removed to prevent notifications)

      const sessionHistory =
        sessionsResult.status === 'fulfilled' && sessionsResult.value.ok
          ? sessionsResult.value.data.map(convertSessionToHistory)
          : [];
      if (sessionsResult.status === 'rejected' || (sessionsResult.status === 'fulfilled' && !sessionsResult.value.ok)) {
        const reason = sessionsResult.status === 'rejected'
          ? sessionsResult.reason
          : sessionsResult.value.error;
        console.warn('[Games] Failed to load session history', reason);
      }
      // Recent sessions fetched successfully (console log removed to prevent notifications)

      const historyMap = new Map<string, GameHistory>();
      persistedHistory.forEach((entry) => {
        historyMap.set(entry.gameId, {
          ...entry,
          score: entry.score ?? entry.totalHits ?? 0,
        });
      });
      sessionHistory.forEach((entry) => {
        const existing = historyMap.get(entry.gameId);
        if (!existing || (existing.totalHits ?? 0) === 0) {
          historyMap.set(entry.gameId, entry);
        }
      });

      const combinedHistory = Array.from(historyMap.values()).sort(
        (a, b) => (b.startTime ?? 0) - (a.startTime ?? 0),
      );

      setGameHistory(combinedHistory);
      
      // Only update summary if it actually changed (prevent infinite loop)
      if (combinedHistory.length > 0) {
        const newSummary = convertHistoryEntryToLiveSummary(combinedHistory[0]);
        setRecentSessionSummary((prev) => {
          // Compare gameId and startedAt to detect actual changes
          if (!prev || prev.gameId !== newSummary.gameId || prev.startedAt !== newSummary.startedAt) {
            return newSummary;
          }
          return prev; // Return same reference if unchanged
        });
      } else {
        setRecentSessionSummary(null);
      }
    } catch (error) {
      console.warn('[Games] Failed to load game history', error);
      setGameHistory([]);
    } finally {
      setIsHistoryLoading(false);
      isLoadingHistoryRef.current = false;
    }
  }, [convertSessionToHistory, user?.id]);

  useEffect(() => {
    if (!user?.id) {
      setGameHistory([]);
      setIsHistoryLoading(false);
      setRecentSessionSummary(null);
      hasLoadedHistoryRef.current = false;
      return;
    }
    // Only load once on mount or when user changes
    if (hasLoadedHistoryRef.current || isLoadingHistoryRef.current) {
      return;
    }
    hasLoadedHistoryRef.current = true;
    void loadGameHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const currentGameId: string | null = null;
  const isStarting = isLaunchingLifecycle;
  const isStopping = isStoppingLifecycle;

  // Loads the latest edge snapshot and keeps local mirrors (state + refs) in sync so downstream hooks can reuse the same data.
  const loadLiveDevices = useCallback(
    async ({
      silent = false,
      showToast = false,
      reason = 'manual',
    }: { silent?: boolean; showToast?: boolean; reason?: 'initial' | 'postStop' | 'manual' } = {}) => {
      try {
        const result = await refreshGameDevices({ silent });
        if (!result) {
          return;
        }
        const mapped = result.devices;

        console.info('[Games] Edge devices refresh complete', {
          refreshedAt: new Date().toISOString(),
          totalDevices: mapped.length,
          source: result.source,
          sample: mapped.slice(0, 5).map((device) => ({
            deviceId: device.deviceId,
            name: device.name,
            status: device.gameStatus,
            wifiStrength: device.wifiStrength,
            hitCount: device.hitCount,
          })),
        });

        setAvailableDevices(mapped);
        availableDevicesRef.current = mapped;
        setErrorMessage(null);

        if (!isRunningLifecycle) {
          const baseline: Record<string, number> = {};
          mapped.forEach((device) => {
            baseline[device.deviceId] = device.hitCount ?? 0;
          });
          setHitCounts(baseline);
        } else {
          setHitCounts((prev) => {
            const next = { ...prev };
            mapped.forEach((device) => {
              if (!(device.deviceId in next)) {
                next[device.deviceId] = device.hitCount ?? 0;
              }
            });
            return next;
          });
        }

        hasLoadedDevicesRef.current = true;

        // Don't call refreshTargets here - it's redundant since we already fetched devices
        // The targets store will be updated by other components that need it
        // This prevents duplicate expensive API calls

        // Toast notifications removed per user request
      } catch (error) {
        console.error('❌ Failed to load live device data:', error);
        // Toast notification removed per user request
        if (!silent) {
          setErrorMessage('Failed to load live device data. Please try again.');
        }
        setAvailableDevices([]);
        availableDevicesRef.current = [];
      }
    },
    [isRunningLifecycle, refreshGameDevices, refreshTargets],
  );

  useEffect(() => {
    availableDevicesRef.current = availableDevices;
  }, [availableDevices]);

  useEffect(() => {
    if (hasLoadedDevicesRef.current) {
      return;
    }
    hasLoadedDevicesRef.current = true; // Set ref BEFORE starting async work
    void loadLiveDevices({ showToast: true, reason: 'initial' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount

  // Don't trigger a separate targets refresh if we're already loading devices
  // The loadLiveDevices call will populate targets via refreshTargets internally
  useEffect(() => {
    // Only refresh if we have no targets AND we're not currently loading devices
    // AND we haven't just loaded devices (to avoid redundant calls)
    if (targetsSnapshot.length === 0 && !targetsStoreLoading && !loadingDevices && hasLoadedDevicesRef.current) {
      void refreshTargets().catch((err) => {
        console.warn('[Games] Failed to refresh targets snapshot for status sync', err);
      });
    }
  }, [targetsSnapshot.length, targetsStoreLoading, refreshTargets, loadingDevices]);

  // Removed duplicate fetchRooms() call - React Query hooks handle room fetching
  // Rooms are already fetched by React Query useRooms hook used elsewhere
  // This eliminates duplicate rooms payload calls
  const hasLoadedRoomsRef = useRef(false);
  useEffect(() => {
    if (hasLoadedRoomsRef.current) {
      return;
    }
    hasLoadedRoomsRef.current = true;
    let cancelled = false;

    const loadGroups = async () => {
      try {
        // Only fetch groups - rooms are handled by React Query
        await fetchGroups();
      } catch (err) {
        if (!cancelled) {
          console.warn('[Games] Failed to fetch groups for selection card', err);
        }
      }
    };

    void loadGroups();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount

  useEffect(() => {
    if (hasFetchedPresetsRef.current) {
      return;
    }
    hasFetchedPresetsRef.current = true;
    let cancelled = false;

    const run = async () => {
      mark('games-fetch-presets-start');
      throttledLog('games-fetch-presets', 10000, '[Games] Fetching game presets (initial load)', {
        at: new Date().toISOString(),
        existingPresetCount: gamePresets.length,
      });
      try {
        await fetchPresets();
        mark('games-fetch-presets-end');
        const duration = measure('games-fetch-presets-duration', 'games-fetch-presets-start', 'games-fetch-presets-end');
        console.info('⚡ [Performance] Game presets fetch', { duration: `${duration.toFixed(2)}ms` });
      } catch (err) {
        mark('games-fetch-presets-error');
        if (!cancelled) {
          console.warn('[Games] Failed to fetch game presets', {
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [fetchPresets]);

const stagedPresetTargets = useMemo<NormalizedGameDevice[]>(() => {
  if (pendingSessionTargets.length > 0) {
    return pendingSessionTargets;
  }
  if (currentSessionTargets.length > 0) {
    return currentSessionTargets;
  }
  if (selectedDeviceIds.length === 0) {
    return [];
  }
  return selectedDeviceIds
    .map((deviceId) => availableDevices.find((device) => device.deviceId === deviceId) ?? null)
    .filter((device): device is NormalizedGameDevice => device !== null);
}, [pendingSessionTargets, currentSessionTargets, selectedDeviceIds, availableDevices]);

useEffect(() => {
  if (gamePresets.length === 0) {
    throttledLogOnChange('games-presets-empty', 5000, '[Games] Game presets list empty', {
      at: new Date().toISOString(),
      presetsLoading,
      presetsError,
      });
      return;
    }
    throttledLogOnChange('games-presets-updated', 5000, '[Games] Game presets updated', {
      fetchedAt: new Date().toISOString(),
      totalPresets: gamePresets.length,
      sample: gamePresets.slice(0, 3).map((preset) => ({
        id: preset.id,
        name: preset.name,
        targetCount: preset.targetIds.length,
        durationSeconds: preset.durationSeconds,
      })),
    });
  }, [gamePresets]);

  useEffect(() => {
    console.debug('[Games] Presets loading state change', {
      at: new Date().toISOString(),
      presetsLoading,
      currentPresetCount: gamePresets.length,
    });
  }, [presetsLoading, gamePresets.length]);

  useEffect(() => {
    if (!presetsSaving) {
      return;
    }
    console.debug('[Games] Preset save in progress', {
      at: new Date().toISOString(),
      stagedName: savePresetName,
      targetCount: stagedPresetTargets.length,
    });
  }, [presetsSaving, savePresetName, stagedPresetTargets.length]);

  useEffect(() => {
    if (!presetsError) {
      presetsErrorRef.current = null;
      return;
    }
    if (presetsErrorRef.current === presetsError) {
      return;
    }
    presetsErrorRef.current = presetsError;
    console.warn('[Games] Presets error surfaced to UI', {
      at: new Date().toISOString(),
      message: presetsError,
    });
    toast.error(presetsError);
  }, [presetsError]);

  const targetById = useMemo(() => {
    const map = new Map<string, Target>();
    targetsSnapshot.forEach((target) => {
      const customName = customNames.get(target.id);
      map.set(target.id, {
        ...target,
        customName: customName || null,
      });
    });
    return map;
  }, [targetsSnapshot, customNames]);

  const deviceNameById = useMemo(() => {
    const map = new Map<string, string>();
    availableDevices.forEach((device) => {
      map.set(device.deviceId, device.name);
    });
    return map;
  }, [availableDevices]);

  const availableDeviceMap = useMemo(() => {
    const map = new Map<string, NormalizedGameDevice>();
    availableDevices.forEach((device) => {
      map.set(device.deviceId, device);
    });
    return map;
  }, [availableDevices]);

  const deriveConnectionStatus = useCallback(
    (device: NormalizedGameDevice): 'online' | 'standby' | 'offline' => {
      const target = targetById.get(device.deviceId);
      if (target) {
        if (target.status === 'offline') {
          return 'offline';
        }
        if (target.status === 'standby') {
          return 'standby';
        }
        if (target.status === 'online') {
          return 'online';
        }
      }

      const rawStatus = (device.raw?.status ?? '').toString().toLowerCase();
      if (
        rawStatus.includes('offline') ||
        rawStatus.includes('disconnected') ||
        rawStatus === 'inactive'
      ) {
        return 'offline';
      }
      if (rawStatus === 'standby' || rawStatus === 'idle') {
        return 'standby';
      }
      if (['online', 'active', 'busy', 'active_online'].includes(rawStatus)) {
        return 'online';
      }

      const rawGameStatus = (device.raw?.gameStatus ?? '').toString().toLowerCase();
      if (rawGameStatus === 'start' || rawGameStatus === 'busy') {
        return 'online';
      }
      if (rawGameStatus === 'stop' || rawGameStatus === 'idle') {
        return 'standby';
      }

      if (typeof device.raw?.isOnline === 'boolean') {
        return device.raw.isOnline ? 'online' : 'offline';
      }

      if (typeof device.isOnline === 'boolean') {
        return device.isOnline ? 'online' : 'offline';
      }

      const lastActivity =
        (typeof target?.lastActivityTime === 'number' ? target.lastActivityTime : null) ??
        (typeof device.lastSeen === 'number' ? device.lastSeen : null);
      if (lastActivity) {
        return Date.now() - lastActivity <= DEVICE_ONLINE_STALE_THRESHOLD_MS ? 'online' : 'offline';
      }

      return 'offline';
    },
    [targetById],
  );

  const roomSelections = useMemo(() => {
    return rooms
      .map((room) => {
        const targets = Array.isArray(room.targets) ? room.targets : [];
        const deviceIds = targets
          .map((target) => target.id)
          .filter((id): id is string => typeof id === 'string' && id.length > 0);
        if (deviceIds.length === 0) {
          return null;
        }
        let onlineCount = 0;
        deviceIds.forEach((deviceId) => {
          const device = availableDeviceMap.get(deviceId);
          if (device && deriveConnectionStatus(device) !== 'offline') {
            onlineCount += 1;
          }
        });
        return {
          id: room.id,
          name: room.name,
          deviceIds,
          targetCount: deviceIds.length,
          onlineCount,
        };
      })
      .filter((room): room is {
        id: string;
        name: string;
        deviceIds: string[];
        targetCount: number;
        onlineCount: number;
      } => room !== null)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [rooms, availableDeviceMap, deriveConnectionStatus]);

  const groupSelections = useMemo(() => {
    return groups
      .map((group) => {
        const targets = Array.isArray(group.targets) ? group.targets : [];
        const deviceIds = targets
          .map((target) => target.id)
          .filter((id): id is string => typeof id === 'string' && id.length > 0);
        if (deviceIds.length === 0) {
          return null;
        }
        let onlineCount = 0;
        deviceIds.forEach((deviceId) => {
          const device = availableDeviceMap.get(deviceId);
          if (device && deriveConnectionStatus(device) !== 'offline') {
            onlineCount += 1;
          }
        });
        return {
          id: group.id,
          name: group.name,
          deviceIds,
          targetCount: deviceIds.length,
          onlineCount,
        };
      })
      .filter((group): group is {
        id: string;
        name: string;
        deviceIds: string[];
        targetCount: number;
        onlineCount: number;
      } => group !== null)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [groups, availableDeviceMap, deriveConnectionStatus]);

  const deriveIsOnline = useCallback(
    (device: NormalizedGameDevice) => deriveConnectionStatus(device) !== 'offline',
    [deriveConnectionStatus],
  );

  // Centralises the logic to stage the session dialog for a given device roster.
  const openStartDialogForTargets = useCallback(
    async ({
      targetIds,
      source,
      requireOnline,
      syncCurrentTargets = false,
    }: {
      targetIds: string[];
      source: 'manual' | 'preset';
      requireOnline: boolean;
      syncCurrentTargets?: boolean;
    }): Promise<{ targets: NormalizedGameDevice[]; gameId: string } | null> => {
      const uniqueIds = Array.from(
        new Set(
          targetIds
            .map((id) => (typeof id === 'string' ? id.trim() : ''))
            .filter((id): id is string => id.length > 0),
        ),
      );

      if (uniqueIds.length === 0) {
        const message = source === 'preset' ? 'Preset has no targets to apply.' : 'Select at least one target before starting a game.';
        setErrorMessage(message);
        toast.error(message);
        return null;
      }

      const resolvedTargets = uniqueIds
        .map((deviceId) => availableDeviceMap.get(deviceId) ?? null)
        .filter((device): device is NormalizedGameDevice => device !== null);

      const missingDeviceIds = uniqueIds.filter((deviceId) => !availableDeviceMap.has(deviceId));

      if (resolvedTargets.length === 0) {
        const message =
          source === 'preset'
            ? 'Preset targets are not available in the current device snapshot.'
            : 'Selected targets are unavailable. Refresh the device list and try again.';
        setErrorMessage(message);
        toast.error(message);
        return null;
      }

      const onlineTargets = resolvedTargets.filter((device) => deriveIsOnline(device));
      const offlineTargets = resolvedTargets.filter((device) => !deriveIsOnline(device));

      if (requireOnline && offlineTargets.length > 0) {
        const message =
          offlineTargets.length === resolvedTargets.length
            ? 'Selected targets are offline. Choose at least one online target.'
            : 'Some selected targets are offline. Deselect offline devices to continue.';
        setErrorMessage(message);
        toast.error(message);
        return null;
      }

      if (missingDeviceIds.length > 0) {
        console.warn('[Games] Preset targets missing in snapshot', {
          source,
          missingDeviceIds,
        });
        toast.warning(`Missing ${missingDeviceIds.length} preset target${missingDeviceIds.length === 1 ? '' : 's'}. Refresh devices and try again.`);
      }

      if (!requireOnline && offlineTargets.length > 0) {
        toast.warning(`${offlineTargets.length} preset target${offlineTargets.length === 1 ? '' : 's'} offline. They will be kept in the selection.`);
      }

      const effectiveTargets = requireOnline ? onlineTargets : resolvedTargets;
      if (effectiveTargets.length === 0) {
        const message = 'No online targets available for this session.';
        setErrorMessage(message);
        toast.error(message);
        return null;
      }

      let generatedGameId: string | null = null;
      try {
        console.info('[Games] Authenticating with ThingsBoard before opening start dialog', { source });
        await refreshDirectAuthToken();
        generatedGameId = `GM-${Date.now()}`;
      } catch (error) {
        console.error('[Games] ThingsBoard authentication failed', { error, source });
        const message = error instanceof Error ? error.message : 'Failed to authenticate with ThingsBoard.';
        setDirectControlError(message);
        setErrorMessage(message);
        toast.error(message);
        return null;
      }

      const directTargetList = effectiveTargets.map((device) => ({
        deviceId: device.deviceId,
        name: device.name ?? device.deviceId,
      }));
      const resolvedGameId = generatedGameId ?? `GM-${Date.now()}`;

      const initialStates = directTargetList.reduce<Record<string, 'idle' | 'pending' | 'success' | 'error'>>((acc, target) => {
        acc[target.deviceId] = 'idle';
        return acc;
      }, {});

      selectionManuallyModifiedRef.current = true;
      setSelectedDeviceIds(effectiveTargets.map((device) => device.deviceId));
      setDirectSessionTargets(directTargetList);
      updateDirectStartStates(() => initialStates);
      setDirectFlowActive(false);
      setDirectSessionGameId(resolvedGameId);
      setDirectTelemetryEnabled(false);

      setErrorMessage(null);
      setDirectControlError(null);
      setPendingSessionTargets(effectiveTargets);
      if (syncCurrentTargets) {
        setCurrentSessionTargets(effectiveTargets);
      }
      resetSessionTimer(null);
      resetSessionActivation();
      setGameStartTime(null);
      setGameStopTime(null);
      setIsSessionDialogDismissed(false);
      setSessionLifecycle('selecting');

      console.info('[Games] Session dialog prepared', {
        source,
        targetCount: effectiveTargets.length,
        missingDeviceIds,
        offlineTargetIds: offlineTargets.map((device) => device.deviceId),
        gameId: resolvedGameId,
      });

      return { targets: effectiveTargets, gameId: resolvedGameId };
    },
    [
      availableDeviceMap,
      deriveIsOnline,
      refreshDirectAuthToken,
      resetSessionActivation,
      resetSessionTimer,
      setCurrentSessionTargets,
      setDirectControlError,
      setDirectFlowActive,
      setDirectSessionGameId,
      setDirectSessionTargets,
      setDirectTelemetryEnabled,
      setErrorMessage,
      setGameStartTime,
      setGameStopTime,
      setIsSessionDialogDismissed,
      setPendingSessionTargets,
      setSelectedDeviceIds,
      setSessionLifecycle,
      toast,
      updateDirectStartStates,
    ],
  );

  const getOnlineDevices = useCallback(() => {
    return availableDevicesRef.current.filter((device) => deriveIsOnline(device));
  }, [deriveIsOnline]);

  useEffect(() => {
    if (isSessionLocked) {
      return;
    }

    const onlineIdsInOrder = availableDevices
      .filter((device) => deriveIsOnline(device))
      .map((device) => device.deviceId);

    setSelectedDeviceIds((prev) => {
      if (prev.length === 0) {
        return prev;
      }

      const filtered = prev.filter((id) => onlineIdsInOrder.includes(id));
      if (filtered.length === prev.length && filtered.every((id, index) => id === prev[index])) {
        return prev;
      }
      return filtered;
    });
  }, [availableDevices, deriveIsOnline, isSessionLocked]);

  const handleToggleDeviceSelection = useCallback(
    (deviceId: string, checked: boolean) => {
      selectionManuallyModifiedRef.current = true;
      setStagedPresetId(null);
      setSelectedDeviceIds((prev) => {
        let next: string[];
        if (checked) {
          next = prev.includes(deviceId) ? prev : [...prev, deviceId];
        } else {
          next = prev.filter((id) => id !== deviceId);
        }

        setSessionRoomId((currentRoomId) => {
          if (!currentRoomId) {
            return null;
          }
          const currentRoom = roomSelections.find((room) => room.id === currentRoomId);
          if (!currentRoom) {
            return null;
          }
          const hasAnySelected = currentRoom.deviceIds.some((id) => next.includes(id));
          return hasAnySelected ? currentRoomId : null;
        });

        setSessionGroupId((currentGroupId) => {
          if (!currentGroupId) {
            return null;
          }
          const currentGroup = groupSelections.find((group) => group.id === currentGroupId);
          if (!currentGroup) {
            return null;
          }
          const hasAnySelected = currentGroup.deviceIds.some((id) => next.includes(id));
          return hasAnySelected ? currentGroupId : null;
        });

        return next;
      });
    },
    [roomSelections, groupSelections],
  );

  const handleSelectAllDevices = useCallback(() => {
    selectionManuallyModifiedRef.current = true;
    setSessionRoomId(null);
    setSessionGroupId(null);
    setStagedPresetId(null);
    const next = availableDevicesRef.current
      .filter((device) => deriveIsOnline(device))
      .map((device) => device.deviceId);
    setSelectedDeviceIds(next);
  }, [deriveIsOnline]);

  const handleClearDeviceSelection = useCallback(() => {
    selectionManuallyModifiedRef.current = true;
    setSessionRoomId(null);
    setSessionGroupId(null);
    setStagedPresetId(null);
    setSelectedDeviceIds([]);
  }, []);

  const handleToggleRoomTargets = useCallback(
    (roomId: string, checked: boolean) => {
      selectionManuallyModifiedRef.current = true;
      setStagedPresetId(null);
      const room = roomSelections.find((entry) => entry.id === roomId);
      if (!room) {
        return;
      }
      const roomDeviceIds = room.deviceIds;
      if (roomDeviceIds.length === 0) {
        return;
      }
      setSelectedDeviceIds((prev) => {
        if (checked) {
          const merged = new Set(prev);
          roomDeviceIds.forEach((id) => merged.add(id));
          return Array.from(merged);
        }
        const deviceIdsToRemove = new Set(roomDeviceIds);
        return prev.filter((id) => !deviceIdsToRemove.has(id));
      });
      if (checked) {
        setSessionRoomId(roomId);
        setSessionGroupId(null); // Clear group selection when room is selected
      } else if (sessionRoomId === roomId) {
        setSessionRoomId(null);
      }
    },
    [roomSelections, sessionRoomId],
  );

  const handleSelectAllRooms = useCallback(() => {
    selectionManuallyModifiedRef.current = true;
    setSessionRoomId(null);
    setSessionGroupId(null);
    setStagedPresetId(null);
    const roomDeviceIds = roomSelections.flatMap((room) => room.deviceIds);
    if (roomDeviceIds.length === 0) {
      return;
    }
    setSelectedDeviceIds((prev) => Array.from(new Set([...prev, ...roomDeviceIds])));
  }, [roomSelections]);

  const handleClearRoomSelection = useCallback(() => {
    selectionManuallyModifiedRef.current = true;
    setSessionRoomId(null);
    setSessionGroupId(null);
    setStagedPresetId(null);
    const roomDeviceIds = roomSelections.flatMap((room) => room.deviceIds);
    if (roomDeviceIds.length === 0) {
      return;
    }
    const deviceIdsToRemove = new Set(roomDeviceIds);
    setSelectedDeviceIds((prev) => prev.filter((id) => !deviceIdsToRemove.has(id)));
  }, [roomSelections]);

  const handleToggleGroupTargets = useCallback(
    (groupId: string, checked: boolean) => {
      selectionManuallyModifiedRef.current = true;
      setStagedPresetId(null);
      const group = groupSelections.find((entry) => entry.id === groupId);
      if (!group) {
        return;
      }
      const groupDeviceIds = group.deviceIds;
      if (groupDeviceIds.length === 0) {
        return;
      }
      setSelectedDeviceIds((prev) => {
        if (checked) {
          const merged = new Set(prev);
          groupDeviceIds.forEach((id) => merged.add(id));
          return Array.from(merged);
        }
        const deviceIdsToRemove = new Set(groupDeviceIds);
        return prev.filter((id) => !deviceIdsToRemove.has(id));
      });
      if (checked) {
        setSessionGroupId(groupId);
        setSessionRoomId(null); // Clear room selection when group is selected
      } else if (sessionGroupId === groupId) {
        setSessionGroupId(null);
      }
    },
    [groupSelections, sessionGroupId],
  );

  const handleSelectAllGroups = useCallback(() => {
    selectionManuallyModifiedRef.current = true;
    setSessionGroupId(null);
    setSessionRoomId(null);
    setStagedPresetId(null);
    const groupDeviceIds = groupSelections.flatMap((group) => group.deviceIds);
    if (groupDeviceIds.length === 0) {
      return;
    }
    setSelectedDeviceIds((prev) => Array.from(new Set([...prev, ...groupDeviceIds])));
  }, [groupSelections]);

  const handleClearGroupSelection = useCallback(() => {
    selectionManuallyModifiedRef.current = true;
    setSessionGroupId(null);
    setStagedPresetId(null);
    const groupDeviceIds = groupSelections.flatMap((group) => group.deviceIds);
    if (groupDeviceIds.length === 0) {
      return;
    }
    const deviceIdsToRemove = new Set(groupDeviceIds);
    setSelectedDeviceIds((prev) => prev.filter((id) => !deviceIdsToRemove.has(id)));
  }, [groupSelections]);

  // Re-fetches the preset catalog on demand so operators can sync recent changes.
  const handleRefreshPresets = useCallback(async () => {
    if (presetsLoading) {
      console.debug('[Games] Manual preset refresh ignored because a fetch is already in progress', {
        at: new Date().toISOString(),
      });
      return;
    }
    console.info('[Games] Manual game preset refresh triggered');
    await fetchPresets();
    const { error, presets: refreshedPresets } = useGamePresets.getState();
    console.info('[Games] Manual preset refresh completed', {
      at: new Date().toISOString(),
      error,
      presetCount: refreshedPresets.length,
    });
    if (!error) {
      toast.success('Game presets refreshed.');
    }
  }, [fetchPresets, presetsLoading]);

  const handleUsePreviousSettings = useCallback(async () => {
    if (!recentSessionSummary) {
      toast.info('No previous session available yet.');
      return;
    }
    if (isSessionLocked) {
      toast.info('Finish or stop the active session before reusing settings.');
      return;
    }

    const targetIds =
      Array.isArray(recentSessionSummary.targetDeviceIds) && recentSessionSummary.targetDeviceIds.length > 0
        ? recentSessionSummary.targetDeviceIds
        : recentSessionSummary.targets.map((target) => target.deviceId);

    if (targetIds.length === 0) {
      toast.error('Previous session did not capture any targets to reuse.');
      return;
    }

    setActivePresetId(null);
    const prepResult = await openStartDialogForTargets({
      targetIds,
      source: 'manual',
      requireOnline: false,
      syncCurrentTargets: true,
    });

    if (!prepResult || prepResult.targets.length === 0) {
      return;
    }

    const summaryDuration =
      typeof recentSessionSummary.desiredDurationSeconds === 'number' && recentSessionSummary.desiredDurationSeconds > 0
        ? Math.round(recentSessionSummary.desiredDurationSeconds)
        : null;

    setSessionRoomId(recentSessionSummary.roomId ?? null);
    setSessionDurationSeconds(summaryDuration);
    
    // Load goal shots from recent session summary if available
    const summaryGoalShots = recentSessionSummary.historyEntry?.goalShotsPerTarget;
    if (summaryGoalShots && typeof summaryGoalShots === 'object' && !Array.isArray(summaryGoalShots)) {
      setGoalShotsPerTarget(summaryGoalShots as Record<string, number>);
    } else {
      setGoalShotsPerTarget({});
    }
    
    setStagedPresetId(recentSessionSummary.presetId ?? null);
    advanceToReviewStep();
    toast.success('Previous session settings staged. Review and launch when ready.');
  }, [
    advanceToReviewStep,
    isSessionLocked,
    openStartDialogForTargets,
    recentSessionSummary,
    setSessionDurationSeconds,
    setSessionRoomId,
    setStagedPresetId,
    setActivePresetId,
    toast,
  ]);

  const handleCreateNewSetup = useCallback(() => {
    if (isSessionLocked) {
      toast.info('Stop the active session before creating a new setup.');
      return;
    }

    selectionManuallyModifiedRef.current = true;
    setSelectedDeviceIds([]);
    setPendingSessionTargets([]);
    setCurrentSessionTargets([]);
    setDirectSessionTargets([]);
    setDirectSessionGameId(null);
    updateDirectStartStates({});
    setSessionRoomId(null);
    setSessionDurationSeconds(null);
    setStagedPresetId(null);
    setActivePresetId(null);
    setIsSessionDialogDismissed(true);
    setSessionLifecycle('idle');
    resetSetupFlow();
    toast.success('Setup reset. Select targets to begin.');
  }, [
    isSessionLocked,
    resetSetupFlow,
    toast,
    updateDirectStartStates,
    setSelectedDeviceIds,
    setPendingSessionTargets,
    setCurrentSessionTargets,
    setDirectSessionTargets,
    setDirectSessionGameId,
    setSessionRoomId,
    setSessionDurationSeconds,
    setStagedPresetId,
    setActivePresetId,
    setIsSessionDialogDismissed,
    setSessionLifecycle,
  ]);

  // Deletes a preset and refreshes local state once the backend acknowledges the removal.
const handleDeletePreset = useCallback(
  async (preset: GamePreset) => {
      if (deletingPresetId) {
        return;
      }
      setDeletingPresetId(preset.id);
      console.info('[Games] Deleting game preset', { presetId: preset.id, name: preset.name });
      try {
        await deletePresetFromStore(preset.id);
        toast.success(`Preset "${preset.name}" deleted.`);
      } catch (error) {
        console.error('[Games] Failed to delete preset', { presetId: preset.id, error });
        toast.error('Failed to delete preset. Please try again.');
      } finally {
        setDeletingPresetId(null);
      }
  },
  [deletePresetFromStore, deletingPresetId],
);

  const sessionRoomName = useMemo(() => {
    if (!sessionRoomId) {
      return null;
    }
    const roomRecord = rooms.find((room) => room.id === sessionRoomId);
    return roomRecord?.name ?? null;
  }, [rooms, sessionRoomId]);

  const selectedDevices = useMemo<NormalizedGameDevice[]>(() => {
    if (selectedDeviceIds.length === 0) {
      return [];
    }
    return selectedDeviceIds
      .map((deviceId) => availableDevices.find((device) => device.deviceId === deviceId) ?? null)
      .filter((device): device is NormalizedGameDevice => device !== null);
  }, [availableDevices, selectedDeviceIds]);

  useEffect(() => {
    throttledLogOnChange('games-duration', 2000, '[Games] Session desired duration updated', {
      durationSeconds: sessionDurationSeconds,
    });
  }, [sessionDurationSeconds]);

  useEffect(() => {
    throttledLogOnChange('games-room', 2000, '[Games] Session room updated', {
      sessionRoomId,
      sessionRoomName,
    });
  }, [sessionRoomId, sessionRoomName]);

  const resetSavePresetForm = useCallback(() => {
    setSavePresetName('');
    setSavePresetDescription('');
    setSavePresetIncludeRoom(false);
    setSavePresetDurationInput('');
  }, []);

  const handleSavePresetDialogOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) {
        setIsSavePresetDialogOpen(false);
        resetSavePresetForm();
      } else {
        setIsSavePresetDialogOpen(true);
      }
    },
    [resetSavePresetForm],
  );

  const handleRequestSavePreset = useCallback(() => {
    if (stagedPresetTargets.length === 0) {
      toast.error('Select at least one target before saving a preset.');
      return;
    }

    resetSavePresetForm();
    const defaultDuration = typeof sessionDurationSeconds === 'number' && sessionDurationSeconds > 0 ? Math.round(sessionDurationSeconds) : null;

    setSavePresetIncludeRoom(Boolean(sessionRoomId));
    setSavePresetDurationInput(defaultDuration ? String(defaultDuration) : '');

    console.info('[Games] Save preset dialog opened', {
      targetCount: stagedPresetTargets.length,
      sessionRoomId,
      defaultDuration,
    });

    setIsSavePresetDialogOpen(true);
  }, [resetSavePresetForm, sessionDurationSeconds, sessionRoomId, stagedPresetTargets, toast]);

  const handleSavePresetNameChange = useCallback((value: string) => {
    setSavePresetName(value);
  }, []);

  const handleSavePresetDescriptionChange = useCallback((value: string) => {
    setSavePresetDescription(value);
  }, []);

  const handleSavePresetIncludeRoomChange = useCallback(
    (value: boolean) => {
      if (!sessionRoomId) {
        setSavePresetIncludeRoom(false);
        return;
      }
      setSavePresetIncludeRoom(value);
    },
    [sessionRoomId],
  );

  const handleSavePresetDurationChange = useCallback((value: string) => {
    setSavePresetDurationInput(value);
  }, []);

  const handleSavePresetSubmit = useCallback(async () => {
    const trimmedName = savePresetName.trim();
    if (trimmedName.length === 0) {
      toast.error('Preset name is required.');
      return;
    }

    if (stagedPresetTargets.length === 0) {
      toast.error('Select at least one target before saving a preset.');
      return;
    }

    const durationInputTrimmed = savePresetDurationInput.trim();
    let durationSeconds: number | null = null;
    if (durationInputTrimmed.length > 0) {
      const parsed = Number(durationInputTrimmed);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        toast.error('Duration must be greater than zero.');
        return;
      }
      durationSeconds = Math.round(parsed);
    }

    const targetIds = Array.from(new Set(stagedPresetTargets.map((device) => device.deviceId)));
    const resolvedRoomId = savePresetIncludeRoom && sessionRoomId ? sessionRoomId : null;
    const resolvedRoomName = resolvedRoomId ? rooms.find((room) => room.id === resolvedRoomId)?.name ?? null : null;
    if (resolvedRoomId && !resolvedRoomName) {
      console.warn('[Games] Unable to resolve room name for preset save', { resolvedRoomId });
    }

    const description = savePresetDescription.trim().length > 0 ? savePresetDescription.trim() : null;
    const settings: Record<string, unknown> = { source: 'games-page' };
    if (durationSeconds) {
      settings.desiredDurationSeconds = durationSeconds;
    }
    if (resolvedRoomId) {
      settings.roomId = resolvedRoomId;
    }
    if (Object.keys(goalShotsPerTarget).length > 0) {
      settings.goalShotsPerTarget = goalShotsPerTarget;
    }

    console.info('[Games] Saving preset request', {
      name: trimmedName,
      targetCount: targetIds.length,
      durationSeconds,
      resolvedRoomId,
      includeRoom: Boolean(resolvedRoomId),
      stagedPresetTargets: stagedPresetTargets.map((device) => device.deviceId),
    });

    try {
      console.debug('[Games] Calling savePreset()', {
        at: new Date().toISOString(),
      });
      await savePreset({
        name: trimmedName,
        description,
        roomId: resolvedRoomId,
        roomName: resolvedRoomName,
        durationSeconds,
        targetIds,
        settings,
      });
      console.debug('[Games] savePreset() resolved, refreshing presets', {
        at: new Date().toISOString(),
      });
      await fetchPresets();
      toast.success(`Preset "${trimmedName}" saved.`);
      setIsSavePresetDialogOpen(false);
      resetSavePresetForm();
    } catch (error) {
      console.error('[Games] Failed to save preset', error);
      toast.error('Failed to save preset. Please try again.');
    }
  }, [
    fetchPresets,
    resetSavePresetForm,
    rooms,
    savePreset,
    savePresetDescription,
    savePresetDurationInput,
    savePresetIncludeRoom,
    savePresetName,
    sessionRoomId,
    stagedPresetTargets,
    toast,
  ]);

  const handleDesiredDurationChange = useCallback((value: number | null) => {
    if (value === null) {
      setSessionDurationSeconds(null);
      return;
    }
    const normalized = Number.isFinite(value) && value > 0 ? Math.round(value) : null;
    setSessionDurationSeconds(normalized);
  }, []);

  const handleDurationInputValueChange = useCallback(
    (value: string) => {
      setDurationInputValue(value);
      setStagedPresetId(null);
      const trimmed = value.trim();
      if (trimmed.length === 0) {
        setSessionDurationSeconds(null);
        setIsDurationUnlimited(true);
        return;
      }
      const numeric = Number(trimmed);
      if (!Number.isFinite(numeric) || numeric <= 0) {
        return;
      }
      setSessionDurationSeconds(Math.round(numeric));
      setIsDurationUnlimited(false);
    },
    [],
  );

  const handleToggleDurationUnlimited = useCallback(
    (value: boolean) => {
      setIsDurationUnlimited(value);
      setStagedPresetId(null);
      if (value) {
        setSessionDurationSeconds(null);
        setDurationInputValue('');
      } else {
        const fallbackSeconds =
          typeof sessionDurationSeconds === 'number' && sessionDurationSeconds > 0
            ? sessionDurationSeconds
            : 120;
        setSessionDurationSeconds(fallbackSeconds);
        setDurationInputValue(String(fallbackSeconds));
      }
    },
    [sessionDurationSeconds],
  );

  // Shared telemetry hook feeds real-time hit data for active devices so the page can merge hit counts, splits, and transitions.
  const directTelemetryDeviceDescriptors = useMemo(
    () =>
      activeDeviceIds.map((deviceId) => ({
        deviceId,
        deviceName: availableDevicesRef.current.find((device) => device.deviceId === deviceId)?.name ?? deviceId,
      })),
    [activeDeviceIds],
  );

  const isDirectTelemetryLifecycle =
    DIRECT_TB_CONTROL_ENABLED && Boolean(directSessionGameId) &&
    (isLaunchingLifecycle || isRunningLifecycle || isStoppingLifecycle || isFinalizingLifecycle);

  const directTelemetryState = useDirectTbTelemetry({
    enabled: isDirectTelemetryLifecycle && directTelemetryEnabled,
    token: directControlToken,
    gameId: directSessionGameId,
    devices: directTelemetryDeviceDescriptors,
  });

  const standardTelemetryState = useGameTelemetry({
    token: tbSession?.token ?? null,
    gameId: currentGameId,
    deviceIds: directTelemetryDeviceDescriptors,
    enabled: (isLaunchingLifecycle || isRunningLifecycle) && Boolean(currentGameId),
    onAuthError: () => {
      void refreshThingsboardSession({ force: true });
    },
    onError: (reason) => {
      // Telemetry error handled silently (console log removed to prevent notifications)
    },
  });

  const isDirectFlow = isDirectTelemetryLifecycle && directTelemetryEnabled;
  const telemetryState = isDirectFlow ? directTelemetryState : standardTelemetryState;
  
  // Refs to track latest telemetry state (avoid dependency array issues)
  const telemetryStateRef = useRef(telemetryState);
  useEffect(() => {
    telemetryStateRef.current = telemetryState;
  }, [telemetryState]);

  // Stops an individual target when it reaches its goal
  const stopTargetWhenGoalReached = useCallback(
    async (deviceId: string, deviceName: string, goalShots: number) => {
      if (stoppedTargets.has(deviceId)) {
        return; // Already stopped
      }

      const gameId = directSessionGameId || currentGameId;
      if (!gameId) {
        console.warn('[Games] Cannot stop target: no game ID', { deviceId });
        return;
      }

      try {
        console.info('[Games] Stopping target due to goal reached', {
          deviceId,
          deviceName,
          goalShots,
          gameId,
        });

        const stopTimestamp = Date.now();
        await tbSendOneway(deviceId, 'stop', {
          ts: stopTimestamp,
          values: {
            gameId,
            reason: 'goal_reached',
            goalShots,
          },
        });

        const newStoppedTargets = new Set(stoppedTargets).add(deviceId);
        setStoppedTargets(newStoppedTargets);

        toast.success(`${deviceName} reached goal of ${goalShots} shots`);
      } catch (error) {
        console.error('[Games] Failed to stop target when goal reached', {
          deviceId,
          deviceName,
          error,
        });
        toast.error(`Failed to stop ${deviceName}. Please stop manually.`);
      }
    },
    [stoppedTargets, directSessionGameId, currentGameId],
  );

  useEffect(() => {
    if ((isLaunchingLifecycle || isRunningLifecycle) && (currentGameId || isDirectFlow)) {
      const currentTelemetry = telemetryState;
      
      // Only update hitCounts if content actually changed (prevent infinite loop)
      const currentHitCounts = currentTelemetry.hitCounts;
      const hitCountsChanged = JSON.stringify(prevHitCountsRef.current) !== JSON.stringify(currentHitCounts);
      if (hitCountsChanged) {
        setHitCounts(currentHitCounts);
        prevHitCountsRef.current = currentHitCounts;
      }

      // Only update hitHistory if content actually changed (prevent infinite loop)
      const currentHitHistory = currentTelemetry.hitHistory;
      const hitHistoryChanged = 
        prevHitHistoryRef.current.length !== currentHitHistory.length ||
        prevHitHistoryRef.current.some((prev, i) => {
          const curr = currentHitHistory[i];
          return !curr || prev.timestamp !== curr.timestamp || prev.deviceId !== curr.deviceId;
        });
      if (hitHistoryChanged) {
        setHitHistory(currentHitHistory);
        prevHitHistoryRef.current = currentHitHistory;
      }

      // Only update availableDevices if hitCounts or hitTimesByDevice changed
      if (hitCountsChanged || hitHistoryChanged) {
        setAvailableDevices((prev) => {
          const next = prev.map((device) => {
            const count = currentTelemetry.hitCounts[device.deviceId] ?? device.hitCount;
            const hitTimes = currentTelemetry.hitTimesByDevice[device.deviceId];
            if (typeof count !== 'number' && !hitTimes) {
              return device;
            }

            const newHitCount = typeof count === 'number' ? count : device.hitCount;
            const newHitTimes = hitTimes ?? device.hitTimes;
            
            // Only create new object if values actually changed
            if (newHitCount === device.hitCount && newHitTimes === device.hitTimes) {
              return device;
            }

            return {
              ...device,
              hitCount: newHitCount,
              hitTimes: newHitTimes,
            };
          });
          
          // Only update if array actually changed
          const hasChanges = next.some((device, i) => device !== prev[i]);
          if (hasChanges) {
            availableDevicesRef.current = next;
            return next;
          }
          return prev; // Return same reference if no changes
        });
      }

      // Check if any targets have reached their goal shots
      if (isRunningLifecycle && Object.keys(goalShotsPerTargetRef.current).length > 0) {
        Object.entries(goalShotsPerTargetRef.current).forEach(([deviceId, goalShots]) => {
          const currentHits = currentTelemetry.hitCounts[deviceId] ?? 0;
          if (currentHits >= goalShots && !stoppedTargetsRef.current.has(deviceId)) {
            const device = currentSessionTargetsRef.current.find((d) => d.deviceId === deviceId) ||
              availableDevicesRef.current.find((d) => d.deviceId === deviceId);
            const deviceName = device?.name ?? deviceId;
            void stopTargetWhenGoalReached(deviceId, deviceName, goalShots);
          }
        });
      }

      if (!sessionConfirmed && !hasMarkedTelemetryConfirmedRef.current) {
        const latestTelemetryTimestamp = (() => {
          if (typeof currentTelemetry.sessionEventTimestamp === 'number') {
            return currentTelemetry.sessionEventTimestamp;
          }
          const fromHistory = currentTelemetry.hitHistory.at(-1)?.timestamp;
          if (typeof fromHistory === 'number') {
            return fromHistory;
          }
          const flattened = Object.values(currentTelemetry.hitTimesByDevice)
            .flat()
            .filter((value): value is number => typeof value === 'number');
          if (flattened.length > 0) {
            return Math.min(...flattened);
          }
          return null;
        })();

        if (latestTelemetryTimestamp !== null) {
          hasMarkedTelemetryConfirmedRef.current = true;
          markTelemetryConfirmed(latestTelemetryTimestamp);
        }
      }
    } else if (sessionLifecycle === 'idle') {
      // Only reset if we actually have data to clear (prevent unnecessary updates)
      setHitCounts((prev) => {
        if (Object.keys(prev).length === 0) {
          return prev; // Already empty, return same reference
        }
        return {};
      });
      setHitHistory((prev) => {
        if (prev.length === 0) {
          return prev; // Already empty, return same reference
        }
        return [];
      });
      setStoppedTargets((prev) => (prev.size > 0 ? new Set() : prev)); // Only update if not already empty
      // Reset refs when session ends
      prevHitCountsRef.current = {};
      prevHitHistoryRef.current = [];
    }
  }, [
    activeDeviceIds,
    currentGameId,
    isRunningLifecycle,
    isLaunchingLifecycle,
    sessionLifecycle,
    sessionConfirmed,
    markTelemetryConfirmed,
    isDirectFlow,
    stopTargetWhenGoalReached,
    telemetryState,
  ]);

  useEffect(() => {
    if (
      sessionLifecycle === 'launching' &&
      sessionConfirmed &&
      typeof telemetryConfirmedAt === 'number'
    ) {
      const anchor =
        startTriggeredAt !== null && telemetryConfirmedAt < startTriggeredAt
          ? startTriggeredAt
          : telemetryConfirmedAt;
      startSessionTimer(anchor);
      setSessionLifecycle('running');
    }
  }, [
    sessionLifecycle,
    sessionConfirmed,
    telemetryConfirmedAt,
    startTriggeredAt,
    startSessionTimer,
  ]);

  const splitRecords =
    isRunningLifecycle || sessionLifecycle === 'stopping' || sessionLifecycle === 'finalizing'
      ? telemetryState.splits
      : [];

  const transitionRecords =
    isRunningLifecycle || sessionLifecycle === 'stopping' || sessionLifecycle === 'finalizing'
      ? telemetryState.transitions
      : [];

  const finalizeSession = useCallback(
    async ({
      resolvedGameId,
      sessionLabel,
      startTimestamp,
      stopTimestamp,
      targetDevices,
      hitHistorySnapshot,
      splitRecordsSnapshot,
      transitionRecordsSnapshot,
      roomId,
      roomName,
      desiredDurationSeconds,
      presetId,
      goalShotsPerTarget,
    }: {
      resolvedGameId: string;
      sessionLabel: string;
      startTimestamp: number;
      stopTimestamp: number;
      targetDevices: NormalizedGameDevice[];
      hitHistorySnapshot: SessionHitRecord[];
      splitRecordsSnapshot: SplitRecord[];
      transitionRecordsSnapshot: TransitionRecord[];
      roomId: string | null;
      roomName: string | null;
      desiredDurationSeconds: number | null;
      presetId: string | null;
      goalShotsPerTarget?: Record<string, number>;
    }) => {
      const sessionSummary = buildLiveSessionSummary({
        gameId: resolvedGameId,
        gameName: sessionLabel,
        startTime: startTimestamp,
        stopTime: stopTimestamp,
        hitHistory: hitHistorySnapshot,
        splitRecords: splitRecordsSnapshot,
        transitionRecords: transitionRecordsSnapshot,
        devices: targetDevices,
        roomId,
        roomName,
        desiredDurationSeconds,
        presetId,
        goalShotsPerTarget: goalShotsPerTarget ?? {},
      });

      console.info('[Games] Session summary prepared', {
        gameId: sessionSummary.gameId,
        startTime: sessionSummary.historyEntry.startTime,
        endTime: sessionSummary.historyEntry.endTime,
        startTimeISO: new Date(sessionSummary.historyEntry.startTime).toISOString(),
        endTimeISO: new Date(sessionSummary.historyEntry.endTime).toISOString(),
        totalHits: sessionSummary.totalHits,
        durationSeconds: sessionSummary.durationSeconds,
        deviceStats: sessionSummary.deviceStats,
        splits: sessionSummary.splits,
        transitions: sessionSummary.transitions,
        targets: sessionSummary.targets,
        hitHistory: sessionSummary.hitHistory,
        historyEntry: sessionSummary.historyEntry,
      });

      console.info('[Games] Persisting Supabase payload', sessionSummary.historyEntry);
      setRecentSessionSummary(sessionSummary);
      setGameHistory((prev) => [sessionSummary.historyEntry, ...prev]);

      try {
        const { status, sessionPersisted, sessionPersistError } = await saveGameHistory(sessionSummary.historyEntry);
        if (status === 'created') {
          console.info('[Games] Game history entry created', sessionSummary.historyEntry.gameId);
        } else if (status === 'updated') {
          console.info('[Games] Game history entry updated', sessionSummary.historyEntry.gameId);
        }
        if (!sessionPersisted) {
          console.warn('[Games] Session analytics missing from Supabase sessions table', {
            gameId: sessionSummary.historyEntry.gameId,
            sessionPersistError,
          });
        }
      } catch (persistError) {
        console.warn('[Games] Failed to persist game history', persistError);
        toast.error('Failed to persist game history. Please check your connection.');
      }

      return sessionSummary;
    },
    [toast],
  );

  // Coordinates stop lifecycle: calls direct ThingsBoard RPCs, aggregates telemetry into a summary, persists history, and refreshes UI.
  const handleStopDirectGame = useCallback(async () => {
    if (!directSessionGameId) {
      return;
    }

    const activeDeviceIdsSnapshot = [...activeDeviceIds];
    if (activeDeviceIdsSnapshot.length === 0) {
      setSessionLifecycle('idle');
      setGameStopTime(null);
      resetSessionTimer(null);
      resetSessionActivation();
      setDirectTelemetryEnabled(false);
      setDirectFlowActive(false);
      setSessionRoomId(null);
      setSessionDurationSeconds(null);
      return;
    }

    console.info('[Games] Stopping direct ThingsBoard session', {
      gameId: directSessionGameId,
      deviceIds: activeDeviceIdsSnapshot,
    });

    const stopTimestamp = Date.now();
    setSessionLifecycle('stopping');
    setGameStopTime(stopTimestamp);
    freezeSessionTimer(stopTimestamp);
    console.info('[Games] Game stop initiated', {
      gameId: directSessionGameId,
      stopTimestamp,
      stopTimeISO: new Date(stopTimestamp).toISOString(),
      reason: 'manual_or_timeout',
    });
    console.info('[Games] Disabling direct telemetry stream (stop initiated)');
    setDirectTelemetryEnabled(false);

    const stopResults = await Promise.allSettled(
      directSessionTargets.map(async ({ deviceId }) => {
        updateDirectStartStates((prev) => ({ ...prev, [deviceId]: 'pending' }));
        let attemptedRefresh = false;

        const sendStopCommand = async () => {
          try {
            await tbSendOneway(deviceId, 'stop', {
              ts: stopTimestamp,
              values: {
                deviceId,
                event: 'stop',
                gameId: directSessionGameId,
              },
            });
          } catch (error) {
            const status = resolveHttpStatus(error);
            if (status === 504) {
              console.info('[Games] ThingsBoard stop RPC timed out (expected for oneway command)', {
                deviceId,
                gameId: directSessionGameId,
              });
            } else if (status === 401 && !attemptedRefresh) {
              attemptedRefresh = true;
              await refreshDirectAuthToken();
              await sendStopCommand();
            } else if (isAxiosNetworkError(error)) {
              console.info('[Games] ThingsBoard stop RPC hit a network issue; command may still apply', {
                deviceId,
              });
            } else {
              throw error;
            }
          }
        };

        try {
          await tbSetShared(deviceId, { status: 'free' });
          await sendStopCommand();
          updateDirectStartStates((prev) => ({ ...prev, [deviceId]: 'success' }));
        } catch (error) {
          console.error('[Games] Failed to stop device via ThingsBoard', error);
          updateDirectStartStates((prev) => ({ ...prev, [deviceId]: 'error' }));
          throw error;
        }
      }),
    );

    const stopFailures = stopResults.filter((result) => result.status === 'rejected');
    if (stopFailures.length > 0) {
      toast.error(`${stopFailures.length} device(s) may not have received the stop command.`);
    } else {
      toast.success('Stop commands sent to all devices.');
    }

    setSessionLifecycle('finalizing');

    setAvailableDevices((prev) =>
      prev.map((device) => {
        if (activeDeviceIdsSnapshot.includes(device.deviceId)) {
          return {
            ...device,
            gameStatus: 'stop',
            lastSeen: stopTimestamp,
          };
        }
        return device;
      }),
    );

    const targetDevices =
      currentSessionTargets.length > 0
        ? currentSessionTargets
        : activeDeviceIdsSnapshot
            .map((deviceId) => availableDevicesRef.current.find((device) => device.deviceId === deviceId) ?? null)
            .filter((device): device is NormalizedGameDevice => device !== null);

    const hitHistorySnapshot = [...hitHistory];
    const splitRecordsSnapshot = [...splitRecords];
    const transitionRecordsSnapshot = [...transitionRecords];
    const startTimestampSnapshot = gameStartTime ?? stopTimestamp;
    const sessionLabel = `Game ${new Date(startTimestampSnapshot).toLocaleTimeString()}`;

    try {
      await finalizeSession({
        resolvedGameId: directSessionGameId,
        sessionLabel,
        startTimestamp: startTimestampSnapshot,
        stopTimestamp,
        targetDevices,
        hitHistorySnapshot,
        splitRecordsSnapshot,
        transitionRecordsSnapshot,
        roomId: sessionRoomId,
        roomName: sessionRoomName,
        desiredDurationSeconds: sessionDurationSeconds,
        presetId: activePresetId,
        goalShotsPerTarget,
      });

      console.info('[Games] Direct session persisted successfully', {
        gameId: directSessionGameId,
        stopTimestamp,
      });
      await loadGameHistory();
      toast.success('Game stopped successfully.');
    } catch (error) {
      console.error('[Games] Failed to persist direct session summary', error);
      toast.error('Failed to finalize session. Please try again.');
      setSessionLifecycle('running');
      setDirectTelemetryEnabled(true);
      return;
    }

    currentGameDevicesRef.current = [];
    setActiveDeviceIds([]);
    setCurrentSessionTargets([]);
    setPendingSessionTargets([]);
    setDirectFlowActive(false);
    setSessionLifecycle('idle');
    setGameStartTime(null);
    setGameStopTime(stopTimestamp);
    resetSessionTimer(null);
    resetSessionActivation();
    setDirectTelemetryEnabled(false);
    updateDirectStartStates({});
    setDirectSessionTargets([]);
    setDirectSessionGameId(null);
    setSessionRoomId(null);
    setSessionDurationSeconds(null);
    setActivePresetId(null);
    setStagedPresetId(null);
    resetSetupFlow();
    void loadLiveDevices({ silent: true, showToast: true, reason: 'postStop' });
  }, [
    directSessionGameId,
    directSessionTargets,
    activeDeviceIds,
    currentSessionTargets,
    finalizeSession,
    freezeSessionTimer,
    hitHistory,
    splitRecords,
    transitionRecords,
    gameStartTime,
    activePresetId,
    sessionRoomId,
    sessionRoomName,
    sessionDurationSeconds,
    resetSessionActivation,
    resetSessionTimer,
    setActiveDeviceIds,
    setCurrentSessionTargets,
    updateDirectStartStates,
    setDirectTelemetryEnabled,
    setDirectFlowActive,
    setSessionLifecycle,
    setGameStopTime,
    setPendingSessionTargets,
    setGameStartTime,
    setDirectSessionTargets,
    setDirectSessionGameId,
    setAvailableDevices,
    resetSetupFlow,
    refreshDirectAuthToken,
    loadLiveDevices,
    loadGameHistory,
    toast,
  ]);

  const handleStopGame = useCallback(async () => {
    if (!isRunningLifecycle || isStopping || isStoppingLifecycle || isFinalizingLifecycle) {
      return;
    }

    console.info('[Games] Forwarding stop request to direct ThingsBoard handler');
    await handleStopDirectGame();
  }, [isRunningLifecycle, isStopping, isStoppingLifecycle, isFinalizingLifecycle, handleStopDirectGame]);

  // Monitor if all targets with goals have been stopped and terminate game if needed
  useEffect(() => {
    if (!isRunningLifecycle || activeDeviceIds.length === 0 || Object.keys(goalShotsPerTarget).length === 0) {
      return;
    }

    if (goalTerminationTriggeredRef.current) {
      return;
    }

    const activeTargetsWithGoals = activeDeviceIds.filter((id) => goalShotsPerTarget[id] !== undefined);
    const allTargetsWithGoalsStopped = activeTargetsWithGoals.length > 0 && activeTargetsWithGoals.every((id) => stoppedTargets.has(id));
    const isSingleTarget = activeDeviceIds.length === 1;

    if ((isSingleTarget || allTargetsWithGoalsStopped) && stoppedTargets.size > 0) {
      goalTerminationTriggeredRef.current = true;
      console.info('[Games] All targets with goals reached their goals. Terminating game.', {
        isSingleTarget,
        allTargetsWithGoalsStopped,
        activeDeviceIds,
        stoppedTargets: Array.from(stoppedTargets),
        activeTargetsWithGoals,
      });
      toast.success('All targets reached their goals. Game ending...');
      // Small delay to ensure stop commands are sent before terminating
      setTimeout(() => {
        void handleStopGame();
      }, 500);
    }
  }, [isRunningLifecycle, activeDeviceIds, goalShotsPerTarget, stoppedTargets, handleStopGame]);

  useEffect(() => {
    if (!isRunningLifecycle) {
      return;
    }
    if (typeof sessionDurationSeconds !== 'number' || sessionDurationSeconds <= 0) {
      return;
    }
    if (autoStopTriggeredRef.current) {
      return;
    }
    if (sessionTimerSeconds < sessionDurationSeconds) {
      return;
    }
    autoStopTriggeredRef.current = true;
    console.info('[Games] Auto-stopping session because desired duration elapsed', {
      desiredDurationSeconds: sessionDurationSeconds,
      elapsedSeconds: sessionTimerSeconds,
    });
    toast.info('Session reached its time limit. Stopping game...');
    void handleStopGame();
  }, [handleStopGame, isRunningLifecycle, sessionDurationSeconds, sessionTimerSeconds, toast]);
  // Dismisses the start dialog, cancelling setup when we're still in the pre-launch phase.
  const handleCloseStartDialog = useCallback(() => {
    if (sessionLifecycle === 'selecting' && !isStarting && !isLaunchingLifecycle) {
      setSessionLifecycle('idle');
      setPendingSessionTargets([]);
      resetSessionTimer(null);
      setIsSessionDialogDismissed(false);
      setSessionRoomId(null);
      setSessionDurationSeconds(null);
      setStagedPresetId(null);
      resetSetupFlow();
      return;
    }

    if (sessionLifecycle !== 'idle') {
      setIsSessionDialogDismissed(true);
    }
  }, [isLaunchingLifecycle, isStarting, resetSessionTimer, sessionLifecycle, setIsSessionDialogDismissed, setPendingSessionTargets, resetSetupFlow]);


  const executeDirectStart = useCallback(
    async ({
      deviceIds,
      timestamp,
      isRetry = false,
      gameIdOverride,
      targetsOverride,
    }: {
      deviceIds: string[];
      timestamp: number;
      isRetry?: boolean;
      gameIdOverride?: string;
      targetsOverride?: NormalizedGameDevice[];
    }) => {
      const activeGameId = gameIdOverride ?? directSessionGameId;
      const uniqueIds = Array.from(new Set(deviceIds));
      if (uniqueIds.length === 0) {
        toast.error('No devices selected to start.');
        return { successIds: [], errorIds: [] };
      }

      if (!activeGameId) {
        toast.error('Missing ThingsBoard game identifier. Close and reopen the dialog to retry.');
        return { successIds: [], errorIds: uniqueIds };
      }

      const candidateTargets =
        targetsOverride && targetsOverride.length > 0
          ? targetsOverride.map((device) => ({
              deviceId: device.deviceId,
              name: device.name ?? device.deviceId,
            }))
          : directSessionTargets;

      const targetsToCommand = candidateTargets.filter((target) => uniqueIds.includes(target.deviceId));
      if (targetsToCommand.length === 0) {
        toast.error('Unable to resolve ThingsBoard devices for the start command.');
        setDirectFlowActive(false);
        setDirectTelemetryEnabled(false);
        setSessionLifecycle('selecting');
        setGameStartTime(null);
        setGameStopTime(null);
        resetSessionTimer(null);
        setHitCounts({});
        setHitHistory([]);
        setDirectControlError('Unable to resolve ThingsBoard devices for the start command.');
        setActivePresetId(null);
        return { successIds: [], errorIds: uniqueIds };
      }

      updateDirectStartStates((prev) => {
        const next = { ...prev };
        uniqueIds.forEach((deviceId) => {
          next[deviceId] = 'pending';
        });
        return next;
      });

      await Promise.allSettled(
        targetsToCommand.map(async ({ deviceId }) => {
          let attemptedRefresh = false;
          const run = async () => {
            const sharedAttributes: Record<string, unknown> = {
              gameId: activeGameId,
              status: 'busy',
            };
            if (sessionDurationSeconds && sessionDurationSeconds > 0) {
              sharedAttributes.desiredDurationSeconds = sessionDurationSeconds;
            }
            if (sessionRoomId) {
              sharedAttributes.roomId = sessionRoomId;
            }

            await tbSetShared(deviceId, sharedAttributes);

            const commandValues: Record<string, unknown> = {
              deviceId,
              event: 'start',
              gameId: activeGameId,
            };
            if (sessionDurationSeconds && sessionDurationSeconds > 0) {
              commandValues.desiredDurationSeconds = sessionDurationSeconds;
            }
            if (sessionRoomId) {
              commandValues.roomId = sessionRoomId;
            }

            try {
              await tbSendOneway(deviceId, 'start', {
                ts: timestamp,
                values: commandValues,
              });
            } catch (error) {
              const status = resolveHttpStatus(error);
              if (status === 504) {
                console.info('[Games] ThingsBoard start RPC timed out (expected for oneway)', { deviceId, gameId: activeGameId });
              } else if (status === 401 && !attemptedRefresh) {
                attemptedRefresh = true;
                await refreshDirectAuthToken();
                await run();
                return;
              } else if (isAxiosNetworkError(error)) {
                console.info('[Games] ThingsBoard start RPC hit a network issue; command may still apply', { deviceId });
              } else {
                throw error;
              }
            }
          };

          try {
            await run();
            updateDirectStartStates((prev) => ({ ...prev, [deviceId]: 'success' }));
          } catch (error) {
            updateDirectStartStates((prev) => ({ ...prev, [deviceId]: 'error' }));
            console.error('[Games] ThingsBoard start command failed', { deviceId, error });
            throw error;
          }
        }),
      );

      const finalStates = directStartStatesRef.current;
      const successIds = uniqueIds.filter((deviceId) => finalStates[deviceId] === 'success');
      const errorIds = uniqueIds.filter((deviceId) => finalStates[deviceId] === 'error');

      if (successIds.length === 0) {
        setDirectFlowActive(false);
        setDirectTelemetryEnabled(false);
        setSessionLifecycle('selecting');
        setGameStartTime(null);
        setGameStopTime(null);
        resetSessionTimer(null);
        setHitCounts({});
        setHitHistory([]);
        setDirectControlError('Start commands failed. Adjust the devices or refresh your session and try again.');
        setActivePresetId(null);
        if (!isRetry) {
          toast.error('Failed to start session. Update device status and retry.');
        }
        return { successIds: [], errorIds };
      }

      setDirectFlowActive(true);
      setDirectTelemetryEnabled(true);
      setSessionLifecycle('running');
      setGameStartTime((prev) => prev ?? timestamp);
      markTelemetryConfirmed(timestamp);
      setDirectControlError(errorIds.length > 0 ? 'Some devices failed to start. Retry failed devices.' : null);

      if (errorIds.length > 0) {
        toast.warning(`${errorIds.length} device${errorIds.length === 1 ? '' : 's'} failed to start. Use retry to try again.`);
      } else if (!isRetry) {
        toast.success(`Start commands dispatched to ${successIds.length} device${successIds.length === 1 ? '' : 's'}.`);
      }

      return { successIds, errorIds };
    },
    [
      directSessionTargets,
      directSessionGameId,
      updateDirectStartStates,
      refreshDirectAuthToken,
      toast,
      setDirectFlowActive,
      setDirectTelemetryEnabled,
      setActivePresetId,
      setSessionLifecycle,
      setGameStartTime,
      setGameStopTime,
      resetSessionTimer,
      setHitCounts,
      setHitHistory,
      setDirectControlError,
      markTelemetryConfirmed,
      sessionDurationSeconds,
      sessionRoomId,
    ],
  );

  // Centralises the launch flow so both the auto-start path and dialog CTA share the same logic.
  const beginSessionLaunch = useCallback(
    ({ targets: preparedTargets, gameId: gameIdOverride }: { targets?: NormalizedGameDevice[]; gameId?: string } = {}) => {
      const activeGameId = gameIdOverride ?? directSessionGameId;
      const hasPreparedTargets = preparedTargets && preparedTargets.length > 0;
      if (!activeGameId || (!hasPreparedTargets && directSessionTargets.length === 0 && pendingSessionTargets.length === 0)) {
        toast.error('No devices are ready for direct control. Close and reopen the dialog.');
        return;
      }

      const stagedTargets =
        hasPreparedTargets
          ? preparedTargets!
          : pendingSessionTargets.length > 0
            ? pendingSessionTargets
            : directSessionTargets
                .map((target) => availableDevicesRef.current.find((device) => device.deviceId === target.deviceId) ?? null)
                .filter((device): device is NormalizedGameDevice => device !== null);

      if (stagedTargets.length === 0) {
        toast.error('Unable to resolve target metadata for the selected devices.');
        return;
      }

      const timestamp = Date.now();
      const offlineTargets = stagedTargets.filter((device) => !deriveIsOnline(device));
      let launchTargets = stagedTargets;

      if (offlineTargets.length > 0) {
        const onlineTargets = stagedTargets.filter((device) => deriveIsOnline(device));
        if (onlineTargets.length === 0) {
          setPendingSessionTargets([]);
          setCurrentSessionTargets([]);
          updateDirectStartStates({});
          setDirectControlError('All staged targets are offline. Adjust your selection and try again.');
          toast.error('All staged targets are offline. Adjust your selection and try again.');
          return;
        }

        toast.warning(`${offlineTargets.length} target${offlineTargets.length === 1 ? '' : 's'} went offline and were removed from launch.`);
        launchTargets = onlineTargets;
        const launchIdSet = new Set(launchTargets.map((device) => device.deviceId));
        setDirectSessionTargets((prev) => prev.filter((target) => launchIdSet.has(target.deviceId)));
      }

      const launchDeviceIds = launchTargets.map((device) => device.deviceId);

      setPendingSessionTargets(launchTargets);
      setCurrentSessionTargets(launchTargets);
      currentGameDevicesRef.current = launchDeviceIds;
      selectionManuallyModifiedRef.current = true;
      setSelectedDeviceIds(launchDeviceIds);
      setActiveDeviceIds(launchDeviceIds);
      setRecentSessionSummary(null);
      setGameStartTime(null);
      setGameStopTime(null);
      setHitCounts(Object.fromEntries(launchDeviceIds.map((id) => [id, 0])));
      setHitHistory([]);
      setStoppedTargets(new Set()); // Reset stopped targets when starting new session
      setErrorMessage(null);
      setDirectControlError(null);

      setActivePresetId(stagedPresetId);
      markSessionTriggered(timestamp);
      setSessionLifecycle('launching');
      setDirectFlowActive(true);
      setDirectTelemetryEnabled(false);
      startSessionTimer(timestamp);

      updateDirectStartStates(() => {
        const next: Record<string, 'idle' | 'pending' | 'success' | 'error'> = {};
        launchDeviceIds.forEach((deviceId) => {
          next[deviceId] = 'pending';
        });
        return next;
      });

      console.info('[Games] Begin session pressed (direct ThingsBoard path)', {
        deviceIds: launchDeviceIds,
        gameId: activeGameId,
        desiredDurationSeconds: sessionDurationSeconds,
        sessionRoomId,
      });

      void executeDirectStart({
        deviceIds: launchDeviceIds,
        timestamp,
        gameIdOverride: activeGameId,
        targetsOverride: launchTargets,
      });
    },
    [
      availableDevicesRef,
      directSessionGameId,
      directSessionTargets,
      executeDirectStart,
      deriveIsOnline,
      markSessionTriggered,
      pendingSessionTargets,
      setActiveDeviceIds,
      setActivePresetId,
      setCurrentSessionTargets,
      setDirectFlowActive,
      setDirectTelemetryEnabled,
      setDirectSessionTargets,
      setDirectControlError,
      setErrorMessage,
      setGameStartTime,
      setGameStopTime,
      setHitCounts,
      setHitHistory,
      setPendingSessionTargets,
      setRecentSessionSummary,
      setSelectedDeviceIds,
      setSessionLifecycle,
      startSessionTimer,
      sessionDurationSeconds,
      sessionRoomId,
      stagedPresetId,
      toast,
      updateDirectStartStates,
    ],
  );

  // Applies a preset by staging its targets, room, and duration, then immediately launching the session.
  const handleApplyPreset = useCallback(
    async (preset: GamePreset) => {
      if (isSessionLocked) {
        toast.info('Complete or stop the current session before applying a preset.');
        return;
      }
      setApplyingPresetId(preset.id);
      console.info('[Games] Applying game preset', {
        presetId: preset.id,
        name: preset.name,
        roomId: preset.roomId,
        durationSeconds: preset.durationSeconds,
        targetCount: preset.targetIds.length,
      });

      try {
        const prepResult = await openStartDialogForTargets({
          targetIds: preset.targetIds,
          source: 'preset',
          requireOnline: false,
          syncCurrentTargets: true,
        });

        if (!prepResult || prepResult.targets.length === 0) {
          return;
        }

        const resolvedRoomId =
          preset.roomId ??
          (preset.settings != null && typeof (preset.settings as Record<string, unknown>)['roomId'] === 'string'
            ? ((preset.settings as Record<string, unknown>)['roomId'] as string)
            : null);
        const resolvedRoomName =
          resolvedRoomId !== null ? rooms.find((room) => room.id === resolvedRoomId)?.name ?? null : null;
        if (resolvedRoomId !== null && !resolvedRoomName) {
          console.warn('[Games] Preset room not found in local store', { presetId: preset.id, roomId: resolvedRoomId });
        }
        setSessionRoomId(resolvedRoomId ?? null);

        const desiredDurationSeconds = resolvePresetDurationSeconds(preset);
        setSessionDurationSeconds(desiredDurationSeconds);
        
        // Load goal shots from preset settings if available
        const presetGoalShots = preset.settings?.goalShotsPerTarget;
        if (presetGoalShots && typeof presetGoalShots === 'object' && !Array.isArray(presetGoalShots)) {
          setGoalShotsPerTarget(presetGoalShots as Record<string, number>);
        } else {
          setGoalShotsPerTarget({});
        }
        
        setStagedPresetId(preset.id);
        setActivePresetId(preset.id);
        toast.success(`Preset "${preset.name}" applied. Launching session...`);
        beginSessionLaunch({ targets: prepResult.targets, gameId: prepResult.gameId });
      } catch (error) {
        console.error('[Games] Failed to apply preset', { presetId: preset.id, error });
        toast.error('Failed to apply preset. Try again after refreshing devices.');
      } finally {
        setApplyingPresetId(null);
      }
    },
    [beginSessionLaunch, isSessionLocked, openStartDialogForTargets, rooms],
  );

  const handleConfirmStartDialog = useCallback(() => {
    beginSessionLaunch();
  }, [beginSessionLaunch]);

  const handleRetryFailedDevices = useCallback(async () => {
    const failedIds = Object.entries(directStartStatesRef.current)
      .filter(([, state]) => state === 'error')
      .map(([deviceId]) => deviceId);

    if (failedIds.length === 0) {
      toast.info('No failed devices to retry.');
      return;
    }

    if (!directSessionGameId) {
      toast.error('Session is missing a ThingsBoard identifier. Close and reopen the dialog to retry.');
      return;
    }

    setIsRetryingFailedDevices(true);
    try {
      setDirectControlError(null);
      await executeDirectStart({ deviceIds: failedIds, timestamp: Date.now(), isRetry: true });
    } catch (error) {
      console.error('[Games] Retry failed devices encountered an error', error);
      toast.error('Retry failed devices encountered an error. Check connectivity and try again.');
    } finally {
      setIsRetryingFailedDevices(false);
    }
  }, [directSessionGameId, executeDirectStart, toast, setDirectControlError]);
  // Allows the dialog to immediately terminate the active session if needed.
  const handleStopFromDialog = useCallback(() => {
    void handleStopGame();
  }, [handleStopGame]);

  const formatLastSeen = (timestamp: number) => {
    if (!timestamp) return 'No activity';
    const diffMs = Date.now() - timestamp;
    if (diffMs < 5_000) return 'Just now';
    if (diffMs < 60_000) return `${Math.round(diffMs / 1000)}s ago`;
    if (diffMs < 3_600_000) return `${Math.round(diffMs / 60_000)}m ago`;
    return new Date(timestamp).toLocaleTimeString();
  };

  const activeSessionHits = activeDeviceIds.reduce(
    (sum, id) => sum + (hitCounts[id] ?? 0),
    0
  );
  const recentTransitions = useMemo(() => {
    if (transitionRecords.length === 0) {
      return [];
    }
    return transitionRecords
      .slice(-8)
      .map((transition, index) => {
        const fromDevice =
          transition.fromDeviceName ??
          deviceNameById.get(transition.fromDevice) ??
          transition.fromDevice;
        const toDevice =
          transition.toDeviceName ?? deviceNameById.get(transition.toDevice) ?? transition.toDevice;

        return {
          id: `${transition.fromDevice}-${transition.toDevice}-${index}`,
          fromDevice,
          toDevice,
          label: `${fromDevice} → ${toDevice}`,
          time: typeof transition.time === 'number' ? transition.time : Number(transition.time) || 0,
          transitionNumber: transition.transitionNumber ?? index + 1,
        };
      })
      .reverse();
  }, [deviceNameById, transitionRecords]);

  const elapsedSeconds = useMemo(() => {
    if (isRunningLifecycle) {
      return sessionTimerSeconds;
    }
    if (gameStartTime && gameStopTime) {
      return Math.max(0, Math.floor((gameStopTime - gameStartTime) / 1000));
    }
    return sessionTimerSeconds;
  }, [gameStartTime, gameStopTime, isRunningLifecycle, sessionTimerSeconds]);

  const selectedOnlineDevices = useMemo(() => {
    if (selectedDeviceIds.length === 0) {
      return 0;
    }

    return selectedDeviceIds.filter((id) => {
      const device = availableDevices.find((item) => item.deviceId === id);
      return device ? deriveIsOnline(device) : false;
    }).length;
  }, [availableDevices, deriveIsOnline, selectedDeviceIds]);

  const totalOnlineSelectableTargets = useMemo(() => {
    return availableDevices.filter((device) => deriveIsOnline(device)).length;
  }, [availableDevices, deriveIsOnline]);

  const orderedAvailableDevices = useMemo(() => {
    const selectedIdSet = new Set(selectedDeviceIds);

    const selectedDevicesOrdered = availableDevices.filter((device) => selectedIdSet.has(device.deviceId));

    if (!sessionRoomId) {
      const remainingDevices = availableDevices.filter((device) => !selectedIdSet.has(device.deviceId));
      return [...selectedDevicesOrdered, ...remainingDevices];
    }

    const selectedRoom = roomSelections.find((room) => room.id === sessionRoomId);
    if (!selectedRoom) {
      const remainingDevices = availableDevices.filter((device) => !selectedIdSet.has(device.deviceId));
      return [...selectedDevicesOrdered, ...remainingDevices];
    }

    const prioritizedIds = new Set(selectedRoom.deviceIds);
    const remainingDevices = availableDevices.filter((device) => !selectedIdSet.has(device.deviceId));
    const inRoom = remainingDevices.filter((device) => prioritizedIds.has(device.deviceId));
    const notInRoom = remainingDevices.filter((device) => !prioritizedIds.has(device.deviceId));

    return [...selectedDevicesOrdered, ...inRoom, ...notInRoom];
  }, [availableDevices, roomSelections, sessionRoomId, selectedDeviceIds]);

  const canAdvanceToDuration = selectedDevices.length > 0;
  const canAdvanceToReview =
    isDurationUnlimited || (typeof sessionDurationSeconds === 'number' && sessionDurationSeconds > 0);
  const canContinueToDuration = canAdvanceToDuration && selectedOnlineDevices > 0;
  const canLaunchGame =
    isStepReview && canAdvanceToReview && selectedOnlineDevices > 0 && !isSessionLocked;
  const formattedDurationLabel = isDurationUnlimited
    ? 'No time limit'
    : sessionDurationSeconds && sessionDurationSeconds > 0
      ? formatSessionDuration(sessionDurationSeconds)
      : 'No time limit';

  const reviewTargets = useMemo(() => {
    if (selectedDevices.length === 0) {
      return [];
    }
    return selectedDevices.slice(0, REVIEW_TARGET_DISPLAY_LIMIT);
  }, [selectedDevices]);

  const remainingReviewTargetCount = Math.max(selectedDevices.length - reviewTargets.length, 0);

  useEffect(() => {
    if (!isStepSelectTargets) {
      return;
    }
    if (!canContinueToDuration) {
      return;
    }
    advanceToDurationStep();
  }, [advanceToDurationStep, canContinueToDuration, isStepSelectTargets]);

  useEffect(() => {
    if (isSessionLocked) {
      return;
    }
    if (setupStep === 'review') {
      return;
    }
    if (!canAdvanceToReview) {
      return;
    }
    if (selectedDevices.length === 0 || selectedOnlineDevices === 0) {
      return;
    }
    advanceToReviewStep();
  }, [
    advanceToReviewStep,
    canAdvanceToReview,
    isSessionLocked,
    selectedDevices.length,
    selectedOnlineDevices,
    setupStep,
  ]);

  // Stages the selected targets and immediately launches the live session.
  const handleOpenStartDialog = useCallback(async () => {
    if (!canLaunchGame) {
      return;
    }
    setStagedPresetId(null);
    advanceToReviewStep();
    const prepResult = await openStartDialogForTargets({
      targetIds: selectedDeviceIds,
      source: 'manual',
      requireOnline: true,
      syncCurrentTargets: false,
    });
    if (!prepResult || prepResult.targets.length === 0) {
      return;
    }
    beginSessionLaunch({ targets: prepResult.targets, gameId: prepResult.gameId });
  }, [advanceToReviewStep, beginSessionLaunch, canLaunchGame, openStartDialogForTargets, selectedDeviceIds]);

  const sessionHitEntries = useMemo<SessionHitEntry[]>(() => {
    if (hitHistory.length === 0) {
      return [];
    }
    const baseTime = (gameStartTime ?? hitHistory[0]?.timestamp ?? Date.now());

    return hitHistory.map((hit, index) => {
      const previous = index > 0 ? hitHistory[index - 1] : null;
      const sinceStartSeconds = Math.max(0, (hit.timestamp - baseTime) / 1000);
      const splitSeconds =
        previous && previous.timestamp
          ? Math.max(0, (hit.timestamp - previous.timestamp) / 1000)
          : null;

      return {
        id: `${hit.deviceId}-${hit.timestamp}-${index}`,
        deviceName: hit.deviceName,
        timestamp: hit.timestamp,
        sequence: index + 1,
        sinceStartSeconds,
        splitSeconds,
      };
    });
  }, [hitHistory, gameStartTime]);

  const isInitialDataLoading =
    // Don't block page rendering on loadingDevices - it's slow (3500ms) and setup sections can render progressively
    // Only block on critical data that setup sections actually need
    isHistoryLoading || roomsLoading || targetsStoreLoading || presetsLoading;

  const displayedSelectedCount = selectedDeviceIds.length;
  const isPageLoading = isInitialDataLoading;
  const sessionDialogTargets =
    isLiveDialogPhase && currentSessionTargets.length > 0 ? currentSessionTargets : pendingSessionTargets;
  const canDismissSessionDialog = sessionLifecycle === 'selecting' && !isStarting && !isLaunchingLifecycle;
  useEffect(() => {
    console.debug('[Games] Preset banner state updated', {
      at: new Date().toISOString(),
      presetCount: gamePresets.length,
      presetsLoading,
      presetsError,
    });
  }, [gamePresets.length, presetsError, presetsLoading]);

  return (
    <div className="min-h-screen bg-brand-background">
      <Header onMenuClick={() => setIsMobileMenuOpen(true)} />

      <div className="flex flex-1">
        {!isMobile && <Sidebar />}
        <MobileDrawer isOpen={isMobileMenuOpen} onClose={() => setIsMobileMenuOpen(false)} />

        <main className="flex-1 overflow-y-auto">
          <div className="p-2 md:p-4 lg:p-6 xl:p-8 max-w-[1600px] mx-auto">
            {errorMessage && (
              <Card className="border-red-200 bg-red-50 mb-6">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-red-600" />
                    <span className="text-red-800 font-medium">{errorMessage}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setErrorMessage(null)}
                      className="ml-auto text-red-600 hover:text-red-800"
                    >
                      ×
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
            <div className="space-y-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between text-left">
                <div>
                  <h1 className="font-heading text-2xl md:text-3xl font-semibold text-brand-text">
                    Games &amp; Sessions Overview
                  </h1>
                  <p className="font-body text-brand-text/70 text-sm md:text-base">
                    Manage rooms, targets, and quick-start presets from one control center.
                  </p>
                </div>
                <div className="flex flex-col items-stretch gap-3 text-sm text-brand-dark/60 sm:flex-row sm:items-center sm:gap-4" />
              </div>

              {presetsLoading ? (
                <GamePresetsCard
                  presets={gamePresets}
                  isLoading={presetsLoading}
                  isSessionLocked={isSessionLocked}
                  applyingId={applyingPresetId}
                  deletingId={deletingPresetId}
                  onApply={handleApplyPreset}
                  onDelete={handleDeletePreset}
                />
              ) : presetsError ? (
                <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <span>We couldn&apos;t load your presets. Try again in a moment.</span>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={handleRefreshPresets}>
                      Retry
                    </Button>
                  </div>
                </div>
              ) : gamePresets.length === 0 ? (
                <div className="rounded-md border border-dashed border-brand-primary/40 bg-brand-primary/10 px-4 py-3 text-sm text-brand-dark/80 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <span>No presets yet</span>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={handleRefreshPresets}>
                      Refresh
                    </Button>
                    <Button size="sm" onClick={handleRequestSavePreset} disabled={isSessionLocked || selectedDevices.length === 0}>
                      Save current setup
                    </Button>
                  </div>
                </div>
              ) : (
                <GamePresetsCard
                  presets={gamePresets}
                  isLoading={false}
                  isSessionLocked={isSessionLocked}
                  applyingId={applyingPresetId}
                  deletingId={deletingPresetId}
                  onApply={handleApplyPreset}
                  onDelete={handleDeletePreset}
                />
              )}

              <div className="space-y-4">
                {isPageLoading ? (
                  <StepOneSkeleton />
                ) : (
                  <Card className="bg-white border-gray-200 shadow-sm rounded-md md:rounded-lg">
                    <CardContent className="p-[10px] space-y-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center rounded-full bg-brand-primary/10 px-2.5 py-0.5 text-xs font-semibold text-brand-primary">
                            Step 1
                          </span>
                          <span className="text-xs font-medium uppercase tracking-wide text-brand-dark/60">
                            Targets & Room
                          </span>
                        </div>
                        <h2 className="font-heading text-lg text-brand-dark text-left">Select targets, group, or room</h2>
                        <p className="text-xs text-brand-dark/60 text-left">Choose at least one online target to continue.</p>
                      </div>
                      <div className="space-y-4">
                        <div className="grid gap-4 md:grid-cols-3 md:items-start">
                          <div className="h-full">
                            <RoomSelectionCard
                              roomsLoading={roomsLoading}
                              rooms={roomSelections}
                              selectedDeviceIds={selectedDeviceIds}
                              isSessionLocked={isSessionLocked}
                              activeRoomId={sessionRoomId}
                              onSelectAllRooms={handleSelectAllRooms}
                              onClearRooms={handleClearRoomSelection}
                              onToggleRoomTargets={handleToggleRoomTargets}
                              className="h-full"
                            />
                          </div>
                          <div className="h-full">
                            <GroupSelectionCard
                              groupsLoading={groupsLoading}
                              groups={groupSelections}
                              selectedDeviceIds={selectedDeviceIds}
                              isSessionLocked={isSessionLocked}
                              activeGroupId={sessionGroupId}
                              onSelectAllGroups={handleSelectAllGroups}
                              onClearGroups={handleClearGroupSelection}
                              onToggleGroupTargets={handleToggleGroupTargets}
                              className="h-full"
                            />
                          </div>
                          <div className="h-full">
                            <TargetSelectionCard
                              loadingDevices={loadingDevices}
                              isSessionLocked={isSessionLocked}
                              devices={orderedAvailableDevices}
                              targetDetails={targetById}
                              selectedDeviceIds={selectedDeviceIds}
                              hitCounts={hitCounts}
                              deriveConnectionStatus={deriveConnectionStatus}
                              deriveIsOnline={deriveIsOnline}
                              formatLastSeen={formatLastSeen}
                              onToggleDevice={handleToggleDeviceSelection}
                              onSelectAll={handleSelectAllDevices}
                              onClearSelection={handleClearDeviceSelection}
                              selectedCount={displayedSelectedCount}
                              totalOnlineSelectableTargets={totalOnlineSelectableTargets}
                              className="h-full"
                            />
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {isPageLoading ? (
                  <StepTwoSkeleton />
                ) : (
                  <Card className="bg-white border-gray-200 shadow-sm rounded-md md:rounded-lg">
                    <CardContent className="p-[10px] space-y-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center rounded-full bg-brand-primary/10 px-2.5 py-0.5 text-xs font-semibold text-brand-primary">
                              Step 2
                            </span>
                            <span className="text-xs font-medium uppercase tracking-wide text-brand-dark/60">
                              Duration
                            </span>
                          </div>
                          <h2 className="font-heading text-lg text-brand-dark">Select session duration</h2>
                          <p className="text-xs text-brand-dark/60">Set a timer or run without limits.</p>
                        </div>
                      </div>
                      {!canAdvanceToDuration ? (
                        <div className="rounded-md border border-dashed border-gray-200 bg-gray-50 px-3 py-4 text-sm text-brand-dark/60">
                          Complete Step 1 to configure the game duration.
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <div className="space-y-4 rounded-md border border-gray-200 bg-gray-50 px-[10px] py-[10px]">
                            <div className="space-y-2">
                              <Label className="text-xs font-medium text-brand-dark">Quick selections</Label>
                              <div className="flex flex-wrap gap-2">
                                {[
                                  { label: '30s', value: 30 },
                                  { label: '1m', value: 60 },
                                  { label: '2m', value: 120 },
                                ].map((option) => (
                                  <Button
                                    key={option.value}
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleDurationInputValueChange(String(option.value))}
                                    disabled={isSessionLocked}
                                  >
                                    {option.label}
                                  </Button>
                                ))}
                                <Button
                                  type="button"
                                  variant={isDurationUnlimited ? 'default' : 'outline'}
                                  size="sm"
                                  onClick={() => handleToggleDurationUnlimited(true)}
                                  disabled={isSessionLocked}
                                >
                                  No time limit
                                </Button>
                              </div>
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="game-duration" className="text-xs font-medium text-brand-dark">
                                Custom duration (seconds)
                              </Label>
                              <Input
                                id="game-duration"
                                type="number"
                                inputMode="numeric"
                                placeholder="Enter seconds (e.g. 180)"
                                value={durationInputValue}
                                min={10}
                                step={10}
                                onChange={(event) => handleDurationInputValueChange(event.target.value)}
                                disabled={isSessionLocked}
                              />
                              <p className="text-[11px] text-brand-dark/60">
                                {isDurationUnlimited
                                  ? 'Timer disabled • leave blank or choose No time limit'
                                  : `Formatted: ${formattedDurationLabel}`}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {isPageLoading ? (
                  <StepThreeSkeleton />
                ) : (
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
                          onClick={handleRequestSavePreset}
                          disabled={isSessionLocked || selectedDevices.length === 0}
                        >
                          Save as preset
                        </Button>
                        <Button
                          onClick={handleOpenStartDialog}
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
                          Complete the previous steps with at least one online target to enable launch.
                        </p>
                      )}
                    </CardContent>
                  </Card>
                )}

                {isPageLoading ? (
                  <LiveSessionCardSkeleton />
                ) : (
                  <LiveSessionCard
                    isRunning={isRunningLifecycle}
                    timerSeconds={sessionTimerSeconds}
                    activeTargets={currentSessionTargets}
                    activeHits={activeSessionHits}
                    hitCounts={hitCounts}
                    recentSummary={recentSessionSummary}
                    desiredDurationSeconds={sessionDurationSeconds}
                    goalShotsPerTarget={goalShotsPerTarget}
                    stoppedTargets={stoppedTargets}
                    onUsePrevious={handleUsePreviousSettings}
                    onCreateNew={handleCreateNewSetup}
                    isSessionLocked={isSessionLocked}
                  />
                )}
              </div>
            </div>
          </div>
        </main>
        <StartSessionDialog
          open={isSessionDialogVisible}
          lifecycle={sessionLifecycle}
          onClose={handleCloseStartDialog}
          onConfirm={handleConfirmStartDialog}
          onStop={handleStopFromDialog}
          isStarting={isStarting}
          isStopping={isStopping}
          canClose={canDismissSessionDialog}
          sessionSeconds={sessionTimerSeconds}
          targets={sessionDialogTargets}
          sessionHits={sessionHitEntries}
          currentGameId={currentGameId}
          directControlEnabled={DIRECT_TB_CONTROL_ENABLED}
          directToken={directControlToken}
          directAuthError={directControlError}
          isDirectAuthLoading={isDirectAuthLoading}
          directTargets={directSessionTargets}
          directGameId={directSessionGameId}
          directStartStates={directStartStates}
          directFlowActive={directFlowActive}
          onRetryFailed={handleRetryFailedDevices}
          isRetryingFailedDevices={isRetryingFailedDevices}
          selectedRoomName={sessionRoomName}
          desiredDurationSeconds={sessionDurationSeconds}
          onDesiredDurationChange={handleDesiredDurationChange}
          onRequestSavePreset={handleRequestSavePreset}
          isSavingPreset={presetsSaving}
          goalShotsPerTarget={goalShotsPerTarget}
        />
        <SavePresetDialog
          open={isSavePresetDialogOpen}
          onOpenChange={handleSavePresetDialogOpenChange}
          isSaving={presetsSaving}
          name={savePresetName}
          onNameChange={handleSavePresetNameChange}
          description={savePresetDescription}
          onDescriptionChange={handleSavePresetDescriptionChange}
          targetCount={stagedPresetTargets.length}
          includeRoom={savePresetIncludeRoom}
          canIncludeRoom={Boolean(sessionRoomId)}
          onIncludeRoomChange={handleSavePresetIncludeRoomChange}
          durationValue={savePresetDurationInput}
          onDurationValueChange={handleSavePresetDurationChange}
          onSubmit={handleSavePresetSubmit}
          roomName={sessionRoomName}
        />
      </div>
    </div>
  );
};

function convertHistoryEntryToLiveSummary(entry: GameHistory): LiveSessionSummary {
  const sortedHitHistory = Array.isArray(entry.hitHistory)
    ? [...entry.hitHistory].sort((a, b) => a.timestamp - b.timestamp)
    : [];

  const hitsByDevice = new Map<string, number[]>();
  sortedHitHistory.forEach((hit) => {
    const existing = hitsByDevice.get(hit.deviceId);
    if (existing) {
      existing.push(hit.timestamp);
    } else {
      hitsByDevice.set(hit.deviceId, [hit.timestamp]);
    }
  });

  let deviceStats: GameHistory['targetStats'];
  if (Array.isArray(entry.targetStats) && entry.targetStats.length > 0) {
    deviceStats = entry.targetStats.map((stat) => ({
      deviceId: stat.deviceId,
      deviceName: stat.deviceName,
      hitCount: stat.hitCount,
      hitTimes: [...stat.hitTimes],
      averageInterval: stat.averageInterval,
      firstHitTime: stat.firstHitTime,
      lastHitTime: stat.lastHitTime,
    }));
  } else if (Array.isArray(entry.deviceResults) && entry.deviceResults.length > 0) {
    deviceStats = entry.deviceResults.map((result) => {
      const deviceHits = hitsByDevice.get(result.deviceId) ?? [];
      const intervals = deviceHits.slice(1).map((ts, idx) => (ts - deviceHits[idx]) / 1000);

      return {
        deviceId: result.deviceId,
        deviceName: result.deviceName ?? result.deviceId,
        hitCount: Number.isFinite(result.hitCount) ? result.hitCount : deviceHits.length,
        hitTimes: [...deviceHits],
        averageInterval: intervals.length
          ? Number((intervals.reduce((sum, value) => sum + value, 0) / intervals.length).toFixed(2))
          : 0,
        firstHitTime: deviceHits[0] ?? 0,
        lastHitTime: deviceHits[deviceHits.length - 1] ?? 0,
      };
    });
  } else {
    deviceStats = [];
  }

  const totalHits = Number.isFinite(entry.totalHits)
    ? entry.totalHits
    : deviceStats.reduce((sum, stat) => sum + (stat.hitCount ?? 0), 0);

  const firstHitTimestamp = sortedHitHistory.length > 0 ? sortedHitHistory[0].timestamp : undefined;
  const lastHitTimestamp =
    sortedHitHistory.length > 0 ? sortedHitHistory[sortedHitHistory.length - 1].timestamp : undefined;

  const startTime = Number.isFinite(entry.startTime) ? entry.startTime : firstHitTimestamp ?? Date.now();
  const endTime = Number.isFinite(entry.endTime) ? entry.endTime : lastHitTimestamp ?? startTime;
  const derivedFirstHitTimestamp = sortedHitHistory.length > 0 ? sortedHitHistory[0].timestamp : startTime;
  const derivedLastHitTimestamp = sortedHitHistory.length > 0
    ? sortedHitHistory[sortedHitHistory.length - 1].timestamp
    : derivedFirstHitTimestamp;
  const totalSessionSpan = Math.max(1, endTime - startTime);
  const activeSpanRaw = derivedLastHitTimestamp - derivedFirstHitTimestamp;
  const normalizedActiveSpan =
    totalHits < 2 || !Number.isFinite(activeSpanRaw) || activeSpanRaw <= 0 ? totalSessionSpan : activeSpanRaw;
  const efficiencyScoreFromHistory =
    totalHits > 0 ? Math.round((totalHits * (totalSessionSpan / Math.max(1, normalizedActiveSpan))) * 100) / 100 : 0;
  const efficiencyScore = Number.isFinite(efficiencyScoreFromHistory)
    ? efficiencyScoreFromHistory
    : typeof entry.score === 'number' && Number.isFinite(entry.score)
      ? entry.score
      : 0;
  const computedDurationSeconds = Math.max(0, (endTime - startTime) / 1000);
  const durationSeconds = Number.isFinite(entry.actualDuration) && entry.actualDuration > 0
    ? Number(entry.actualDuration.toFixed(2))
    : Number(computedDurationSeconds.toFixed(2));

  const computedAverageHitInterval = (() => {
    if (sortedHitHistory.length < 2) {
      return 0;
    }
    const intervals = sortedHitHistory
      .slice(1)
      .map((hit, idx) => (hit.timestamp - sortedHitHistory[idx].timestamp) / 1000);
    return intervals.length
      ? Number((intervals.reduce((sum, value) => sum + value, 0) / intervals.length).toFixed(2))
      : 0;
  })();

  const averageHitInterval =
    typeof entry.averageHitInterval === 'number' && Number.isFinite(entry.averageHitInterval)
      ? Number(entry.averageHitInterval.toFixed(2))
      : computedAverageHitInterval;

  entry.roomId = typeof entry.roomId === 'string' && entry.roomId.length > 0 ? entry.roomId : null;
  entry.roomName = entry.roomName ?? null;

  const normalizedDesiredDuration =
    typeof entry.desiredDurationSeconds === 'number' && Number.isFinite(entry.desiredDurationSeconds) && entry.desiredDurationSeconds > 0
      ? Math.round(entry.desiredDurationSeconds)
      : null;
  entry.desiredDurationSeconds = normalizedDesiredDuration;
  entry.presetId = typeof entry.presetId === 'string' && entry.presetId.length > 0 ? entry.presetId : null;

  const splits = Array.isArray(entry.splits) ? entry.splits.map((split) => ({ ...split })) : [];
  const transitions = Array.isArray(entry.transitions)
    ? entry.transitions.map((transition) => ({ ...transition }))
    : [];

  const aggregateTargets = Array.isArray(entry.deviceResults) && entry.deviceResults.length > 0 ? entry.deviceResults : deviceStats;
  const fallbackTargets = aggregateTargets.map((result) => ({
    deviceId: result.deviceId,
    deviceName: result.deviceName ?? result.deviceId,
  }));

  const targetDeviceIds =
    Array.isArray(entry.targetDeviceIds) && entry.targetDeviceIds.length > 0
      ? entry.targetDeviceIds
      : fallbackTargets.map((target) => target.deviceId);

  const targetDeviceNames = Array.isArray(entry.targetDeviceNames) ? entry.targetDeviceNames : [];

  const targets = targetDeviceIds.map((deviceId, index) => {
    const existingName =
      targetDeviceNames[index] ??
      deviceStats.find((stat) => stat.deviceId === deviceId)?.deviceName ??
      fallbackTargets.find((target) => target.deviceId === deviceId)?.deviceName ??
      deviceId;
    return {
      deviceId,
      deviceName: existingName ?? deviceId,
    };
  });

  entry.targetDeviceIds = targets.map((target) => target.deviceId);
  entry.targetDeviceNames = targets.map((target) => target.deviceName);

  return {
    gameId: entry.gameId,
    gameName: entry.gameName,
    startedAt: startTime,
    stoppedAt: endTime,
    durationSeconds,
    totalHits,
    averageHitInterval,
    deviceStats,
    crossTargetStats: entry.crossTargetStats ?? null,
    splits,
    transitions,
    targets,
    hitHistory: sortedHitHistory,
    roomId: entry.roomId ?? null,
    roomName: entry.roomName ?? null,
    desiredDurationSeconds: entry.desiredDurationSeconds ?? null,
    targetDeviceIds: entry.targetDeviceIds ?? targets.map((target) => target.deviceId),
    presetId: entry.presetId ?? null,
    historyEntry: {
      ...entry,
      // Ensure goalShotsPerTarget is preserved
      goalShotsPerTarget: entry.goalShotsPerTarget ?? undefined,
    },
    efficiencyScore,
  };
}

interface BuildLiveSessionSummaryArgs {
  gameId: string;
  gameName?: string;
  startTime: number;
  stopTime: number;
  hitHistory: SessionHitRecord[];
  splitRecords: SplitRecord[];
  transitionRecords: TransitionRecord[];
  devices: NormalizedGameDevice[];
  roomId?: string | null;
  roomName?: string | null;
  desiredDurationSeconds?: number | null;
  presetId?: string | null;
  goalShotsPerTarget?: Record<string, number>;
}

// Consolidates telemetry streams and device metadata into a reusable session report.
function buildLiveSessionSummary({
  gameId,
  gameName,
  startTime,
  stopTime,
  hitHistory,
  splitRecords,
  transitionRecords,
  devices,
  roomId = null,
  roomName = null,
  desiredDurationSeconds = null,
  presetId = null,
  goalShotsPerTarget = {},
}: BuildLiveSessionSummaryArgs): LiveSessionSummary {
  const safeStart = Number.isFinite(startTime) ? startTime : stopTime;
  const durationMs = Math.max(0, stopTime - safeStart);
  const rawDurationSeconds = durationMs / 1000;
  const durationSeconds = Number(rawDurationSeconds.toFixed(2));
  const deviceMap = new Map(devices.map((device) => [device.deviceId, device]));
  const deviceIdSet = new Set(devices.map((device) => device.deviceId));

  const sortedHits = [...hitHistory]
    .filter((hit) => deviceIdSet.size === 0 || deviceIdSet.has(hit.deviceId))
    .sort((a, b) => a.timestamp - b.timestamp);
  const totalHits = sortedHits.length;

  const firstHitTimestamp = sortedHits.length > 0 ? sortedHits[0].timestamp : safeStart;
  const lastHitTimestamp = sortedHits.length > 0 ? sortedHits[sortedHits.length - 1].timestamp : firstHitTimestamp;
  const totalSessionSpan = Math.max(1, stopTime - safeStart);
  const activeSpanRaw = lastHitTimestamp - firstHitTimestamp;
  const normalizedActiveSpan =
    totalHits < 2 || !Number.isFinite(activeSpanRaw) || activeSpanRaw <= 0 ? totalSessionSpan : activeSpanRaw;
  const efficiencyScore =
    totalHits > 0 ? Math.round((totalHits * (totalSessionSpan / Math.max(1, normalizedActiveSpan))) * 100) / 100 : 0;

  const deviceStats = devices.map((device) => {
    const hitsForDevice = sortedHits.filter((hit) => hit.deviceId === device.deviceId);
    const hitTimes = hitsForDevice.map((hit) => hit.timestamp);
    const sortedHitTimes = [...hitTimes].sort((a, b) => a - b);
    const intervals = sortedHitTimes.slice(1).map((ts, idx) => (ts - sortedHitTimes[idx]) / 1000);

    return {
      deviceId: device.deviceId,
      deviceName: device.name ?? device.deviceId,
      hitCount: hitsForDevice.length,
      hitTimes: sortedHitTimes,
      averageInterval: intervals.length
        ? Number((intervals.reduce((sum, value) => sum + value, 0) / intervals.length).toFixed(2))
        : 0,
      firstHitTime: sortedHitTimes[0] ?? 0,
      lastHitTime: sortedHitTimes[sortedHitTimes.length - 1] ?? 0,
    };
  });

  const overallIntervals = sortedHits.slice(1).map((hit, idx) => (hit.timestamp - sortedHits[idx].timestamp) / 1000);
  const averageHitInterval = overallIntervals.length
    ? Number((overallIntervals.reduce((sum, value) => sum + value, 0) / overallIntervals.length).toFixed(2))
    : 0;

  const switchTimes: number[] = [];
  for (let i = 1; i < sortedHits.length; i++) {
    if (sortedHits[i].deviceId !== sortedHits[i - 1].deviceId) {
      const switchSpan = (sortedHits[i].timestamp - sortedHits[i - 1].timestamp) / 1000;
      switchTimes.push(Number(switchSpan.toFixed(2)));
    }
  }

  const crossTargetStats = {
    totalSwitches: switchTimes.length,
    averageSwitchTime: switchTimes.length
      ? Number((switchTimes.reduce((sum, value) => sum + value, 0) / switchTimes.length).toFixed(2))
      : 0,
    switchTimes,
  };

  const splits: SessionSplit[] = splitRecords
    .filter((split) => deviceIdSet.has(split.deviceId))
    .map((split) => ({
      deviceId: split.deviceId,
      deviceName: split.deviceName ?? deviceMap.get(split.deviceId)?.name ?? split.deviceId,
      splitNumber: split.splitNumber,
      time: typeof split.time === 'number' ? split.time : Number(split.time) || 0,
      timestamp: typeof split.timestamp === 'number' ? split.timestamp : null,
    }))
    .sort((a, b) => a.splitNumber - b.splitNumber);

  const transitions: SessionTransition[] = transitionRecords
    .filter((transition) => deviceIdSet.has(transition.fromDevice) || deviceIdSet.has(transition.toDevice))
    .map((transition) => ({
      fromDevice: transition.fromDeviceName ?? transition.fromDevice,
      toDevice: transition.toDeviceName ?? transition.toDevice,
      transitionNumber: transition.transitionNumber,
      time: typeof transition.time === 'number' ? transition.time : Number(transition.time) || 0,
    }))
    .sort((a, b) => a.transitionNumber - b.transitionNumber);

  const targets = devices.map((device) => ({
    deviceId: device.deviceId,
    deviceName: device.name ?? device.deviceId,
  }));

  const historyEntry: GameHistory = {
    gameId,
    gameName: gameName ?? `Game ${new Date(safeStart).toLocaleTimeString()}`,
    duration: Math.max(1, Math.ceil(rawDurationSeconds / 60)),
    startTime: safeStart,
    endTime: stopTime,
    score: efficiencyScore,
    deviceResults: deviceStats.map(({ deviceId, deviceName, hitCount }) => ({
      deviceId,
      deviceName,
      hitCount,
    })),
    totalHits,
    actualDuration: durationSeconds,
    averageHitInterval,
    targetStats: deviceStats,
    crossTargetStats,
  };
  historyEntry.roomId = roomId ?? null;
  historyEntry.roomName = roomName ?? null;
  const normalizedDesiredDuration =
    typeof desiredDurationSeconds === 'number' && Number.isFinite(desiredDurationSeconds) && desiredDurationSeconds > 0
      ? Math.round(desiredDurationSeconds)
      : null;
  historyEntry.desiredDurationSeconds = normalizedDesiredDuration;
  historyEntry.presetId = presetId ?? null;
  if (Object.keys(goalShotsPerTarget).length > 0) {
    historyEntry.goalShotsPerTarget = goalShotsPerTarget;
  }
  historyEntry.targetDeviceIds = targets.map((target) => target.deviceId);
  historyEntry.targetDeviceNames = targets.map((target) => target.deviceName);
  historyEntry.splits = splits;
  historyEntry.transitions = transitions;
  historyEntry.hitHistory = sortedHits;

  return {
    gameId: historyEntry.gameId,
    gameName: historyEntry.gameName,
    startedAt: historyEntry.startTime,
    stoppedAt: historyEntry.endTime,
    durationSeconds,
    totalHits,
    averageHitInterval,
    deviceStats,
    crossTargetStats: historyEntry.crossTargetStats,
    splits,
    transitions,
    targets,
    hitHistory: historyEntry.hitHistory ?? [],
    roomId: historyEntry.roomId ?? null,
    roomName: historyEntry.roomName ?? null,
    desiredDurationSeconds: historyEntry.desiredDurationSeconds ?? null,
    targetDeviceIds: historyEntry.targetDeviceIds ?? targets.map((target) => target.deviceId),
    presetId: historyEntry.presetId ?? null,
    historyEntry,
    efficiencyScore,
  };
}


export default Games;
