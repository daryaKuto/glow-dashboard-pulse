import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Play, Square, Timer, Target, BookmarkPlus } from 'lucide-react';
import type { NormalizedGameDevice } from '@/hooks/useGameDevices';
import type { SessionHitRecord } from '@/services/device-game-flow';
import type { TelemetryEnvelope } from '@/services/thingsboard-client';
import { tbSubscribeTelemetry } from '@/services/thingsboard-client';
import {
  formatSecondsWithMillis,
  formatSessionDuration,
  type SessionLifecycle,
  type SessionHitEntry,
} from '@/components/game-session/sessionState';
import { useTargetCustomNames } from '@/features/targets';

export interface StartSessionDialogProps {
  open: boolean;
  lifecycle: SessionLifecycle;
  onClose: () => void;
  onConfirm: () => void;
  onStop: () => void;
  isStarting: boolean;
  isStopping: boolean;
  canClose: boolean;
  sessionSeconds: number;
  targets: NormalizedGameDevice[];
  sessionHits: SessionHitEntry[];
  currentGameId: string | null;
  directControlEnabled: boolean;
  directToken: string | null;
  directAuthError: string | null;
  isDirectAuthLoading: boolean;
  directTargets: Array<{ deviceId: string; name: string }>;
  directGameId: string | null;
  directStartStates: Record<string, 'idle' | 'pending' | 'success' | 'error'>;
  directFlowActive: boolean;
  onRetryFailed: () => void;
  isRetryingFailedDevices: boolean;
  selectedRoomName: string | null;
  desiredDurationSeconds: number | null;
  onDesiredDurationChange: (value: number | null) => void;
  onRequestSavePreset: () => void;
  isSavingPreset: boolean;
  goalShotsPerTarget?: Record<string, number>;
}

// Normalizes telemetry payload values into strings for dialog subscriptions.
const resolveSeriesString = (input: unknown): string | null => {
  if (typeof input === 'string') {
    return input;
  }
  if (typeof input === 'number') {
    return String(input);
  }
  if (Array.isArray(input) && input.length > 0) {
    return resolveSeriesString(input[0]);
  }
  if (input && typeof input === 'object') {
    const value = (input as { value?: unknown }).value;
    return resolveSeriesString(value);
  }
  return null;
};

// Extracts telemetry timestamps while tolerating heterogeneous payload shapes.
const resolveSeriesTimestamp = (input: unknown, fallback: number): number => {
  if (typeof input === 'number' && Number.isFinite(input)) {
    return input;
  }
  if (Array.isArray(input) && input.length > 0) {
    return resolveSeriesTimestamp(input[0], fallback);
  }
  if (input && typeof input === 'object') {
    const record = input as { ts?: unknown; timestamp?: unknown; value?: unknown };
    const tsValue = typeof record.ts === 'number' ? record.ts : typeof record.timestamp === 'number' ? record.timestamp : null;
    if (tsValue !== null) {
      return tsValue;
    }
    if (record.value) {
      return resolveSeriesTimestamp(record.value, fallback);
    }
  }
  return fallback;
};

const SessionStopwatchCard: React.FC<{
  seconds: number;
  accent: 'default' | 'live';
  statusText: string;
  showSpinner?: boolean;
}> = ({ seconds, accent, statusText, showSpinner = false }) => {
  const isLive = accent === 'live';
  const containerClasses = [
    'flex flex-col items-center justify-center rounded-xl sm:rounded-2xl px-4 py-6 sm:px-6 sm:py-8 text-center',
    isLive ? 'bg-white/10 border border-white/15 shadow-lg' : 'bg-brand-secondary/10 border border-brand-secondary/30',
  ].join(' ');

  return (
    <div className={containerClasses}>
      <Timer className={`mb-3 sm:mb-4 h-8 w-8 sm:h-10 sm:w-10 ${isLive ? 'text-white/80' : 'text-brand-primary'}`} />
      <div className={`text-[10px] sm:text-[11px] uppercase tracking-[0.4em] font-semibold ${isLive ? 'text-white/70' : 'text-brand-dark/60'}`}>
        Stopwatch
      </div>
      <div className={`mt-3 sm:mt-4 font-heading ${isLive ? 'text-white text-4xl sm:text-5xl md:text-6xl' : 'text-brand-dark text-3xl sm:text-4xl md:text-5xl'}`}>
        {formatSessionDuration(seconds)}
      </div>
      <p className={`mt-2 sm:mt-3 text-xs font-medium ${isLive ? 'text-white/70' : 'text-brand-dark/60'}`}>{statusText}</p>
      {showSpinner && <Loader2 className={`mt-2 sm:mt-3 h-4 w-4 sm:h-5 sm:w-5 animate-spin ${isLive ? 'text-white/70' : 'text-brand-primary'}`} />}
    </div>
  );
};

