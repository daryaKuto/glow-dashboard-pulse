import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import type { NormalizedGameDevice } from '@/hooks/useGameDevices';
import { formatSessionDuration } from '@/components/game-session/sessionState';
import type { LiveSessionSummary } from './types';

interface LiveSessionCardProps {
  isRunning: boolean;
  timerSeconds: number;
  activeTargets: NormalizedGameDevice[];
  activeHits: number;
  hitCounts: Record<string, number>;
  recentSummary: LiveSessionSummary | null;
}

// Displays either the current live telemetry view or the most recent session summary snapshot.
export const LiveSessionCard: React.FC<LiveSessionCardProps> = ({
  isRunning,
  timerSeconds,
  activeTargets,
  activeHits,
  hitCounts,
  recentSummary,
}) => {
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
                  console.debug('[LiveSessionCard] Tracking target', { deviceId: target.deviceId, hits });
                  return (
                    <div
                      key={target.deviceId}
                      className="flex items-center justify-between rounded-xl border border-gray-100 bg-white px-3 py-2 shadow-sm"
                    >
                      <div>
                        <p className="font-medium text-brand-dark leading-tight">{target.name ?? target.deviceId}</p>
                        <p className="text-[11px] text-brand-dark/60">Live hits updating</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[11px] text-brand-dark/60 uppercase tracking-wide">Hits</p>
                        <p className="font-heading text-xl text-brand-primary">{hits}</p>
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

  if (recentSummary) {
    console.debug('[LiveSessionCard] Rendering last session summary', { gameId: recentSummary.gameId });
    const topResults = [...(recentSummary.historyEntry.deviceResults ?? [])]
      .sort((a, b) => (b.hitCount ?? 0) - (a.hitCount ?? 0))
      .slice(0, 3);
    const recentSplits = (recentSummary.splits ?? []).slice(0, 4);

    return (
      <Card className="rounded-md md:rounded-lg border border-brand-primary/20 bg-gradient-to-br from-white via-brand-primary/5 to-brand-secondary/10 shadow-lg">
        <CardContent className="p-4 md:p-5 space-y-5">
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
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-xl border border-brand-secondary/30 bg-white/80 px-4 py-3 shadow-sm">
              <p className="text-[10px] uppercase tracking-wide text-brand-dark/60">Total Hits</p>
              <p className="font-heading text-2xl text-brand-primary">{recentSummary.totalHits}</p>
            </div>
            <div className="rounded-xl border border-brand-secondary/30 bg-white/80 px-4 py-3 shadow-sm">
              <p className="text-[10px] uppercase tracking-wide text-brand-dark/60">Avg Split</p>
              <p className="font-heading text-2xl text-brand-primary">
                {recentSummary.averageHitInterval > 0 ? `${recentSummary.averageHitInterval.toFixed(2)}s` : '—'}
              </p>
            </div>
            <div className="rounded-xl border border-brand-secondary/30 bg-white/80 px-4 py-3 shadow-sm">
              <p className="text-[10px] uppercase tracking-wide text-brand-dark/60">Efficiency Score</p>
              <p className="font-heading text-2xl text-brand-primary">
                {recentSummary.efficiencyScore > 0 ? recentSummary.efficiencyScore.toFixed(2) : '—'}
              </p>
            </div>
            <div className="rounded-xl border border-brand-secondary/30 bg-white/80 px-4 py-3 shadow-sm sm:col-span-3">
              <p className="text-[10px] uppercase tracking-wide text-brand-dark/60">Game ID</p>
              <p className="font-heading text-base text-brand-dark truncate max-w-[200px]" title={recentSummary.gameId}>
                {recentSummary.gameId}
              </p>
            </div>
          </div>
          <Separator />
          <div className="space-y-3">
            <p className="text-[11px] uppercase tracking-wide text-brand-dark/60">Top Targets</p>
            {topResults.length === 0 ? (
              <p className="text-sm text-brand-dark/60">No target activity captured for this session.</p>
            ) : (
              <div className="space-y-2">
                {topResults.map((result) => (
                  <div
                    key={result.deviceId}
                    className="flex items-center justify-between rounded-lg border border-brand-secondary/20 bg-white/80 px-3 py-2"
                  >
                    <span className="font-medium text-brand-dark">{result.deviceName}</span>
                    <span className="font-heading text-lg text-brand-primary">{result.hitCount}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          {recentSplits.length > 0 && (
            <>
              <Separator />
              <div className="space-y-3">
                <div className="flex items-center justify-between text-[11px] uppercase tracking-wide text-brand-dark/60">
                  <span>Recent Splits</span>
                  <span className="text-brand-primary text-[10px] font-semibold">Hit number + Time Split</span>
                </div>
                <div className="space-y-1.5">
                  {recentSplits.map((split) => (
                    <div
                      key={`${split.deviceId}-${split.splitNumber}`}
                      className="flex items-center justify-between rounded-lg border border-brand-primary/20 bg-brand-primary/5 px-3 py-2 text-xs text-brand-dark"
                    >
                      <span className="font-medium text-brand-dark">Hit #{split.splitNumber}</span>
                      <span className="font-heading text-sm text-brand-primary">{split.time.toFixed(2)}s</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-white border-gray-200 shadow-sm rounded-md md:rounded-lg">
      <CardContent className="p-4 md:p-5 text-sm text-brand-dark/60">
        Launch a live session to capture real-time stats and view the summary here.
      </CardContent>
    </Card>
  );
};

// Placeholder while live session data boots.
export const LiveSessionCardSkeleton: React.FC = () => (
  <Card className="bg-white border-gray-200 shadow-sm rounded-md md:rounded-lg">
    <CardContent className="p-4 md:p-5 space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-5 w-32 bg-gray-200" />
        <Skeleton className="h-6 w-16 bg-gray-200" />
      </div>
      <div className="rounded-lg border border-gray-100 bg-gray-50 px-4 py-8 text-center space-y-3">
        <Skeleton className="mx-auto h-10 w-10 rounded-full bg-gray-200" />
        <Skeleton className="mx-auto h-4 w-20 bg-gray-200" />
        <Skeleton className="mx-auto h-10 w-40 bg-gray-200" />
      </div>
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="flex items-center justify-between">
            <Skeleton className="h-3 w-28 bg-gray-200" />
            <Skeleton className="h-3 w-16 bg-gray-200" />
          </div>
        ))}
      </div>
    </CardContent>
  </Card>
);
