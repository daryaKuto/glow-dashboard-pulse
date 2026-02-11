import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { AlertCircle } from 'lucide-react';
import Header from '@/components/shared/Header';
import Sidebar from '@/components/shared/Sidebar';
import MobileDrawer from '@/components/shared/MobileDrawer';
import { useIsMobile } from '@/shared/hooks/use-mobile';
import { useGameDevices, type NormalizedGameDevice } from '@/features/games/hooks/use-game-devices';
import { useTargets } from '@/features/targets';
import type { Target } from '@/features/targets/schema';
import { useRooms } from '@/features/rooms';
import { useTargetGroups } from '@/features/targets';
import { useGameTelemetry } from '@/features/games/hooks/use-game-telemetry';
import { useThingsboardToken } from '@/features/games/hooks/use-thingsboard-token';
import { useDirectTbTelemetry } from '@/features/games/hooks/use-direct-tb-telemetry';
import { useSessionActivation } from '@/features/games/hooks/use-session-activation';
import { useAuth } from '@/shared/hooks/use-auth';
import { mark } from '@/utils/performance-monitor';
import { useTargetCustomNames } from '@/features/targets';
import {
  LiveSessionCard,
  LiveSessionCardSkeleton,
  StartSessionDialog,
} from '@/components/games';
import { useSessionTimer, type SessionHitEntry } from '@/components/game-session/sessionState';
import { useGamePresets, useSaveGamePreset, useDeleteGamePreset } from '@/features/games';
import { useDeviceSelection } from '@/features/games/hooks/use-device-selection';
import { useSessionLifecycle } from '@/features/games/hooks/use-session-lifecycle';
import { useSessionTelemetrySync } from '@/features/games/hooks/use-session-telemetry-sync';
import { useGameDataLoader } from '@/features/games/hooks/use-game-data-loader';
import { usePresetManagement } from '@/features/games/hooks/use-preset-management';
import { useSessionState } from '@/features/games/hooks/use-session-state';
import { useSessionRegistry } from '@/features/games/hooks/use-session-registry';
import { useTbAuth } from '@/features/games/hooks/use-tb-auth';
import { useTbDeviceRpc } from '@/features/games/hooks/use-tb-device-rpc';
import { useTbSessionFlow } from '@/features/games/hooks/use-tb-session-flow';
import { useSessionFinalizer } from '@/features/games/hooks/use-session-finalizer';
import {
  StepOneSkeleton,
  StepTwoSkeleton,
  StepThreeSkeleton,
  GamePresetsCard,
  SavePresetDialog,
  SetupStepOne,
  SetupStepTwo,
  SetupStepThree,
} from './components';

const REVIEW_TARGET_DISPLAY_LIMIT = 6;

const DIRECT_TB_CONTROL_ENABLED = true;

