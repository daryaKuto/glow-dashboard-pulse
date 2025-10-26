import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { Target as TargetIcon, Users, Calendar, Bell, Clock, Zap, Trophy, TrendingUp, Activity, Play, User, X, Gamepad2, BarChart, Award, CheckCircle, Flame, Target, ShieldCheck } from 'lucide-react';
import { useStats } from '@/store/useStats';
import { useTargets } from '@/store/useTargets';
import { useRooms } from '@/store/useRooms';
import { useScenarios, type ScenarioHistory } from '@/store/useScenarios';
import { useSessions, type Session } from '@/store/useSessions';
import { useAuth } from '@/providers/AuthProvider';
import Header from '@/components/shared/Header';
import Sidebar from '@/components/shared/Sidebar';
import MobileDrawer from '@/components/shared/MobileDrawer';
import { useIsMobile } from '@/hooks/use-mobile';
import { useInitialSync } from '@/hooks/useInitialSync';
import type { TargetsSummary } from '@/lib/edge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import dayjs from 'dayjs';

// Modern Stat Card Component
const StatCard: React.FC<{
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  trend?: { value: number; isPositive: boolean };
  isLoading?: boolean;
}> = ({ title, value, subtitle, icon, trend, isLoading = false }) => (
  <Card className="bg-white border-gray-200 shadow-sm hover:shadow-md transition-shadow rounded-md md:rounded-lg">
    <CardContent className="p-2 md:p-4">
      <div className="flex items-start gap-2">
        <div className="flex-1 space-y-0.5 md:space-y-1 text-center md:text-left">
          <p className="text-xs font-medium text-brand-dark/70 font-body">{title}</p>
          {isLoading ? (
            <div className="h-4 md:h-6 w-10 md:w-14 bg-gray-200 rounded animate-pulse mx-auto md:mx-0"></div>
          ) : (
            <p className="text-sm md:text-xl lg:text-2xl font-bold text-brand-dark font-heading">{value}</p>
          )}
          {subtitle && (
            <p className="text-xs text-brand-dark/50 font-body">{subtitle}</p>
          )}
        </div>
        <div className="flex-shrink-0 p-1 md:p-2 bg-brand-secondary/10 rounded-sm md:rounded-lg">
          <div className="text-brand-primary w-3 h-3 md:w-5 md:h-5">
            {icon}
          </div>
        </div>
      </div>
      {trend && !isLoading && (
        <div className="mt-1 md:mt-3 flex items-center gap-1 md:gap-2">
          <div className={`flex items-center gap-0.5 md:gap-1 text-xs ${trend.isPositive ? 'text-green-600' : 'text-red-600'}`}>
            <TrendingUp className={`w-2.5 h-2.5 md:w-4 md:h-4 ${!trend.isPositive && 'rotate-180'}`} />
            <span>{trend.value}%</span>
          </div>
          <span className="text-xs text-brand-dark/50 font-body">vs last week</span>
        </div>
      )}
    </CardContent>
  </Card>
);

const formatScoreValue = (value: number | null | undefined): string => {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return 'N/A';
  }
  return value % 1 === 0 ? value.toString() : value.toFixed(2);
};

const formatDurationValue = (durationMs: number | null | undefined): string => {
  if (durationMs === null || durationMs === undefined || Number.isNaN(durationMs)) {
    return '—';
  }
  const totalSeconds = Math.max(0, Math.round(durationMs / 1000));
  if (totalSeconds < 60) {
    return `${totalSeconds}s`;
  }
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
};

type TimeRange = 'day' | 'week' | 'month' | 'all';

type RangeSummary = {
  chartData: Array<{ label: string; hits: number }>;
  averageScore: number | null;
  bestScore: number | null;
  totalShots: number;
  sessionCount: number;
};

const RANGE_ORDER: TimeRange[] = ['day', 'week', 'month', 'all'];

const RANGE_CONFIG: Record<TimeRange, { windowMs: number | null; bucketMs: number; bucketCount: number; label: string }> = {
  day: { windowMs: 24 * 60 * 60 * 1000, bucketMs: 60 * 60 * 1000, bucketCount: 24, label: 'ha' },
  week: { windowMs: 7 * 24 * 60 * 60 * 1000, bucketMs: 24 * 60 * 60 * 1000, bucketCount: 7, label: 'ddd' },
  month: { windowMs: 30 * 24 * 60 * 60 * 1000, bucketMs: 24 * 60 * 60 * 1000, bucketCount: 30, label: 'MMM D' },
  all: { windowMs: null, bucketMs: 30 * 24 * 60 * 60 * 1000, bucketCount: 18, label: 'MMM YY' },
};

