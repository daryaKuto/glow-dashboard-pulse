import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Loader2, Play, Square, Timer } from 'lucide-react';
import type { NormalizedGameDevice } from '@/hooks/useGameDevices';
import type { SessionHitRecord } from '@/services/device-game-flow';
import type { SplitRecord, TransitionRecord } from '@/hooks/useGameTelemetry';
import type { SessionLifecycle, SessionHitEntry } from './sessionState';
import { formatSecondsWithMillis, formatSessionDuration } from './sessionState';

interface SessionStopwatchCardProps {
  seconds: number;
  accent: 'default' | 'live';
  statusText: string;
  showSpinner?: boolean;
}

const SessionStopwatchCard: React.FC<SessionStopwatchCardProps> = ({
  seconds,
  accent,
  statusText,
  showSpinner = false,
}) => {
  const isLive = accent === 'live';
  const containerClasses = [
    'flex flex-col items-center justify-center rounded-2xl px-6 py-8 text-center',
    isLive ? 'bg-white/10 border border-white/15 shadow-lg' : 'bg-brand-secondary/10 border border-brand-secondary/30',
  ].join(' ');

  return (
    <div className={containerClasses}>
      <Timer className={`mb-4 h-10 w-10 ${isLive ? 'text-white/80' : 'text-brand-primary'}`} />
      <div className={`text-[11px] uppercase tracking-[0.4em] font-semibold ${isLive ? 'text-white/70' : 'text-brand-dark/60'}`}>
        Stopwatch
      </div>
      <div className={`mt-4 font-heading ${isLive ? 'text-white text-5xl sm:text-6xl' : 'text-brand-dark text-4xl sm:text-5xl'}`}>
        {formatSessionDuration(seconds)}
      </div>
      <p className={`mt-3 text-xs font-medium ${isLive ? 'text-white/70' : 'text-brand-dark/60'}`}>
        {statusText}
      </p>
      {showSpinner && (
        <Loader2 className={`mt-3 h-5 w-5 animate-spin ${isLive ? 'text-white/70' : 'text-brand-primary'}`} />
      )}
    </div>
  );
};

