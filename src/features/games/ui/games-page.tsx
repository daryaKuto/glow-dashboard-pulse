import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useGameDevices, type NormalizedGameDevice } from '@/features/games/hooks/use-game-devices';
import { useTargets } from '@/features/targets';
import type { Target } from '@/features/targets/schema';
import { useRooms } from '@/features/rooms';
import { useTargetGroups } from '@/features/targets';
import { useDirectTbTelemetry } from '@/features/games/hooks/use-direct-tb-telemetry';
import { useSessionActivation } from '@/features/games/hooks/use-session-activation';
import { useAuth } from '@/shared/hooks/use-auth';
import { mark } from '@/utils/performance-monitor';
import { useTargetCustomNames } from '@/features/targets';
import {
  LiveSessionCard,
  LiveSessionCardSkeleton,
  StartSessionDialog,
} from '@/features/games/ui/components';
import { useSessionTimer, type SessionHitEntry } from '@/features/games/lib/session-state';
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
import { deriveIsOnline } from '@/features/games/lib/device-status-utils';
import {
  SetupWizardSkeleton,
  SavePresetDialog,
  SetupStepOne,
  SetupStepTwo,
  SetupStepThree,
  ErrorBanner,
  PresetBanner,
} from './components';
import { Card, CardContent } from '@/components/ui/card';
import { Check, Pencil, RotateCcw } from 'lucide-react';
import { FeatureErrorBoundary } from '@/shared/ui/FeatureErrorBoundary';
import { motion, AnimatePresence } from 'framer-motion';

const REVIEW_TARGET_DISPLAY_LIMIT = 6;

// --- Wizard accordion inline components (Phase 3) ---