const buildRangeSummaries = (sessions: Session[]): Record<TimeRange, RangeSummary> => {
  const now = Date.now();
  const summaries: Record<TimeRange, RangeSummary> = {} as Record<TimeRange, RangeSummary>;

  RANGE_ORDER.forEach((range) => {
    const config = RANGE_CONFIG[range];
    const windowStart =
      config.windowMs === null
        ? (() => {
            const earliest = sessions.reduce<number | null>((min, session) => {
              const ts = Date.parse(session.startedAt);
              if (Number.isNaN(ts)) return min;
              if (min === null || ts < min) {
                return ts;
              }
              return min;
            }, null);
            return earliest ?? now - config.bucketMs * config.bucketCount;
          })()
        : now - config.windowMs;

    const filteredSessions = sessions.filter((session) => {
      const ts = Date.parse(session.startedAt);
      if (Number.isNaN(ts)) return false;
      if (config.windowMs === null) {
        return ts <= now;
      }
      return ts >= windowStart && ts <= now;
    });

    const bucketStart = config.windowMs === null ? windowStart : windowStart;
    const buckets: Array<{ start: number; label: string; hits: number }> = [];
    for (let i = 0; i < config.bucketCount; i += 1) {
      const start = bucketStart + i * config.bucketMs;
      const label = dayjs(start).format(config.label);
      buckets.push({ start, label, hits: 0 });
    }

    filteredSessions.forEach((session) => {
      const ts = Date.parse(session.startedAt);
      if (Number.isNaN(ts)) {
        return;
      }
      const index = Math.min(
        buckets.length - 1,
        Math.max(0, Math.floor((ts - bucketStart) / config.bucketMs)),
      );
      buckets[index].hits += Number.isFinite(session.hitCount) ? session.hitCount : 0;
    });

    const totalShots = filteredSessions.reduce(
      (sum, session) => sum + (Number.isFinite(session.hitCount) ? (session.hitCount ?? 0) : 0),
      0,
    );
    const scoreValues = filteredSessions
      .map((session) => (Number.isFinite(session.score) ? session.score ?? 0 : null))
      .filter((value): value is number => value !== null);

    const averageScore =
      scoreValues.length > 0
        ? Number((scoreValues.reduce((sum, value) => sum + value, 0) / scoreValues.length).toFixed(2))
        : null;
    const bestScore =
      scoreValues.length > 0 ? Math.max(...scoreValues) : null;

    summaries[range] = {
      chartData: buckets.map((bucket) => ({ label: bucket.label, hits: bucket.hits })),
      averageScore,
      bestScore,
      totalShots,
      sessionCount: filteredSessions.length,
    };
  });

  return summaries;
};

// Activity Chart Component - Supabase-powered Target Activity
const STREAK_TIERS = [
  { label: '3 Day Spark', threshold: 3, Icon: Flame, description: 'Keep the momentum alive.' },
  { label: '7 Day Groove', threshold: 7, Icon: Target, description: 'One week of laser focus.' },
  { label: '30 Day Legend', threshold: 30, Icon: ShieldCheck, description: 'Elite performance unlocked.' },
];

const ActivityChart: React.FC<{
  summaries: Record<TimeRange, RangeSummary>;
  availableRanges: TimeRange[];
  activeRange: TimeRange;
  onRangeChange: (range: TimeRange) => void;
  isLoading: boolean;
  currentStreakLength: number;
}> = ({
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
          ? 2
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
          <div className="h-6 bg-gray-200 rounded w-32 mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-16"></div>
        </div>
        <div className="flex items-end justify-between gap-2 h-32">
          {[...Array(7)].map((_, i) => (
            <div key={i} className="flex-1 bg-gray-200 animate-pulse rounded-t-lg h-16"></div>
          ))}
        </div>
      </div>
    );
  }

  // Calculate real activity metrics
  
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
                          isLatest
                            ? 'bg-brand-primary'
                            : 'bg-brand-secondary/30 hover:bg-brand-secondary/50'
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

