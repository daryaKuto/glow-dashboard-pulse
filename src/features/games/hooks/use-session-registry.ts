import { useRef, useCallback } from 'react';
import type { SessionHitRecord } from '@/features/games/lib/device-game-flow';
import type { SplitRecord, TransitionRecord } from '@/features/games/lib/telemetry-types';
import type { NormalizedGameDevice } from './use-game-devices';
import type { FinalizeSessionArgs } from '@/features/games/lib/telemetry-types';

// --- Callback type map: every cross-hook callback in one place ---

export type SessionCallbacks = {
  // Provided by useSessionTelemetrySync, consumed by useThingsboardControl + useGameDataLoader
  setHitCounts: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  setHitHistory: React.Dispatch<React.SetStateAction<SessionHitRecord[]>>;
  setStoppedTargets: React.Dispatch<React.SetStateAction<Set<string>>>;

  // Provided by useThingsboardControl, consumed by usePresetManagement
  openStartDialogForTargets: (args: {
    targetIds: string[];
    source: 'manual' | 'preset';
    requireOnline: boolean;
    syncCurrentTargets?: boolean;
  }) => Promise<{ targets: NormalizedGameDevice[]; gameId: string } | null>;
  beginSessionLaunch: (args?: {
    targets?: NormalizedGameDevice[];
    gameId?: string;
  }) => void;

  // Provided by usePresetManagement, consumed by useDeviceSelection + useSessionState
  setStagedPresetId: React.Dispatch<React.SetStateAction<string | null>>;

  // Provided by useSessionOrchestration, consumed by useThingsboardControl
  finalizeSession: (args: FinalizeSessionArgs) => Promise<unknown>;

  // Snapshot getters — provided by useSessionOrchestration,
  // consumed by useThingsboardControl during stop
  getHitHistory: () => SessionHitRecord[];
  getSplitRecords: () => SplitRecord[];
  getTransitionRecords: () => TransitionRecord[];
};

// --- The registry type (a ref whose `.current` holds partial callbacks) ---

export type SessionRegistry = {
  current: Partial<SessionCallbacks>;
};

// --- The registry hook ---

export function useSessionRegistry() {
  const registry = useRef<Partial<SessionCallbacks>>({});

  // Type-safe register: hooks call this to publish their callbacks
  const register = useCallback(<K extends keyof SessionCallbacks>(
    key: K,
    fn: SessionCallbacks[K],
  ) => {
    registry.current[key] = fn;
  }, []);

  // Type-safe call: hooks call this to invoke a callback from another hook.
  // Silently no-ops if the callback hasn't been registered yet.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const call = useCallback(<K extends keyof SessionCallbacks>(
    key: K,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ...args: SessionCallbacks[K] extends (...a: infer P) => any ? P : never
  ) => {
    const fn = registry.current[key];
    if (typeof fn === 'function') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (fn as (...a: any[]) => any)(...args);
    }
  }, []);

  return { register, call, registry } as const;
}

export type UseSessionRegistryReturn = ReturnType<typeof useSessionRegistry>;
