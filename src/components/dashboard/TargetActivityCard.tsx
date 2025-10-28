import React, { useMemo } from 'react';
import dayjs from 'dayjs';
import { Target as TargetIcon, Trophy, Zap, Flame, Target, ShieldCheck } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatScoreValue } from '@/utils/dashboard';
import type { Session } from '@/store/useSessions';

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
  const tb = session.thingsboardData ?? null;

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
    if (Array.isArray(tb.targetStats)) {
      tb.targetStats.forEach(pushStat);
    } else if (Array.isArray(tb.deviceResults)) {
      tb.deviceResults.forEach(pushStat);
    } else if (Array.isArray(tb.devices)) {
      tb.devices.forEach(pushStat);
    }
  }

  const rawSensor = session.rawSensorData ?? null;
  if (rawSensor && Array.isArray(rawSensor.devices)) {
    rawSensor.devices.forEach(pushStat);
  }

  return stats;
};

export const buildRangeSummaries = (sessions: Session[]): Record<TimeRange, RangeSummary> => {
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
    const rangeUpperBound = hasEntries ? entries[entries.length - 1].ts : now;
    const earliestTs = hasEntries ? entries[0].ts : rangeUpperBound;
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
    const scoreValues = filteredSessions
      .map((session) => (Number.isFinite(session.score) ? session.score ?? 0 : null))
      .filter((value): value is number => value !== null);

    const averageScore =
      scoreValues.length > 0
        ? Number((scoreValues.reduce((sum, value) => sum + value, 0) / scoreValues.length).toFixed(2))
        : null;
    const bestScore = scoreValues.length > 0 ? Math.max(...scoreValues) : null;

    const targetBuckets: TargetBucket[] = bucketDeviceMaps.map((bucketMap, index) => ({
      label: buckets[index].label,
      devices: Array.from(bucketMap.values()).sort((a, b) => b.hits - a.hits),
    }));

    const targetTotals: TargetStat[] = Array.from(totalTargetMap.values()).sort((a, b) => b.hits - a.hits);

    summaries[range] = {
      chartData: buckets.map((bucket) => ({ label: bucket.label, hits: bucket.hits })),
      averageScore,
      bestScore,
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
      <div className="space-y-4">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-32 mb-2" />
          <div className="h-4 bg-gray-200 rounded w-16" />
        </div>
        <div className="flex items-end justify-between gap-2 h-32">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="flex-1 bg-gray-200 animate-pulse rounded-t-lg h-16" />
          ))}
        </div>
      </div>
    );
  }

  const maxHits = Math.max(...activityBuckets.map((d) => d.metric), 1);
  const nextTier = STREAK_TIERS.find((tier) => currentStreakLength < tier.threshold) ?? STREAK_TIERS[STREAK_TIERS.length - 1];
  const averageScoreDisplay = formatScoreValue(summary?.averageScore ?? null);
  const bestScoreDisplay = formatScoreValue(summary?.bestScore ?? null);
  const totalShotsDisplay = summary ? summary.totalShots.toLocaleString() : '—';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-primary/10 text-brand-primary">
            <TargetIcon className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-medium text-brand-dark">Target Activity</h3>
            <p className="text-[11px] text-brand-dark/60">Supabase session telemetry</p>
          </div>
        </div>
        <Badge className="bg-brand-primary/10 text-brand-primary border-brand-primary/20">
          {summary?.sessionCount ?? 0} sessions
        </Badge>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {[
          {
            label: 'Average Score',
            value: averageScoreDisplay,
            icon: <Trophy className="h-4 w-4" />,
            bg: 'from-brand-primary/10 via-white to-brand-primary/5',
          },
          {
            label: 'Best Score',
            value: bestScoreDisplay,
            icon: <Zap className="h-4 w-4" />,
            bg: 'from-emerald-500/10 via-white to-emerald-500/5',
          },
          {
            label: 'Shots Fired',
            value: totalShotsDisplay,
            icon: <TargetIcon className="h-4 w-4" />,
            bg: 'from-brand-secondary/10 via-white to-brand-secondary/5',
          },
        ].map((metric) => (
          <div
            key={metric.label}
            className={`rounded-lg border border-white/40 bg-gradient-to-br ${metric.bg} px-3 py-2 flex flex-col gap-1`}
          >
            <div className="flex items-center justify-between text-[11px] text-brand-dark/60">
              <span>{metric.label}</span>
              <span className="text-brand-primary/80">{metric.icon}</span>
            </div>
            <p className="text-sm font-heading text-brand-dark">{metric.value}</p>
          </div>
        ))}
      </div>

      <div className="pt-4 border-t border-gray-200">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-medium text-brand-dark">
            {activeRange === 'day' && '24-Hour Hit Activity'}
            {activeRange === 'week' && '7-Day Hit Trend'}
            {activeRange === 'month' && '30-Day Activity'}
            {activeRange === 'all' && 'All-Time Activity'}
          </h4>
          <div className="flex space-x-1">
            {availableRanges.map((range) => (
              <Button
                key={range}
                variant={activeRange === range ? 'default' : 'ghost'}
                size="sm"
                onClick={() => onRangeChange(range)}
                className="text-xs px-2 py-1 h-7"
              >
                {range === 'day' && 'Day'}
                {range === 'week' && 'Week'}
                {range === 'month' && 'Month'}
                {range === 'all' && 'All'}
              </Button>
            ))}
          </div>
        </div>
        {hasData ? (
          <>
            <div className="flex items-end justify-between gap-2 h-20">
              {activityBuckets.map((item, index) => {
                const isLatest = index === activityBuckets.length - 1;
                const barHeight = (item.metric / maxHits) * 100;
                return (
                  <div key={`${item.label}-${index}`} className="flex flex-col items-center gap-2 flex-1">
                    <div className="flex-1 flex items-end w-full">
                      <div
                        className={`w-full rounded-t-lg transition-all duration-300 ${
                          isLatest ? 'bg-brand-primary' : 'bg-brand-secondary/30 hover:bg-brand-secondary/50'
                        }`}
                        style={{
                          height: `${Math.max(6, barHeight)}%`,
                          minHeight: '4px',
                        }}
                        title={
                          activeRange === 'day'
                            ? `${item.label}: ${item.incrementalHits ?? item.hits} hits this hour · ${item.metric} cumulative`
                            : `${item.label}: ${item.hits} hits`
                        }
                      />
                    </div>
                    <span className="text-xs text-brand-dark/50 font-body">{item.label}</span>
                  </div>
                );
              })}
            </div>
            <div className="mt-4 rounded-lg border border-brand-primary/20 bg-brand-primary/5 p-3 space-y-3">
              <div className="text-center space-y-1">
                <p className="text-xs uppercase tracking-wide text-brand-primary/80 font-semibold">Don't break your streak</p>
                <p className="text-sm text-brand-dark">
                  {currentStreakLength > 0
                    ? `You're on a ${currentStreakLength}-day streak. Keep it going!`
                    : 'Play today to start your streak.'}
                </p>
              </div>
              <div className="rounded-lg border p-2.5 bg-white flex flex-wrap items-center gap-2 justify-between">
                {(() => {
                  const Icon = nextTier.Icon;
                  const daysRemaining = Math.max(nextTier.threshold - Math.min(currentStreakLength, nextTier.threshold), 0);
                  const achieved = daysRemaining === 0;
                  return (
                    <>
                      <div className="flex items-center gap-2">
                        <div className={`rounded-full p-2.5 ${achieved ? 'bg-green-100 text-green-700' : 'bg-brand-secondary/10 text-brand-secondary'}`}>
                          <Icon className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-brand-dark">{nextTier.label}</p>
                          <p className="text-xs text-brand-dark/60">{nextTier.description}</p>
                        </div>
                      </div>
                      <p className="text-xs font-medium text-brand-primary text-left sm:text-right ml-auto">
                        {achieved ? 'Milestone achieved — keep it rolling!' : `${daysRemaining} day${daysRemaining === 1 ? '' : 's'} until unlock`}
                      </p>
                    </>
                  );
                })()}
              </div>
            </div>
          </>
        ) : (
          <div className="rounded-lg border border-dashed border-brand-secondary/40 bg-brand-secondary/5 px-4 py-6 text-center text-sm text-brand-dark/60">
            No Supabase sessions found for this range.
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
  <Card className="bg-white border-gray-200 shadow-sm rounded-md md:rounded-lg h-full">
    <CardHeader className="pb-1 md:pb-3 p-2 md:p-4">
      <CardTitle className="text-xs md:text-base lg:text-lg font-heading text-brand-dark">Target Activity</CardTitle>
    </CardHeader>
    <CardContent className="p-2 md:p-4">
      {showSkeleton ? (
        <div className="space-y-4 animate-pulse">
          <div className="flex items-center justify-between">
            <div className="h-4 w-28 bg-gray-200 rounded" />
            <div className="h-6 w-20 bg-gray-200 rounded" />
          </div>
          <div className="grid grid-cols-3 gap-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="rounded-lg border border-gray-200 bg-white/70 px-3 py-2 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="h-3 w-12 bg-gray-200 rounded" />
                  <div className="h-4 w-8 bg-gray-200 rounded" />
                </div>
                <div className="h-4 w-16 bg-gray-200 rounded" />
              </div>
            ))}
          </div>
          <div className="space-y-3 pt-2 border-t border-gray-100">
            <div className="flex items-end justify-between gap-2 h-20">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="flex flex-col items-center gap-2 flex-1">
                  <div className="flex-1 flex items-end w-full">
                    <div className="w-full rounded-t-lg bg-gray-200" style={{ height: `${10 + i * 5}%` }} />
                  </div>
                  <div className="h-3 w-8 bg-gray-200 rounded" />
                </div>
              ))}
            </div>
            <div className="rounded-lg border border-gray-200 bg-white/80 p-3 space-y-2">
              <div className="h-3 w-32 bg-gray-200 rounded mx-auto" />
              <div className="rounded-lg border border-gray-200 bg-white p-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-full bg-gray-200" />
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