// Progress Ring Component
const ProgressRing: React.FC<{
  percentage: number;
  label: string;
  value: number;
  color: string;
  size?: number;
}> = ({ percentage, label, value, color, size = 80 }) => {
  const radius = (size - 8) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div className="flex flex-col items-center space-y-2">
      <div className="relative">
        <svg width={size} height={size} className="transform -rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="#f3f4f6"
            strokeWidth="6"
            fill="transparent"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={color}
            strokeWidth="6"
            fill="transparent"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            className="transition-all duration-500 ease-in-out"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-lg font-bold text-brand-dark">{value}</span>
        </div>
      </div>
      <span className="text-xs text-brand-dark/70 font-body text-center whitespace-pre-line">{label}</span>
    </div>
  );
};

// Coming Soon Card Component
const ComingSoonCard: React.FC<{
  type: string;
  title: string;
  description: string;
  onDismiss: () => void;
}> = ({ type, title, description, onDismiss }) => {
  const getIcon = () => {
    switch (type) {
      case 'training': return <Gamepad2 className="h-5 w-5" />;
      case 'multiplayer': return <Users className="h-5 w-5" />;
      case 'analytics': return <BarChart className="h-5 w-5" />;
      case 'tournaments': return <Award className="h-5 w-5" />;
      default: return <Play className="h-5 w-5" />;
    }
  };

  const getBadgeColor = () => {
    switch (type) {
      case 'training': return 'bg-brand-primary';
      case 'multiplayer': return 'bg-green-600';
      case 'analytics': return 'bg-blue-600';
      case 'tournaments': return 'bg-purple-600';
      default: return 'bg-brand-primary';
    }
  };

  return (
    <Card className="bg-white border-gray-200 shadow-sm relative overflow-hidden min-w-[300px] md:min-w-[350px] rounded-md md:rounded-lg">
      <div className="absolute inset-0 bg-black/5 z-10">
        <div className="absolute top-4 md:top-6 left-0 right-0 bg-brand-primary text-white py-2 font-display font-semibold text-sm text-center shadow-lg">
          Coming Soon
        </div>
      </div>
      <button
        onClick={onDismiss}
        className="absolute top-2 right-2 z-20 p-1 rounded-full bg-white/80 hover:bg-white transition-colors"
      >
        <X className="h-4 w-4 text-gray-600" />
      </button>
      <CardHeader className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="p-2 bg-brand-secondary/10 rounded-sm md:rounded-lg">
            {getIcon()}
          </div>
          <Badge className={`${getBadgeColor()} text-white rounded-sm md:rounded`}>
            {type.charAt(0).toUpperCase() + type.slice(1)}
          </Badge>
        </div>
        <CardTitle className="text-lg font-heading text-brand-dark">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-brand-dark/70 font-body">
          {description}
        </p>
        
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-brand-dark">Progress</span>
            <span className="text-sm font-bold text-brand-dark">0%</span>
          </div>
          <Progress value={0} className="h-2" />
        </div>

        <Button 
          className="w-full bg-brand-secondary hover:bg-brand-primary text-white font-body rounded-sm md:rounded"
          disabled
        >
          Coming Soon
        </Button>
      </CardContent>
    </Card>
  );
};

const SESSION_HISTORY_LIMIT = 250;