// Main Live Game Control page: orchestrates device state, telemetry streams, and session history for operator control.
const Games: React.FC = () => {
  mark('games-page-render-start');
  const isMobile = useIsMobile();
  const { user } = useAuth();
  // Tracks the shadcn sidebar state so we know whether to render the drawer on small screens.
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const { isLoading: loadingDevices, refresh: refreshGameDevices } = useGameDevices({ immediate: false });
  const {
    data: targetsData,
    isLoading: targetsStoreLoading,
    refetch: refetchTargets,
  } = useTargets();
  const targetsSnapshot = targetsData?.targets ?? [];
  const refreshTargets = useCallback(async () => {
    await refetchTargets();
  }, [refetchTargets]);
  const { data: roomsData, isLoading: roomsLoading } = useRooms();
  const rooms = roomsData?.rooms ?? [];
  // Target groups - now using React Query hook (replaces Zustand useTargetGroups store)
  const { groups, isLoading: groupsLoading, refetch: refetchGroups } = useTargetGroups();
  // Game presets - now using React Query hooks (replaces Zustand useGamePresets store)
  const { data: gamePresets = [], isLoading: presetsLoading, error: presetsQueryError, refetch: refetchPresets } = useGamePresets();
  const savePresetMutation = useSaveGamePreset();
  const deletePresetMutation = useDeleteGamePreset();
  const presetsSaving = savePresetMutation.isPending;
  const presetsError = presetsQueryError?.message ?? savePresetMutation.error?.message ?? deletePresetMutation.error?.message ?? null;
  // Canonical list of targets decorated with live telemetry that powers the tables and selectors.
  const [availableDevices, setAvailableDevices] = useState<NormalizedGameDevice[]>([]);
  // Surface-level error banner for operator actions (start/stop failures, auth issues).
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // Single source of truth for the popup lifecycle (selecting → launching → running → stopping → finalizing).
  const {
    lifecycle: sessionLifecycle,
    isSessionDialogDismissed,
    isSelectingLifecycle,
    isLaunchingLifecycle,
    isRunningLifecycle,
    isStoppingLifecycle,
    isFinalizingLifecycle,
    isSessionLocked,
    isSessionDialogVisible,
    isLiveDialogPhase,
    setLifecycle: setSessionLifecycle,
    setIsSessionDialogDismissed,
    lifecycleRef: sessionLifecycleRef,
  } = useSessionLifecycle();
  const currentSessionTargetsRef = useRef<NormalizedGameDevice[]>([]);
  // Custom names for targets
  const { data: customNames = new Map() } = useTargetCustomNames();

  // Callback registry: single ref replaces all 10 bridge refs.
  // Hooks register their callbacks here; other hooks read them at call time.
  const { register, call, registry } = useSessionRegistry();

  // --- Game data loader (history, devices, localStorage persistence) ---
  const {
    gameHistory,
    setGameHistory,
    isHistoryLoading,
    recentSessionSummary,
    setRecentSessionSummary,
    loadGameHistory,
    loadLiveDevices,
    availableDevicesRef,
  } = useGameDataLoader({
    userId: user?.id,
    isRunningLifecycle,
    availableDevices,
    setAvailableDevices,
    setErrorMessage,
    registry,
    refreshGameDevices,
    refreshTargets,
    targetsSnapshot,
    targetsStoreLoading,
    loadingDevices,
  });

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
  // Centralised token manager so the Games page always has a fresh ThingsBoard JWT for sockets/RPCs.
  const { session: tbSession, refresh: refreshThingsboardSession } = useThingsboardToken();

  const currentGameId: string | null = null;
  const isStarting = isLaunchingLifecycle;
  const isStopping = isStoppingLifecycle;


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

  // Status from edge device list (device.raw.status from useGameDevices / edge fetchTargetsWithTelemetry).
  const deriveConnectionStatus = useCallback(
    (device: NormalizedGameDevice): 'online' | 'standby' | 'offline' => {
      const status = device.raw?.status;
      if (status === 'online' || status === 'standby' || status === 'offline') {
        return status;
      }
      return 'offline';
    },
    [],
  );

  const {
    selectedDeviceIds,
    sessionRoomId,
    sessionGroupId,
    roomSelections,
    groupSelections,
    orderedAvailableDevices,
    selectedOnlineDevices,
    totalOnlineSelectableTargets,
    handleToggleDeviceSelection,
    handleSelectAllDevices,
    handleClearDeviceSelection,
    handleToggleRoomTargets,
    handleSelectAllRooms,
    handleClearRoomSelection,
    handleToggleGroupTargets,
    handleSelectAllGroups,
    handleClearGroupSelection,
    setSelectedDeviceIds,
    setSessionRoomId,
    setSessionGroupId,
    selectionManuallyModifiedRef,
  } = useDeviceSelection({
    availableDevices,
    rooms,
    groups,
    deriveConnectionStatus,
    onSelectionChange: () => call('setStagedPresetId', null),
  });

  const deriveIsOnline = useCallback(
    (device: NormalizedGameDevice) => deriveConnectionStatus(device) !== 'offline',
    [deriveConnectionStatus],
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

  const selectedDevices = useMemo<NormalizedGameDevice[]>(() => {
    if (selectedDeviceIds.length === 0) {
      return [];
    }
    return selectedDeviceIds
      .map((deviceId) => availableDevices.find((device) => device.deviceId === deviceId) ?? null)
      .filter((device): device is NormalizedGameDevice => device !== null);
  }, [availableDevices, selectedDeviceIds]);

  // --- Consolidated session state (timestamps, devices, duration, setup step wizard) ---
  const {
    gameStartTime,
    setGameStartTime,
    gameStopTime,
    setGameStopTime,
    activeDeviceIds,
    setActiveDeviceIds,
    pendingSessionTargets,
    setPendingSessionTargets,
    currentSessionTargets,
    setCurrentSessionTargets,
    sessionDurationSeconds,
    setSessionDurationSeconds,
    durationInputValue,
    isDurationUnlimited,
    goalShotsPerTarget,
    setGoalShotsPerTarget,
    isStepSelectTargets,
    isStepReview,
    canAdvanceToDuration,
    canAdvanceToReview,
    canLaunchGame,
    formattedDurationLabel,
    resetSetupStep,
    advanceToReviewStep,
    handleDesiredDurationChange,
    handleDurationInputValueChange,
    handleToggleDurationUnlimited,
  } = useSessionState({
    recentSessionSummary,
    sessionLifecycle,
    selectedOnlineDevices,
    selectedDeviceCount: selectedDevices.length,
    isSessionLocked,
    registry,
  });

  // --- Preset management (state, save/delete/apply callbacks, logging effects) ---
  const {
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
  } = usePresetManagement({
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
    registry,
  });
  // Register setStagedPresetId so useDeviceSelection + useSessionState can reach it via registry.
  register('setStagedPresetId', setStagedPresetId);

  const sessionRoomName = useMemo(() => {
    if (!sessionRoomId) {
      return null;
    }
    const roomRecord = rooms.find((room) => room.id === sessionRoomId);
    return roomRecord?.name ?? null;
  }, [rooms, sessionRoomId]);

  // Sync currentSessionTargetsRef with latest value from useSessionState
  useEffect(() => {
    currentSessionTargetsRef.current = currentSessionTargets;
  }, [currentSessionTargets]);

  // Composite reset: resets setup step + clears external state from other hooks
  const resetSetupFlow = useCallback(() => {
    resetSetupStep();
    call('setStagedPresetId', null);
    call('setStoppedTargets', new Set<string>());
  }, [resetSetupStep, call]);

  useEffect(() => {
    if (selectedDeviceIds.length === 0 && !isStepSelectTargets) {
      resetSetupFlow();
    }
  }, [isStepSelectTargets, resetSetupFlow, selectedDeviceIds.length]);

  // C.1: ThingsBoard auth (token, error, loading state)
  const {
    directControlToken,
    directControlError,
    isDirectAuthLoading,
    setDirectControlError,
    refreshDirectAuthToken,
  } = useTbAuth();

  // Shared direct-session state — lifted to page level so C.2 and C.3 can both access it
  // without a circular dependency (C.2 needs these values, C.3 needs executeDirectStart from C.2).
  const [directSessionGameId, setDirectSessionGameId] = useState<string | null>(null);
  const [directSessionTargets, setDirectSessionTargets] = useState<Array<{ deviceId: string; name: string }>>([]);
  const [directFlowActive, setDirectFlowActive] = useState(false);
  const [directTelemetryEnabled, setDirectTelemetryEnabled] = useState(false);

  // C.2: Device RPC (per-device start states, executeDirectStart, retry)
  const {
    directStartStates,
    isRetryingFailedDevices,
    directStartStatesRef,
    updateDirectStartStates,
    executeDirectStart,
    handleRetryFailedDevices,
  } = useTbDeviceRpc({
    refreshDirectAuthToken,
    setDirectControlError,
    setSessionLifecycle,
    startSessionTimer,
    resetSessionTimer,
    markTelemetryConfirmed,
    setGameStartTime,
    setGameStopTime,
    setErrorMessage,
    setActivePresetId,
    directSessionGameId,
    directSessionTargets,
    setDirectFlowActive,
    setDirectTelemetryEnabled,
    sessionDurationSeconds,
    sessionRoomId,
    registry,
  });

  // C.3: Session flow (dialog handlers, start/stop orchestration)
  const {
    isDirectTelemetryLifecycle,
    isDirectFlow,
    openStartDialogForTargets,
    beginSessionLaunch,
    handleStopDirectGame,
    handleStopGame,
    handleCloseStartDialog,
    handleUsePreviousSettings,
    handleCreateNewSetup,
    handleOpenStartDialog,
    handleConfirmStartDialog,
    handleStopFromDialog,
  } = useTbSessionFlow({
    refreshDirectAuthToken,
    setDirectControlError,
    executeDirectStart,
    updateDirectStartStates,
    isLaunchingLifecycle,
    isRunningLifecycle,
    isStoppingLifecycle,
    isFinalizingLifecycle,
    isSessionLocked,
    sessionLifecycle,
    setSessionLifecycle,
    setIsSessionDialogDismissed,
    resetSessionTimer,
    freezeSessionTimer,
    resetSessionActivation,
    markSessionTriggered,
    selectedDeviceIds,
    setSelectedDeviceIds,
    selectionManuallyModifiedRef,
    setSessionRoomId,
    registry,
    register,
    activeDeviceIds,
    setActiveDeviceIds,
    pendingSessionTargets,
    setPendingSessionTargets,
    currentSessionTargets,
    setCurrentSessionTargets,
    setAvailableDevices,
    gameStartTime,
    setGameStartTime,
    setGameStopTime,
    setErrorMessage,
    setRecentSessionSummary,
    goalShotsPerTarget,
    sessionDurationSeconds,
    setSessionDurationSeconds,
    sessionRoomId,
    sessionRoomName,
    stagedPresetId,
    activePresetId,
    setActivePresetId,
    setStagedPresetId,
    setGoalShotsPerTarget,
    availableDevicesRef,
    currentGameDevicesRef,
    availableDeviceMap,
    deriveIsOnline,
    loadGameHistory,
    loadLiveDevices,
    resetSetupFlow,
    recentSessionSummary,
    canLaunchGame,
    advanceToReviewStep,
    directSessionGameId,
    setDirectSessionGameId,
    directSessionTargets,
    setDirectSessionTargets,
    directFlowActive,
    setDirectFlowActive,
    directTelemetryEnabled,
    setDirectTelemetryEnabled,
  });

  // Shared telemetry hook feeds real-time hit data for active devices so the page can merge hit counts, splits, and transitions.
  const directTelemetryDeviceDescriptors = useMemo(
    () =>
      activeDeviceIds.map((deviceId) => ({
        deviceId,
        deviceName: availableDevicesRef.current.find((device) => device.deviceId === deviceId)?.name ?? deviceId,
      })),
    [activeDeviceIds],
  );

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

  const telemetryState = isDirectFlow ? directTelemetryState : standardTelemetryState;


  // Refs to track latest telemetry state (avoid dependency array issues)
  const telemetryStateRef = useRef(telemetryState);
  useEffect(() => {
    telemetryStateRef.current = telemetryState;
  }, [telemetryState]);

  // Telemetry sync: owns hitCounts, hitHistory, stoppedTargets state + processing effect.
  const {
    hitCounts,
    hitHistory,
    stoppedTargets,
    setHitCounts,
    setHitHistory,
    setStoppedTargets,
    stoppedTargetsRef,
    goalShotsPerTargetRef,
    stopTargetWhenGoalReached,
  } = useSessionTelemetrySync({
    isLaunchingLifecycle,
    isRunningLifecycle,
    sessionLifecycle,
    currentGameId,
    directSessionGameId,
    isDirectFlow,
    telemetryState,
    goalShotsPerTarget,
    sessionConfirmed,
    markTelemetryConfirmed,
    hasMarkedTelemetryConfirmedRef,
    currentSessionTargetsRef,
    availableDevicesRef,
    setAvailableDevices,
    activeDeviceIds,
  });

  // Register telemetry setters so other hooks can reach them via registry.
  register('setHitCounts', setHitCounts);
  register('setHitHistory', setHitHistory);
  register('setStoppedTargets', setStoppedTargets);

  // C.4: Session finalizer (auto-stop, goal termination, session persistence)
  const {
    splitRecords,
    transitionRecords,
  } = useSessionFinalizer({
    sessionLifecycle,
    isRunningLifecycle,
    isLaunchingLifecycle,
    setSessionLifecycle,
    sessionConfirmed,
    telemetryConfirmedAt,
    startTriggeredAt,
    sessionTimerSeconds,
    startSessionTimer,
    activeDeviceIds,
    goalShotsPerTarget,
    sessionDurationSeconds,
    hitHistory,
    stoppedTargets,
    telemetryState,
    setRecentSessionSummary,
    setGameHistory,
    register,
    sessionConfirmedRef,
    hasMarkedTelemetryConfirmedRef,
    handleStopGame,
  });

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

  const reviewTargets = useMemo(() => {
    if (selectedDevices.length === 0) {
      return [];
    }
    return selectedDevices.slice(0, REVIEW_TARGET_DISPLAY_LIMIT);
  }, [selectedDevices]);

  const remainingReviewTargetCount = Math.max(selectedDevices.length - reviewTargets.length, 0);

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
    // Don't block page rendering on loadingDevices or roomsLoading:
    // - loadingDevices is slow (3500ms) and setup sections can render progressively
    // - roomsLoading duplicates the same ThingsBoard telemetry fetch that targets-with-telemetry does (see rooms/index.ts)
    //   Both fetch all devices + telemetry from ThingsBoard, so waiting for both is redundant (~850ms each)
    // RoomSelectionCard handles its own loading state internally, showing "Loading rooms…" while data loads
    isHistoryLoading || targetsStoreLoading || presetsLoading;

  const displayedSelectedCount = selectedDeviceIds.length;
  const isPageLoading = isInitialDataLoading;
  const sessionDialogTargets =
    isLiveDialogPhase && currentSessionTargets.length > 0 ? currentSessionTargets : pendingSessionTargets;
  const canDismissSessionDialog = sessionLifecycle === 'selecting' && !isStarting && !isLaunchingLifecycle;

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
                  <SetupStepOne
                    roomsLoading={roomsLoading}
                    roomSelections={roomSelections}
                    sessionRoomId={sessionRoomId}
                    onSelectAllRooms={handleSelectAllRooms}
                    onClearRoomSelection={handleClearRoomSelection}
                    onToggleRoomTargets={handleToggleRoomTargets}
                    groupsLoading={groupsLoading}
                    groupSelections={groupSelections}
                    sessionGroupId={sessionGroupId}
                    onSelectAllGroups={handleSelectAllGroups}
                    onClearGroupSelection={handleClearGroupSelection}
                    onToggleGroupTargets={handleToggleGroupTargets}
                    loadingDevices={loadingDevices}
                    isSessionLocked={isSessionLocked}
                    orderedAvailableDevices={orderedAvailableDevices}
                    targetById={targetById}
                    selectedDeviceIds={selectedDeviceIds}
                    hitCounts={hitCounts}
                    deriveConnectionStatus={deriveConnectionStatus}
                    deriveIsOnline={deriveIsOnline}
                    formatLastSeen={formatLastSeen}
                    onToggleDeviceSelection={handleToggleDeviceSelection}
                    onSelectAllDevices={handleSelectAllDevices}
                    onClearDeviceSelection={handleClearDeviceSelection}
                    displayedSelectedCount={displayedSelectedCount}
                    totalOnlineSelectableTargets={totalOnlineSelectableTargets}
                  />
                )}

                {isPageLoading ? (
                  <StepTwoSkeleton />
                ) : (
                  <SetupStepTwo
                    canAdvanceToDuration={canAdvanceToDuration}
                    isSessionLocked={isSessionLocked}
                    isDurationUnlimited={isDurationUnlimited}
                    durationInputValue={durationInputValue}
                    formattedDurationLabel={formattedDurationLabel}
                    onDurationInputValueChange={handleDurationInputValueChange}
                    onToggleDurationUnlimited={handleToggleDurationUnlimited}
                  />
                )}

                {isPageLoading ? (
                  <StepThreeSkeleton />
                ) : (
                  <SetupStepThree
                    sessionRoomName={sessionRoomName}
                    selectedDevices={selectedDevices}
                    reviewTargets={reviewTargets}
                    remainingReviewTargetCount={remainingReviewTargetCount}
                    formattedDurationLabel={formattedDurationLabel}
                    canAdvanceToReview={canAdvanceToReview}
                    canLaunchGame={canLaunchGame}
                    isSessionLocked={isSessionLocked}
                    isStarting={isStarting}
                    loadingDevices={loadingDevices}
                    goalShotsPerTarget={goalShotsPerTarget}
                    setGoalShotsPerTarget={setGoalShotsPerTarget}
                    targetById={targetById}
                    deriveIsOnline={deriveIsOnline}
                    onOpenStartDialog={handleOpenStartDialog}
                    onRequestSavePreset={handleRequestSavePreset}
                  />
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

export default Games;
