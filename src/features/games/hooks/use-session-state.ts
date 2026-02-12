import { useState, useEffect, useCallback, useRef } from 'react';
import type { NormalizedGameDevice } from './use-game-devices';
import type { LiveSessionSummary } from '@/features/games/ui/components/types';
import type { SessionLifecycle } from '@/features/games/lib/session-state';
import { formatSessionDuration } from '@/features/games/lib/session-state';
import type { SessionRegistry } from './use-session-registry';

export type GameSetupStep = 'select-targets' | 'select-duration' | 'review';

interface UseSessionStateDeps {
  recentSessionSummary: LiveSessionSummary | null;
  sessionLifecycle: SessionLifecycle;
  selectedOnlineDevices: number;
  selectedDeviceCount: number;
  isSessionLocked: boolean;
  registry: SessionRegistry;
}

export function useSessionState(deps: UseSessionStateDeps) {
  const {
    recentSessionSummary,
    sessionLifecycle,
    selectedOnlineDevices,
    selectedDeviceCount,
    isSessionLocked,
    registry,
  } = deps;

  // --- Session timestamps ---
  const [gameStartTime, setGameStartTime] = useState<number | null>(null);
  const [gameStopTime, setGameStopTime] = useState<number | null>(null);

  // --- Active devices for the in-progress session ---
  const [activeDeviceIds, setActiveDeviceIds] = useState<string[]>([]);
  const [pendingSessionTargets, setPendingSessionTargets] = useState<NormalizedGameDevice[]>([]);
  const [currentSessionTargets, setCurrentSessionTargets] = useState<NormalizedGameDevice[]>([]);

  // --- Duration state ---
  const [sessionDurationSeconds, setSessionDurationSeconds] = useState<number | null>(null);
  const [durationInputValue, setDurationInputValue] = useState('');
  const [isDurationUnlimited, setIsDurationUnlimited] = useState(true);

  // --- Goal shots per target ---
  const [goalShotsPerTarget, setGoalShotsPerTarget] = useState<Record<string, number>>({});

  // --- Setup step wizard ---
  const [setupStep, setSetupStep] = useState<GameSetupStep>('select-targets');

  // Ref for seeded duration deduplication
  const seededDurationSummaryIdRef = useRef<string | null>(null);

  // --- Derived booleans ---
  const isStepSelectTargets = setupStep === 'select-targets';
  const isStepReview = setupStep === 'review';
  const canAdvanceToDuration = selectedDeviceCount > 0;
  const canContinueToDuration = canAdvanceToDuration && selectedOnlineDevices > 0;
  const canAdvanceToReview =
    isDurationUnlimited || (typeof sessionDurationSeconds === 'number' && sessionDurationSeconds > 0);
  const canLaunchGame =
    isStepReview && canAdvanceToReview && selectedOnlineDevices > 0 && !isSessionLocked;
  const formattedDurationLabel = isDurationUnlimited
    ? 'No time limit'
    : sessionDurationSeconds && sessionDurationSeconds > 0
      ? formatSessionDuration(sessionDurationSeconds)
      : 'No time limit';

  // --- Callbacks ---

  const advanceToDurationStep = useCallback(() => {
    setSetupStep('select-duration');
  }, []);

  const advanceToReviewStep = useCallback(() => {
    setSetupStep('review');
  }, []);

  /** Resets the setup step and goal shots. External callers should also reset
   *  `setStagedPresetId(null)` and `setStoppedTargets(new Set())` separately. */
  const resetSetupStep = useCallback(() => {
    setSetupStep('select-targets');
    setGoalShotsPerTarget({});
  }, []);

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
      registry.current.setStagedPresetId?.(null);
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
      registry.current.setStagedPresetId?.(null);
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

  // --- Effects ---

  // Duration validation: clear invalid durations when on the duration step
  useEffect(() => {
    if (setupStep !== 'select-duration') {
      return;
    }
    const hasDuration = typeof sessionDurationSeconds === 'number' && sessionDurationSeconds > 0;
    if (!hasDuration) {
      setSessionDurationSeconds(null);
    }
  }, [sessionDurationSeconds, setupStep]);

  // Duration → input sync: keep durationInputValue and isDurationUnlimited in sync
  useEffect(() => {
    if (typeof sessionDurationSeconds === 'number' && sessionDurationSeconds > 0) {
      setDurationInputValue(String(sessionDurationSeconds));
      setIsDurationUnlimited(false);
    } else {
      setDurationInputValue('');
      setIsDurationUnlimited(true);
    }
  }, [sessionDurationSeconds]);

  // Seeded duration from most recent session summary
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
  }, [recentSessionSummary, sessionLifecycle, sessionDurationSeconds, setupStep]);

  // Auto-advance: select-targets → select-duration
  useEffect(() => {
    if (!isStepSelectTargets) {
      return;
    }
    if (!canContinueToDuration) {
      return;
    }
    advanceToDurationStep();
  }, [advanceToDurationStep, canContinueToDuration, isStepSelectTargets]);

  // Auto-advance: select-duration → review
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
    if (selectedDeviceCount === 0 || selectedOnlineDevices === 0) {
      return;
    }
    advanceToReviewStep();
  }, [
    advanceToReviewStep,
    canAdvanceToReview,
    isSessionLocked,
    selectedDeviceCount,
    selectedOnlineDevices,
    setupStep,
  ]);

  return {
    // Session timestamps
    gameStartTime,
    setGameStartTime,
    gameStopTime,
    setGameStopTime,

    // Active devices
    activeDeviceIds,
    setActiveDeviceIds,
    pendingSessionTargets,
    setPendingSessionTargets,
    currentSessionTargets,
    setCurrentSessionTargets,

    // Duration
    sessionDurationSeconds,
    setSessionDurationSeconds,
    durationInputValue,
    isDurationUnlimited,
    goalShotsPerTarget,
    setGoalShotsPerTarget,

    // Setup step
    setupStep,
    setSetupStep,

    // Derived
    isStepSelectTargets,
    isStepReview,
    canAdvanceToDuration,
    canContinueToDuration,
    canAdvanceToReview,
    canLaunchGame,
    formattedDurationLabel,

    // Callbacks
    advanceToDurationStep,
    advanceToReviewStep,
    resetSetupStep,
    handleDesiredDurationChange,
    handleDurationInputValueChange,
    handleToggleDurationUnlimited,
  };
}