const Dashboard: React.FC = () => {
  const location = useLocation();
  const isMobile = useIsMobile();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const [dismissedCards, setDismissedCards] = useState<string[]>([]);
  const [targetsLoading, setTargetsLoading] = useState(false);
  const isFetchingRef = useRef(false);
  const lastFetchTimeRef = useRef(0);
  const telemetryFetchedRef = useRef(false);
  const telemetryInitializedRef = useRef(false);
  const FETCH_DEBOUNCE_MS = 2000; // 2 seconds debounce
  
  // Real data from stores
  const { 
    metrics,
    activeTargets, 
    roomsCreated, 
    pendingInvites, 
    isLoading: statsLoading, 
    fetchStats
  } = useStats();
  
  const { targets: rawTargets, fetchTargetsFromEdge, fetchTargetDetails } = useTargets();
  const { rooms, fetchRooms } = useRooms();
  const { scenarioHistory, isLoading: scenariosLoading, fetchScenarios } = useScenarios();
  const { sessions, isLoading: sessionsLoading, fetchSessions } = useSessions();
  
  const { user, session, loading: authLoading } = useAuth();

  // Initial sync with ThingsBoard (only on dashboard)
  const { syncStatus, isReady } = useInitialSync();

  // Fetch merged targets with room assignments and telemetry
  const fetchMergedTargets = useCallback(async () => {
    setTargetsLoading(true);
    try {
      const targets = await fetchTargetsFromEdge(true);
      if (targets.length > 0) {
        const deviceIds = targets.map((target) => target.id);
        try {
          await fetchTargetDetails(deviceIds, {
            includeHistory: false,
            telemetryKeys: ['hit_ts', 'hits', 'event'],
            recentWindowMs: 5 * 60 * 1000,
          });
        } catch (detailError) {
          console.error('[Dashboard] Failed to hydrate target details', detailError);
        }
      }
    } catch (error) {
      console.error('[Dashboard] Error fetching edge targets', error);
    } finally {
      setTargetsLoading(false);
    }
  }, [fetchTargetsFromEdge, fetchTargetDetails]);

  const summary: TargetsSummary | null = metrics?.summary ?? null;
  const summaryLoading = statsLoading && !summary;
  const summaryReady = useMemo(() => {
    if (summaryLoading) {
      return false;
    }
    if (summary) {
      return true;
    }
    return rawTargets.length > 0;
  }, [summary, summaryLoading, rawTargets.length]);
  const summaryPending = summaryLoading || (statsLoading && !summaryReady);
  const shouldShowSkeleton = summaryPending || sessionsLoading || targetsLoading;
  const telemetryLoading = targetsLoading && rawTargets.length === 0;

  const telemetryEnabled = summaryReady;
  const currentTargets = rawTargets;

  const refreshAllData = useCallback(async () => {
    try {
      const refreshPromises: Array<Promise<unknown>> = [
        fetchStats({ force: true }),
        fetchMergedTargets(),
        fetchScenarios(),
        fetchRooms(),
      ];

      if (user?.id) {
        refreshPromises.push(fetchSessions(user.id, { includeFullHistory: true, limit: SESSION_HISTORY_LIMIT }));
      }

      await Promise.all(refreshPromises);
    } catch (error) {
      console.error('[Dashboard] Failed to refresh dashboard data', error);
    }
  }, [fetchStats, fetchMergedTargets, fetchScenarios, fetchRooms, fetchSessions, user?.id]);

  useEffect(() => {
    if (authLoading || !user?.id) {
      return;
    }

    refreshAllData();
  }, [authLoading, user?.id, refreshAllData]);

  // Smart polling system with heartbeat detection - optimized for parallel execution
  const fetchAllData = useCallback(async () => {
    if (!telemetryEnabled) {
      return;
    }

    if (isFetchingRef.current) {
      return;
    }

    const now = Date.now();
    if (now - lastFetchTimeRef.current < FETCH_DEBOUNCE_MS) {
      return;
    }
    lastFetchTimeRef.current = now;

    isFetchingRef.current = true;
    try {
      const metricsPromise = fetchStats({ force: true });
      const sessionsPromise = user?.id
        ? fetchSessions(user.id, { limit: SESSION_HISTORY_LIMIT })
        : Promise.resolve();

      await Promise.all([
        metricsPromise,
        Promise.allSettled([fetchMergedTargets()]),
        Promise.allSettled([fetchScenarios()]),
        sessionsPromise,
      ]);
    } catch (error) {
      console.error('[Dashboard] Error fetching data', error);
    } finally {
      isFetchingRef.current = false;
    }
  }, [telemetryEnabled, fetchStats, fetchScenarios, fetchMergedTargets, fetchSessions, user?.id]);

  const stats = useMemo(() => {
    const usingDetailedTargets = currentTargets.length > 0;
    const totalTargetsValue = usingDetailedTargets
      ? currentTargets.length
      : summary?.totalTargets ?? 0;
    const onlineTargetsValue = usingDetailedTargets
      ? currentTargets.filter((target) => target.status === 'online' || target.status === 'standby').length
      : summary?.onlineTargets ?? 0;
    const totalRoomsValue = rooms.length > 0 ? rooms.length : summary?.totalRooms ?? 0;

    const recentScenarios = sessions.slice(0, 3);
    const avgScoreValue =
      recentScenarios.length > 0
        ? Number(
            (
              recentScenarios.reduce(
                (sum, session) => sum + (Number.isFinite(session.score) ? session.score ?? 0 : 0),
                0,
              ) / recentScenarios.length
            ).toFixed(2),
          )
        : 0;

    return {
      onlineTargets: onlineTargetsValue,
      totalTargets: totalTargetsValue,
      avgScore: avgScoreValue,
      totalRooms: totalRoomsValue,
    };
  }, [currentTargets, rooms.length, sessions, summary]);

  const { onlineTargets, totalTargets, avgScore, totalRooms } = stats;
  
  // Calculate recentScenarios for use in JSX (moved from useMemo for easier access)
  const recentScenarios = sessions.slice(0, 3);
  const completedSessionsCount = useMemo(
    () => sessions.filter((session) => (session.score ?? 0) > 0).length,
    [sessions],
  );
  const totalSessionsCount = sessions.length;

  const earliestSessionTimestamp = useMemo(() => {
    return sessions.reduce<number | null>((min, session) => {
      const ts = Date.parse(session.startedAt);
      if (Number.isNaN(ts)) {
        return min;
      }
      if (min === null || ts < min) {
        return ts;
      }
      return min;
    }, null);
  }, [sessions]);

  const rangeSummaries = useMemo(() => buildRangeSummaries(sessions), [sessions]);

  const currentStreakLength = useMemo(() => {
    if (sessions.length === 0) {
      return 0;
    }

    const uniqueDays = Array.from(
      new Set(
        sessions
          .map((session) => dayjs(session.startedAt).startOf('day'))
          .filter((day) => day.isValid())
          .map((day) => day.valueOf()),
      ),
    ).sort((a, b) => b - a);

    if (uniqueDays.length === 0) {
      return 0;
    }

    const today = dayjs().startOf('day');
    const firstDay = dayjs(uniqueDays[0]);

    if (today.diff(firstDay, 'day') > 1) {
      return 0;
    }

    let streak = 1;
    let previousDay = firstDay;

    for (let i = 1; i < uniqueDays.length; i += 1) {
      const currentDay = dayjs(uniqueDays[i]);
      const diff = previousDay.diff(currentDay, 'day');
      if (diff === 1) {
        streak += 1;
        previousDay = currentDay;
      } else {
        break;
      }
    }

    return streak;
  }, [sessions]);

  const availableRanges = useMemo(() => {
    const coverage = earliestSessionTimestamp
      ? Date.now() - earliestSessionTimestamp
      : 0;
    const ranges = RANGE_ORDER.filter((range) => {
      const summary = rangeSummaries[range];
      if (!summary || summary.sessionCount === 0) {
        return false;
      }
      if (range === 'day') {
        return true;
      }
      const windowMs = RANGE_CONFIG[range].windowMs;
      if (windowMs === null) {
        return true;
      }
      return coverage >= windowMs;
    });
    return ranges.length > 0 ? ranges : ['day'];
  }, [rangeSummaries, earliestSessionTimestamp]);

  const [activeRange, setActiveRange] = useState<TimeRange>(availableRanges[0] ?? 'day');

  useEffect(() => {
    if (!availableRanges.includes(activeRange)) {
      setActiveRange(availableRanges[0]);
    }
  }, [availableRanges, activeRange]);

  const sessionScores = useMemo(
    () =>
      sessions
        .map((session) => session.score)
        .filter((score): score is number => typeof score === 'number' && Number.isFinite(score)),
    [sessions],
  );

  const averageScoreMetric = sessionScores.length > 0
    ? Number(
        (sessionScores.reduce((sum, score) => sum + score, 0) / sessionScores.length).toFixed(2),
      )
    : null;

  const bestScoreMetric = sessionScores.length > 0
    ? Math.max(...sessionScores)
    : null;

  // Note: Authentication is handled at the route level in App.tsx
  // If we reach this component, the user is already authenticated
  
  // Banner removed - no longer showing ThingsBoard connection status

  return (
    <div className="min-h-screen flex flex-col bg-brand-light responsive-container">
      <Header onMenuClick={() => setIsMobileMenuOpen(true)} />
      <div className="flex flex-1 no-overflow">
        {!isMobile && <Sidebar />}
        <MobileDrawer 
          isOpen={isMobileMenuOpen} 
          onClose={() => setIsMobileMenuOpen(false)} 
        />
        
        <main className="flex-1 overflow-y-auto responsive-container">
          <div className="w-full px-4 py-2 md:p-4 lg:p-6 md:max-w-7xl md:mx-auto space-y-2 md:space-y-4 lg:space-y-6 responsive-transition h-full">
            
            
            {/* Progressive Enhancement Indicators */}
            {!isReady && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-sm text-blue-800 font-medium">Loading real-time data...</span>
                </div>
                <p className="text-xs text-blue-600 mt-1">
                  Connecting to ThingsBoard for live shooting activity and session data
                </p>
              </div>
            )}
           

            {/* Stats Cards Grid - Using Real Data */}
            <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-2 md:gap-4">
              {shouldShowSkeleton ? (
                // Skeleton loading for stats cards
                [...Array(4)].map((_, i) => (
                  <div key={i} className="bg-white rounded-lg p-4 md:p-6 shadow-sm border border-gray-200 animate-pulse">
                    <div className="flex items-center justify-between mb-2">
                      <div className="h-4 w-4 bg-gray-200 rounded"></div>
                      <div className="h-6 w-16 bg-gray-200 rounded"></div>
                    </div>
                    <div className="h-8 w-20 bg-gray-200 rounded mb-1"></div>
                    <div className="h-3 w-24 bg-gray-200 rounded"></div>
                  </div>
                ))
              ) : (
                <>
                  <StatCard
                    title="Total Registered Targets"
                    value={summaryReady ? totalTargets : '—'}
                    subtitle={summaryReady ? `${onlineTargets} online` : ''}
                    icon={<TargetIcon className="w-6 h-6 -ml-1.5 md:ml-0" />}
                    isLoading={summaryPending || !summaryReady}
                  />
                  <StatCard
                    title="Total Rooms"
                    value={summaryReady ? totalRooms : '—'}
                    subtitle={summaryReady ? 'Configured spaces' : ''}
                    icon={<Activity className="w-6 h-6 -ml-1.5 md:ml-0" />}
                    isLoading={summaryPending || !summaryReady}
                  />
                  <StatCard
                    title="Average Score"
                    value={summaryReady ? formatScoreValue(avgScore) : '—'}
                    subtitle={summaryReady ? 'Recent sessions' : ''}
                    icon={<Trophy className="w-6 h-6 -ml-1.5 md:ml-0" />}
                    isLoading={sessionsLoading}
                  />
                  <StatCard
                    title="Completed Sessions"
                    value={
                      sessionsLoading && completedSessionsCount === 0
                        ? '—'
                        : completedSessionsCount
                    }
                    subtitle={
                      totalSessionsCount > 0
                        ? 'Keep the streak going!'
                        : 'No sessions yet'
                    }
                    icon={<CheckCircle className="w-6 h-6 -ml-1.5 md:ml-0" />}
                    isLoading={sessionsLoading}
                  />
                </>
              )}
            </div>
            

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 md:gap-4 lg:gap-5">
              
              {/* Activity Chart - Real Target Activity */}
              <Card className="bg-white border-gray-200 shadow-sm rounded-md md:rounded-lg">
                <CardHeader className="pb-1 md:pb-3 p-2 md:p-4">
                  <CardTitle className="text-xs md:text-base lg:text-lg font-heading text-brand-dark">Target Activity</CardTitle>
                </CardHeader>
                <CardContent className="p-2 md:p-4">
                  {(targetsLoading && currentTargets.length === 0) ? (
                    <div className="space-y-4 animate-pulse">
                      <div className="flex items-center justify-between">
                        <div className="h-4 w-28 bg-gray-200 rounded"></div>
                        <div className="h-6 w-20 bg-gray-200 rounded"></div>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        {[...Array(3)].map((_, i) => (
                          <div key={i} className="rounded-lg border border-gray-200 bg-white/70 px-3 py-2 space-y-2">
                            <div className="flex items-center justify-between">
                              <div className="h-3 w-12 bg-gray-200 rounded"></div>
                              <div className="h-4 w-8 bg-gray-200 rounded"></div>
                            </div>
                            <div className="h-4 w-16 bg-gray-200 rounded"></div>
                          </div>
                        ))}
                      </div>
                      <div className="space-y-3 pt-2 border-t border-gray-100">
                        <div className="flex items-end justify-between gap-2 h-20">
                          {[...Array(8)].map((_, i) => (
                            <div key={i} className="flex flex-col items-center gap-2 flex-1">
                              <div className="flex-1 flex items-end w-full">
                                <div className="w-full rounded-t-lg bg-gray-200" style={{ height: `${10 + i * 5}%` }}></div>
                              </div>
                              <div className="h-3 w-8 bg-gray-200 rounded"></div>
                            </div>
                          ))}
                        </div>
                        <div className="rounded-lg border border-gray-200 bg-white/80 p-3 space-y-2">
                          <div className="h-3 w-32 bg-gray-200 rounded mx-auto"></div>
                          <div className="rounded-lg border border-gray-200 bg-white p-2 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className="w-10 h-10 rounded-full bg-gray-200"></div>
                              <div className="space-y-1">
                                <div className="h-3 w-16 bg-gray-200 rounded"></div>
                                <div className="h-3 w-20 bg-gray-200 rounded"></div>
                              </div>
                            </div>
                            <div className="h-3 w-14 bg-gray-200 rounded"></div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                  <ActivityChart 
                    summaries={rangeSummaries}
                    availableRanges={availableRanges}
                    activeRange={activeRange}
                    onRangeChange={setActiveRange}
                    isLoading={telemetryLoading || sessionsLoading}
                    currentStreakLength={currentStreakLength}
                  />
                  )}
                </CardContent>
              </Card>

              {/* Recent Sessions */}
              <Card className="bg-white border-gray-200 shadow-sm rounded-md md:rounded-lg">
                <CardHeader className="pb-1 md:pb-3 p-2 md:p-4">
                  {shouldShowSkeleton ? (
                    <div className="animate-pulse flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-gray-200"></div>
                        <div className="space-y-2">
                          <div className="h-4 w-24 bg-gray-200 rounded"></div>
                          <div className="h-3 w-32 bg-gray-200 rounded"></div>
                        </div>
                      </div>
                      <div className="h-6 w-16 bg-gray-200 rounded"></div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-primary/10 text-brand-primary">
                          <Gamepad2 className="h-4 w-4" />
                        </div>
                        <div>
                          <CardTitle className="text-xs md:text-base lg:text-lg font-heading text-brand-dark">
                            Recent Sessions
                          </CardTitle>
                          <p className="text-[11px] text-brand-dark/60">Latest games synced from Supabase</p>
                        </div>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        className="text-brand-secondary hover:text-brand-primary text-xs h-6 px-2 rounded-sm md:rounded"
                        onClick={() => window.location.href = '/dashboard/scenarios'}
                      >
                        View All
                      </Button>
                    </div>
                  )}
                </CardHeader>
                <CardContent className="p-2 md:p-4">
                  {shouldShowSkeleton ? (
                    <div className="space-y-2 md:space-y-3 animate-pulse">
                      {[...Array(3)].map((_, i) => (
                        <div key={i} className="border border-gray-200 rounded-sm md:rounded-lg bg-gradient-to-r from-gray-50 to-gray-100 p-3 md:p-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="h-8 w-8 rounded-full bg-gray-200"></div>
                              <div className="space-y-1">
                                <div className="h-3 w-24 bg-gray-200 rounded"></div>
                                <div className="h-4 w-32 bg-gray-200 rounded"></div>
                              </div>
                            </div>
                            <div className="h-5 w-16 bg-gray-200 rounded-full"></div>
                          </div>
                          <div className="grid grid-cols-3 gap-2 text-xs">
                            {[...Array(3)].map((_, statIndex) => (
                              <div key={statIndex} className="rounded-md bg-white/70 px-2 py-2 border border-white/60 space-y-2">
                                <div className="h-2 w-12 bg-gray-200 rounded"></div>
                                <div className="h-4 w-10 bg-gray-200 rounded"></div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : recentScenarios.length > 0 ? (
                    <div className="space-y-2 md:space-y-3">
                      {recentScenarios.map((session) => {
                        const isCompleted = Number.isFinite(session.score) && (session.score ?? 0) > 0;
                        const accent = isCompleted ? 'from-emerald-500/15 to-teal-500/10' : 'from-brand-secondary/20 to-brand-primary/10';
                        const iconBg = isCompleted ? 'bg-emerald-500/20 text-emerald-600' : 'bg-brand-secondary/20 text-brand-secondary';
                        const icon = isCompleted ? <Trophy className="h-4 w-4" /> : <Clock className="h-4 w-4" />;

                        return (
                          <Card
                            key={session.id}
                            className={`border border-transparent bg-gradient-to-r ${accent} rounded-sm md:rounded-lg shadow-sm`}
                          >
                            <CardContent className="p-3 md:p-4 space-y-2">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <div className={`flex h-8 w-8 items-center justify-center rounded-full ${iconBg}`}>
                                    {icon}
                                  </div>
                                  <div>
                                    <p className="text-[11px] font-medium text-brand-dark/60">
                                      {dayjs(session.startedAt).format('MMM D, HH:mm')}
                                    </p>
                                    <h4 className="font-heading text-sm text-brand-dark">
                                      {session.gameName || session.scenarioName || 'Custom Game'}
                                    </h4>
                                  </div>
                                </div>
                                <Badge
                                  className={`text-[10px] md:text-xs border-none ${
                                    isCompleted ? 'bg-emerald-500 text-white' : 'bg-amber-500 text-white'
                                  }`}
                                >
                                  {isCompleted ? 'Completed' : 'In Progress'}
                                </Badge>
                              </div>
                              <div className="grid grid-cols-3 gap-2 text-[11px] md:text-xs text-brand-dark/70">
                                <div className="rounded-md bg-white/50 px-2 py-1 border border-white/40">
                                  <p className="uppercase tracking-wide text-[10px] text-brand-dark/50">Score</p>
                                  <p className="font-heading text-sm text-brand-dark">
                                    {Number.isFinite(session.score) ? formatScoreValue(session.score) : 'N/A'}
                                  </p>
                                </div>
                                <div className="rounded-md bg-white/50 px-2 py-1 border border-white/40">
                                  <p className="uppercase tracking-wide text-[10px] text-brand-dark/50">Hits</p>
                                  <p className="font-heading text-sm text-brand-dark">
                                    {Number.isFinite(session.hitCount) ? session.hitCount : '—'}
                                  </p>
                                </div>
                                <div className="rounded-md bg-white/50 px-2 py-1 border border-white/40 text-right">
                                  <p className="uppercase tracking-wide text-[10px] text-brand-dark/50">Duration</p>
                                  <p className="font-heading text-sm text-brand-dark">
                                    {formatDurationValue(session.duration)}
                                  </p>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-4">
                      <p className="text-xs text-brand-dark/70 font-body mb-3">No sessions yet</p>
                      <Button 
                        className="bg-brand-secondary hover:bg-brand-primary text-white font-body"
                        onClick={() => window.location.href = '/dashboard/scenarios'}
                      >
                        Start Training
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Coming Soon Features - Dismissible Stack */}
            <div className="space-y-4">
              <h3 className="text-lg font-heading text-brand-dark">Upcoming Features</h3>
              <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-thin scrollbar-thumb-brand-secondary scrollbar-track-gray-100">
                {[
                  { type: 'training', title: 'Precision Shooting Course', description: 'Structured training programs with progressive difficulty levels. Master precision shooting with guided lessons and skill assessments.' },
                  { type: 'multiplayer', title: 'Play with Friends', description: 'Challenge friends to shooting competitions and team training sessions. Create private rooms and compete in real-time leaderboards.' },
                  { type: 'analytics', title: 'Advanced Analytics', description: 'Deep dive into your performance with detailed analytics, heat maps, and improvement suggestions powered by AI.' },
                  { type: 'tournaments', title: 'Global Tournaments', description: 'Compete in worldwide tournaments, climb leaderboards, and earn rewards. Join seasonal events and special challenges.' }
                ].filter(card => !dismissedCards.includes(card.type)).map((card) => (
                  <ComingSoonCard
                    key={card.type}
                    type={card.type}
                    title={card.title}
                    description={card.description}
                    onDismiss={() => setDismissedCards(prev => [...prev, card.type])}
                  />
                ))}
                {dismissedCards.length === 4 && (
                  <div className="min-w-[300px] md:min-w-[350px] flex items-center justify-center">
                    <div className="text-center p-8">
                      <p className="text-brand-dark/70 font-body mb-4">All upcoming features dismissed</p>
                      <Button 
                        variant="outline" 
                        onClick={() => setDismissedCards([])}
                        className="border-brand-secondary text-brand-secondary hover:bg-brand-secondary hover:text-white rounded-sm md:rounded"
                      >
                        Show All Again
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>

          </div>
        </main>
      </div>
    </div>
  );
};

export default Dashboard;
