import React, { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { NormalizedGameDevice } from '@/features/games/hooks/use-game-devices';
import { formatSessionDuration } from '@/components/game-session/sessionState';
import type { LiveSessionSummary } from './types';
import { Building2, Clock3, Bookmark, Crosshair, PlusCircle, RotateCcw, Info, ArrowRight } from 'lucide-react';
import { useTargetCustomNames } from '@/features/targets';

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

  if (isRunning) {
    return (
      <Card className="bg-white border-brand-primary/20 shadow-lg rounded-md md:rounded-xl">
        <CardContent className="p-4 md:p-6 space-y-5">
          <div className="rounded-2xl bg-gradient-to-r from-brand-primary to-brand-secondary text-white px-5 py-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-[0.35em] text-white/70">Current Session</p>
              <h2 className="font-heading text-2xl text-white">Live Telemetry</h2>
              <p className="text-sm text-white/80">Tracking {activeTargets.length} targets in real time</p>
            </div>
            <Badge className="bg-white/15 text-white border-white/40 uppercase tracking-wide">Active</Badge>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-xl bg-brand-primary text-white px-4 py-3 shadow-md">
              <p className="text-[11px] uppercase tracking-wide text-white/70">Stopwatch</p>
              <p className="font-heading text-3xl">{formatSessionDuration(timerSeconds)}</p>
              <p className="mt-1 text-xs text-white/70">Goal: {desiredDurationLabel}</p>
            </div>
            <div className="rounded-xl bg-brand-secondary text-white px-4 py-3 shadow-md">
              <p className="text-[11px] uppercase tracking-wide text-white/70">Session Hits</p>
              <p className="font-heading text-3xl">{activeHits}</p>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-[11px] uppercase tracking-wide text-brand-dark/70">Targets</p>
              <span className="text-xs text-brand-dark/50">IDs logged to console</span>
            </div>
            {activeTargets.length === 0 ? (
              <p className="rounded-xl border border-dashed border-brand-secondary/60 bg-brand-secondary/10 px-3 py-4 text-sm text-brand-dark/70 text-center">
                Select one or more online targets to stream live stats.
              </p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {activeTargets.map((target) => {
                  const hits = hitCounts[target.deviceId] ?? target.hitCount ?? 0;
                  const goalShots = goalShotsPerTarget[target.deviceId];
                  const hasGoal = typeof goalShots === 'number' && goalShots > 0;
                  const isGoalReached = hasGoal && hits >= goalShots;
                  const isStopped = stoppedTargets.has(target.deviceId);
                  console.debug('[LiveSessionCard] Tracking target', { deviceId: target.deviceId, hits, goalShots, isGoalReached, isStopped });
                  return (
                    <div
                      key={target.deviceId}
                      className={`flex items-center justify-between rounded-xl border px-3 py-2 shadow-sm ${
                        isStopped
                          ? 'border-green-300 bg-green-50'
                          : isGoalReached
                            ? 'border-green-200 bg-green-50/50'
                            : 'border-gray-100 bg-white'
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-brand-dark leading-tight truncate">{target.name ?? target.deviceId}</p>
                          {isStopped && (
                            <Badge className="bg-green-600 text-white text-[10px] px-1.5 py-0">Goal Reached</Badge>
                          )}
                        </div>
                        <p className="text-[11px] text-brand-dark/60">
                          {hasGoal ? `${hits} / ${goalShots} shots` : 'Live hits updating'}
                        </p>
                      </div>
                      <div className="text-right ml-2">
                        <p className="text-[11px] text-brand-dark/60 uppercase tracking-wide">Hits</p>
                        <p className={`font-heading text-xl ${isGoalReached ? 'text-green-600' : 'text-brand-primary'}`}>{hits}</p>
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

  // Calculate per-target split statistics (moved outside conditional for hooks rules)
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

  if (recentSummary) {
    console.debug('[LiveSessionCard] Rendering last session summary', { gameId: recentSummary.gameId });
    const topResults = [...(recentSummary.historyEntry.deviceResults ?? [])]
      .sort((a, b) => (b.hitCount ?? 0) - (a.hitCount ?? 0))
      .slice(0, 3);
    const recentSplits = (recentSummary.splits ?? []).slice(0, 4);
    const recentTransitions = (recentSummary.transitions ?? []).slice(0, 4);
    const summaryRoomLabel = recentSummary.roomName ?? 'No room selected';
    const summaryDurationLabel =
      typeof recentSummary.desiredDurationSeconds === 'number' && recentSummary.desiredDurationSeconds > 0
        ? formatSessionDuration(recentSummary.desiredDurationSeconds)
        : 'No time limit';
    const displayTargets = recentSummary.targets.slice(0, 4);
    const extraTargetCount = Math.max(0, recentSummary.targets.length - displayTargets.length);
    const actionsDisabled = isSessionLocked;
    const isMultiTarget = recentSummary.targets.length > 1;
    
    // Calculate total goal shots from goalShotsPerTarget
    // Check multiple possible locations for goalShotsPerTarget
    const goalShotsPerTargetRaw = 
      recentSummary.historyEntry?.goalShotsPerTarget ?? 
      (recentSummary.historyEntry as any)?.goalShotsPerTarget ??
      (recentSummary as any)?.goalShotsPerTarget ??
      {};
    
    // Also check if it's stored directly in the summary (for backwards compatibility)
    const allPossibleLocations = [
      recentSummary.historyEntry?.goalShotsPerTarget,
      (recentSummary.historyEntry as any)?.goalShotsPerTarget,
      (recentSummary as any)?.goalShotsPerTarget,
      (recentSummary as any)?.historyEntry?.goalShotsPerTarget,
    ].filter(Boolean);
    
    const goalShotsPerTarget = allPossibleLocations.length > 0 
      ? (allPossibleLocations[0] as Record<string, number>)
      : goalShotsPerTargetRaw;
    
    console.debug('[LiveSessionCard] Full summary structure', {
      historyEntry: recentSummary.historyEntry,
      goalShotsPerTarget,
      historyEntryKeys: recentSummary.historyEntry ? Object.keys(recentSummary.historyEntry) : [],
      hasGoalShotsProperty: 'goalShotsPerTarget' in (recentSummary.historyEntry || {}),
      rawGoalShots: recentSummary.historyEntry?.goalShotsPerTarget,
      allPossibleLocations,
      summaryKeys: Object.keys(recentSummary),
    });
    
    const totalGoalShots = Object.values(goalShotsPerTarget).reduce((sum, goal) => {
      const numGoal = typeof goal === 'number' ? goal : (typeof goal === 'string' ? parseInt(goal, 10) : 0);
      return sum + (Number.isFinite(numGoal) && numGoal >= 0 ? numGoal : 0);
    }, 0);
    
    // Debug logging to help diagnose display issues
    console.debug('[LiveSessionCard] Summary goal shots calculation', {
      goalShotsPerTarget,
      totalGoalShots,
      totalHits: recentSummary.totalHits,
      goalShotsEntries: Object.entries(goalShotsPerTarget),
      goalShotsKeys: Object.keys(goalShotsPerTarget),
      goalShotsValues: Object.values(goalShotsPerTarget),
      historyEntryGoalShots: recentSummary.historyEntry?.goalShotsPerTarget,
      willDisplay: totalGoalShots > 0 ? totalGoalShots : '—',
    });

    return (
      <Card className="rounded-md md:rounded-lg border border-brand-primary/20 bg-gradient-to-br from-white via-brand-primary/5 to-brand-secondary/10 shadow-lg">
        <CardContent className="p-3 md:p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-[11px] uppercase tracking-[0.2em] text-brand-primary font-semibold">Last Session</p>
              <h2 className="font-heading text-xl text-brand-dark">Summary</h2>
              <p className="text-xs text-brand-dark/70">
                {new Date(recentSummary.startedAt).toLocaleTimeString()} • {recentSummary.targets.length} targets
              </p>
            </div>
            <Badge className="bg-brand-primary/10 text-brand-primary border-brand-primary/40">
              {formatSessionDuration(recentSummary.durationSeconds)}
            </Badge>
          </div>
          <TooltipProvider>
            <div className={`grid grid-cols-1 gap-2 ${isMultiTarget ? 'sm:grid-cols-5' : 'sm:grid-cols-4'}`}>
              <div className="rounded-xl border border-brand-secondary/30 bg-white/80 px-3 py-2 shadow-sm">
                <p className="text-[10px] uppercase tracking-wide text-brand-dark/60">Total Hits</p>
                <p className="font-heading text-2xl text-brand-primary">{recentSummary.totalHits}</p>
              </div>
              <div className="rounded-xl border border-brand-secondary/30 bg-white/80 px-3 py-2 shadow-sm">
                <p className="text-[10px] uppercase tracking-wide text-brand-dark/60">Goal Shots</p>
                <p className="font-heading text-2xl text-brand-primary">
                  {totalGoalShots > 0 ? totalGoalShots : '—'}
                </p>
              </div>
              <div className="rounded-xl border border-brand-secondary/30 bg-white/80 px-3 py-2 shadow-sm">
                <div className="flex items-center gap-1">
                  <p className="text-[10px] uppercase tracking-wide text-brand-dark/60">Avg Split</p>
                  <Popover>
                    <PopoverTrigger asChild>
                      <button 
                        type="button" 
                        className="inline-flex items-center justify-center rounded-full hover:bg-brand-dark/10 p-0.5 -m-0.5 transition-colors"
                        aria-label="Info about Avg Split"
                      >
                        <Info className="h-3 w-3 text-brand-dark/40" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent 
                      side="bottom" 
                      align="start"
                      className="w-72 bg-white border border-gray-200 shadow-lg p-3"
                    >
                      <p className="text-xs font-medium text-brand-dark mb-1">What is Avg Split?</p>
                      <p className="text-xs text-brand-dark/70 mb-2">
                        {isMultiTarget 
                          ? 'Average time between consecutive hits on the same target. Measures recoil management and trigger control.'
                          : 'Average time between consecutive shots. Measures recoil management and trigger control.'}
                      </p>
                      <p className="text-[10px] text-brand-dark/50 border-t border-gray-100 pt-2">
                        <span className="font-medium">Calculation:</span> Split = timestamp of shot N − timestamp of shot N-1 (on the same target)
                      </p>
                    </PopoverContent>
                  </Popover>
                </div>
                <p className="font-heading text-2xl text-brand-primary">
                  {recentSummary.averageHitInterval > 0 ? `${recentSummary.averageHitInterval.toFixed(2)}s` : '—'}
                </p>
              </div>
              {isMultiTarget && (
                <div className="rounded-xl border border-brand-secondary/30 bg-white/80 px-3 py-2 shadow-sm">
                  <div className="flex items-center gap-1">
                    <p className="text-[10px] uppercase tracking-wide text-brand-dark/60">Avg Transition</p>
                    <Popover>
                      <PopoverTrigger asChild>
                        <button 
                          type="button" 
                          className="inline-flex items-center justify-center rounded-full hover:bg-brand-dark/10 p-0.5 -m-0.5 transition-colors"
                          aria-label="Info about Avg Transition"
                        >
                          <Info className="h-3 w-3 text-brand-dark/40" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent 
                        side="bottom" 
                        align="start"
                        className="w-72 bg-white border border-gray-200 shadow-lg p-3"
                      >
                        <p className="text-xs font-medium text-brand-dark mb-1">What is Avg Transition?</p>
                        <p className="text-xs text-brand-dark/70 mb-2">
                          Average time to switch between different targets. Measures target acquisition speed.
                        </p>
                        <p className="text-[10px] text-brand-dark/50 border-t border-gray-100 pt-2">
                          <span className="font-medium">Calculation:</span> Transition = time from last hit on Target A to first hit on Target B
                        </p>
                      </PopoverContent>
                    </Popover>
                  </div>
                  <p className="font-heading text-2xl text-brand-primary">
                    {avgTransitionTime !== null ? `${avgTransitionTime.toFixed(2)}s` : '—'}
                  </p>
                </div>
              )}
              <div className={`rounded-xl border px-3 py-2 shadow-sm ${
                recentSummary.isValid === false
                  ? 'border-red-300 bg-red-50/80'
                  : 'border-brand-secondary/30 bg-white/80'
              }`}>
                <div className="flex items-center gap-1">
                  <p className="text-[10px] uppercase tracking-wide text-brand-dark/60">Score</p>
                  <Popover>
                    <PopoverTrigger asChild>
                      <button 
                        type="button" 
                        className="inline-flex items-center justify-center rounded-full hover:bg-brand-dark/10 p-0.5 -m-0.5 transition-colors"
                        aria-label="Info about Score"
                      >
                        <Info className="h-3 w-3 text-brand-dark/40" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent 
                      side="bottom" 
                      align="start"
                      className="w-80 bg-white border border-gray-200 shadow-lg p-3"
                    >
                      <p className="text-xs font-medium text-brand-dark mb-1">How Score is Calculated</p>
                      {recentSummary.isValid === false ? (
                        <p className="text-xs text-brand-dark/70">
                          <span className="font-medium text-red-600">Did Not Finish (DNF):</span> Not all required hits were achieved. A run is valid only when all targets receive their required number of hits.
                        </p>
                      ) : totalGoalShots > 0 ? (
                        <>
                          <p className="text-xs text-brand-dark/70 mb-2">
                            Score = time (in seconds) of the last required hit. <span className="font-medium">Lower is better.</span>
                          </p>
                          <div className="text-[10px] text-brand-dark/50 border-t border-gray-100 pt-2 space-y-1">
                            <p><span className="font-medium">Single target:</span> Score = timestamp of the Nth hit (relative to start)</p>
                            <p><span className="font-medium">Multi-target:</span> Score = timestamp when all targets reach their goal shots</p>
                            <p className="text-brand-dark/40 italic">No averages or partial credit — all goals must be met.</p>
                          </div>
                        </>
                      ) : (
                        <>
                          <p className="text-xs text-brand-dark/70 mb-2">
                            Score = time from first hit to last hit. <span className="font-medium">Lower is better.</span>
                          </p>
                          <div className="text-[10px] text-brand-dark/50 border-t border-gray-100 pt-2 space-y-1">
                            <p><span className="font-medium">No goals set:</span> Score measures total run time (first shot to last shot)</p>
                            <p className="text-brand-dark/40 italic">Set goal shots per target for completion-based scoring.</p>
                          </div>
                        </>
                      )}
                    </PopoverContent>
                  </Popover>
                </div>
                <p className={`font-heading text-2xl ${
                  recentSummary.isValid === false
                    ? 'text-red-500'
                    : 'text-brand-primary'
                }`}>
                  {recentSummary.isValid === false
                    ? 'DNF'
                    : typeof recentSummary.score === 'number' && Number.isFinite(recentSummary.score)
                      ? `${recentSummary.score.toFixed(2)}s`
                      : '—'}
                </p>
              </div>
            </div>
          </TooltipProvider>
          <Separator />
          <div className="space-y-2">
            <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
              <div className="flex items-start gap-2 rounded-md border border-gray-200 bg-gray-50 px-3 py-2">
                <div className="rounded-md bg-white p-2 text-brand-primary shadow-sm">
                  <Building2 className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-brand-dark/60">Room</p>
                  <p className="font-medium text-brand-dark">{summaryRoomLabel ?? 'No room selected'}</p>
                </div>
              </div>
              <div className="flex items-start gap-2 rounded-md border border-gray-200 bg-gray-50 px-3 py-2">
                <div className="rounded-md bg-white p-2 text-brand-primary shadow-sm">
                  <Crosshair className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-brand-dark/60">Targets</p>
                  <p className="font-medium text-brand-dark">{recentSummary.targets.length} staged</p>
                </div>
              </div>
              <div className="flex items-start gap-2 rounded-md border border-gray-200 bg-gray-50 px-3 py-2">
                <div className="rounded-md bg-white p-2 text-brand-primary shadow-sm">
                  <Clock3 className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-brand-dark/60">Duration</p>
                  <p className="font-medium text-brand-dark">{summaryDurationLabel}</p>
                </div>
              </div>
            </div>
            {recentSummary.presetId && (
              <div className="flex items-start gap-2 rounded-md border border-gray-200 bg-gray-50 px-3 py-2">
                <div className="rounded-md bg-white p-2 text-brand-primary shadow-sm">
                  <Bookmark className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-brand-dark/60">Preset</p>
                  <Badge variant="outline" className="text-xs font-mono">
                    {recentSummary.presetId}
                  </Badge>
                </div>
              </div>
            )}
            {displayTargets.length === 0 ? (
              <div className="rounded-md border border-dashed border-gray-200 bg-white px-3 py-2 text-sm text-brand-dark/60">
                No targets recorded.
              </div>
            ) : (
              <div className="rounded-md border border-gray-200 bg-white px-3 py-2">
                <p className="text-xs font-medium uppercase tracking-wide text-brand-dark/60">Target list</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {displayTargets.map((target) => {
                    const displayName = getDisplayName(target.deviceId, target.deviceName);
                    return (
                      <span
                        key={target.deviceId}
                        className="inline-flex items-center rounded-full border border-brand-secondary/30 bg-gray-50 px-3 py-1 text-xs font-medium text-brand-dark"
                        title={displayName !== target.deviceName ? `Original: ${target.deviceName}` : undefined}
                      >
                        {displayName}
                      </span>
                    );
                  })}
                  {extraTargetCount > 0 && (
                    <span className="inline-flex items-center rounded-full border border-dashed border-brand-secondary/40 bg-gray-50 px-3 py-1 text-xs font-medium text-brand-dark/60">
                      +{extraTargetCount} more target{extraTargetCount === 1 ? '' : 's'}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
          <Separator />
          <div className="space-y-2">
            <p className="text-[11px] uppercase tracking-wide text-brand-dark/60">Top Targets</p>
            {topResults.length === 0 ? (
              <p className="text-sm text-brand-dark/60">No target activity captured for this session.</p>
            ) : (
              <div className="space-y-1.5">
                {topResults.map((result) => {
                  const goalShots = recentSummary.historyEntry.goalShotsPerTarget?.[result.deviceId];
                  const hasGoal = typeof goalShots === 'number' && goalShots > 0;
                  const goalReached = hasGoal && (result.hitCount ?? 0) >= goalShots;
                  const actualHits = result.hitCount ?? 0;
                  const displayName = getDisplayName(result.deviceId, result.deviceName);
                  return (
                    <div
                      key={result.deviceId}
                      className={`flex items-center justify-between rounded-lg border px-2 py-1.5 ${
                        goalReached
                          ? 'border-green-300 bg-green-50/50'
                          : 'border-brand-secondary/20 bg-white/80'
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <span 
                          className="font-medium text-brand-dark block truncate"
                          title={displayName !== result.deviceName ? `Original: ${result.deviceName}` : undefined}
                        >
                          {displayName}
                        </span>
                        {hasGoal && (
                          <span className="text-[10px] text-brand-dark/60">
                            Goal: {goalShots} shots
                          </span>
                        )}
                      </div>
                      <div className="text-right ml-2">
                        {hasGoal ? (
                          <>
                            <span className={`font-heading text-lg ${goalReached ? 'text-green-600' : 'text-brand-primary'}`}>
                              {actualHits} / {goalShots}
                            </span>
                            <span className="block text-[10px] text-brand-dark/60">
                              hits
                            </span>
                          </>
                        ) : (
                          <>
                            <span className="font-heading text-lg text-brand-primary">
                              {actualHits}
                            </span>
                            <span className="block text-[10px] text-brand-dark/60">
                              hits
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          {/* Performance Breakdown - Per-target and transition statistics */}
          {(perTargetStats.some(s => s.splitCount > 0) || transitionStats.length > 0) && (
            <>
              <Separator />
              <div className="space-y-3">
                <p className="text-[11px] uppercase tracking-wide text-brand-dark/60">Performance Breakdown</p>
                
                {/* Per-Target Split Statistics */}
                {perTargetStats.some(s => s.splitCount > 0) && (
                  <div className="rounded-md border border-gray-200 bg-gray-50/50 p-2">
                    <p className="text-[10px] uppercase tracking-wide text-brand-dark/50 mb-2">
                      {isMultiTarget ? 'Per-Target Split Statistics' : 'Split Statistics'}
                    </p>
                    <div className="space-y-1.5">
                      {perTargetStats.filter(s => s.splitCount > 0).map((stat) => (
                        <div 
                          key={stat.deviceId}
                          className="flex items-center justify-between text-xs bg-white rounded px-2 py-1.5 border border-gray-100"
                        >
                          <div className="flex-1 min-w-0">
                            {isMultiTarget && (
                              <span className="font-medium text-brand-dark truncate block">{stat.deviceName}</span>
                            )}
                            <span className="text-[10px] text-brand-dark/60">
                              {stat.hitCount} hits, {stat.splitCount} split{stat.splitCount !== 1 ? 's' : ''}
                            </span>
                          </div>
                          <div className="text-right ml-2 flex-shrink-0">
                            <div className="text-brand-primary font-medium">
                              avg {stat.avgSplit !== null ? `${stat.avgSplit.toFixed(2)}s` : '—'}
                            </div>
                            {stat.fastestSplit !== null && (
                              <div className="text-[10px] text-green-600">
                                fastest {stat.fastestSplit.toFixed(2)}s
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Transition Statistics (multi-target only) */}
                {isMultiTarget && transitionStats.length > 0 && (
                  <div className="rounded-md border border-gray-200 bg-gray-50/50 p-2">
                    <p className="text-[10px] uppercase tracking-wide text-brand-dark/50 mb-2">Transition Statistics</p>
                    <div className="space-y-1.5">
                      {transitionStats.map((stat) => (
                        <div 
                          key={stat.key}
                          className="flex items-center justify-between text-xs bg-white rounded px-2 py-1.5 border border-gray-100"
                        >
                          <div className="flex items-center gap-1.5 flex-1 min-w-0">
                            <span className="font-medium text-brand-dark truncate">{stat.fromName}</span>
                            <ArrowRight className="h-3 w-3 text-brand-secondary flex-shrink-0" />
                            <span className="font-medium text-brand-dark truncate">{stat.toName}</span>
                          </div>
                          <div className="text-right ml-2 flex-shrink-0">
                            <div className="text-brand-secondary font-medium">
                              avg {stat.avgTime.toFixed(2)}s
                            </div>
                            <div className="text-[10px] text-brand-dark/60">
                              {stat.count} transition{stat.count !== 1 ? 's' : ''}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
          {recentSplits.length > 0 && (
            <>
              <Separator />
              <div className="space-y-2">
                <div className="flex items-center justify-between text-[11px] uppercase tracking-wide text-brand-dark/60">
                  <div className="flex items-center gap-1">
                    <span>Recent Splits</span>
                    <Popover>
                      <PopoverTrigger asChild>
                        <button 
                          type="button" 
                          className="inline-flex items-center justify-center rounded-full hover:bg-brand-dark/10 p-0.5 -m-0.5 transition-colors"
                          aria-label="Info about Splits"
                        >
                          <Info className="h-3 w-3 text-brand-dark/40" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent 
                        side="bottom" 
                        align="start"
                        className="w-80 bg-white border border-gray-200 shadow-lg p-3"
                      >
                        <p className="text-xs font-medium text-brand-dark mb-1">What is a Split?</p>
                        <p className="text-xs text-brand-dark/70 mb-2">
                          {isMultiTarget 
                            ? 'Split = time between consecutive hits on the same target. Measures recoil management and trigger control.'
                            : 'Split = time between consecutive shots. Measures recoil management and trigger control.'}
                        </p>
                        <div className="text-[10px] text-brand-dark/50 border-t border-gray-100 pt-2 space-y-1">
                          <p><span className="font-medium">Formula:</span> Split = timestamp of shot N − timestamp of shot N-1</p>
                          {isMultiTarget && (
                            <p><span className="font-medium">Note:</span> Splits are calculated per-target, ignoring hits on other targets in between.</p>
                          )}
                          <p className="italic">Example: Shots at 0.82s, 1.05s → Split = 0.23s</p>
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>
                  <span className="text-brand-primary text-[10px] font-semibold">
                    {isMultiTarget ? 'Target • Split # • Time' : 'Split # • Time'}
                  </span>
                </div>
                  <div className="space-y-1">
                    {recentSplits.map((split) => {
                      const displayName = getDisplayName(split.deviceId, split.deviceName);
                      // Count splits per device to show proper split number per target
                      const splitsForDevice = recentSummary.splits?.filter(s => s.deviceId === split.deviceId) ?? [];
                      const splitIndexForDevice = splitsForDevice.findIndex(s => s.splitNumber === split.splitNumber) + 1;
                      
                      return (
                        <div
                          key={`${split.deviceId}-${split.splitNumber}`}
                          className="flex items-center justify-between rounded-lg border border-brand-primary/20 bg-brand-primary/5 px-2 py-1.5 text-xs text-brand-dark"
                        >
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            {isMultiTarget && (
                              <>
                                <span 
                                  className="font-medium text-brand-dark truncate" 
                                  title={displayName !== split.deviceName ? `Original: ${split.deviceName}` : undefined}
                                >
                                  {displayName}
                                </span>
                                <span className="text-brand-dark/60">•</span>
                              </>
                            )}
                            <span className="font-medium text-brand-dark">
                              Split #{isMultiTarget ? splitIndexForDevice : split.splitNumber}
                            </span>
                          </div>
                          <span className="font-heading text-sm text-brand-primary ml-2">{split.time.toFixed(2)}s</span>
                        </div>
                      );
                    })}
                </div>
              </div>
            </>
          )}
          {isMultiTarget && recentTransitions.length > 0 && (
            <>
              <Separator />
              <div className="space-y-2">
                <div className="flex items-center justify-between text-[11px] uppercase tracking-wide text-brand-dark/60">
                  <div className="flex items-center gap-1">
                    <span>Recent Transitions</span>
                    <Popover>
                      <PopoverTrigger asChild>
                        <button 
                          type="button" 
                          className="inline-flex items-center justify-center rounded-full hover:bg-brand-dark/10 p-0.5 -m-0.5 transition-colors"
                          aria-label="Info about Transitions"
                        >
                          <Info className="h-3 w-3 text-brand-dark/40" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent 
                        side="bottom" 
                        align="start"
                        className="w-80 bg-white border border-gray-200 shadow-lg p-3"
                      >
                        <p className="text-xs font-medium text-brand-dark mb-1">What is a Transition?</p>
                        <p className="text-xs text-brand-dark/70 mb-2">
                          Transition = time to switch between different targets. Measures target acquisition speed.
                        </p>
                        <div className="text-[10px] text-brand-dark/50 border-t border-gray-100 pt-2 space-y-1">
                          <p><span className="font-medium">Formula:</span> Transition = timestamp of hit on new target − timestamp of last hit on previous target</p>
                          <p className="italic">Example: Target A at 1.20s, Target B at 1.55s → A→B transition = 0.35s</p>
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>
                  <span className="text-brand-secondary text-[10px] font-semibold">From → To • Time</span>
                </div>
                <div className="space-y-1">
                  {recentTransitions.map((transition) => {
                    const fromName = getDisplayName(transition.fromDevice, transition.fromDevice);
                    const toName = getDisplayName(transition.toDevice, transition.toDevice);
                    return (
                      <div
                        key={`${transition.fromDevice}-${transition.toDevice}-${transition.transitionNumber}`}
                        className="flex items-center justify-between rounded-lg border border-brand-secondary/20 bg-brand-secondary/5 px-2 py-1.5 text-xs text-brand-dark"
                      >
                        <div className="flex items-center gap-1.5 flex-1 min-w-0">
                          <span className="font-medium text-brand-dark truncate">{fromName}</span>
                          <ArrowRight className="h-3 w-3 text-brand-secondary flex-shrink-0" />
                          <span className="font-medium text-brand-dark truncate">{toName}</span>
                        </div>
                        <span className="font-heading text-sm text-brand-secondary ml-2">{transition.time.toFixed(2)}s</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
          <Separator />
          <div className="flex flex-col gap-1.5 sm:flex-row sm:justify-end">
            <Button
              variant="default"
              onClick={onCreateNew}
              disabled={actionsDisabled || !onCreateNew}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              <PlusCircle className="h-4 w-4" />
              Create new setup
            </Button>
            <Button
              variant="default"
              onClick={onUsePrevious}
              disabled={actionsDisabled || !onUsePrevious}
              className="bg-green-600 hover:bg-green-700 text-white sm:min-w-[180px]"
            >
              <RotateCcw className="h-4 w-4" />
              Use previous settings
            </Button>
          </div>
          {actionsDisabled && (onUsePrevious || onCreateNew) && (
            <p className="text-[11px] text-brand-dark/60 text-right">
              Stop the active session to adjust setups.
            </p>
          )}
        </CardContent>
      </Card>
    );
  }

  return null;
};

// Placeholder while live session data boots.
export const LiveSessionCardSkeleton: React.FC = () => (
  <Card className="bg-white border-gray-200 shadow-sm rounded-md md:rounded-lg">
    <CardContent className="p-4 md:p-5 space-y-5">
      <div className="rounded-2xl bg-gradient-to-r from-brand-primary/10 to-brand-secondary/10 px-5 py-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-4 w-36 bg-gray-200" />
          <Skeleton className="h-6 w-40 bg-gray-200" />
          <Skeleton className="h-3 w-48 bg-gray-200" />
        </div>
        <Skeleton className="h-6 w-20 bg-gray-200 rounded-full" />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-xl bg-gray-50 px-4 py-3 shadow-inner space-y-2">
          <Skeleton className="h-3 w-32 bg-gray-200" />
          <Skeleton className="h-8 w-36 bg-gray-200" />
          <Skeleton className="h-3 w-28 bg-gray-200" />
        </div>
        <div className="rounded-xl bg-gray-50 px-4 py-3 shadow-inner space-y-2">
          <Skeleton className="h-3 w-32 bg-gray-200" />
          <Skeleton className="h-8 w-24 bg-gray-200" />
        </div>
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Skeleton className="h-3 w-36 bg-gray-200" />
          <Skeleton className="h-3 w-24 bg-gray-200" />
        </div>
        <div className="space-y-2 max-h-48">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-3 py-2 shadow-sm"
            >
              <div className="space-y-1">
                <Skeleton className="h-4 w-32 bg-gray-200" />
                <Skeleton className="h-3 w-40 bg-gray-200" />
              </div>
              <Skeleton className="h-6 w-16 bg-gray-200 rounded-full" />
            </div>
          ))}
        </div>
      </div>
      <Separator />
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Skeleton className="h-3 w-32 bg-gray-200" />
          <Skeleton className="h-3 w-24 bg-gray-200" />
        </div>
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              key={index}
              className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-3 py-2"
            >
              <Skeleton className="h-4 w-32 bg-gray-200" />
              <Skeleton className="h-4 w-16 bg-gray-200" />
            </div>
          ))}
        </div>
      </div>
      <Separator />
      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
        <Skeleton className="h-9 w-full sm:w-40 rounded-md bg-gray-200" />
        <Skeleton className="h-10 w-full sm:w-48 rounded-md bg-gray-200" />
      </div>
      <Skeleton className="h-3 w-52 bg-gray-200 self-end" />
    </CardContent>
  </Card>
);
