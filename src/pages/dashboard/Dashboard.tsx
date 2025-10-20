import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { Target as TargetIcon, Users, Calendar, Bell, Clock, Zap, Trophy, TrendingUp, Activity, BarChart3, Play, User, X, Gamepad2, BarChart, Award } from 'lucide-react';
import { useStats } from '@/store/useStats';
import { useDashboardStats } from '@/store/useDashboardStats';
import { useTargets } from '@/store/useTargets';
import { useRooms } from '@/store/useRooms';
import { useScenarios, type ScenarioHistory } from '@/scenarios - old do not use/useScenarios';
import { useSessions, type Session } from '@/store/useSessions';
import { useAuth } from '@/providers/AuthProvider';
import Header from '@/components/shared/Header';
import Sidebar from '@/components/shared/Sidebar';
import MobileDrawer from '@/components/shared/MobileDrawer';
import { useIsMobile } from '@/hooks/use-mobile';
import { useShootingActivityPolling } from '@/hooks/useShootingActivityPolling';
import { useInitialSync } from '@/hooks/useInitialSync';
import { useHistoricalActivity } from '@/hooks/useHistoricalActivity';
import type { TargetShootingActivity } from '@/hooks/useShootingActivityPolling';
import { fetchTargetsSummary, type TargetsSummary } from '@/lib/edge';
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