const SessionTargetList: React.FC<{ targets: NormalizedGameDevice[]; tone: 'default' | 'live' }> = ({ targets, tone }) => {
  const containerTone =
    tone === 'live'
      ? 'rounded-lg border border-white/20 bg-white/10 text-white/80'
      : 'rounded-lg border border-dashed border-brand-secondary/40 bg-brand-secondary/10 text-brand-dark/60';

  if (targets.length === 0) {
    return (
      <p className={`${containerTone} px-3 py-4 text-sm text-center`}>
        Select at least one online target to begin a live session.
      </p>
    );
  }

  return (
    <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
      {targets.map((target) => (
        <div
          key={target.deviceId}
          className={
            tone === 'live'
              ? 'flex items-center justify-between rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-white'
              : 'flex items-center justify-between rounded-lg border border-gray-100 bg-white px-3 py-2'
          }
        >
          <div>
            <p className="font-medium leading-tight">{target.name ?? 'Target'}</p>
            <p className={tone === 'live' ? 'text-[11px] text-white/70' : 'text-[11px] text-brand-dark/50'}>
              Device ID logged to console
            </p>
          </div>
          <Badge
            variant="outline"
            className={
              target.isOnline === false
                ? tone === 'live'
                  ? 'border-white/30 text-white/60'
                  : 'text-brand-dark/60'
                : tone === 'live'
                  ? 'border-white/40 bg-white/15 text-white'
                  : 'bg-green-100 text-green-700 border-green-200'
            }
          >
            {target.isOnline === false ? 'Offline' : 'Online'}
          </Badge>
        </div>
      ))}
    </div>
  );
};

const SessionProgressMessage: React.FC<{ tone: 'default' | 'live'; message: string; subtext?: string }> = ({
  tone,
  message,
  subtext,
}) => {
  const isLive = tone === 'live';
  return (
    <div
      className={[
        'rounded-xl border px-4 py-6 text-center text-sm flex flex-col items-center gap-3',
        isLive ? 'border-white/15 bg-white/10 text-white/80' : 'border-brand-secondary/20 bg-brand-secondary/10 text-brand-dark/70',
      ].join(' ')}
    >
      <Loader2 className={`h-5 w-5 animate-spin ${isLive ? 'text-white/80' : 'text-brand-primary'}`} />
      <p>{message}</p>
      {subtext && <p className="text-xs opacity-75">{subtext}</p>}
    </div>
  );
};

