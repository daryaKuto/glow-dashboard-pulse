import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { toast } from '@/components/ui/sonner';
import { throttledLogOnChange } from '@/utils/log-throttle';
import { resolvePresetDurationSeconds } from '@/features/games/lib/telemetry-utils';
import type { NormalizedGameDevice } from '@/features/games/hooks/use-game-devices';
import type { GamePreset } from '@/features/games';

// Signatures for ThingsBoard control callbacks accessed via bridge refs.
type OpenStartDialogFn = (args: {
  targetIds: string[];
  source: 'manual' | 'preset';
  requireOnline: boolean;
  syncCurrentTargets?: boolean;
}) => Promise<{ targets: NormalizedGameDevice[]; gameId: string } | null>;

type BeginSessionLaunchFn = (args?: {
  targets?: NormalizedGameDevice[];
  gameId?: string;
}) => void;

export interface UsePresetManagementOptions {
  // React Query preset state
  gamePresets: GamePreset[];
  presetsLoading: boolean;
  presetsError: string | null;
  presetsSaving: boolean;
  refetchPresets: () => Promise<{ data?: GamePreset[] }>;
  deletePresetMutation: { mutateAsync: (id: string) => Promise<unknown> };
  savePresetMutation: {
    mutateAsync: (params: {
      name: string;
      description: string | null;
      roomId: string | null;
      roomName: string | null;
      durationSeconds: number | null;
      targetIds: string[];
      settings: Record<string, unknown>;
    }) => Promise<unknown>;
  };

  // Session state (read-only inputs)
  isSessionLocked: boolean;
  sessionDurationSeconds: number | null;
  sessionRoomId: string | null;
  goalShotsPerTarget: Record<string, number>;
  rooms: Array<{ id: string; name?: string | null }>;

  // For stagedPresetTargets memo
  pendingSessionTargets: NormalizedGameDevice[];
  currentSessionTargets: NormalizedGameDevice[];
  selectedDeviceIds: string[];
  availableDevices: NormalizedGameDevice[];

  // Setters for cross-hook state
  setSessionRoomId: React.Dispatch<React.SetStateAction<string | null>>;
  setSessionDurationSeconds: React.Dispatch<React.SetStateAction<number | null>>;
  setGoalShotsPerTarget: React.Dispatch<React.SetStateAction<Record<string, number>>>;

  // Bridge refs for TB control callbacks (wired after useThingsboardControl)
  openStartDialogRef: React.MutableRefObject<OpenStartDialogFn>;
  beginSessionLaunchRef: React.MutableRefObject<BeginSessionLaunchFn>;
}

export interface UsePresetManagementReturn {
  // State values
  applyingPresetId: string | null;
  deletingPresetId: string | null;
  isSavePresetDialogOpen: boolean;
  savePresetName: string;
  savePresetDescription: string;
  savePresetIncludeRoom: boolean;
  savePresetDurationInput: string;
  stagedPresetId: string | null;
  activePresetId: string | null;

  // Setters needed externally
  setStagedPresetId: React.Dispatch<React.SetStateAction<string | null>>;
  setActivePresetId: React.Dispatch<React.SetStateAction<string | null>>;

  // Computed
  stagedPresetTargets: NormalizedGameDevice[];

  // Callbacks
  handleRefreshPresets: () => Promise<void>;
  handleDeletePreset: (preset: GamePreset) => Promise<void>;
  handleSavePresetDialogOpenChange: (nextOpen: boolean) => void;
  handleRequestSavePreset: () => void;
  handleSavePresetNameChange: (value: string) => void;
  handleSavePresetDescriptionChange: (value: string) => void;
  handleSavePresetIncludeRoomChange: (value: boolean) => void;
  handleSavePresetDurationChange: (value: string) => void;
  handleSavePresetSubmit: () => Promise<void>;
  handleApplyPreset: (preset: GamePreset) => Promise<void>;
}