// Activity Chart Component - Real Target Activity
const ActivityChart: React.FC<{
  targetActivity: TargetShootingActivity[];
  hitTrend: Array<{ date: string; hits: number }>;
  isLoading: boolean;
  historicalData: Array<{ date: string; hits: number; timestamp: number }>;
  timeRange: 'day' | 'week' | '3m' | '6m' | 'all';
  onTimeRangeChange: (range: 'day' | 'week' | '3m' | '6m' | 'all') => void;
  historicalLoading: boolean;
  averageScore: number | null;
  bestScore: number | null;
  lastShotsFired: number | null;
}> = ({
  targetActivity,
  hitTrend,
  isLoading,
  historicalData,
  timeRange,
  onTimeRangeChange,
  historicalLoading,
  averageScore,
  bestScore,
  lastShotsFired,
}) => {

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
  
  // Use historical data for the chart, fallback to hitTrend, then empty data
  const chartData = historicalData.length > 0 ? historicalData : 
    (hitTrend.length > 0 ? hitTrend : 
      Array.from({ length: 7 }, (_, i) => {
        const date = new Date();
        date.setDate(date.getDate() - (6 - i));
        return { 
          date: date.toISOString().split('T')[0], 
          hits: 0 
        };
      })
    );

  const maxHits = Math.max(...chartData.map(d => d.hits), 1);
  const averageScoreDisplay = averageScore !== null ? `${averageScore}%` : 'N/A';
  const bestScoreDisplay = bestScore !== null ? `${bestScore}%` : 'N/A';
  const lastShotsDisplay = lastShotsFired !== null ? lastShotsFired.toLocaleString() : 'N/A';
  
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-brand-dark">Session Metrics</h3>
        <Badge className="bg-green-500 text-white border-green-500">
          Real-time
        </Badge>
      </div>

      <div className="space-y-3">
        {[{
          label: 'Average Score',
          value: averageScoreDisplay,
          color: 'bg-brand-primary'
        }, {
          label: 'Best Score',
          value: bestScoreDisplay,
          color: 'bg-green-500'
        }, {
          label: 'Last Shots Fired',
          value: lastShotsDisplay,
          color: 'bg-purple-500'
        }].map((metric) => (
          <div key={metric.label} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${metric.color}`}></div>
              <span className="text-sm text-brand-dark">{metric.label}</span>
            </div>
            <span className="text-sm font-medium text-brand-dark">{metric.value}</span>
          </div>
        ))}
      </div>

      {/* Time Range Tabs */}
      <div className="pt-4 border-t border-gray-200">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-medium text-brand-dark">
            {timeRange === 'day' && '24-Hour Hit Activity'}
            {timeRange === 'week' && '7-Day Hit Trend'}
            {timeRange === '3m' && '3-Month Activity'}
            {timeRange === '6m' && '6-Month Activity'}
            {timeRange === 'all' && 'All-Time Activity'}
          </h4>
          <div className="flex space-x-1">
            {(['day', 'week', '3m', '6m', 'all'] as const).map((range) => (
              <Button
                key={range}
                variant={timeRange === range ? 'default' : 'ghost'}
                size="sm"
                onClick={() => onTimeRangeChange(range)}
                className="text-xs px-2 py-1 h-7"
                disabled={historicalLoading}
              >
                {range === 'day' && 'Day'}
                {range === 'week' && 'Week'}
                {range === '3m' && '3M'}
                {range === '6m' && '6M'}
                {range === 'all' && 'All'}
              </Button>
            ))}
          </div>
        </div>
        <div className="flex items-end justify-between gap-2 h-20">
          {historicalLoading ? (
            // Show loading skeleton
            [...Array(7)].map((_, i) => (
              <div key={i} className="flex-1 bg-gray-200 animate-pulse rounded-t-lg h-16"></div>
            ))
          ) : (
            chartData.map((item, index) => {
              const isLatest = index === chartData.length - 1;
              let timeLabel: string;
              
              // Format time label based on selected range
              switch (timeRange) {
                case 'day':
                  timeLabel = dayjs(item.date).format('HH:mm');
                  break;
                case 'week':
                  timeLabel = dayjs(item.date).format('ddd');
                  break;
                case '3m':
                case '6m':
                  timeLabel = dayjs(item.date).format('MMM DD');
                  break;
                case 'all':
                  timeLabel = dayjs(item.date).format('MMM YY');
                  break;
                default:
                  timeLabel = dayjs(item.date).format('ddd');
              }
              
              return (
                <div key={index} className="flex flex-col items-center gap-2 flex-1">
                  <div className="flex-1 flex items-end w-full">
                    <div
                      className={`w-full rounded-t-lg transition-all duration-300 ${
                        isLatest 
                          ? 'bg-brand-primary' 
                          : 'bg-brand-secondary/30 hover:bg-brand-secondary/50'
                      }`}
                      style={{
                        height: `${(item.hits / maxHits) * 100}%`,
                        minHeight: '4px'
                      }}
                      title={`${timeLabel}: ${item.hits} hits`}
                    />
                  </div>
                  <span className="text-xs text-brand-dark/50 font-body">{timeLabel}</span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

// System Overview using simple metric display
const SystemOverview: React.FC<{
  targets: Target[];
  sessions: Session[];
  isLoading: boolean;
  summary?: TargetsSummary | null;
  summaryLoading?: boolean;
}> = ({ targets, sessions, isLoading, summary, summaryLoading }) => {
  const summaryReady = Boolean(summary) || targets.length > 0;
  const isSkeleton = isLoading || summaryLoading || !summaryReady;

  if (isSkeleton) {
    return (
      <div className="space-y-2 md:space-y-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="flex items-center justify-between p-2 md:p-3 bg-gray-50 rounded-sm md:rounded-lg animate-pulse">
            <div className="h-3 md:h-4 w-20 md:w-24 bg-gray-200 rounded-sm md:rounded"></div>
            <div className="h-4 md:h-5 w-10 md:w-12 bg-gray-200 rounded-sm md:rounded"></div>
          </div>
        ))}
      </div>
    );
  }

  const hasTargetDetails = targets.length > 0;
  const totalTargets = hasTargetDetails ? targets.length : summary?.totalTargets ?? 0;
  const onlineTargets = hasTargetDetails
    ? targets.filter(t => t.status === 'online').length
    : summary?.onlineTargets ?? 0;
  const offlineTargets = hasTargetDetails
    ? targets.filter(t => t.status === 'offline').length
    : summary?.offlineTargets ?? Math.max(totalTargets - onlineTargets, 0);
  const completedSessions = sessions.filter(s => s.score > 0).length;
  const totalSessions = sessions.length;
  
  // If no targets available, show N/A
  const hasTargets = totalTargets > 0;

  const metrics = [
    { 
      label: 'Online Targets', 
      value: hasTargets ? onlineTargets : 'N/A', 
      total: hasTargets ? totalTargets : null,
      color: hasTargets ? 'text-green-600' : 'text-gray-400',
      bgColor: hasTargets ? 'bg-green-50' : 'bg-gray-50'
    },
    { 
      label: 'Offline Targets', 
      value: hasTargets ? offlineTargets : 'N/A', 
      total: hasTargets ? totalTargets : null,
      color: hasTargets ? 'text-gray-600' : 'text-gray-400',
      bgColor: hasTargets ? 'bg-gray-50' : 'bg-gray-50'
    },
    { 
      label: 'Completed Sessions', 
      value: completedSessions, 
      total: totalSessions,
      color: 'text-brand-primary',
      bgColor: 'bg-orange-50'
    },
    { 
      label: 'Total Sessions', 
      value: totalSessions, 
      total: null,
      color: 'text-brand-secondary',
      bgColor: 'bg-purple-50'
    },
  ];

  return (
    <div className="space-y-2 md:space-y-3">
      {metrics.map((metric, index) => (
        <div key={index} className={`flex items-center justify-between p-2 md:p-3 ${metric.bgColor} rounded-sm md:rounded-lg`}>
          <div className="flex items-center gap-2 md:gap-3">
            <div className={`w-1.5 h-1.5 md:w-2 md:h-2 rounded-full ${metric.color.replace('text-', 'bg-')}`}></div>
            <span className="text-xs md:text-sm font-medium text-brand-dark">{metric.label}</span>
          </div>
          <div className="flex items-center gap-1 md:gap-2">
            <span className={`text-sm md:text-base lg:text-lg font-bold ${metric.color}`}>{metric.value}</span>
            {metric.total !== null && (
              <span className="text-xs md:text-sm text-brand-dark/50">/ {metric.total}</span>
            )}
          </div>
        </div>
      ))}
      
      {/* Quick Actions */}
      <div className="pt-2 md:pt-3 border-t border-gray-200">
        <div className="grid grid-cols-2 gap-1.5 md:gap-2">
          <Button 
            size="sm" 
            className="bg-brand-primary text-white hover:bg-brand-primary/90 text-[10px] h-7 !px-2 w-full whitespace-nowrap overflow-hidden"
            onClick={() => window.location.href = '/dashboard/targets'}
          >
            <span className="truncate">Manage Targets</span>
          </Button>
          <Button 
            size="sm" 
            className="bg-brand-purple text-white hover:bg-brand-purple/90 text-[10px] h-7 !px-2 w-full whitespace-nowrap overflow-hidden"
            onClick={() => window.location.href = '/dashboard/scenarios'}
          >
            <span className="truncate">View Sessions</span>
          </Button>
        </div>
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

const Dashboard: React.FC = () => {
  const location = useLocation();
  const isMobile = useIsMobile();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const [dismissedCards, setDismissedCards] = useState<string[]>([]);
  const [targetsLoading, setTargetsLoading] = useState(false);
  const [timeRange, setTimeRange] = useState<'day' | 'week' | '3m' | '6m' | 'all'>('week');
  const isFetchingRef = useRef(false);
  const lastFetchTimeRef = useRef(0);
  const telemetryFetchedRef = useRef(false);
  const telemetryInitializedRef = useRef(false);
  const [summary, setSummary] = useState<TargetsSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const FETCH_DEBOUNCE_MS = 2000; // 2 seconds debounce
  
  // Real data from stores
  const { 
    activeTargets, 
    roomsCreated, 
    lastScenarioScore, 
    pendingInvites, 
    hitTrend,
    isLoading: statsLoading, 
    fetchStats, 
    updateHit, 
    setWsConnected 
  } = useStats();
  
  const { slices, refresh: refreshDashboardStats } = useDashboardStats();
  const { targets: rawTargets, fetchTargetsFromEdge } = useTargets();
  const { rooms } = useRooms();
  const { scenarioHistory, isLoading: scenariosLoading, fetchScenarios } = useScenarios();
  const { sessions, isLoading: sessionsLoading, fetchSessions } = useSessions();
  
  const { user, session, loading: authLoading } = useAuth();

  // Initial sync with ThingsBoard (only on dashboard)
  const { syncStatus, isReady } = useInitialSync();

  // Get ThingsBoard token from localStorage
  const tbToken = localStorage.getItem('tb_access');

  useEffect(() => {
    if (!user?.id) {
      return;
    }

    void fetchSessions(user.id, 10);
  }, [user?.id, fetchSessions]);

  // Fetch merged targets with room assignments and telemetry
  const fetchMergedTargets = useCallback(async () => {
    setTargetsLoading(true);
    try {
      await fetchTargetsFromEdge(true);
      console.log('[Dashboard] Edge targets refreshed via store');
    } catch (error) {
      console.error('[Dashboard] Error fetching edge targets', error);
    } finally {
      setTargetsLoading(false);
    }
  }, [fetchTargetsFromEdge]);

  const loadSummary = useCallback(async (force = false) => {
    setSummaryLoading(true);
    setSummaryError(null);
    try {
      const { summary: summaryPayload } = await fetchTargetsSummary(force);
      if (summaryPayload) {
        setSummary(summaryPayload);
        console.log('[Dashboard] Summary data from edge', summaryPayload);
      }
    } catch (error) {
      console.error('[Dashboard] Failed to load summary from edge function', error);
      setSummaryError(error instanceof Error ? error.message : 'Failed to load dashboard summary');
    } finally {
      setSummaryLoading(false);
    }
  }, []);

  const summaryReady = useMemo(() => {
    if (summaryLoading) {
      return false;
    }

    if (summary) {
      return true;
    }

    return rawTargets.length > 0;
  }, [summary, summaryLoading, rawTargets.length]);

  const telemetryEnabled = summaryReady;

  useEffect(() => {
    if (authLoading) {
      return;
    }

    if (!user || !session?.access_token) {
      setSummary(null);
      return;
    }

    loadSummary();
  }, [authLoading, session?.access_token, user, loadSummary]);

  // Smart polling system with heartbeat detection - optimized for parallel execution
  const fetchAllData = useCallback(async () => {
    if (!telemetryEnabled) {
      return;
    }

    // Prevent multiple simultaneous fetches
    if (isFetchingRef.current) {
      return;
    }

    // Debounce rapid successive calls
    const now = Date.now();
    if (now - lastFetchTimeRef.current < FETCH_DEBOUNCE_MS) {
      return;
    }
    lastFetchTimeRef.current = now;

    isFetchingRef.current = true;
    try {
      await Promise.allSettled([refreshDashboardStats()]);
      Promise.allSettled([fetchMergedTargets()]);
      if (tbToken) {
        Promise.allSettled([fetchStats(tbToken), fetchScenarios(tbToken)]);
      }
    } catch (error) {
      console.error('[Dashboard] Error fetching data', error);
    } finally {
      isFetchingRef.current = false;
    }
  }, [telemetryEnabled, tbToken, fetchStats, fetchScenarios, refreshDashboardStats, fetchMergedTargets]);

  // Lightweight update function for shooting activity polling
  // Only refreshes essential data, not full dashboard data
  const updateShootingData = useCallback(async () => {
    if (!telemetryEnabled) {
      return;
    }
    if (rawTargets.length === 0) {
      try {
        await fetchTargetsFromEdge();
      } catch (error) {
        console.error('[Dashboard] Failed to refresh targets for shooting data', error);
      }
    }
  }, [telemetryEnabled, rawTargets.length, fetchTargetsFromEdge]);

  const { 
    currentInterval, 
    currentMode, 
    hasActiveShooters,
    hasRecentActivity,
    isStandbyMode,
    targetActivity,
    activeShotsCount,
    recentShotsCount,
    forceUpdate 
  } = useShootingActivityPolling(updateShootingData, {
    activeInterval: 10000,     // 10 seconds during active shooting
    recentInterval: 30000,     // 30 seconds if shot within last 30s but not active
    standbyInterval: 60000,    // 60 seconds if no shots for 10+ minutes
    activeThreshold: 30000,    // 30 seconds - active shooting threshold
    standbyThreshold: 600000   // 10 minutes - standby mode threshold
  }, telemetryEnabled);

  // Historical activity data for time range charts
  const { 
    historicalData, 
    isLoading: historicalLoading, 
    error: historicalError 
  } = useHistoricalActivity(rawTargets, timeRange, telemetryEnabled);

  // Use Zustand store directly as single source of truth
  const currentTargets = rawTargets;
  
  // Check if ThingsBoard data is available (moved up to avoid hoisting issues)
  const hasThingsBoardData = currentTargets.length > 0 || rooms.length > 0;

  // Fetch telemetry for status display when data is available
  useEffect(() => {
    if (!telemetryEnabled) {
      return;
    }

    if (telemetryInitializedRef.current) {
      return;
    }

    telemetryInitializedRef.current = true;
    fetchAllData();
  }, [telemetryEnabled, fetchAllData]);

  // Fetch telemetry for status display when data is available
  useEffect(() => {
    if (!telemetryEnabled) {
      return;
    }

    if (isReady && syncStatus.isComplete && !telemetryFetchedRef.current && rawTargets.length > 0) {
      telemetryFetchedRef.current = true; // Mark as fetched BEFORE the call

      fetchMergedTargets().catch(error => {
        console.error('[Dashboard] Telemetry fetch failed', error);
        telemetryFetchedRef.current = false; // Allow retry on error
      });
    }
  }, [telemetryEnabled, isReady, syncStatus.isComplete, rawTargets.length, fetchMergedTargets]);

  // Fallback: if sync fails or no data, fetch manually
  useEffect(() => {
    if (!telemetryEnabled) {
      return;
    }

    if (isReady && syncStatus.error && !hasThingsBoardData) {
      fetchAllData();
    }
  }, [telemetryEnabled, isReady, syncStatus.error, hasThingsBoardData, fetchAllData]);
  
  // Determine when summary data is available and when to show placeholders
  const hasSummaryData = currentTargets.length > 0 || Boolean(summary);
  const summaryPending = summaryLoading && !hasSummaryData;
  const shouldShowTargetsLoading = (targetsLoading || summaryLoading) && currentTargets.length === 0 && !hasSummaryData;
  const shouldShowSkeleton = (!hasSummaryData) || summaryPending || (sessionsLoading && sessions.length === 0);
  const telemetryLoading = !hasSummaryData || targetsLoading || summaryLoading || historicalLoading;

  const stats = useMemo(() => {
    const usingDetailedTargets = currentTargets.length > 0;
    const totalTargets = usingDetailedTargets
      ? currentTargets.length
      : summary?.totalTargets ?? 0;
    const onlineTargets = usingDetailedTargets
      ? currentTargets.filter(target => target.status === 'online').length
      : summary?.onlineTargets ?? 0;
    const assignedTargets = usingDetailedTargets
      ? currentTargets.filter(target => target.roomId).length
      : summary?.assignedTargets ?? 0;
    const totalRooms = rooms.length > 0
      ? rooms.length
      : summary?.totalRooms ?? 0;

    const roomUtilization = totalTargets > 0
      ? Math.round((assignedTargets / totalTargets) * 100)
      : 0;

    const recentScenarios = sessions.slice(0, 3);
    const avgScore = recentScenarios.length > 0 
      ? Math.round(recentScenarios.reduce((sum, s) => sum + (s.score || 0), 0) / recentScenarios.length)
      : (lastScenarioScore || 0);

    return {
      onlineTargets,
      totalTargets,
      assignedTargets,
      roomUtilization,
      avgScore,
      totalRooms
    };
  }, [currentTargets, rooms.length, sessions, lastScenarioScore, summary]);

  // Destructure for use in JSX
  const { onlineTargets, totalTargets, assignedTargets, roomUtilization, avgScore, totalRooms } = stats;
  
  // Calculate recentScenarios for use in JSX (moved from useMemo for easier access)
  const recentScenarios = sessions.slice(0, 3);

  const sessionScores = useMemo(() => (
    sessions
      .map((session) => session.score)
      .filter((score): score is number => typeof score === 'number' && !Number.isNaN(score))
  ), [sessions]);

  const averageScoreMetric = sessionScores.length > 0
    ? Math.round(sessionScores.reduce((sum, score) => sum + score, 0) / sessionScores.length)
    : null;

  const bestScore = sessionScores.length > 0
    ? Math.max(...sessionScores)
    : null;

  const latestSession = sessions[0];
  const lastShotsFired = latestSession
    ? (() => {
        const value = latestSession.totalShots ?? latestSession.hitCount;
        return typeof value === 'number' && !Number.isNaN(value) ? value : null;
      })()
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
                    value={summaryReady ? (avgScore ? `${avgScore}%` : 'N/A') : '—'}
                    subtitle={summaryReady ? 'Recent sessions' : ''}
                    icon={<Trophy className="w-6 h-6 -ml-1.5 md:ml-0" />}
                    isLoading={sessionsLoading}
                  />
                  <StatCard
                    title="Target Assignment"
                    value={summaryReady ? `${roomUtilization}%` : '—'}
                    subtitle={summaryReady ? `${assignedTargets}/${totalTargets} targets assigned` : ''}
                    icon={<BarChart3 className="w-6 h-6 -ml-1.5 md:ml-0" />}
                    isLoading={summaryPending || !summaryReady}
                  />
                </>
              )}
            </div>
            

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-2 md:gap-4 lg:gap-5">
              
              {/* Activity Chart - Real Target Activity */}
              <Card className="bg-white border-gray-200 shadow-sm rounded-md md:rounded-lg">
                <CardHeader className="pb-1 md:pb-3 p-2 md:p-4">
                  <CardTitle className="text-xs md:text-base lg:text-lg font-heading text-brand-dark">Target Activity</CardTitle>
                </CardHeader>
                <CardContent className="p-2 md:p-4">
                  {(targetsLoading && currentTargets.length === 0) ? (
                    <div className="space-y-4 animate-pulse">
                      <div className="flex items-center justify-between">
                        <div className="h-6 w-32 bg-gray-200 rounded"></div>
                        <div className="h-4 w-16 bg-gray-200 rounded"></div>
                      </div>
                      <div className="space-y-3">
                        {[...Array(3)].map((_, i) => (
                          <div key={i} className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className="w-3 h-3 bg-gray-200 rounded-full"></div>
                              <div className="h-4 w-24 bg-gray-200 rounded"></div>
                            </div>
                            <div className="h-4 w-8 bg-gray-200 rounded"></div>
                          </div>
                        ))}
                      </div>
                      <div className="h-32 bg-gray-200 rounded"></div>
                    </div>
                  ) : (
                  <ActivityChart 
                    targetActivity={targetActivity} 
                    hitTrend={hitTrend} 
                    isLoading={telemetryLoading}
                    historicalData={historicalData}
                    timeRange={timeRange}
                    onTimeRangeChange={setTimeRange}
                    historicalLoading={historicalLoading}
                    averageScore={averageScoreMetric}
                    bestScore={bestScore}
                    lastShotsFired={lastShotsFired}
                  />
                  )}
                </CardContent>
              </Card>

              {/* System Overview - Real Target and Scenario Data */}
              <Card className="bg-white border-gray-200 shadow-sm rounded-md md:rounded-lg">
                <CardHeader className="pb-1 md:pb-3 p-2 md:p-4">
                  <CardTitle className="text-xs md:text-base lg:text-lg font-heading text-brand-dark">System Overview</CardTitle>
                </CardHeader>
                <CardContent className="p-2 md:p-4">
                  {shouldShowSkeleton ? (
                    <div className="space-y-3 animate-pulse">
                      {[...Array(4)].map((_, i) => (
                        <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div className="flex items-center gap-3">
                            <div className="w-2 h-2 bg-gray-200 rounded-full"></div>
                            <div className="h-4 w-24 bg-gray-200 rounded"></div>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="h-5 w-8 bg-gray-200 rounded"></div>
                            <div className="h-4 w-6 bg-gray-200 rounded"></div>
                          </div>
                        </div>
                      ))}
                      <div className="pt-3 border-t border-gray-200">
                        <div className="grid grid-cols-2 gap-2">
                          <div className="h-7 bg-gray-200 rounded"></div>
                          <div className="h-7 bg-gray-200 rounded"></div>
                        </div>
                      </div>
                    </div>
                  ) : (
                  <SystemOverview 
                    targets={currentTargets} 
                    sessions={sessions} 
                    isLoading={shouldShowTargetsLoading || sessionsLoading} 
                    summary={summary}
                    summaryLoading={summaryLoading}
                  />
                )}
              </CardContent>
            </Card>

              {/* Recent Sessions */}
              <Card className="bg-white border-gray-200 shadow-sm rounded-md md:rounded-lg">
                <CardHeader className="pb-1 md:pb-3 p-2 md:p-4">
                  {shouldShowSkeleton ? (
                    <div className="animate-pulse space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="h-4 w-24 bg-gray-200 rounded"></div>
                        <div className="h-4 w-16 bg-gray-200 rounded"></div>
                      </div>
                      <div className="h-5 w-32 bg-gray-200 rounded"></div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-xs md:text-base lg:text-lg font-heading text-brand-dark">
                        Recent Sessions
                      </CardTitle>
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
                        <div key={i} className="bg-gray-100 border border-gray-200 rounded-sm md:rounded-lg p-2">
                          <div className="flex items-center justify-between mb-1">
                            <div className="h-3 w-20 bg-gray-200 rounded"></div>
                            <div className="h-3 w-12 bg-gray-200 rounded"></div>
                          </div>
                          <div className="h-4 w-28 bg-gray-200 rounded mb-1"></div>
                          <div className="h-2 w-full bg-gray-200 rounded"></div>
                        </div>
                      ))}
                    </div>
                  ) : recentScenarios.length > 0 ? (
                    <div className="space-y-2 md:space-y-3">
                      {recentScenarios.map((session) => (
                        <Card key={session.id} className="border-gray-200 bg-gray-50 rounded-sm md:rounded-lg">
                          <CardContent className="p-2 md:p-3 space-y-1 md:space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-medium text-brand-dark/70">
                                {dayjs(session.startedAt).format('MMM D, HH:mm')}
                              </span>
                              <Badge 
                                variant="outline" 
                                className={`text-xs rounded-sm md:rounded ${
                                  session.score > 0 ? 'border-green-600 text-green-600' : 'border-brand-secondary text-brand-secondary'
                                }`}
                              >
                                {session.score > 0 ? 'Completed' : 'Pending'}
                              </Badge>
                            </div>
                            <h4 className="font-medium text-brand-dark text-xs leading-tight">
                              {session.gameName || session.scenarioName}
                            </h4>
                            {session.score !== undefined && (
                              <div className="flex items-center justify-between text-xs">
                                <span className="text-brand-dark/70">Score:</span>
                                <span className="font-bold text-brand-dark">
                                  {session.score ? `${session.score}%` : 'N/A'}
                                </span>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      ))}
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