const SessionTargetList: React.FC<{ targets: NormalizedGameDevice[] }> = ({ targets }) => {
  if (targets.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-brand-secondary/40 bg-brand-secondary/10 px-3 py-4 text-sm text-brand-dark/60 text-center">
        Select at least one online target to begin a live session.
      </p>
    );
  }

  return (
    <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
      {targets.map((target) => (
        <div
          key={target.deviceId}
          className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 px-3 py-2"
        >
          <div>
            <p className="font-medium text-brand-dark">{target.name ?? target.deviceId}</p>
            <p className="text-xs text-brand-dark/60">{target.deviceId}</p>
          </div>
          <Badge
            variant="outline"
            className={
              target.isOnline === false
                ? 'text-brand-dark/60'
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

const SessionProgressMessage: React.FC<{
  tone: 'default' | 'live';
  message: string;
  subtext?: string;
}> = ({ tone, message, subtext }) => {
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
}> = ({ hits, variant, emptyLabel, limit = 12 }) => {
  if (hits.length === 0) {
    return (
      <div
        className={
          variant === 'live'
            ? 'rounded-xl border border-white/15 bg-white/10 px-4 py-6 text-center text-sm text-white/70'
            : 'rounded-xl border border-white/15 bg-white/10 px-4 py-6 text-center text-sm text-white/70'
        }
      >
        {emptyLabel}
      </div>
    );
  }

  const sliced = hits.slice(-limit).reverse();

  return (
    <div
      className={
        variant === 'live'
          ? 'max-h-60 overflow-y-auto rounded-xl border border-white/15 bg-white/10 divide-y divide-white/10'
          : 'max-h-52 overflow-y-auto rounded-xl border border-white/15 bg-white/10 divide-y divide-white/10'
      }
    >
      {sliced.map((hit) => (
        <div
          key={hit.id}
          className={
            variant === 'live'
              ? 'flex items-center justify-between px-4 py-3 text-xs sm:text-sm text-white'
              : 'flex items-center justify-between px-4 py-3 text-xs sm:text-sm text-white/80'
          }
        >
          <div className="flex items-center gap-3">
            <span className="font-mono text-[11px] sm:text-xs text-white/60">
              #{hit.sequence}
            </span>
            <span className="font-semibold">{hit.deviceName}</span>
          </div>
          <div className="flex items-center gap-4 font-mono text-[11px] sm:text-xs uppercase tracking-wide">
            <span>{formatSecondsWithMillis(hit.sinceStartSeconds)}</span>
            <span className="text-white/70">
              {hit.splitSeconds !== null ? `+${formatSecondsWithMillis(hit.splitSeconds)}` : '—'}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
};

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
  splitRecords?: SplitRecord[];
  transitionRecords?: TransitionRecord[];
  hitHistory?: SessionHitRecord[];
}

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
}) => {
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
  const usesLivePalette = isRunningPhase || isStoppingPhase || isFinalizingPhase;

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

  let bodyContent: React.ReactNode;
  if (isRunningPhase) {
    bodyContent = (
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Badge className="bg-white/15 text-white border-white/20 text-xs px-3 py-1">
            {`${targets.length} target${targets.length === 1 ? '' : 's'} armed`}
          </Badge>
        </div>
        <h3 className="text-sm uppercase tracking-wide text-white/80">Live shot feed</h3>
        <SessionHitFeedList
          hits={sessionHits}
          variant="live"
          emptyLabel="Waiting for the first hit..."
          limit={12}
        />
      </div>
    );
  } else if (isStoppingPhase || isFinalizingPhase) {
    const message = isFinalizingPhase
      ? 'Persisting session summary...'
      : 'Sending stop command to all targets...';
    bodyContent = (
      <div className="space-y-3">
        <SessionProgressMessage tone="live" message={message} />
        {sessionHits.length > 0 && (
          <>
            <h3 className="text-sm uppercase tracking-wide text-white/80">Recent hits</h3>
            <SessionHitFeedList
              hits={sessionHits}
              variant="finalizing"
              emptyLabel="Waiting for hits..."
              limit={6}
            />
          </>
        )}
      </div>
    );
  } else if (isLaunchingPhase) {
    bodyContent = (
      <div className="space-y-3">
        <SessionProgressMessage
          tone="default"
          message="Starting session on selected targets..."
          subtext="Waiting for ThingsBoard to confirm the game is live."
        />
      </div>
    );
  } else {
    bodyContent = (
      <div className="space-y-3">
        <h3 className="font-heading text-sm uppercase tracking-wide text-brand-dark/70">
          Targets ({targets.length})
        </h3>
        <SessionTargetList targets={targets} />
      </div>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className={[
          'max-w-xl',
          'transition-colors',
          'duration-300',
          'shadow-xl',
          usesLivePalette ? 'bg-brand-secondary text-white border-brand-secondary/50' : 'bg-white text-brand-dark border-gray-200',
        ].join(' ')}
      >
        <DialogHeader className="space-y-2">
          <DialogTitle className="text-2xl font-heading">Current Session</DialogTitle>
          <DialogDescription className={usesLivePalette ? 'text-white/80' : 'text-brand-dark/70'}>
            {dialogDescription}
          </DialogDescription>
          {currentGameId && (
            <p className={`text-xs font-mono ${usesLivePalette ? 'text-white/65' : 'text-brand-dark/50'}`}>Game ID: {currentGameId}</p>
          )}
        </DialogHeader>

        <div className="space-y-6">
          <SessionStopwatchCard
            seconds={sessionSeconds}
            accent={usesLivePalette ? 'live' : 'default'}
            statusText={stopwatchStatus}
            showSpinner={showStopwatchSpinner}
          />

          {bodyContent}
        </div>

        <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-between">
          {showCloseButton ? (
            <Button
              variant="outline"
              onClick={onClose}
              disabled={!canClose || isStarting || isLaunchingPhase}
              className={usesLivePalette ? 'border-white/35 text-white hover:bg-white/10 hidden' : undefined}
            >
              {canClose ? 'Cancel' : 'Close'}
            </Button>
          ) : (
            <span className="hidden sm:block" aria-hidden="true" />
          )}
          <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
            {showStopButton && (
              <Button
                variant="destructive"
                onClick={onStop}
                disabled={isStoppingPhase || isStopping}
                className="sm:min-w-[140px]"
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
                className={
                  canTriggerStart
                    ? 'sm:min-w-[140px] bg-green-600 hover:bg-green-700'
                    : 'sm:min-w-[140px] bg-green-600/40 text-green-900/60 cursor-not-allowed'
                }
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