export function usePresetManagement(options: UsePresetManagementOptions): UsePresetManagementReturn {
  const {
    gamePresets,
    presetsLoading,
    presetsError,
    presetsSaving,
    refetchPresets,
    deletePresetMutation,
    savePresetMutation,
    isSessionLocked,
    sessionDurationSeconds,
    sessionRoomId,
    goalShotsPerTarget,
    rooms,
    pendingSessionTargets,
    currentSessionTargets,
    selectedDeviceIds,
    availableDevices,
    setSessionRoomId,
    setSessionDurationSeconds,
    setGoalShotsPerTarget,
    openStartDialogRef,
    beginSessionLaunchRef,
  } = options;

  // --- State ---
  const [applyingPresetId, setApplyingPresetId] = useState<string | null>(null);
  const [deletingPresetId, setDeletingPresetId] = useState<string | null>(null);
  const [isSavePresetDialogOpen, setIsSavePresetDialogOpen] = useState(false);
  const [savePresetName, setSavePresetName] = useState('');
  const [savePresetDescription, setSavePresetDescription] = useState('');
  const [savePresetIncludeRoom, setSavePresetIncludeRoom] = useState(false);
  const [savePresetDurationInput, setSavePresetDurationInput] = useState('');
  const [stagedPresetId, setStagedPresetId] = useState<string | null>(null);
  const [activePresetId, setActivePresetId] = useState<string | null>(null);

  // --- Ref ---
  const presetsErrorRef = useRef<string | null>(null);

  // --- Memo ---
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

  // --- Callbacks ---

  const handleRefreshPresets = useCallback(async () => {
    if (presetsLoading) {
      console.debug('[Games] Manual preset refresh ignored because a fetch is already in progress', {
        at: new Date().toISOString(),
      });
      return;
    }
    console.info('[Games] Manual game preset refresh triggered');
    try {
      const result = await refetchPresets();
      console.info('[Games] Manual preset refresh completed', {
        at: new Date().toISOString(),
        presetCount: result.data?.length ?? 0,
      });
      toast.success('Game presets refreshed.');
    } catch (err) {
      console.error('[Games] Manual preset refresh failed', {
        at: new Date().toISOString(),
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }, [refetchPresets, presetsLoading]);

  const handleDeletePreset = useCallback(
    async (preset: GamePreset) => {
      if (deletingPresetId) {
        return;
      }
      setDeletingPresetId(preset.id);
      console.info('[Games] Deleting game preset', { presetId: preset.id, name: preset.name });
      try {
        await deletePresetMutation.mutateAsync(preset.id);
      } catch (error) {
        console.error('[Games] Failed to delete preset', { presetId: preset.id, error });
      } finally {
        setDeletingPresetId(null);
      }
    },
    [deletePresetMutation, deletingPresetId],
  );

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
      console.debug('[Games] Calling savePresetMutation.mutateAsync()', {
        at: new Date().toISOString(),
      });
      await savePresetMutation.mutateAsync({
        name: trimmedName,
        description,
        roomId: resolvedRoomId,
        roomName: resolvedRoomName ?? null,
        durationSeconds,
        targetIds,
        settings,
      });
      console.debug('[Games] savePresetMutation resolved', {
        at: new Date().toISOString(),
      });
      setIsSavePresetDialogOpen(false);
      resetSavePresetForm();
    } catch (error) {
      console.error('[Games] Failed to save preset', error);
    }
  }, [
    goalShotsPerTarget,
    resetSavePresetForm,
    rooms,
    savePresetMutation,
    savePresetDescription,
    savePresetDurationInput,
    savePresetIncludeRoom,
    savePresetName,
    sessionRoomId,
    stagedPresetTargets,
  ]);

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
        const prepResult = await openStartDialogRef.current({
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
        beginSessionLaunchRef.current({ targets: prepResult.targets, gameId: prepResult.gameId });
      } catch (error) {
        console.error('[Games] Failed to apply preset', { presetId: preset.id, error });
        toast.error('Failed to apply preset. Try again after refreshing devices.');
      } finally {
        setApplyingPresetId(null);
      }
    },
    [beginSessionLaunchRef, isSessionLocked, openStartDialogRef, rooms, setGoalShotsPerTarget, setSessionDurationSeconds, setSessionRoomId],
  );

  // --- Effects ---

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

  return {
    applyingPresetId,
    deletingPresetId,
    isSavePresetDialogOpen,
    savePresetName,
    savePresetDescription,
    savePresetIncludeRoom,
    savePresetDurationInput,
    stagedPresetId,
    activePresetId,
    setStagedPresetId,
    setActivePresetId,
    stagedPresetTargets,
    handleRefreshPresets,
    handleDeletePreset,
    handleSavePresetDialogOpenChange,
    handleRequestSavePreset,
    handleSavePresetNameChange,
    handleSavePresetDescriptionChange,
    handleSavePresetIncludeRoomChange,
    handleSavePresetDurationChange,
    handleSavePresetSubmit,
    handleApplyPreset,
  };
}
