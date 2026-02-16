import React, { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { NormalizedGameDevice } from '@/features/games/hooks/use-game-devices';
import { formatSessionDuration } from '@/features/games/lib/session-state';
import type { LiveSessionSummary } from './types';
import { ChevronRight, PlusCircle, RotateCcw, Info, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTargetCustomNames } from '@/features/targets';

// --- Collapsible section for summary detail ---
const CollapsibleSection: React.FC<{
  title: string;
  badge?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}> = ({ title, badge, defaultOpen = false, children }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-t border-[rgba(28,25,43,0.06)]">
      <button onClick={() => setOpen(!open)}
        className="flex items-center justify-between w-full py-3 text-left group">
        <div className="flex items-center gap-2">
          <ChevronRight className={`h-4 w-4 text-brand-dark/30 transition-transform duration-200 ${open ? 'rotate-90' : ''}`} />
          <span className="text-sm font-medium text-brand-dark font-body">{title}</span>
          {badge && <span className="text-[10px] font-medium text-brand-dark/40 font-body">{badge}</span>}
        </div>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2, ease: 'easeOut' }} className="overflow-hidden">
            <div className="pb-3 space-y-2">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// --- Summary card (extracted for readability) ---
const SummaryCard: React.FC<{
  recentSummary: LiveSessionSummary;
  isMultiTarget: boolean;
  totalGoalShots: number;
  summaryGoalShots: Record<string, number>;
  avgTransitionTime: number | null;
  topResults: Array<{ deviceId: string; deviceName: string; hitCount?: number }>;
  recentSplits: Array<{ deviceId: string; deviceName: string; splitNumber: number; time: number }>;
  recentTransitions: Array<{ fromDevice: string; toDevice: string; transitionNumber: number; time: number }>;
  perTargetStats: Array<{ deviceId: string; deviceName: string; hitCount: number; splitCount: number; avgSplit: number | null; fastestSplit: number | null }>;
  transitionStats: Array<{ key: string; fromName: string; toName: string; count: number; avgTime: number }>;
  actionsDisabled: boolean;
  onCreateNew?: () => void;
  onUsePrevious?: () => void;
  getDisplayName: (deviceId: string, defaultName: string) => string;
}> = ({
  recentSummary, isMultiTarget, totalGoalShots, summaryGoalShots, avgTransitionTime,
  topResults, recentSplits, recentTransitions, perTargetStats, transitionStats,
  actionsDisabled, onCreateNew, onUsePrevious, getDisplayName,
}) => (
  <Card className="shadow-card bg-gradient-to-br from-white via-white to-brand-primary/[0.04] rounded-[var(--radius-lg)]">
    <CardContent className="p-5 md:p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-label text-brand-secondary uppercase tracking-wide font-body">Last Session</p>
          <h2 className="font-heading text-lg text-brand-dark">Summary</h2>
          <p className="text-[11px] text-brand-dark font-body">
            {new Date(recentSummary.startedAt).toLocaleTimeString()} &bull; {recentSummary.targets.length} targets
          </p>
        </div>
        <div className="rounded-full bg-brand-primary/10 px-3 py-1">
          <span className="text-xs font-bold text-brand-primary font-body tabular-nums">
            {formatSessionDuration(recentSummary.durationSeconds)}
          </span>
        </div>
      </div>

      {/* Hero stats grid — always visible */}
      <div className={`grid grid-cols-2 gap-2 ${isMultiTarget ? 'sm:grid-cols-4' : 'sm:grid-cols-3'}`}>
        <div className="rounded-[var(--radius)] bg-brand-primary/5 px-3 py-2 shadow-subtle">
          <p className="text-label text-brand-secondary font-body uppercase tracking-wide block mb-0.5">Total Hits</p>
          <p className="text-stat-md font-bold text-brand-dark font-body tabular-nums">{recentSummary.totalHits}</p>
        </div>
        <div className={`rounded-[var(--radius)] px-3 py-2 shadow-subtle ${
          recentSummary.isValid === false ? 'bg-red-50' : 'bg-brand-primary/5'
        }`}>
          <div className="flex items-center gap-1">
            <p className="text-label text-brand-secondary font-body uppercase tracking-wide block mb-0.5">Score</p>
            <Popover>
              <PopoverTrigger asChild>
                <button type="button" className="inline-flex items-center justify-center rounded-full hover:bg-brand-dark/10 p-0.5 -m-0.5 transition-colors" aria-label="Info about Score">
                  <Info className="h-3 w-3 text-brand-dark/40" />
                </button>
              </PopoverTrigger>
              <PopoverContent side="bottom" align="start" className="w-80 bg-white shadow-lg p-3 border-0 z-30">
                <p className="text-xs font-medium text-brand-dark mb-1">How Score is Calculated</p>
                {recentSummary.isValid === false ? (
                  <p className="text-xs text-brand-dark/70">
                    <span className="font-medium text-red-600">Did Not Finish (DNF):</span> Not all required hits were achieved.
                  </p>
                ) : totalGoalShots > 0 ? (
                  <p className="text-xs text-brand-dark/70">
                    Score = time (in seconds) of the last required hit. <span className="font-medium">Lower is better.</span>
                  </p>
                ) : (
                  <p className="text-xs text-brand-dark/70">
                    Score = time from first hit to last hit. <span className="font-medium">Lower is better.</span>
                  </p>
                )}
              </PopoverContent>
            </Popover>
          </div>
          <p className={`text-stat-md font-bold font-body tabular-nums ${
            recentSummary.isValid === false ? 'text-red-500' : 'text-brand-dark'
          }`}>
            {recentSummary.isValid === false
              ? 'DNF'
              : typeof recentSummary.score === 'number' && Number.isFinite(recentSummary.score)
                ? `${recentSummary.score.toFixed(2)}s`
                : '—'}
          </p>
        </div>
        <div className="rounded-[var(--radius)] bg-brand-primary/5 px-3 py-2 shadow-subtle">
          <div className="flex items-center gap-1">
            <p className="text-label text-brand-secondary font-body uppercase tracking-wide block mb-0.5">Avg Split</p>
            <Popover>
              <PopoverTrigger asChild>
                <button type="button" className="inline-flex items-center justify-center rounded-full hover:bg-brand-dark/10 p-0.5 -m-0.5 transition-colors" aria-label="Info about Avg Split">
                  <Info className="h-3 w-3 text-brand-dark/40" />
                </button>
              </PopoverTrigger>
              <PopoverContent side="bottom" align="start" className="w-72 bg-white shadow-lg p-3 border-0 z-30">
                <p className="text-xs font-medium text-brand-dark mb-1">What is Avg Split?</p>
                <p className="text-xs text-brand-dark/70">
                  {isMultiTarget
                    ? 'Average time between consecutive hits on the same target.'
                    : 'Average time between consecutive shots.'}
                </p>
              </PopoverContent>
            </Popover>
          </div>
          <p className="text-stat-md font-bold text-brand-dark font-body tabular-nums">
            {recentSummary.averageHitInterval > 0 ? `${recentSummary.averageHitInterval.toFixed(2)}s` : '—'}
          </p>
        </div>
        {isMultiTarget && (
          <div className="rounded-[var(--radius)] bg-brand-primary/5 px-3 py-2 shadow-subtle">
            <div className="flex items-center gap-1">
              <p className="text-label text-brand-secondary font-body uppercase tracking-wide block mb-0.5">Avg Transition</p>
              <Popover>
                <PopoverTrigger asChild>
                  <button type="button" className="inline-flex items-center justify-center rounded-full hover:bg-brand-dark/10 p-0.5 -m-0.5 transition-colors" aria-label="Info about Avg Transition">
                    <Info className="h-3 w-3 text-brand-dark/40" />
                  </button>
                </PopoverTrigger>
                <PopoverContent side="bottom" align="start" className="w-72 bg-white shadow-lg p-3 border-0 z-30">
                  <p className="text-xs font-medium text-brand-dark mb-1">What is Avg Transition?</p>
                  <p className="text-xs text-brand-dark/70">Average time to switch between different targets.</p>
                </PopoverContent>
              </Popover>
            </div>
            <p className="text-stat-md font-bold text-brand-dark font-body tabular-nums">
              {avgTransitionTime !== null ? `${avgTransitionTime.toFixed(2)}s` : '—'}
            </p>
          </div>
        )}
      </div>

      {/* Collapsible: Targets */}
      <CollapsibleSection title="Targets" badge={`${topResults.length} devices`}>
        {topResults.length === 0 ? (
          <p className="text-sm text-brand-dark/40 font-body">No target activity captured.</p>
        ) : (
          <div className="space-y-1.5">
            {topResults.map((result) => {
              const goalShots = summaryGoalShots[result.deviceId];
              const hasGoal = typeof goalShots === 'number' && goalShots > 0;
              const goalReached = hasGoal && (result.hitCount ?? 0) >= goalShots;
              const actualHits = result.hitCount ?? 0;
              const displayName = getDisplayName(result.deviceId, result.deviceName);
              return (
                <div
                  key={result.deviceId}
                  className={`flex items-center justify-between rounded-[var(--radius)] px-3 py-2 shadow-subtle ${
                    goalReached ? 'bg-green-50' : 'bg-white'
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${goalReached ? 'bg-green-500' : 'bg-brand-primary'}`} />
                      <span className="text-sm font-medium text-brand-dark font-body truncate" title={displayName !== result.deviceName ? `Original: ${result.deviceName}` : undefined}>
                        {displayName}
                      </span>
                      {goalReached && <span className="text-[10px] font-bold text-green-600 uppercase tracking-wide">Done</span>}
                    </div>
                    {hasGoal && (
                      <p className="text-[11px] text-brand-dark/40 font-body ml-4">Goal: {goalShots} shots</p>
                    )}
                  </div>
                  <p className="text-stat-sm font-bold text-brand-dark font-body tabular-nums ml-2">
                    {hasGoal ? `${actualHits}/${goalShots}` : actualHits}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </CollapsibleSection>

      {/* Collapsible: Performance */}
      {(perTargetStats.some(s => s.splitCount > 0) || transitionStats.length > 0) && (
        <CollapsibleSection title="Performance">
          {perTargetStats.some(s => s.splitCount > 0) && (
            <div className="space-y-1.5">
              <p className="text-label text-brand-secondary font-body uppercase tracking-wide">
                {isMultiTarget ? 'Per-Target Splits' : 'Split Statistics'}
              </p>
              {perTargetStats.filter(s => s.splitCount > 0).map((stat) => (
                <div key={stat.deviceId} className="flex items-center justify-between text-xs bg-white rounded-[var(--radius)] px-3 py-2 shadow-subtle">
                  <div className="flex-1 min-w-0">
                    {isMultiTarget && <span className="font-medium text-brand-dark font-body truncate block">{stat.deviceName}</span>}
                    <span className="text-[10px] text-brand-dark/40 font-body">
                      {stat.hitCount} hits, {stat.splitCount} split{stat.splitCount !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="text-right ml-2 flex-shrink-0">
                    <p className="text-brand-primary font-medium font-body tabular-nums">
                      avg {stat.avgSplit !== null ? `${stat.avgSplit.toFixed(2)}s` : '—'}
                    </p>
                    {stat.fastestSplit !== null && (
                      <p className="text-[10px] text-green-600 font-body tabular-nums">
                        best {stat.fastestSplit.toFixed(2)}s
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
          {isMultiTarget && transitionStats.length > 0 && (
            <div className="space-y-1.5 mt-3">
              <p className="text-label text-brand-secondary font-body uppercase tracking-wide">Transitions</p>
              {transitionStats.map((stat) => (
                <div key={stat.key} className="flex items-center justify-between text-xs bg-white rounded-[var(--radius)] px-3 py-2 shadow-subtle">
                  <div className="flex items-center gap-1.5 flex-1 min-w-0">
                    <span className="font-medium text-brand-dark font-body truncate">{stat.fromName}</span>
                    <ArrowRight className="h-3 w-3 text-brand-secondary flex-shrink-0" />
                    <span className="font-medium text-brand-dark font-body truncate">{stat.toName}</span>
                  </div>
                  <div className="text-right ml-2 flex-shrink-0">
                    <p className="text-brand-secondary font-medium font-body tabular-nums">avg {stat.avgTime.toFixed(2)}s</p>
                    <p className="text-[10px] text-brand-dark/40 font-body">{stat.count}x</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CollapsibleSection>
      )}

      {/* Collapsible: Shot Log */}
      {(recentSplits.length > 0 || (isMultiTarget && recentTransitions.length > 0)) && (
        <CollapsibleSection title="Shot Log" badge={`${recentSplits.length + recentTransitions.length} entries`}>
          {recentSplits.length > 0 && (
            <div className="space-y-1">
              {recentSplits.map((split) => {
                const displayName = getDisplayName(split.deviceId, split.deviceName);
                const splitsForDevice = recentSummary.splits?.filter(s => s.deviceId === split.deviceId) ?? [];
                const splitIndexForDevice = splitsForDevice.findIndex(s => s.splitNumber === split.splitNumber) + 1;
                return (
                  <div key={`${split.deviceId}-${split.splitNumber}`} className="flex items-center justify-between rounded-[var(--radius)] bg-brand-primary/[0.03] px-3 py-1.5 text-xs">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      {isMultiTarget && (
                        <>
                          <span className="font-medium text-brand-dark font-body truncate" title={displayName !== split.deviceName ? `Original: ${split.deviceName}` : undefined}>
                            {displayName}
                          </span>
                          <span className="text-brand-dark/30">&bull;</span>
                        </>
                      )}
                      <span className="font-medium text-brand-dark font-body">Split #{isMultiTarget ? splitIndexForDevice : split.splitNumber}</span>
                    </div>
                    <span className="text-sm font-bold text-brand-primary font-body tabular-nums ml-2">{split.time.toFixed(2)}s</span>
                  </div>
                );
              })}
            </div>
          )}
          {isMultiTarget && recentTransitions.length > 0 && (
            <div className="space-y-1 mt-2">
              {recentTransitions.map((transition) => {
                const fromName = getDisplayName(transition.fromDevice, transition.fromDevice);
                const toName = getDisplayName(transition.toDevice, transition.toDevice);
                return (
                  <div key={`${transition.fromDevice}-${transition.toDevice}-${transition.transitionNumber}`} className="flex items-center justify-between rounded-[var(--radius)] bg-brand-secondary/[0.03] px-3 py-1.5 text-xs">
                    <div className="flex items-center gap-1.5 flex-1 min-w-0">
                      <span className="font-medium text-brand-dark font-body truncate">{fromName}</span>
                      <ArrowRight className="h-3 w-3 text-brand-secondary flex-shrink-0" />
                      <span className="font-medium text-brand-dark font-body truncate">{toName}</span>
                    </div>
                    <span className="text-sm font-bold text-brand-secondary font-body tabular-nums ml-2">{transition.time.toFixed(2)}s</span>
                  </div>
                );
              })}
            </div>
          )}
        </CollapsibleSection>
      )}

      {/* Action buttons */}
      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end pt-3 border-t border-[rgba(28,25,43,0.06)]">
        <Button variant="secondary" onClick={onCreateNew} disabled={actionsDisabled || !onCreateNew}>
          <PlusCircle className="h-4 w-4" /> New setup
        </Button>
        <Button onClick={onUsePrevious} disabled={actionsDisabled || !onUsePrevious}>
          <RotateCcw className="h-4 w-4" /> Repeat session
        </Button>
      </div>
      {actionsDisabled && (onUsePrevious || onCreateNew) && (
        <p className="text-[11px] text-brand-dark/40 text-right font-body">
          Stop the active session to adjust setups.
        </p>
      )}
    </CardContent>
  </Card>
);

interface LiveSessionCardProps {
  isRunning: boolean;
  timerSeconds: number;
  activeTargets: NormalizedGameDevice[];
  activeHits: number;
  hitCounts: Record<string, number>;
  recentSummary: LiveSessionSummary | null;
  desiredDurationSeconds?: number | null;
  goalShotsPerTarget?: Record<string, number>;
  stoppedTargets?: Set<string>;
  onUsePrevious?: () => void;
  onCreateNew?: () => void;
  isSessionLocked?: boolean;
}

// Displays either the current live telemetry view or the most recent session summary snapshot.
export const LiveSessionCard: React.FC<LiveSessionCardProps> = ({
  isRunning,
  timerSeconds,
  activeTargets,
  activeHits,
  hitCounts,
  recentSummary,
  desiredDurationSeconds = null,
  goalShotsPerTarget = {},
  stoppedTargets = new Set(),
  onUsePrevious,
  onCreateNew,
  isSessionLocked = false,
}) => {
  const { data: customNames = new Map() } = useTargetCustomNames();
  const desiredDurationLabel =
    typeof desiredDurationSeconds === 'number' && desiredDurationSeconds > 0
      ? formatSessionDuration(desiredDurationSeconds)
      : 'No time limit';

  // All hooks must be called unconditionally (before any early return) to satisfy React's rules of hooks.
  // Calculate per-target split statistics
  const perTargetStats = useMemo(() => {
    if (!recentSummary) return [];

    const stats: Record<string, { splits: number[]; hitCount: number; deviceName: string }> = {};

    // Initialize from targets
    recentSummary.targets.forEach((target) => {
      stats[target.deviceId] = { splits: [], hitCount: 0, deviceName: target.deviceName };
    });

    // Populate hit counts from device stats
    recentSummary.deviceStats?.forEach((stat) => {
      if (stats[stat.deviceId]) {
        stats[stat.deviceId].hitCount = stat.hitCount;
      }
    });

    // Populate splits
    recentSummary.splits?.forEach((split) => {
      if (stats[split.deviceId]) {
        stats[split.deviceId].splits.push(split.time);
      }
    });

    return Object.entries(stats).map(([deviceId, data]) => {
      const avgSplit = data.splits.length > 0
        ? data.splits.reduce((a, b) => a + b, 0) / data.splits.length
        : null;
      const fastestSplit = data.splits.length > 0 ? Math.min(...data.splits) : null;
      return {
        deviceId,
        deviceName: customNames.get(deviceId) ?? data.deviceName,
        hitCount: data.hitCount,
        splitCount: data.splits.length,
        avgSplit,
        fastestSplit,
      };
    });
  }, [recentSummary, customNames]);

  // Calculate transition statistics by direction
  const transitionStats = useMemo(() => {
    if (!recentSummary?.transitions) return [];

    const stats: Record<string, { count: number; times: number[]; fromName: string; toName: string }> = {};

    recentSummary.transitions.forEach((transition) => {
      const key = `${transition.fromDevice}->${transition.toDevice}`;
      if (!stats[key]) {
        stats[key] = {
          count: 0,
          times: [],
          fromName: customNames.get(transition.fromDevice) ?? transition.fromDevice,
          toName: customNames.get(transition.toDevice) ?? transition.toDevice,
        };
      }
      stats[key].count++;
      stats[key].times.push(transition.time);
    });

    return Object.entries(stats).map(([key, data]) => ({
      key,
      fromName: data.fromName,
      toName: data.toName,
      count: data.count,
      avgTime: data.times.reduce((a, b) => a + b, 0) / data.times.length,
    }));
  }, [recentSummary?.transitions, customNames]);

  // Calculate average transition time for the stats grid
  const avgTransitionTime = useMemo(() => {
    if (!recentSummary?.transitions || recentSummary.transitions.length === 0) return null;
    const totalTime = recentSummary.transitions.reduce((sum, t) => sum + t.time, 0);
    return totalTime / recentSummary.transitions.length;
  }, [recentSummary?.transitions]);

  if (isRunning) {
    return (
      <Card className="bg-white shadow-elevated rounded-[var(--radius-lg)]">
        <CardContent className="p-5 md:p-6 space-y-4">
          {/* Compact header with live indicator */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-label text-brand-secondary uppercase tracking-wide font-body">Live Session</p>
              <h2 className="font-heading text-lg text-brand-dark">Training</h2>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-[live-pulse_2s_ease-in-out_infinite]" />
              <span className="text-xs font-medium text-red-500 font-body uppercase tracking-wide">Live</span>
            </div>
          </div>

          {/* Hero stats — Strava recording-screen style */}
          <div className="bg-brand-light px-5 py-4 rounded-[var(--radius)]">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <div className="text-center">
                <motion.p
                  key={activeHits}
                  initial={{ scale: 1.05 }}
                  animate={{ scale: 1 }}
                  transition={{ duration: 0.15, ease: 'easeOut' }}
                  className="text-stat-hero font-bold text-brand-dark font-body tabular-nums"
                >
                  {activeHits}
                </motion.p>
                <p className="text-label text-brand-secondary uppercase tracking-wide font-body">Total Hits</p>
              </div>
              <div className="text-center">
                <p className="text-stat-lg font-bold text-brand-dark font-body tabular-nums">
                  {formatSessionDuration(timerSeconds)}
                </p>
                <p className="text-label text-brand-secondary uppercase tracking-wide font-body">Elapsed</p>
                <p className="text-[10px] text-brand-dark/40 font-body mt-0.5">Goal: {desiredDurationLabel}</p>
              </div>
              <div className="text-center hidden sm:block">
                <p className="text-stat-lg font-bold text-brand-dark font-body tabular-nums">
                  {activeTargets.length}
                </p>
                <p className="text-label text-brand-secondary uppercase tracking-wide font-body">Targets</p>
              </div>
            </div>
          </div>

          {/* Target rows */}
          <div className="space-y-2">
            {activeTargets.length === 0 ? (
              <p className="text-sm text-brand-dark/40 font-body text-center py-6">
                Select one or more online targets to stream live stats.
              </p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {activeTargets.map((target) => {
                  const hits = hitCounts[target.deviceId] ?? target.hitCount ?? 0;
                  const goalShots = goalShotsPerTarget[target.deviceId];
                  const hasGoal = typeof goalShots === 'number' && goalShots > 0;
                  const isStopped = stoppedTargets.has(target.deviceId);
                  return (
                    <div
                      key={target.deviceId}
                      className={`flex items-center justify-between rounded-[var(--radius)] px-3 py-2.5 shadow-subtle transition-all duration-200 ${
                        isStopped ? 'bg-green-50 shadow-green-100/50' : 'bg-white'
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${isStopped ? 'bg-green-500' : 'bg-brand-primary'}`} />
                          <p className="text-sm font-medium text-brand-dark leading-tight truncate font-body">{target.name ?? target.deviceId}</p>
                          {isStopped && <span className="text-[10px] font-bold text-green-600 uppercase tracking-wide">Done</span>}
                        </div>
                        <p className="text-[11px] text-brand-dark/40 font-body ml-4">
                          {hasGoal ? `${hits} / ${goalShots} shots` : 'Live tracking'}
                        </p>
                      </div>
                      <div className="text-right ml-2">
                        <p className="text-stat-md font-bold text-brand-primary font-body tabular-nums">{hits}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Helper function to get display name (custom name or default)
  const getDisplayName = (deviceId: string, defaultName: string): string => {
    return customNames.get(deviceId) ?? defaultName;
  };

  if (recentSummary) {
    const topResults = [...(recentSummary.historyEntry.deviceResults ?? [])]
      .sort((a, b) => (b.hitCount ?? 0) - (a.hitCount ?? 0))
      .slice(0, 3);
    const recentSplits = (recentSummary.splits ?? []).slice(0, 4);
    const recentTransitions = (recentSummary.transitions ?? []).slice(0, 4);
    const actionsDisabled = isSessionLocked;
    const isMultiTarget = recentSummary.targets.length > 1;

    // Calculate total goal shots from goalShotsPerTarget
    const allPossibleLocations = [
      recentSummary.historyEntry?.goalShotsPerTarget,
      (recentSummary.historyEntry as any)?.goalShotsPerTarget,
      (recentSummary as any)?.goalShotsPerTarget,
    ].filter(Boolean);

    const summaryGoalShots = allPossibleLocations.length > 0
      ? (allPossibleLocations[0] as Record<string, number>)
      : {};

    const totalGoalShots = Object.values(summaryGoalShots).reduce((sum, goal) => {
      const numGoal = typeof goal === 'number' ? goal : (typeof goal === 'string' ? parseInt(goal, 10) : 0);
      return sum + (Number.isFinite(numGoal) && numGoal >= 0 ? numGoal : 0);
    }, 0);

    return (
      <SummaryCard
        recentSummary={recentSummary}
        isMultiTarget={isMultiTarget}
        totalGoalShots={totalGoalShots}
        summaryGoalShots={summaryGoalShots}
        avgTransitionTime={avgTransitionTime}
        topResults={topResults}
        recentSplits={recentSplits}
        recentTransitions={recentTransitions}
        perTargetStats={perTargetStats}
        transitionStats={transitionStats}
        actionsDisabled={actionsDisabled}
        onCreateNew={onCreateNew}
        onUsePrevious={onUsePrevious}
        getDisplayName={getDisplayName}
      />
    );
  }

  return null;
};

// Placeholder while live session data boots.
export const LiveSessionCardSkeleton: React.FC = () => (
  <div className="bg-gradient-to-br from-white via-white to-brand-primary/[0.04] shadow-card rounded-[var(--radius-lg)] p-5 md:p-6 animate-pulse space-y-4">
    {/* Header */}
    <div className="flex items-center justify-between">
      <div className="space-y-1.5">
        <Skeleton className="h-3 w-20 bg-gray-200" />
        <Skeleton className="h-5 w-28 bg-gray-200" />
        <Skeleton className="h-3 w-40 bg-gray-200" />
      </div>
      <Skeleton className="h-7 w-16 rounded-full bg-gray-200" />
    </div>
    {/* Hero stats */}
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="rounded-[var(--radius)] bg-gray-100 px-3 py-3 space-y-1.5">
          <Skeleton className="h-3 w-16 bg-gray-200" />
          <Skeleton className="h-7 w-12 bg-gray-200" />
        </div>
      ))}
    </div>
    {/* Target rows */}
    <div className="space-y-2">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="flex items-center justify-between rounded-[var(--radius)] bg-white px-3 py-2.5 shadow-subtle">
          <div className="space-y-1">
            <Skeleton className="h-4 w-32 bg-gray-200" />
            <Skeleton className="h-3 w-20 bg-gray-200" />
          </div>
          <Skeleton className="h-6 w-10 bg-gray-200" />
        </div>
      ))}
    </div>
    {/* Action buttons */}
    <div className="flex gap-2 justify-end pt-3 border-t border-[rgba(28,25,43,0.06)]">
      <Skeleton className="h-10 w-28 rounded-full bg-gray-200" />
      <Skeleton className="h-10 w-36 rounded-full bg-gray-200" />
    </div>
  </div>
);
