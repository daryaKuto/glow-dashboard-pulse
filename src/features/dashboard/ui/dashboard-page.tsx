import React, { useEffect, useState, useMemo } from 'react';
import { Target as TargetIcon, Users, TrendingUp, Activity, Play, X, BarChart, Award, CheckCircle, Gamepad2, Trophy, Info } from 'lucide-react';
import { useRooms } from '@/features/rooms';
import { useDashboardMetrics, useDashboardSessions } from '@/features/dashboard';
import { useAuth } from '@/shared/hooks/use-auth';
import Header from '@/components/shared/Header';
import Sidebar from '@/components/shared/Sidebar';
import MobileDrawer from '@/components/shared/MobileDrawer';
import { useIsMobile } from '@/shared/hooks/use-mobile';
import type { TargetsSummary } from '@/lib/edge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import dayjs from 'dayjs';
import TargetActivityCard, {
  RANGE_CONFIG,
  RANGE_ORDER,
  buildRangeSummaries,
  type TimeRange,
} from '@/features/dashboard/ui/TargetActivityCard';
import RecentSessionsCard from '@/features/dashboard/ui/RecentSessionsCard';
import { HitTimelineSkeleton, HitDistributionSkeleton } from '@/features/games/ui/components';
import { formatScoreValue } from '@/utils/dashboard';

// Lazy-load chart components to defer ~200KB recharts
const TimelineCard = React.lazy(() => import('@/features/dashboard/ui/TimelineCard'));
const HitDistributionCardWrapper = React.lazy(() => import('@/features/dashboard/ui/HitDistributionCardWrapper'));
import { throttledLogOnChange } from '@/utils/log-throttle';

