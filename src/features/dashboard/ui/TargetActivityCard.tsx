import React, { useMemo } from 'react';
import dayjs from 'dayjs';
import { Target as TargetIcon, Flame, Target, ShieldCheck } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { formatScoreValue } from '@/utils/dashboard';
import type { DashboardSession as Session } from '@/features/dashboard';
import type { GameHistory } from '@/features/games/lib/device-game-flow';

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

export type TimeRange = 'day' | 'week' | 'month' | 'all';

type TargetStat = {
  deviceId: string;
  deviceName: string;
  hits: number;
};

type TargetBucket = {
  label: string;
  devices: TargetStat[];
};

export type RangeSummary = {
  chartData: Array<{ label: string; hits: number }>;
  averageScore: number | null;
  bestScore: number | null;
  avgSplit: number | null;
  totalShots: number;
  sessionCount: number;
  targetBuckets: TargetBucket[];
  targetTotals: TargetStat[];
};

export const RANGE_ORDER: TimeRange[] = ['day', 'week', 'month', 'all'];

export const RANGE_CONFIG: Record<
  TimeRange,
  { windowMs: number | null; bucketMs: number; bucketCount: number; label: string }
> = {
  day: { windowMs: 24 * 60 * 60 * 1000, bucketMs: 60 * 60 * 1000, bucketCount: 24, label: 'ha' },
  week: { windowMs: 7 * 24 * 60 * 60 * 1000, bucketMs: 24 * 60 * 60 * 1000, bucketCount: 7, label: 'ddd' },
  month: { windowMs: 30 * 24 * 60 * 60 * 1000, bucketMs: 24 * 60 * 60 * 1000, bucketCount: 30, label: 'MMM D' },
  all: { windowMs: null, bucketMs: 30 * 24 * 60 * 60 * 1000, bucketCount: 18, label: 'MMM YY' },
};

const extractTargetStats = (session: Session): TargetStat[] => {
  const stats: TargetStat[] = [];
  const tb = (session.thingsboardData ?? null) as Record<string, unknown> | null;

  const pushStat = (input: any) => {
    if (!input) return;
    const hitsRaw = input.hitCount ?? input.hits ?? input.totalHits ?? input.count ?? 0;
    const hits = typeof hitsRaw === 'number' && Number.isFinite(hitsRaw) ? hitsRaw : 0;
    if (hits <= 0) return;
    const deviceId = String(input.deviceId ?? input.id ?? input.deviceName ?? 'unknown');
    const deviceName = typeof input.deviceName === 'string' && input.deviceName.trim().length > 0
      ? input.deviceName
      : (typeof input.name === 'string' ? input.name : deviceId);
    stats.push({ deviceId, deviceName, hits });
  };

  if (tb) {
    if (Array.isArray((tb as any).targetStats)) {
      (tb as any).targetStats.forEach((item: any) => pushStat(item));
    } else if (Array.isArray((tb as any).deviceResults)) {
      (tb as any).deviceResults.forEach((item: any) => pushStat(item));
    } else if (Array.isArray((tb as any).devices)) {
      (tb as any).devices.forEach((item: any) => pushStat(item));
    }
  }

  return stats;
};

