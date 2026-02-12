import { useState, useRef, useEffect, useCallback } from 'react';
import type { SessionLifecycle } from '@/features/games/lib/session-state';

interface UseSessionLifecycleReturn {
  // State
  lifecycle: SessionLifecycle;
  isSessionDialogDismissed: boolean;

  // Derived booleans
  isSelectingLifecycle: boolean;
  isLaunchingLifecycle: boolean;
  isRunningLifecycle: boolean;
  isStoppingLifecycle: boolean;
  isFinalizingLifecycle: boolean;
  isSessionLocked: boolean;
  isSessionDialogVisible: boolean;
  isLiveDialogPhase: boolean;

  // Actions
  setLifecycle: React.Dispatch<React.SetStateAction<SessionLifecycle>>;
  setIsSessionDialogDismissed: React.Dispatch<React.SetStateAction<boolean>>;
  dismissDialog: () => void;
  resetDialog: () => void;

  // Refs
  lifecycleRef: React.MutableRefObject<SessionLifecycle>;
}

export function useSessionLifecycle(): UseSessionLifecycleReturn {
  const [lifecycle, setLifecycle] = useState<SessionLifecycle>('idle');
  const [isSessionDialogDismissed, setIsSessionDialogDismissed] = useState(false);
  const lifecycleRef = useRef<SessionLifecycle>('idle');

  // Keep ref in sync
  useEffect(() => {
    lifecycleRef.current = lifecycle;
  }, [lifecycle]);

  // Reset dismissed when idle
  useEffect(() => {
    if (lifecycle === 'idle') {
      setIsSessionDialogDismissed(false);
    }
  }, [lifecycle]);

  // Derived booleans
  const isSelectingLifecycle = lifecycle === 'selecting';
  const isLaunchingLifecycle = lifecycle === 'launching';
  const isRunningLifecycle = lifecycle === 'running';
  const isStoppingLifecycle = lifecycle === 'stopping';
  const isFinalizingLifecycle = lifecycle === 'finalizing';
  const isSessionLocked =
    isLaunchingLifecycle || isRunningLifecycle || isStoppingLifecycle || isFinalizingLifecycle;
  const isSessionDialogVisible = lifecycle !== 'idle' && !isSelectingLifecycle && !isSessionDialogDismissed;
  const isLiveDialogPhase = isRunningLifecycle || isStoppingLifecycle || isFinalizingLifecycle;

  const dismissDialog = useCallback(() => {
    setIsSessionDialogDismissed(true);
  }, []);

  const resetDialog = useCallback(() => {
    setIsSessionDialogDismissed(false);
  }, []);

  return {
    lifecycle,
    isSessionDialogDismissed,
    isSelectingLifecycle,
    isLaunchingLifecycle,
    isRunningLifecycle,
    isStoppingLifecycle,
    isFinalizingLifecycle,
    isSessionLocked,
    isSessionDialogVisible,
    isLiveDialogPhase,
    setLifecycle,
    setIsSessionDialogDismissed,
    dismissDialog,
    resetDialog,
    lifecycleRef,
  };
}