// Modern Stat Card Component
const StatCard: React.FC<{
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  trend?: { value: number; isPositive: boolean };
  isLoading?: boolean;
  infoTitle?: string;
  infoContent?: string;
}> = ({ title, value, subtitle, icon, trend, isLoading = false, infoTitle, infoContent }) => (
  <Card className="bg-white border-gray-200 shadow-sm hover:shadow-md transition-shadow rounded-md md:rounded-lg">
    <CardContent className="p-2 md:p-4">
      <div className="flex items-start gap-2">
        <div className="flex-1 space-y-0.5 md:space-y-1 text-center md:text-left">
          <div className="flex items-center gap-1 justify-center md:justify-start">
            <p className="text-xs font-medium text-brand-dark/70 font-body">{title}</p>
            {infoContent && (
              <Popover>
                <PopoverTrigger asChild>
                  <button 
                    type="button" 
                    className="inline-flex items-center justify-center rounded-full hover:bg-brand-dark/10 p-0.5 -m-0.5 transition-colors"
                    aria-label={`Info about ${title}`}
                  >
                    <Info className="h-3 w-3 text-brand-dark/40" />
                  </button>
                </PopoverTrigger>
                <PopoverContent 
                  side="bottom" 
                  align="start"
                  className="w-64 bg-white border border-gray-200 shadow-lg p-3"
                >
                  {infoTitle && <p className="text-xs font-medium text-brand-dark mb-1">{infoTitle}</p>}
                  <p className="text-xs text-brand-dark/70">{infoContent}</p>
                </PopoverContent>
              </Popover>
            )}
          </div>
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

const SESSION_HISTORY_LIMIT = 30; // Sufficient for day/week/month ranges

const Dashboard: React.FC = () => {
  const isMobile = useIsMobile();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const [dismissedCards, setDismissedCards] = useState<string[]>([]);

  // Get user authentication first (needed for useDashboardMetrics)
  const { user } = useAuth();

  // Use new React Query hooks
  // Don't force fetch on mount - let React Query use cached data if available
  const { data: roomsData, isLoading: roomsLoading } = useRooms(false);
  
  const { data: dashboardMetricsData, isLoading: metricsLoading } = useDashboardMetrics(false, user?.id);

  const rooms = roomsData?.rooms || [];

  // Use React Query for sessions (replaces Zustand useSessions store)
  const { data: sessions = [], isLoading: sessionsLoading } = useDashboardSessions(user?.id, SESSION_HISTORY_LIMIT);

  // Derive isReady from React Query loading states
  const isReady = !metricsLoading && !sessionsLoading && !roomsLoading;

  // Use React Query data for summary
  const summary: TargetsSummary | null = dashboardMetricsData?.metrics?.summary ?? null;
  const summaryLoading = metricsLoading;
  const summaryReady = !summaryLoading && !!summary;
  const summaryPending = summaryLoading || !summaryReady;
  const shouldShowSkeleton = summaryPending || sessionsLoading || roomsLoading;

  const stats = useMemo(() => {
    const totalTargetsValue = summary?.totalTargets ?? 0;
    const onlineTargetsValue = summary?.onlineTargets ?? 0;
    const standbyTargetsValue = summary?.standbyTargets ?? 0;
    const totalRoomsValue = rooms.length > 0 ? rooms.length : summary?.totalRooms ?? 0;

    const recentSessions = sessions.slice(0, 3);
    const avgScoreValue =
      recentSessions.length > 0
        ? Number(
            (
              recentSessions.reduce(
                (sum, session) => sum + (Number.isFinite(session.score) ? session.score ?? 0 : 0),
                0,
              ) / recentSessions.length
            ).toFixed(2),
          )
        : 0;

    return {
      onlineTargets: onlineTargetsValue,
      standbyTargets: standbyTargetsValue,
      totalTargets: totalTargetsValue,
      avgScore: avgScoreValue,
      totalRooms: totalRoomsValue,
    };
  }, [rooms.length, sessions, summary]);

  const { onlineTargets, standbyTargets, totalTargets, avgScore, totalRooms } = stats;

  // Consolidated session analytics - single pass over sessions array
  const sessionAnalytics = useMemo(() => {
    let completedCount = 0;
    let earliest: number | null = null;
    const scores: number[] = [];
    for (const session of sessions) {
      if ((session.score ?? 0) > 0) completedCount++;
      const ts = Date.parse(session.startedAt);
      if (!Number.isNaN(ts) && (earliest === null || ts < earliest)) earliest = ts;
      if (typeof session.score === 'number' && Number.isFinite(session.score))
        scores.push(session.score);
    }
    return { completedCount, earliest, scores };
  }, [sessions]);

  const totalSessionsCount = sessions.length;

  useEffect(() => {
    // Throttle to prevent flooding - only log when data changes or every 10 seconds
    throttledLogOnChange('dashboard-sessions', 10000, '[Dashboard] Supabase sessions snapshot', {
      fetchedAt: new Date().toISOString(),
      totalSessions: sessions.length,
      completedSessions: sessionAnalytics.completedCount,
      sample: sessions.slice(0, 5).map((session) => ({
        id: session.id,
        gameName: session.gameName,
        score: session.score,
        startedAt: session.startedAt,
      })),
    });
  }, [sessions, sessionAnalytics.completedCount]);

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
    const coverage = sessionAnalytics.earliest
      ? Date.now() - sessionAnalytics.earliest
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
  }, [rangeSummaries, sessionAnalytics.earliest]);

  const [activeRange, setActiveRange] = useState<TimeRange>(availableRanges[0] ?? 'day');

  useEffect(() => {
    if (!availableRanges.includes(activeRange)) {
      setActiveRange(availableRanges[0]);
    }
  }, [availableRanges, activeRange]);

  const distributionSourceSummary = useMemo(() => {
    if (rangeSummaries.all && rangeSummaries.all.sessionCount > 0) {
      return rangeSummaries.all;
    }
    return rangeSummaries[activeRange];
  }, [rangeSummaries, activeRange]);

  const {
    totalHits: distributionTotalHits,
    summary: distributionSummary,
    pieData: distributionPieData,
  } = useMemo(() => {
    const summary = distributionSourceSummary;
    if (!summary || !summary.targetTotals || summary.targetTotals.length === 0) {
      return {
        totalHits: 0,
        summary: [] as Array<{ deviceId: string; deviceName: string; hits: number }>,
        pieData: [] as Array<{ name: string; value: number }>,
      };
    }

    const totals = summary.targetTotals;
    const totalHits = totals.reduce((sum, entry) => sum + entry.hits, 0);
    const formatted = totals.map((entry) => ({
      deviceId: entry.deviceId,
      deviceName: entry.deviceName,
      hits: entry.hits,
    }));
    const pieData = formatted.map((entry) => ({
      name: entry.deviceName,
      value: entry.hits > 0 ? entry.hits : 1,
    }));

    return { totalHits, summary: formatted, pieData };
  }, [distributionSourceSummary]);

  const hitDistributionLoading = shouldShowSkeleton;

  const aggregateSeriesLabel = useMemo(() => {
    const activeSummary = rangeSummaries[activeRange];
    const activeCount = activeSummary?.targetTotals?.length ?? 0;
    if (activeCount > 0) {
      if (activeCount === 1) {
        return `${activeSummary.targetTotals[0]?.deviceName ?? 'Device'} Hits`;
      }
      return `${activeCount} Devices · Total Hits`;
    }

    const distributionCount = distributionSourceSummary?.targetTotals?.length ?? 0;
    if (distributionCount > 0) {
      if (distributionCount === 1) {
        return `${distributionSourceSummary.targetTotals[0]?.deviceName ?? 'Device'} Hits`;
      }
      return `${distributionCount} Devices · Total Hits`;
    }

    return 'Total Hit Volume';
  }, [rangeSummaries, activeRange, distributionSourceSummary]);

  const { hitTimelineTrackedDevices, hitTimelineData } = useMemo(() => {
    const summary = rangeSummaries[activeRange];
    if (!summary) {
      return {
        hitTimelineTrackedDevices: [{ deviceId: 'aggregate', deviceName: aggregateSeriesLabel }],
        hitTimelineData: [] as Array<Record<string, number | string>>,
      };
    }

    const topDevices = (summary.targetTotals ?? [])
      .filter((entry) => entry.hits > 0)
      .slice(0, 4);

    const includeAggregateLine = topDevices.length !== 1;
    const trackedDevices = (() => {
      if (topDevices.length === 0) {
        return [{ deviceId: 'aggregate', deviceName: aggregateSeriesLabel }];
      }
      const deviceEntries = topDevices.map((device) => ({
        deviceId: device.deviceId,
        deviceName: device.deviceName,
      }));
      if (!includeAggregateLine) {
        return deviceEntries;
      }
      return [
        { deviceId: 'aggregate', deviceName: aggregateSeriesLabel },
        ...deviceEntries,
      ];
    })();

    const timelineData = (summary.targetBuckets ?? []).map((bucket, bucketIndex) => {
      const row: Record<string, number | string> = { time: bucket.label };
      if (includeAggregateLine) {
        const totalHitsForBucket = bucket.devices.reduce((sum, device) => sum + device.hits, 0);
        const fallbackTotal = summary.chartData?.[bucketIndex]?.hits ?? 0;
        row[aggregateSeriesLabel] = totalHitsForBucket > 0 ? totalHitsForBucket : fallbackTotal;
      }

      topDevices.forEach((device) => {
        const match = bucket.devices.find((entry) => entry.deviceId === device.deviceId);
        row[device.deviceName] = match ? match.hits : 0;
      });

      return row;
    });

    return {
      hitTimelineTrackedDevices: trackedDevices,
      hitTimelineData: timelineData,
    };
  }, [rangeSummaries, activeRange, aggregateSeriesLabel]);

  const hitTimelineLoading = shouldShowSkeleton;

  const averageScoreMetric = sessionAnalytics.scores.length > 0
    ? Number(
        (sessionAnalytics.scores.reduce((sum, score) => sum + score, 0) / sessionAnalytics.scores.length).toFixed(2),
      )
    : null;

  // For time-based scoring, "best" means the lowest/fastest time
  const bestScoreMetric = sessionAnalytics.scores.length > 0
    ? Math.min(...sessionAnalytics.scores)
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
                    subtitle={
                      summaryReady
                        ? [onlineTargets > 0 && `${onlineTargets} online`, standbyTargets > 0 && `${standbyTargets} standby`]
                            .filter(Boolean)
                            .join(', ') || '0 online'
                        : ''
                    }
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
                    infoTitle="How Score is Calculated"
                    infoContent="Score = time (in seconds) of the last required hit. Lower is better. If goal shots are set, the score is the time when all targets reached their required hits. A session is marked 'DNF' if not all required hits were achieved."
                  />
                  <StatCard
                    title="Completed Sessions"
                    value={
                      sessionsLoading && sessionAnalytics.completedCount === 0
                        ? '—'
                        : sessionAnalytics.completedCount
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
            <div className="space-y-2 md:space-y-4 lg:space-y-5">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 md:gap-4 lg:gap-5">
                <TargetActivityCard
                  summaries={rangeSummaries}
                  availableRanges={availableRanges}
                  activeRange={activeRange}
                  onRangeChange={setActiveRange}
                  isLoading={shouldShowSkeleton}
                  currentStreakLength={currentStreakLength}
                  showSkeleton={shouldShowSkeleton}
                />
                <RecentSessionsCard
                  sessions={sessions}
                  isLoading={shouldShowSkeleton}
                  onViewAll={() => {
                    window.location.href = '/dashboard/games';
                  }}
                />
              </div>
              <React.Suspense fallback={
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 md:gap-4 lg:gap-5">
                  <HitTimelineSkeleton />
                  <HitDistributionSkeleton />
                </div>
              }>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 md:gap-4 lg:gap-5">
                  <TimelineCard
                    isLoading={hitTimelineLoading}
                    trackedDevices={hitTimelineTrackedDevices}
                    data={hitTimelineData}
                  />
                  <HitDistributionCardWrapper
                    isLoading={hitDistributionLoading}
                    totalHits={distributionTotalHits}
                    deviceHitSummary={distributionSummary}
                    pieChartData={distributionPieData}
                  />
                </div>
              </React.Suspense>
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