const StepProgressBar: React.FC<{
  currentStep: 1 | 2 | 3;
  step1Complete: boolean;
  step2Complete: boolean;
}> = ({ currentStep, step1Complete, step2Complete }) => (
  <div className="flex gap-1.5">
    {[1, 2, 3].map((step) => {
      const isComplete = step === 1 ? step1Complete : step === 2 ? step2Complete : false;
      const isActive = step === currentStep;
      const isFilled = isComplete || isActive;
      return (
        <div key={step} className="flex-1 h-1.5 rounded-full overflow-hidden bg-[rgba(28,25,43,0.08)]">
          <motion.div
            className="h-full rounded-full bg-brand-primary"
            initial={{ width: 0 }}
            animate={{ width: isFilled ? '100%' : '0%' }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
          />
        </div>
      );
    })}
  </div>
);

const StepBadge: React.FC<{ step: number; isComplete: boolean; isActive: boolean }> = ({
  step, isComplete, isActive
}) => (
  <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-sm font-bold font-body transition-colors duration-200 ${
    isComplete ? 'bg-brand-primary text-white'
      : isActive ? 'bg-brand-primary/10 text-brand-primary'
      : 'bg-[rgba(28,25,43,0.06)] text-brand-dark/30'
  }`}>
    {isComplete ? <Check className="w-4 h-4" /> : step}
  </span>
);

const SetupStep: React.FC<{
  step: number;
  title: string;
  isActive: boolean;
  isComplete: boolean;
  isReachable: boolean;
  summaryText: string;
  onEdit: () => void;
  children: React.ReactNode;
}> = ({ step, title, isActive, isComplete, isReachable, summaryText, onEdit, children }) => (
  <div>
    <button
      onClick={onEdit}
      disabled={!isReachable}
      className="flex items-center justify-between w-full py-2 text-left group"
    >
      <div className="flex items-center gap-3">
        <StepBadge step={step} isComplete={isComplete} isActive={isActive} />
        <div>
          <p className="text-label text-brand-secondary uppercase tracking-wide font-body">Step {step}</p>
          <h2 className="font-heading text-base font-semibold text-brand-dark">{title}</h2>
        </div>
      </div>
      {!isActive && isComplete && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-brand-dark/60 font-body">{summaryText}</span>
          <Pencil className="h-3.5 w-3.5 text-brand-dark/30 group-hover:text-brand-primary transition-colors" />
        </div>
      )}
    </button>
    <AnimatePresence>
      {isActive && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className="overflow-hidden"
        >
          <div className="pt-3 pb-1">{children}</div>
        </motion.div>
      )}
    </AnimatePresence>
  </div>
);

// Main Live Game Control page: orchestrates device state, telemetry streams, and session history for operator control.
const Games: React.FC = () => {
  mark('games-page-render-start');
  const { user } = useAuth();


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
  const [activeView, setActiveView] = useState<'setup' | 'summary'>('setup');
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);
  // Tracks whether auto-advance is allowed.  When the user manually navigates
  // back to an earlier step we disable auto-advance so they can edit freely.
  const autoAdvanceAllowedRef = useRef(true);
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


  const {
    selectedDeviceIds,
    sessionRoomId,
    sessionGroupId,
    availableDeviceMap,
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
    onSelectionChange: () => call('setStagedPresetId', null),
  });

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
  }, [availableDevices, isSessionLocked]);

  const selectedDevices = useMemo<NormalizedGameDevice[]>(() => {
    if (selectedDeviceIds.length === 0) {
      return [];
    }
    return selectedDeviceIds
      .map((deviceId) => availableDeviceMap.get(deviceId) ?? null)
      .filter((device): device is NormalizedGameDevice => device !== null);
  }, [availableDeviceMap, selectedDeviceIds]);

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
    canLaunchGame: _canLaunchGameFromHook,
    formattedDurationLabel,
    resetSetupStep,
    advanceToReviewStep,
    handleDesiredDurationChange,
    handleDurationInputValueChange,
    handleToggleDurationUnlimited,
    setIsDurationUnlimited,
  } = useSessionState({
    recentSessionSummary,
    sessionLifecycle,
    selectedOnlineDevices,
    selectedDeviceCount: selectedDevices.length,
    isSessionLocked,
    registry,
  });

  // Override canLaunchGame to use the visual accordion step (currentStep) instead of
  // the internal setupStep from useSessionState, so both stay in sync after presets.
  const canLaunchGame = currentStep === 3 && canAdvanceToReview && selectedOnlineDevices > 0 && !isSessionLocked;

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
    handleUpdateActivePreset,
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
    setSelectedDeviceIds,
    setSessionRoomId,
    setSessionDurationSeconds,
    setGoalShotsPerTarget,
    setIsDurationUnlimited,
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
    setCurrentStep(1);
    autoAdvanceAllowedRef.current = true;
    call('setStagedPresetId', null);
    call('setStoppedTargets', new Set<string>());
  }, [resetSetupStep, call]);

  // Full clear: resets everything including device selection, room, and duration
  const clearAllSetup = useCallback(() => {
    resetSetupFlow();
    handleClearDeviceSelection();
    setSessionRoomId(null);
    setSessionGroupId(null);
    setSessionDurationSeconds(null);
    setActivePresetId(null);
  }, [resetSetupFlow, handleClearDeviceSelection, setSessionRoomId, setSessionGroupId, setSessionDurationSeconds, setActivePresetId]);

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

  // Shared ref: tracks which targets have been stopped (goal reached).
  // Created here so it can be shared between useDirectTbTelemetry (to ignore
  // post-goal hits) and useSessionTelemetrySync (to prevent duplicate stop RPCs).
  const stoppedTargetsRef = useRef<Set<string>>(new Set());

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
    stoppedTargetsRef,
  });

  const telemetryState = directTelemetryState;

  // Telemetry sync: owns hitCounts, hitHistory, stoppedTargets state + processing effect.
  const {
    hitCounts,
    hitHistory,
    stoppedTargets,
    setHitCounts,
    setHitHistory,
    setStoppedTargets,
    goalShotsPerTargetRef,
    stopTargetWhenGoalReached,
  } = useSessionTelemetrySync({
    isLaunchingLifecycle,
    isRunningLifecycle,
    sessionLifecycle,
    directSessionGameId,
    telemetryState,
    goalShotsPerTarget,
    sessionConfirmed,
    markTelemetryConfirmed,
    hasMarkedTelemetryConfirmedRef,
    stoppedTargetsRef,
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

  // Auto-switch to summary after a game ends (not on initial mount with restored data)
  const hasAutoSwitchedRef = useRef(false);
  useEffect(() => {
    if (!recentSessionSummary) {
      hasAutoSwitchedRef.current = false;
      return;
    }
    // Skip the first time recentSessionSummary appears (restored from localStorage on mount)
    if (!hasAutoSwitchedRef.current) {
      hasAutoSwitchedRef.current = true;
      return;
    }
    if (!isRunningLifecycle && sessionLifecycle === 'idle') {
      setActiveView('summary');
    }
  }, [recentSessionSummary]);

  // Auto-switch to setup when running starts
  useEffect(() => {
    if (isRunningLifecycle) {
      setActiveView('setup');
    }
  }, [isRunningLifecycle]);

  // Auto-advance wizard steps — only when auto-advance is allowed (not when
  // the user has manually navigated back to an earlier step to edit).
  useEffect(() => {
    if (autoAdvanceAllowedRef.current && canAdvanceToDuration && currentStep === 1) {
      setCurrentStep(2);
    }
  }, [canAdvanceToDuration, currentStep]);

  useEffect(() => {
    if (autoAdvanceAllowedRef.current && canAdvanceToReview && currentStep === 2) {
      setCurrentStep(3);
    }
  }, [canAdvanceToReview, currentStep]);


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
          availableDeviceMap.get(transition.fromDevice)?.name ??
          transition.fromDevice;
        const toDevice =
          transition.toDeviceName ?? availableDeviceMap.get(transition.toDevice)?.name ?? transition.toDevice;

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
  }, [availableDeviceMap, transitionRecords]);

  const reviewTargets = selectedDevices.slice(0, REVIEW_TARGET_DISPLAY_LIMIT);

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
    <>
          <FeatureErrorBoundary feature="Game Session">
          <div className="w-full px-4 py-2 md:p-4 lg:p-6 md:max-w-7xl md:mx-auto space-y-2 md:space-y-4 lg:space-y-6 responsive-transition h-full">
            {errorMessage && (
              <ErrorBanner
                message={errorMessage}
                onDismiss={() => setErrorMessage(null)}
              />
            )}
            <div className="space-y-2 md:space-y-4 lg:space-y-6">
              <div className="flex items-center justify-between gap-4">
                <div className="text-left">
                  <h1 className="font-heading text-xl md:text-2xl font-semibold text-brand-dark">
                    Games
                  </h1>
                  <p className="text-sm text-brand-dark/60 font-body">
                    Configure and start training sessions.
                  </p>
                </div>
                {recentSessionSummary && !isRunningLifecycle && (
                  <div className="flex gap-1 bg-brand-light rounded-full p-1">
                    <button
                      onClick={() => setActiveView('setup')}
                      className={`rounded-full px-4 py-1.5 text-xs font-medium font-body transition-all duration-200 ${
                        activeView === 'setup'
                          ? 'bg-brand-primary text-white'
                          : 'text-brand-dark/60 hover:text-brand-dark'
                      }`}
                    >
                      New Session
                    </button>
                    <button
                      onClick={() => setActiveView('summary')}
                      className={`rounded-full px-4 py-1.5 text-xs font-medium font-body transition-all duration-200 ${
                        activeView === 'summary'
                          ? 'bg-brand-primary text-white'
                          : 'text-brand-dark/60 hover:text-brand-dark'
                      }`}
                    >
                      Last Session
                    </button>
                  </div>
                )}
              </div>

              <AnimatePresence mode="wait">
                {activeView === 'setup' ? (
                  <motion.div key="setup" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} className="space-y-2 md:space-y-4 lg:space-y-6">
              <PresetBanner
                presets={gamePresets}
                presetsLoading={presetsLoading}
                presetsError={presetsError}
                isSessionLocked={isSessionLocked}
                applyingId={applyingPresetId}
                deletingId={deletingPresetId}
                activePresetId={activePresetId}
                onApply={async (preset) => { autoAdvanceAllowedRef.current = true; const result = await handleApplyPreset(preset); setCurrentStep(result.hasTargets ? 3 : 1); }}
                onDelete={handleDeletePreset}
                onRefresh={handleRefreshPresets}
              />

              {isPageLoading ? (
                <SetupWizardSkeleton />
              ) : (
                <Card className="bg-white shadow-card rounded-[var(--radius-lg)]">
                  <CardContent className="p-5 md:p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="flex-1">
                        <StepProgressBar
                          currentStep={currentStep}
                          step1Complete={canAdvanceToDuration}
                          step2Complete={canAdvanceToReview}
                        />
                      </div>
                      {selectedDeviceIds.length > 0 && !isSessionLocked && (
                        <button
                          onClick={clearAllSetup}
                          className="flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium font-body text-brand-dark/50 hover:text-brand-primary hover:bg-brand-primary/[0.06] transition-colors shrink-0"
                        >
                          <RotateCcw className="h-3 w-3" />
                          Clear
                        </button>
                      )}
                    </div>

                    {/* Step 1: Select Targets */}
                    <SetupStep
                      step={1}
                      title="Select Targets"
                      isActive={currentStep === 1}
                      isComplete={canAdvanceToDuration}
                      isReachable={true}
                      summaryText={`${selectedDevices.length} target${selectedDevices.length !== 1 ? 's' : ''} selected`}
                      onEdit={() => { autoAdvanceAllowedRef.current = false; setCurrentStep(1); }}
                    >
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
                        formatLastSeen={formatLastSeen}
                        onToggleDeviceSelection={handleToggleDeviceSelection}
                        onSelectAllDevices={handleSelectAllDevices}
                        onClearDeviceSelection={handleClearDeviceSelection}
                        displayedSelectedCount={displayedSelectedCount}
                        totalOnlineSelectableTargets={totalOnlineSelectableTargets}
                        presetTargetWarning={activePresetId != null && selectedDeviceIds.length === 0}
                        onRefreshDevices={() => loadLiveDevices({ silent: false })}
                      />
                    </SetupStep>

                    <div className="border-t border-[rgba(28,25,43,0.06)] my-3" />

                    {/* Step 2: Duration */}
                    <SetupStep
                      step={2}
                      title="Duration"
                      isActive={currentStep === 2}
                      isComplete={canAdvanceToReview}
                      isReachable={canAdvanceToDuration}
                      summaryText={formattedDurationLabel}
                      onEdit={() => { autoAdvanceAllowedRef.current = false; setCurrentStep(2); }}
                    >
                      <SetupStepTwo
                        canAdvanceToDuration={canAdvanceToDuration}
                        isSessionLocked={isSessionLocked}
                        isDurationUnlimited={isDurationUnlimited}
                        durationInputValue={durationInputValue}
                        formattedDurationLabel={formattedDurationLabel}
                        onDurationInputValueChange={handleDurationInputValueChange}
                        onToggleDurationUnlimited={handleToggleDurationUnlimited}
                        onConfirm={() => { autoAdvanceAllowedRef.current = true; setCurrentStep(3); }}
                      />
                    </SetupStep>

                    <div className="border-t border-[rgba(28,25,43,0.06)] my-3" />

                    {/* Step 3: Review & Launch */}
                    <SetupStep
                      step={3}
                      title="Review & Launch"
                      isActive={currentStep === 3}
                      isComplete={false}
                      isReachable={canAdvanceToDuration && canAdvanceToReview}
                      summaryText=""
                      onEdit={() => { autoAdvanceAllowedRef.current = true; setCurrentStep(3); }}
                    >
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
                        activePresetName={activePresetId ? gamePresets.find((p) => p.id === activePresetId)?.name ?? null : null}
                        isUpdatingPreset={presetsSaving}
                        onOpenStartDialog={handleOpenStartDialog}
                        onRequestSavePreset={handleRequestSavePreset}
                        onUpdatePreset={handleUpdateActivePreset}
                      />
                    </SetupStep>
                  </CardContent>
                </Card>
              )}

              {/* Live session card — only during an active session */}
              {isSessionLocked && (
                isPageLoading ? (
                  <LiveSessionCardSkeleton />
                ) : (
                  <LiveSessionCard
                    isRunning={isRunningLifecycle}
                    timerSeconds={sessionTimerSeconds}
                    activeTargets={currentSessionTargets}
                    activeHits={activeSessionHits}
                    hitCounts={hitCounts}
                    recentSummary={null}
                    desiredDurationSeconds={sessionDurationSeconds}
                    goalShotsPerTarget={goalShotsPerTarget}
                    stoppedTargets={stoppedTargets}
                    onUsePrevious={handleUsePreviousSettings}
                    onCreateNew={handleCreateNewSetup}
                    isSessionLocked={isSessionLocked}
                  />
                )
              )}
                  </motion.div>
                ) : (
                  <motion.div key="summary" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
                    {isPageLoading ? (
                      <LiveSessionCardSkeleton />
                    ) : (
                      <LiveSessionCard
                        isRunning={false}
                        timerSeconds={sessionTimerSeconds}
                        activeTargets={currentSessionTargets}
                        activeHits={activeSessionHits}
                        hitCounts={hitCounts}
                        recentSummary={recentSessionSummary}
                        desiredDurationSeconds={sessionDurationSeconds}
                        goalShotsPerTarget={goalShotsPerTarget}
                        stoppedTargets={stoppedTargets}
                        onUsePrevious={() => { handleUsePreviousSettings(); setActiveView('setup'); }}
                        onCreateNew={() => { handleCreateNewSetup(); setActiveView('setup'); }}
                        isSessionLocked={false}
                      />
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
          </FeatureErrorBoundary>
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
    </>
  );
};

export default Games;
