import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { toast } from '@/components/ui/sonner';
import { resolvePresetDurationSeconds } from '@/features/games/lib/telemetry-utils';
import type { NormalizedGameDevice } from '@/features/games/hooks/use-game-devices';
import type { GamePreset } from '@/features/games';
import type { SessionRegistry } from './use-session-registry';

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
      id?: string;
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
  setSelectedDeviceIds: React.Dispatch<React.SetStateAction<string[]>>;
  setSessionRoomId: React.Dispatch<React.SetStateAction<string | null>>;
  setSessionDurationSeconds: React.Dispatch<React.SetStateAction<number | null>>;
  setGoalShotsPerTarget: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  setIsDurationUnlimited: React.Dispatch<React.SetStateAction<boolean>>;

  // Callback registry (replaces bridge refs)
  registry: SessionRegistry;
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
  handleApplyPreset: (preset: GamePreset) => Promise<{ hasTargets: boolean }>;
  handleUpdateActivePreset: () => Promise<void>;
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
    setSelectedDeviceIds,
    setSessionRoomId,
    setSessionDurationSeconds,
    setGoalShotsPerTarget,
    setIsDurationUnlimited,
    registry,
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
      return;
    }
    try {
      const result = await refetchPresets();
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

    try {
      await savePresetMutation.mutateAsync({
        name: trimmedName,
        description,
        roomId: resolvedRoomId,
        roomName: resolvedRoomName ?? null,
        durationSeconds,
        targetIds,
        settings,
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
    async (preset: GamePreset): Promise<{ hasTargets: boolean }> => {
      if (isSessionLocked) {
        toast.info('Complete or stop the current session before applying a preset.');
        return { hasTargets: false };
      }
      setApplyingPresetId(preset.id);

      try {
        // Resolve which preset targets exist in the available device list
        const presetTargetIds = preset.targetIds ?? [];
        const availableDeviceMap = new Map(availableDevices.map((d) => [d.deviceId, d]));
        const matchedIds = presetTargetIds.filter((id) => availableDeviceMap.has(id));
        const hasTargets = matchedIds.length > 0;

        if (matchedIds.length === 0 && presetTargetIds.length > 0) {
          toast.warning('Preset loaded but none of its targets are available. Select targets manually or refresh devices.');
        } else if (matchedIds.length < presetTargetIds.length) {
          const missing = presetTargetIds.length - matchedIds.length;
          toast.info(`${missing} target${missing > 1 ? 's' : ''} from this preset ${missing > 1 ? 'are' : 'is'} unavailable. Applying ${matchedIds.length} available.`);
        }

        // Populate wizard Step 1: target selection (may be empty if no targets matched)
        setSelectedDeviceIds(matchedIds);

        // Populate wizard Step 1: room
        const resolvedRoomId =
          preset.roomId ??
          (preset.settings != null && typeof (preset.settings as Record<string, unknown>)['roomId'] === 'string'
            ? ((preset.settings as Record<string, unknown>)['roomId'] as string)
            : null);
        setSessionRoomId(resolvedRoomId ?? null);

        // Populate wizard Step 2: duration
        const desiredDurationSeconds = resolvePresetDurationSeconds(preset);
        setSessionDurationSeconds(desiredDurationSeconds);
        // Synchronously set isDurationUnlimited so canAdvanceToReview is correct
        // on the same render (the async useEffect sync in useSessionState would
        // otherwise leave it stale for one cycle, blocking the Start button).
        setIsDurationUnlimited(desiredDurationSeconds === null);

        // Populate wizard Step 3: goal shots — filter to only matched (selected) targets
        const presetGoalShots = preset.settings?.goalShotsPerTarget;
        if (presetGoalShots && typeof presetGoalShots === 'object' && !Array.isArray(presetGoalShots)) {
          const rawGoals = presetGoalShots as Record<string, number>;
          const filteredGoals: Record<string, number> = {};
          for (const id of matchedIds) {
            if (id in rawGoals) {
              filteredGoals[id] = rawGoals[id];
            }
          }
          setGoalShotsPerTarget(filteredGoals);
        } else {
          setGoalShotsPerTarget({});
        }

        setStagedPresetId(preset.id);
        setActivePresetId(preset.id);

        if (hasTargets) {
          toast.success(`Preset "${preset.name}" applied. Review the setup and press Start.`);
        }
        // Auto-advance effects in useSessionState will step through the wizard
        return { hasTargets };
      } catch (error) {
        console.error('[Games] Failed to apply preset', { presetId: preset.id, error });
        toast.error('Failed to apply preset. Try again after refreshing devices.');
        return { hasTargets: false };
      } finally {
        setApplyingPresetId(null);
      }
    },
    [availableDevices, isSessionLocked, rooms, setGoalShotsPerTarget, setIsDurationUnlimited, setSelectedDeviceIds, setSessionDurationSeconds, setSessionRoomId],
  );

  const handleUpdateActivePreset = useCallback(async () => {
    if (!activePresetId) {
      toast.error('No active preset to update.');
      return;
    }
    const preset = gamePresets.find((p) => p.id === activePresetId);
    if (!preset) {
      toast.error('Active preset not found.');
      return;
    }
    if (stagedPresetTargets.length === 0) {
      toast.error('Select at least one target before updating the preset.');
      return;
    }

    const targetIds = Array.from(new Set(stagedPresetTargets.map((d) => d.deviceId)));
    const durationSeconds = typeof sessionDurationSeconds === 'number' && sessionDurationSeconds > 0
      ? Math.round(sessionDurationSeconds)
      : null;
    const resolvedRoomId = sessionRoomId ?? null;
    const resolvedRoomName = resolvedRoomId
      ? rooms.find((room) => room.id === resolvedRoomId)?.name ?? null
      : null;

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

    try {
      await savePresetMutation.mutateAsync({
        id: preset.id,
        name: preset.name,
        description: preset.description ?? null,
        roomId: resolvedRoomId,
        roomName: resolvedRoomName,
        durationSeconds,
        targetIds,
        settings,
      });
      toast.success(`Preset "${preset.name}" updated.`);
    } catch (error) {
      console.error('[Games] Failed to update preset', error);
    }
  }, [
    activePresetId,
    gamePresets,
    goalShotsPerTarget,
    rooms,
    savePresetMutation,
    sessionDurationSeconds,
    sessionRoomId,
    stagedPresetTargets,
  ]);

  // --- Effects ---

  useEffect(() => {
    if (!presetsError) {
      presetsErrorRef.current = null;
      return;
    }
    if (presetsErrorRef.current === presetsError) {
      return;
    }
    presetsErrorRef.current = presetsError;
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
    handleUpdateActivePreset,
  };
}