export const buildRangeSummaries = (sessions: Session[], gameHistories?: GameHistory[]): Record<TimeRange, RangeSummary> => {
  const now = Date.now();
  const summaries: Record<TimeRange, RangeSummary> = {} as Record<TimeRange, RangeSummary>;
  const entries = sessions
    .map((session) => {
      const ts = Date.parse(session.startedAt);
      if (Number.isNaN(ts)) {
        return null;
      }
      return { session, ts };
    })
    .filter((entry): entry is { session: Session; ts: number } => entry !== null)
    .sort((a, b) => a.ts - b.ts);

  RANGE_ORDER.forEach((range) => {
    const config = RANGE_CONFIG[range];
    const hasEntries = entries.length > 0;
    const earliestTs = hasEntries ? entries[0].ts : now;
    // Always anchor to now so "Day" = last 24h, "Week" = last 7 days, etc.
    // Using the latest session timestamp caused stale sessions to appear under "today".
    const rangeUpperBound = now;
    const windowStartBase =
      config.windowMs === null ? earliestTs : rangeUpperBound - config.windowMs;

    const bucketEnd = (() => {
      if (!hasEntries) {
        return config.bucketMs >= DAY_MS
          ? dayjs(rangeUpperBound).startOf('day').valueOf()
          : rangeUpperBound;
      }
      if (config.bucketMs >= DAY_MS) {
        return dayjs(rangeUpperBound).startOf('day').valueOf();
      }
      if (config.bucketMs >= HOUR_MS) {
        return dayjs(rangeUpperBound).startOf('hour').valueOf();
      }
      return rangeUpperBound;
    })();

    const alignedBucketStart = bucketEnd - config.bucketMs * (config.bucketCount - 1);
    const bucketRangeEnd = bucketEnd + config.bucketMs;
    const rangeStart =
      config.windowMs === null
        ? Math.min(alignedBucketStart, windowStartBase)
        : Math.max(alignedBucketStart, windowStartBase);
    const filteredEntries = entries.filter(({ ts }) => ts >= rangeStart && ts < bucketRangeEnd);
    const filteredSessions = filteredEntries.map(({ session }) => session);
    const bucketCount = config.bucketCount;

    const buckets: Array<{ start: number; label: string; hits: number }> = [];
    const bucketDeviceMaps: Array<Map<string, TargetStat>> = [];
    for (let i = 0; i < bucketCount; i += 1) {
      const start = alignedBucketStart + i * config.bucketMs;
      const label = dayjs(start).format(config.label);
      buckets.push({ start, label, hits: 0 });
      bucketDeviceMaps.push(new Map());
    }

    const totalTargetMap = new Map<string, TargetStat>();

    filteredSessions.forEach((session) => {
      const ts = Date.parse(session.startedAt);
      if (Number.isNaN(ts)) {
        return;
      }
      const index = Math.min(
        buckets.length - 1,
        Math.max(0, Math.floor((ts - alignedBucketStart) / config.bucketMs)),
      );
      const sessionHits = Number.isFinite(session.hitCount) ? session.hitCount : 0;
      buckets[index].hits += sessionHits;

      const targetStats = extractTargetStats(session);
      if (targetStats.length > 0) {
        const bucketMap = bucketDeviceMaps[index];
        targetStats.forEach((stat) => {
          const existingBucket = bucketMap.get(stat.deviceId) ?? { ...stat, hits: 0 };
          existingBucket.hits += stat.hits;
          bucketMap.set(stat.deviceId, existingBucket);

          const existingTotal = totalTargetMap.get(stat.deviceId) ?? { ...stat, hits: 0 };
          existingTotal.hits += stat.hits;
          totalTargetMap.set(stat.deviceId, existingTotal);
        });
      }
    });

    const totalShots = filteredSessions.reduce(
      (sum, session) => sum + (Number.isFinite(session.hitCount) ? session.hitCount ?? 0 : 0),
      0,
    );
    // Only include completed sessions (score > 0). Score=0 means DNF.
    const scoreValues = filteredSessions
      .map((session) => (typeof session.score === 'number' && Number.isFinite(session.score) && session.score > 0 ? session.score : null))
      .filter((value): value is number => value !== null);

    const averageScore =
      scoreValues.length > 0
        ? Number((scoreValues.reduce((sum, value) => sum + value, 0) / scoreValues.length).toFixed(2))
        : null;
    // For time-based scoring, "best" means the lowest/fastest time
    const bestScore = scoreValues.length > 0 ? Math.min(...scoreValues) : null;

    // Average split — cascading fallback:
    // 1. Splits from game history matching this time range
    // 2. averageHitInterval from game history matching this time range
    // 3. Splits/averageHitInterval from sessions' thingsboardData JSONB (always available)
    // 4. avg_reaction_time_ms from sessions DB column
    const avgSplit = (() => {
      // Try game history first (most accurate source)
      if (gameHistories && gameHistories.length > 0) {
        const filteredHistories = gameHistories.filter((gh) => {
          const ts = gh.startTime;
          return ts >= rangeStart && ts < bucketRangeEnd;
        });

        // 1st: individual split times from game history
        const allSplitTimes: number[] = [];
        for (const gh of filteredHistories) {
          if (gh.splits && gh.splits.length > 0) {
            for (const split of gh.splits) {
              if (typeof split.time === 'number' && Number.isFinite(split.time) && split.time > 0) {
                allSplitTimes.push(split.time);
              }
            }
          }
        }
        if (allSplitTimes.length > 0) {
          const avgSeconds = allSplitTimes.reduce((sum, t) => sum + t, 0) / allSplitTimes.length;
          return Number((avgSeconds * 1000).toFixed(0));
        }

        // 2nd: averageHitInterval from game history (seconds → ms)
        const intervalValues = filteredHistories
          .map((gh) => gh.averageHitInterval)
          .filter((v): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0);
        if (intervalValues.length > 0) {
          const avgSeconds = intervalValues.reduce((sum, v) => sum + v, 0) / intervalValues.length;
          return Number((avgSeconds * 1000).toFixed(0));
        }
      }

      // 3rd: Extract splits or averageHitInterval from sessions' thingsboardData JSONB
      const tbSplitTimes: number[] = [];
      const tbIntervals: number[] = [];
      for (const session of filteredSessions) {
        const tb = session.thingsboardData as Record<string, unknown> | null;
        if (!tb) continue;
        // Check splits array in thingsboardData
        if (Array.isArray(tb.splits)) {
          for (const s of tb.splits) {
            const t = (s as Record<string, unknown>)?.time;
            if (typeof t === 'number' && Number.isFinite(t) && t > 0) {
              tbSplitTimes.push(t); // seconds
            }
          }
        }
        // Check averageHitInterval in thingsboardData
        const ahi = tb.averageHitInterval;
        if (typeof ahi === 'number' && Number.isFinite(ahi) && ahi > 0) {
          tbIntervals.push(ahi); // seconds
        }
      }
      if (tbSplitTimes.length > 0) {
        const avgSeconds = tbSplitTimes.reduce((sum, t) => sum + t, 0) / tbSplitTimes.length;
        return Number((avgSeconds * 1000).toFixed(0));
      }
      if (tbIntervals.length > 0) {
        const avgSeconds = tbIntervals.reduce((sum, v) => sum + v, 0) / tbIntervals.length;
        return Number((avgSeconds * 1000).toFixed(0));
      }

      // 4th: avg_reaction_time_ms from sessions DB column (already in ms)
      const splitValues = filteredSessions
        .map((session) => (typeof session.avgReactionTime === 'number' && Number.isFinite(session.avgReactionTime) && session.avgReactionTime > 0 ? session.avgReactionTime : null))
        .filter((value): value is number => value !== null);
      return splitValues.length > 0
        ? Number((splitValues.reduce((sum, value) => sum + value, 0) / splitValues.length).toFixed(0))
        : null;
    })();

    const targetBuckets: TargetBucket[] = bucketDeviceMaps.map((bucketMap, index) => ({
      label: buckets[index].label,
      devices: Array.from(bucketMap.values()).sort((a, b) => b.hits - a.hits),
    }));

    const targetTotals: TargetStat[] = Array.from(totalTargetMap.values()).sort((a, b) => b.hits - a.hits);

    summaries[range] = {
      chartData: buckets.map((bucket) => ({ label: bucket.label, hits: bucket.hits })),
      averageScore,
      bestScore,
      avgSplit,
      totalShots,
      sessionCount: filteredSessions.length,
      targetBuckets,
      targetTotals,
    };
  });

  return summaries;
};