const SessionHitFeedList: React.FC<{ 
  hits: SessionHitEntry[]; 
  variant: 'live' | 'finalizing'; 
  emptyLabel: string; 
  limit?: number;
  getDisplayName?: (deviceId: string, defaultName: string) => string;
  getDeviceIdFromHit?: (hit: SessionHitEntry) => string | null;
}> = ({
  hits,
  variant,
  emptyLabel,
  limit = 12,
  getDisplayName,
  getDeviceIdFromHit,
}) => {
  const isLive = variant === 'live';
  if (hits.length === 0) {
    return (
      <div
        className={[
          'rounded-xl border px-4 py-6 text-center text-sm flex flex-col items-center gap-3',
          isLive ? 'border-white/20 bg-white/10 text-white/70' : 'border-white/15 bg-white/5 text-white/70',
        ].join(' ')}
      >
        <div className="flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-white/5 text-white/70">
          <Target className="h-5 w-5" />
        </div>
        <p>{emptyLabel}</p>
      </div>
    );
  }

  const sliced = hits.slice(-limit).reverse();

  return (
    <div
      className={[
        'divide-y divide-white/10',
        'overflow-y-auto rounded-lg sm:rounded-xl border border-white/15 bg-white/10',
        isLive ? 'max-h-48 sm:max-h-60' : 'max-h-40 sm:max-h-52',
      ].join(' ')}
    >
      {sliced.map((hit) => {
        const splitLabel = hit.splitSeconds !== null ? `+${formatSecondsWithMillis(hit.splitSeconds)}` : '—';
        const splitTone =
          hit.splitSeconds === null
            ? 'bg-white/5 text-white/60 border-white/15'
            : hit.splitSeconds <= 0.05
              ? 'bg-emerald-400/15 text-emerald-100 border-emerald-200/40'
              : 'bg-amber-400/15 text-amber-100 border-amber-200/40';
        // Use custom name if getDisplayName is provided and we can find deviceId
        // Note: hit.deviceName may already contain the custom name if it came from dialogSessionHits
        // For sessionHits from props, we need to look up deviceId from deviceName
        let displayName = hit.deviceName;
        let originalName: string | undefined = undefined;
        
        if (getDisplayName && getDeviceIdFromHit) {
          // Try to find deviceId using the helper function
          const deviceId = getDeviceIdFromHit(hit);
          if (deviceId) {
            const customName = getDisplayName(deviceId, hit.deviceName);
            if (customName !== hit.deviceName) {
              displayName = customName;
              originalName = hit.deviceName;
            }
          }
        }

        return (
          <div
            key={hit.id}
            className={`flex items-center justify-between px-4 py-3 text-xs sm:text-sm ${isLive ? 'text-white' : 'text-white/80'}`}
          >
            <div className="flex items-center gap-3">
              <div
                className={[
                  'flex h-9 w-9 items-center justify-center rounded-full border',
                  isLive ? 'border-emerald-300/40 bg-emerald-400/10 text-emerald-100' : 'border-white/20 bg-white/5 text-white/70',
                ].join(' ')}
              >
                <Target className="h-4 w-4" />
              </div>
              <div className="flex flex-col">
                <span className="font-semibold leading-tight" title={originalName ? `Original: ${originalName}` : undefined}>
                  {displayName}
                </span>
                <span className="font-mono text-[11px] text-white/60">#{hit.sequence}</span>
              </div>
            </div>
            <div className="text-right">
              <p className="font-heading text-base">{formatSecondsWithMillis(hit.sinceStartSeconds)}</p>
              <span
                className={`mt-1 inline-flex items-center rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide ${splitTone}`}
              >
                {splitLabel}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
};

// StartSessionDialog orchestrates direct ThingsBoard control, telemetry preview, and lifecycle CTA controls.
export const StartSessionDialog: React.FC<StartSessionDialogProps> = ({
  open,
  lifecycle,
  onClose,
  onConfirm,
  onStop,
  isStarting,
  isStopping,
  canClose,
  sessionSeconds,
  targets,
  sessionHits,
  currentGameId,
  directControlEnabled,
  directToken,
  directAuthError: _directAuthError,
  isDirectAuthLoading,
  directTargets,
  directGameId,
  directStartStates: _directStartStates,
  directFlowActive,
  onRetryFailed: _onRetryFailed,
  isRetryingFailedDevices: _isRetryingFailedDevices,
  selectedRoomName,
  desiredDurationSeconds,
  onDesiredDurationChange,
  onRequestSavePreset,
  isSavingPreset,
  goalShotsPerTarget = {},
}) => {
  const [dialogHitHistory, setDialogHitHistory] = useState<SessionHitRecord[]>([]);
  const [durationInput, setDurationInput] = useState('');
  const { data: customNames = new Map() } = useTargetCustomNames();

  useEffect(() => {
    const nextValue =
      typeof desiredDurationSeconds === 'number' && Number.isFinite(desiredDurationSeconds) && desiredDurationSeconds > 0
        ? String(desiredDurationSeconds)
        : '';
    setDurationInput(nextValue);
  }, [desiredDurationSeconds]);

  // Create a reverse map from deviceName to deviceId for looking up custom names
  const deviceNameToIdMap = useMemo(() => {
    const map = new Map<string, string>();
    targets.forEach((target) => {
      const name = target.name ?? target.deviceId;
      map.set(name, target.deviceId);
      // Also map deviceId to itself in case deviceName is the deviceId
      map.set(target.deviceId, target.deviceId);
    });
    return map;
  }, [targets]);

  // Helper function to get display name (custom name or default)
  const getDisplayName = useCallback((deviceId: string, defaultName: string): string => {
    return customNames.get(deviceId) ?? defaultName;
  }, [customNames]);

  // Helper function to get deviceId from hit (for sessionHits from props)
  const getDeviceIdFromHit = useCallback((hit: SessionHitEntry): string | null => {
    // First, try to look up deviceId from deviceName using the reverse map
    const deviceIdFromName = deviceNameToIdMap.get(hit.deviceName);
    if (deviceIdFromName) {
      return deviceIdFromName;
    }
    // If deviceName is already a deviceId (matches one of our targets), return it
    if (deviceNameToIdMap.has(hit.deviceName)) {
      return hit.deviceName;
    }
    // Try to extract from hit.id format: deviceId-timestamp-index
    // Since deviceId can contain hyphens, we can't reliably split
    // But we can try to match against known deviceIds
    const parts = hit.id.split('-');
    if (parts.length >= 3) {
      // Try each possible deviceId combination (from start, removing last parts)
      for (let i = parts.length - 2; i >= 1; i--) {
        const possibleDeviceId = parts.slice(0, i).join('-');
        if (deviceNameToIdMap.has(possibleDeviceId)) {
          return possibleDeviceId;
        }
      }
    }
    return null;
  }, [deviceNameToIdMap]);

  const dialogDeviceIds = useMemo(() => targets.map((target) => target.deviceId), [targets]);
  const dialogDeviceIdSet = useMemo(() => new Set(dialogDeviceIds), [dialogDeviceIds]);
  const targetNameMap = useMemo(() => {
    const map = new Map<string, string>();
    targets.forEach((target) => {
      map.set(target.deviceId, target.name ?? target.deviceId);
    });
    return map;
  }, [targets]);

  const dialogStreamingLifecycle =
    lifecycle === 'launching' || lifecycle === 'running' || lifecycle === 'stopping' || lifecycle === 'finalizing';
  const shouldStreamDialogTelemetry = Boolean(
    open && dialogStreamingLifecycle && directControlEnabled && directFlowActive && directToken && directGameId && dialogDeviceIds.length > 0,
  );

  const resetDialogTelemetry = useCallback(() => {
    setDialogHitHistory([]);
  }, []);

  useEffect(() => {
    if (!shouldStreamDialogTelemetry || !directToken || !directGameId) {
      resetDialogTelemetry();
      return;
    }

    resetDialogTelemetry();

    const unsubscribe = tbSubscribeTelemetry(
      dialogDeviceIds,
      directToken,
      (payload: TelemetryEnvelope) => {
        const telemetryData = payload.data;
        if (!telemetryData) {
          return;
        }

        const eventValue = resolveSeriesString(telemetryData.event);
        const gameIdValue = resolveSeriesString(telemetryData.gameId);
        const deviceId = payload.entityId;

        if (!deviceId || !dialogDeviceIdSet.has(deviceId)) {
          return;
        }

        if (eventValue !== 'hit' || gameIdValue !== directGameId) {
          return;
        }

        const now = Date.now();
        const timestamp = resolveSeriesTimestamp(telemetryData.event, now) ?? now;
        const deviceName = targetNameMap.get(deviceId) ?? deviceId;

        setDialogHitHistory((prev) => [
          ...prev,
          {
            deviceId,
            deviceName,
            timestamp,
            gameId: directGameId,
          },
        ]);
      },
      {
        realtime: true,
        onError: (reason) => {
          console.warn('[StartSessionDialog] Telemetry degraded, relying on fallback state', reason);
        },
      },
    );

    return () => {
      unsubscribe();
    };
  }, [
    directGameId,
    directToken,
    dialogDeviceIdSet,
    dialogDeviceIds,
    resetDialogTelemetry,
    shouldStreamDialogTelemetry,
    targetNameMap,
  ]);

  const dialogSessionHits = useMemo<SessionHitEntry[]>(() => {
    if (dialogHitHistory.length === 0) {
      return [];
    }
    const baseTime = dialogHitHistory[0]?.timestamp ?? Date.now();

    return dialogHitHistory.map((hit, index) => {
      const previous = index > 0 ? dialogHitHistory[index - 1] : null;
      const sinceStartSeconds = Math.max(0, (hit.timestamp - baseTime) / 1000);
      const splitSeconds = previous ? Math.max(0, (hit.timestamp - previous.timestamp) / 1000) : null;
      const displayName = getDisplayName(hit.deviceId, hit.deviceName);

      return {
        id: `${hit.deviceId}-${hit.timestamp}-${index}`,
        deviceName: displayName,
        timestamp: hit.timestamp,
        sequence: index + 1,
        sinceStartSeconds,
        splitSeconds,
      };
    });
  }, [dialogHitHistory, getDisplayName]);

  const displayedSessionHits = dialogSessionHits.length > 0 ? dialogSessionHits : sessionHits;
  const targetDurationFormatted =
    typeof desiredDurationSeconds === 'number' && desiredDurationSeconds > 0
      ? formatSessionDuration(desiredDurationSeconds)
      : 'No time limit';
  const handleDurationInputChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const value = event.target.value;
      setDurationInput(value);
      if (value.trim().length === 0) {
        onDesiredDurationChange(null);
        return;
      }
      const parsed = Number(value);
      if (Number.isFinite(parsed) && parsed >= 0) {
        onDesiredDurationChange(Math.round(parsed));
      }
    },
    [onDesiredDurationChange],
  );

  const handleQuickDuration = useCallback(
    (value: number) => {
      setDurationInput(String(value));
      onDesiredDurationChange(value);
    },
    [onDesiredDurationChange],
  );

  const runningScore = useMemo(() => {
    const totalHits = displayedSessionHits.length;
    if (totalHits === 0) {
      return 0;
    }
    const elapsedSeconds = Math.max(sessionSeconds, 1);
    const hitsPerMinute = (totalHits / elapsedSeconds) * 60;
    return Math.max(0, Math.round(hitsPerMinute * 100) / 100);
  }, [displayedSessionHits.length, sessionSeconds]);

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && canClose) {
      onClose();
    }
  };

  const isSelectingPhase = lifecycle === 'selecting';
  const isLaunchingPhase = lifecycle === 'launching';
  const isRunningPhase = lifecycle === 'running';
  const isStoppingPhase = lifecycle === 'stopping';
  const isFinalizingPhase = lifecycle === 'finalizing';
  const usesLivePalette = isLaunchingPhase || isRunningPhase || isStoppingPhase || isFinalizingPhase;
  const resolvedGameId = currentGameId ?? directGameId;
  const loggedGameIdRef = useRef<string | null>(null);
  const loggedTargetsRef = useRef<string | null>(null);
  const loggedDirectTargetsRef = useRef<string | null>(null);

  useEffect(() => {
    if (!resolvedGameId) {
      return;
    }
    if (loggedGameIdRef.current === resolvedGameId) {
      return;
    }
    loggedGameIdRef.current = resolvedGameId;
    console.debug('[StartSessionDialog] Active game ID', resolvedGameId);
  }, [resolvedGameId]);

  useEffect(() => {
    const signature = targets.map((target) => target.deviceId).sort().join('|');
    if (signature === loggedTargetsRef.current) {
      return;
    }
    loggedTargetsRef.current = signature;
    if (targets.length > 0) {
      console.debug('[StartSessionDialog] Selected targets', targets.map((target) => ({
        deviceId: target.deviceId,
        name: target.name ?? 'Target',
      })));
    }
  }, [targets]);

  useEffect(() => {
    const signature = directTargets.map((target) => target.deviceId).sort().join('|');
    if (signature === loggedDirectTargetsRef.current) {
      return;
    }
    loggedDirectTargetsRef.current = signature;
    if (directTargets.length > 0) {
      console.debug('[StartSessionDialog] Direct-control targets', directTargets);
    }
  }, [directTargets]);

  // The dialog no longer surfaces ThingsBoard connection/status messaging in the UI.

  const dialogDescription = (() => {
    if (isFinalizingPhase) {
      return 'Wrapping up telemetry and saving the session summary.';
    }
    if (isStoppingPhase) {
      return 'Stopping the live session and notifying all selected targets.';
    }
    if (isRunningPhase) {
      return 'Session is live—watch the stopwatch and shot feed update as hits come in.';
    }
    if (isLaunchingPhase) {
      return 'Starting the session on your selected targets. Hang tight—this usually takes a moment.';
    }
    return 'Review your target list and get ready to launch this live session.';
  })();
  const dialogTitle = usesLivePalette ? 'Active Game' : 'New Session';

  const stopwatchStatus = (() => {
    if (isFinalizingPhase) {
      return 'Saving session results...';
    }
    if (isStoppingPhase) {
      return 'Stopping session...';
    }
    if (isRunningPhase) {
      return 'Session is live';
    }
    if (isLaunchingPhase) {
      return 'Launching session...';
    }
    return 'Review selected targets before starting.';
  })();

  const showStopwatchSpinner = isLaunchingPhase || isStoppingPhase || isFinalizingPhase;
  const canTriggerStart = isSelectingPhase && !isStarting && targets.length > 0;
  const showCloseButton = isSelectingPhase || isLaunchingPhase;
  const showStartButton = isSelectingPhase;
  const showStopButton = isRunningPhase;
  const closeButtonLabel = canClose ? 'Cancel' : 'Close';
  const isDismissDisabled = !canClose || isStarting || isLaunchingPhase;

  let bodyContent: React.ReactNode;
  if (isRunningPhase) {
    // Calculate total goal shots
    const totalGoalShots = Object.values(goalShotsPerTarget).reduce((sum, goal) => sum + (typeof goal === 'number' ? goal : 0), 0);
    const hasGoalShots = totalGoalShots > 0;
    
    bodyContent = (
      <div className="space-y-3">
        <div className={`grid grid-cols-1 gap-2 sm:gap-3 ${hasGoalShots ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
          <div className="rounded-lg sm:rounded-xl border border-white/20 bg-white/5 px-3 py-2.5 sm:px-4 sm:py-3 text-center">
            <p className="text-[10px] sm:text-[11px] uppercase tracking-[0.3em] text-white/60">Running Score</p>
            <p className="font-heading text-2xl sm:text-3xl text-white">{runningScore > 0 ? runningScore.toFixed(2) : '—'}</p>
          </div>
          <div className="rounded-lg sm:rounded-xl border border-white/20 bg-white/5 px-3 py-2.5 sm:px-4 sm:py-3 text-center">
            <p className="text-[10px] sm:text-[11px] uppercase tracking-[0.3em] text-white/60">Session Hits</p>
            <p className="font-heading text-2xl sm:text-3xl text-white">{displayedSessionHits.length}</p>
          </div>
          {hasGoalShots && (
            <div className="rounded-lg sm:rounded-xl border border-white/20 bg-white/5 px-3 py-2.5 sm:px-4 sm:py-3 text-center">
              <p className="text-[10px] sm:text-[11px] uppercase tracking-[0.3em] text-white/60">Goal Targets</p>
              <p className="font-heading text-2xl sm:text-3xl text-white">{totalGoalShots}</p>
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Badge className="bg-white/15 text-white border-white/20 text-xs px-2.5 py-1 sm:px-3">
            {`${targets.length} target${targets.length === 1 ? '' : 's'} armed`}
          </Badge>
        </div>
        <h3 className="text-xs sm:text-sm uppercase tracking-wide text-white/80">Live shot feed</h3>
        <SessionHitFeedList hits={displayedSessionHits} variant="live" emptyLabel="Waiting for the first hit..." limit={12} getDisplayName={getDisplayName} getDeviceIdFromHit={getDeviceIdFromHit} />
      </div>
    );
  } else if (isStoppingPhase || isFinalizingPhase) {
    const message = isFinalizingPhase ? 'Persisting session summary...' : 'Sending stop command to all targets...';
    bodyContent = (
      <div className="space-y-3">
        <SessionProgressMessage tone="live" message={message} />
        {displayedSessionHits.length > 0 && (
          <>
            <h3 className="text-sm uppercase tracking-wide text-white/80">Recent hits</h3>
            <SessionHitFeedList hits={displayedSessionHits} variant="finalizing" emptyLabel="Waiting for hits..." limit={6} getDisplayName={getDisplayName} getDeviceIdFromHit={getDeviceIdFromHit} />
          </>
        )}
      </div>
    );
  } else if (isLaunchingPhase) {
    bodyContent = (
      <div className="space-y-3">
        <SessionProgressMessage
          tone={usesLivePalette ? 'live' : 'default'}
          message="Starting session on selected targets..."
          subtext="Waiting for ThingsBoard to confirm the game is live."
        />
      </div>
    );
  } else {
    const quickDurationOptions = [60, 120, 180, 300];
    bodyContent = (
      <div className="space-y-3 sm:space-y-4">
        <div className="space-y-3 rounded-lg border border-brand-secondary/30 bg-brand-secondary/10 px-3 py-3">
          <div className="flex items-center justify-between text-sm text-brand-dark/80">
            <span className="font-medium">Room</span>
            <span className="text-xs sm:text-sm text-brand-dark/70 truncate ml-2">{selectedRoomName ?? 'Not set'}</span>
          </div>
          <div className="space-y-2">
            <Label htmlFor="session-duration-seconds" className="text-xs font-medium text-brand-dark uppercase tracking-wide">
              Session duration (seconds)
            </Label>
            <Input
              id="session-duration-seconds"
              value={durationInput}
              onChange={handleDurationInputChange}
              placeholder="e.g. 120"
              inputMode="numeric"
              className="w-full"
            />
            <div className="flex flex-col gap-2 text-[10px] sm:text-[11px] text-brand-dark/60">
              <span className="block sm:hidden">Leave blank for no limit</span>
              <span className="hidden sm:block">Leave blank for no limit • Formatted: {targetDurationFormatted}</span>
              <div className="flex flex-wrap gap-1.5 sm:gap-2">
                {quickDurationOptions.map((value) => (
                  <Button
                    key={value}
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 px-2 text-xs flex-1 sm:flex-none"
                    onClick={() => handleQuickDuration(value)}
                  >
                    {formatSessionDuration(value)}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-heading text-xs sm:text-sm uppercase tracking-wide text-brand-dark/70">Targets ({targets.length})</h3>
            <span className="hidden sm:inline text-[11px] text-brand-dark/50">IDs logged to console</span>
          </div>
          <SessionTargetList targets={targets} tone="default" />
        </div>

        {targets.length > 0 && (
          <div className="flex justify-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-2 w-full sm:w-auto"
              onClick={onRequestSavePreset}
              disabled={isSavingPreset}
            >
              {isSavingPreset ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <BookmarkPlus className="h-4 w-4" />
                  Save as preset
                </>
              )}
            </Button>
          </div>
        )}
      </div>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className={[
          'w-full',
          'max-w-[calc(100vw-30px)]',
          'sm:max-w-xl',
          'mx-auto',
          'transition-colors',
          'duration-300',
          'shadow-xl',
          'px-4',
          'py-4',
          'sm:px-6',
          'sm:py-6',
          'rounded-lg',
          'sm:rounded-lg',
          usesLivePalette
            ? 'bg-gradient-to-br from-brand-primary to-brand-secondary text-white border-white/20'
            : 'bg-white text-brand-dark border-gray-200',
        ].join(' ')}
      >
        <DialogHeader className="space-y-1 sm:space-y-1.5">
          <DialogTitle className="text-lg sm:text-xl md:text-2xl font-heading">{dialogTitle}</DialogTitle>
          <DialogDescription className={`text-xs sm:text-sm ${usesLivePalette ? 'text-white/80' : 'text-brand-dark/70'}`}>{dialogDescription}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3 sm:space-y-4 md:space-y-6">
          <SessionStopwatchCard
            seconds={sessionSeconds}
            accent={usesLivePalette ? 'live' : 'default'}
            statusText={stopwatchStatus}
            showSpinner={showStopwatchSpinner}
          />

          {bodyContent}
        </div>

        <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-between mt-4 sm:mt-6">
          {showCloseButton ? (
            <Button
              variant="outline"
              onClick={onClose}
              disabled={isDismissDisabled}
              className={`w-full sm:w-auto ${
                usesLivePalette
                  ? 'border-white/35 text-white hover:bg-white/10'
                  : ''
              }`}
            >
              {closeButtonLabel}
            </Button>
          ) : (
            <span className="hidden sm:block" aria-hidden="true" />
          )}
          <div className="flex flex-col sm:flex-row gap-2 sm:items-center w-full sm:w-auto">
            {showStopButton && (
              <Button
                variant="destructive"
                onClick={onStop}
                disabled={isStoppingPhase || isStopping}
                className={`w-full sm:min-w-[140px] ${
                  usesLivePalette ? 'bg-white text-brand-dark hover:bg-white/90 border-none' : ''
                }`}
              >
                {isStopping ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Stopping...
                  </>
                ) : (
                  <>
                    <Square className="h-4 w-4 mr-2" />
                    Stop Session
                  </>
                )}
              </Button>
            )}
            {showStartButton && (
              <Button
                onClick={onConfirm}
                disabled={!canTriggerStart}
                className={`w-full sm:min-w-[140px] ${
                  canTriggerStart
                    ? 'bg-green-600 hover:bg-green-700'
                    : 'bg-green-600/40 text-green-900/60 cursor-not-allowed'
                }`}
              >
                {isStarting ? (
                  <>
                    <Play className="h-4 w-4 mr-2 animate-spin" />
                    Starting...
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-2" />
                    Begin Session
                  </>
                )}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