const STREAK_TIERS = [
  { label: '3 Day Spark', threshold: 3, Icon: Flame, description: 'Keep the momentum alive.' },
  { label: '7 Day Groove', threshold: 7, Icon: Target, description: 'One week of laser focus.' },
  { label: '30 Day Legend', threshold: 30, Icon: ShieldCheck, description: 'Elite performance unlocked.' },
];

type ActivityChartProps = {
  summaries: Record<TimeRange, RangeSummary>;
  availableRanges: TimeRange[];
  activeRange: TimeRange;
  onRangeChange: (range: TimeRange) => void;
  isLoading: boolean;
  currentStreakLength: number;
};

const ActivityChart: React.FC<ActivityChartProps> = ({
  summaries,
  availableRanges,
  activeRange,
  onRangeChange,
  isLoading,
  currentStreakLength,
}) => {
  const summary = summaries[activeRange];
  const chartData = summary?.chartData ?? [];
  const hasData = summary && summary.sessionCount > 0;
  const filteredChartData = useMemo(() => {
    const shouldTrim = activeRange === 'day' || activeRange === 'month' || activeRange === 'all';
    if (!shouldTrim) {
      return chartData;
    }

    const activeIndexes = chartData.reduce<number[]>((indices, bucket, index) => {
      if (bucket.hits > 0) {
        indices.push(index);
      }
      return indices;
    }, []);

    if (activeIndexes.length === 0) {
      const fallbackWindow = activeRange === 'day' ? 8 : 12;
      return chartData.slice(-fallbackWindow);
    }

    const padding =
      activeRange === 'day'
        ? 1
        : activeRange === 'month'
          ? (activeIndexes.length <= 1 ? 0 : 2)
          : 1;

    const firstIndex = Math.max(0, activeIndexes[0] - padding);
    const lastIndex = Math.min(chartData.length - 1, activeIndexes[activeIndexes.length - 1] + padding);
    return chartData.slice(firstIndex, lastIndex + 1);
  }, [chartData, activeRange]);

  const activityBuckets = useMemo(() => {
    if (activeRange !== 'day') {
      return filteredChartData.map((bucket) => ({ ...bucket, metric: bucket.hits }));
    }

    let cumulativeHits = 0;
    return filteredChartData.map((bucket) => {
      cumulativeHits += bucket.hits;
      return {
        ...bucket,
        metric: cumulativeHits,
        incrementalHits: bucket.hits,
      };
    });
  }, [filteredChartData, activeRange]);

  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="flex items-start justify-between">
          <div>
            <div className="h-10 w-20 bg-gray-200 rounded mb-1" />
            <div className="h-3 w-16 bg-gray-200 rounded" />
          </div>
          <div className="h-8 w-40 bg-gray-200 rounded-full" />
        </div>
        <div className="flex items-end gap-1.5 h-36">
          {Array.from({ length: 7 }).map((_, i) => (
            <div
              key={i}
              className="flex-1 bg-gray-200 rounded-t-[8px]"
              style={{ height: `${30 + Math.random() * 60}%` }}
            />
          ))}
        </div>
      </div>
    );
  }

  const maxHits = Math.max(...activityBuckets.map((d) => d.metric), 1);
  const nextTier = STREAK_TIERS.find((tier) => currentStreakLength < tier.threshold) ?? STREAK_TIERS[STREAK_TIERS.length - 1];
  const avgSplitDisplay = summary?.avgSplit != null ? `${(summary.avgSplit / 1000).toFixed(2)}s` : '—';
  const bestScoreDisplay = formatScoreValue(summary?.bestScore ?? null);
  const totalShotsDisplay = summary ? summary.totalShots.toLocaleString() : '—';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TargetIcon className="h-4 w-4 text-brand-primary" />
          <div>
            <h3 className="text-sm font-medium text-brand-dark font-body">Target Activity</h3>
            <p className="text-[11px] text-brand-dark font-body">Session telemetry</p>
          </div>
        </div>
        <span className="text-label text-brand-secondary font-body uppercase tracking-wide">
          {summary?.sessionCount ?? 0} sessions
        </span>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Avg Split', value: avgSplitDisplay },
          { label: 'Best Score', value: bestScoreDisplay },
          { label: 'Shots Fired', value: totalShotsDisplay },
        ].map((metric) => (
          <div key={metric.label} className="rounded-[var(--radius)] bg-brand-primary/5 px-3 py-2 shadow-subtle">
            <span className="text-label text-brand-secondary font-body uppercase tracking-wide block mb-0.5">
              {metric.label}
            </span>
            <p className="text-stat-sm font-bold text-brand-dark font-body tabular-nums">
              {metric.value}
            </p>
          </div>
        ))}
      </div>

      <div className="pt-4 border-t border-[rgba(28,25,43,0.06)]">
        {/* Hero stat + segmented control row */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-stat-lg md:text-stat-hero font-bold text-brand-dark font-body tabular-nums leading-none">
              {summary ? summary.totalShots.toLocaleString() : '—'}
            </p>
            <span className="text-[11px] text-brand-dark font-body mt-0.5 block">
              {activeRange === 'day' && 'Hits today'}
              {activeRange === 'week' && 'Hits this week'}
              {activeRange === 'month' && 'Hits this month'}
              {activeRange === 'all' && 'Total hits'}
            </span>
          </div>
          <div className="bg-brand-light rounded-full p-1 inline-flex">
            {availableRanges.map((range) => (
              <button
                key={range}
                onClick={() => onRangeChange(range)}
                className={cn(
                  'relative px-3 py-1 text-xs font-body font-medium rounded-full transition-all duration-200',
                  activeRange === range
                    ? 'bg-brand-primary text-white'
                    : 'text-brand-dark/60 hover:text-brand-dark'
                )}
              >
                {range === 'day' && 'Day'}
                {range === 'week' && 'Week'}
                {range === 'month' && 'Month'}
                {range === 'all' && 'All'}
              </button>
            ))}
          </div>
        </div>
        {hasData ? (
          <>
            <div className={cn(
              "flex items-end h-36 overflow-hidden",
              activityBuckets.length > 14 ? "gap-0.5" : activityBuckets.length > 8 ? "gap-1" : "gap-1.5 sm:gap-2"
            )}>
              {activityBuckets.map((item, index) => {
                const isLatest = index === activityBuckets.length - 1;
                const barHeight = (item.metric / maxHits) * 100;
                const manyBars = activityBuckets.length > 14;
                // Show every Nth label when there are many bars
                const showLabel = manyBars
                  ? index % Math.ceil(activityBuckets.length / 8) === 0 || isLatest
                  : true;
                return (
                  <div key={`${item.label}-${index}`} className="flex flex-col items-center gap-1 flex-1 min-w-0 h-full">
                    <div className="flex-1 flex items-end w-full min-w-0">
                      <div
                        className={cn(
                          "w-full transition-all duration-300",
                          manyBars ? "rounded-t-[4px]" : "rounded-t-[8px]",
                          isLatest
                            ? 'bg-brand-primary'
                            : 'bg-brand-secondary/20 hover:bg-brand-secondary/35'
                        )}
                        style={{
                          height: `${Math.max(4, barHeight)}%`,
                          minHeight: '4px',
                        }}
                        title={
                          activeRange === 'day'
                            ? `${item.label}: ${item.incrementalHits ?? item.hits} hits this hour · ${item.metric} cumulative`
                            : `${item.label}: ${item.hits} hits`
                        }
                      />
                    </div>
                    {showLabel ? (
                      <span className={cn(
                        "text-brand-dark font-body truncate w-full text-center",
                        manyBars ? "text-[8px]" : "text-[10px]"
                      )}>{item.label}</span>
                    ) : (
                      <span className="h-[10px]" />
                    )}
                  </div>
                );
              })}
            </div>
            <div className="mt-4 rounded-[var(--radius)] bg-brand-primary/5 p-3 space-y-3">
              <div className="text-center space-y-1">
                <p className="text-label text-brand-primary font-body uppercase tracking-wide">Don't break your streak</p>
                <p className="text-sm text-brand-dark font-body">
                  {currentStreakLength > 0
                    ? `You're on a ${currentStreakLength}-day streak. Keep it going!`
                    : 'Play today to start your streak.'}
                </p>
              </div>
              <div className="rounded-[var(--radius)] p-2.5 bg-white shadow-subtle flex flex-wrap items-center gap-2 justify-between">
                {(() => {
                  const Icon = nextTier.Icon;
                  const daysRemaining = Math.max(nextTier.threshold - Math.min(currentStreakLength, nextTier.threshold), 0);
                  const achieved = daysRemaining === 0;
                  return (
                    <>
                      <div className="flex items-center gap-2">
                        <Icon className={`h-5 w-5 ${achieved ? 'text-green-600' : 'text-brand-primary'}`} />
                        <div>
                          <p className="text-sm font-semibold text-brand-dark font-body">{nextTier.label}</p>
                          <p className="text-xs text-brand-dark/60 font-body">{nextTier.description}</p>
                        </div>
                      </div>
                      <p className="text-xs font-medium text-brand-primary font-body text-left sm:text-right ml-auto">
                        {achieved ? 'Milestone achieved — keep it rolling!' : `${daysRemaining} day${daysRemaining === 1 ? '' : 's'} until unlock`}
                      </p>
                    </>
                  );
                })()}
              </div>
            </div>
          </>
        ) : (
          <div className="rounded-[var(--radius)] border border-dashed border-[rgba(28,25,43,0.12)] bg-brand-light px-4 py-6 text-center text-sm text-brand-dark/40 font-body">
            No sessions found for this range.
          </div>
        )}
      </div>
    </div>
  );
};

type TargetActivityCardProps = {
  summaries: Record<TimeRange, RangeSummary>;
  availableRanges: TimeRange[];
  activeRange: TimeRange;
  onRangeChange: (range: TimeRange) => void;
  isLoading: boolean;
  currentStreakLength: number;
  showSkeleton: boolean;
};

const TargetActivityCard: React.FC<TargetActivityCardProps> = ({
  summaries,
  availableRanges,
  activeRange,
  onRangeChange,
  isLoading,
  currentStreakLength,
  showSkeleton,
}) => (
  <Card className="shadow-card h-full bg-gradient-to-br from-white to-brand-primary/[0.03]">
    <CardHeader className="pb-1 md:pb-3 p-5 md:p-6">
      <CardTitle className="text-base font-heading text-brand-dark">Target Activity</CardTitle>
    </CardHeader>
    <CardContent className="p-5 md:p-6 pt-0">
      {showSkeleton ? (
        <div className="space-y-4 animate-pulse">
          <div className="flex items-center justify-between">
            <div className="h-4 w-28 bg-gray-200 rounded" />
            <div className="h-6 w-20 bg-gray-200 rounded" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="rounded-[var(--radius)] bg-white shadow-subtle px-3 py-2 space-y-2">
                <div className="h-3 w-12 bg-gray-200 rounded" />
                <div className="h-5 w-16 bg-gray-200 rounded" />
              </div>
            ))}
          </div>
          <div className="space-y-4 pt-4 border-t border-[rgba(28,25,43,0.06)]">
            <div className="flex items-start justify-between">
              <div>
                <div className="h-10 w-16 bg-gray-200 rounded mb-1" />
                <div className="h-3 w-14 bg-gray-200 rounded" />
              </div>
              <div className="h-7 w-36 bg-gray-200 rounded-full" />
            </div>
            <div className="flex items-end gap-1.5 h-36">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1.5 h-full">
                  <div className="flex-1 flex items-end w-full">
                    <div className="w-full rounded-t-[8px] bg-gray-200" style={{ height: `${15 + i * 8}%` }} />
                  </div>
                  <div className="h-2.5 w-6 bg-gray-200 rounded" />
                </div>
              ))}
            </div>
            <div className="rounded-[var(--radius)] bg-brand-primary/5 p-3 space-y-2">
              <div className="h-3 w-32 bg-gray-200 rounded mx-auto" />
              <div className="rounded-[var(--radius)] bg-white shadow-subtle p-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 bg-gray-200 rounded" />
                  <div className="space-y-1">
                    <div className="h-3 w-16 bg-gray-200 rounded" />
                    <div className="h-3 w-20 bg-gray-200 rounded" />
                  </div>
                </div>
                <div className="h-3 w-14 bg-gray-200 rounded" />
              </div>
            </div>
          </div>
        </div>
      ) : (
        <ActivityChart
          summaries={summaries}
          availableRanges={availableRanges}
          activeRange={activeRange}
          onRangeChange={onRangeChange}
          isLoading={isLoading}
          currentStreakLength={currentStreakLength}
        />
      )}
    </CardContent>
  </Card>
);

export default TargetActivityCard;
