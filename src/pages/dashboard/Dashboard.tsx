import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { Target as TargetIcon, Users, Calendar, Bell, Clock, Zap, Trophy, TrendingUp, Activity, BarChart3, Play, User, X, Gamepad2, BarChart, Award } from 'lucide-react';
import { useStats } from '@/store/useStats';
import { useDashboardStats } from '@/store/useDashboardStats';
import { useTargets, type Target } from '@/store/useTargets';
import { useRooms } from '@/store/useRooms';
import { useGameFlow } from '@/store/useGameFlow';
import { useAuth } from '@/providers/AuthProvider';
import { useDemoMode } from '@/providers/DemoModeProvider';
import { apiWrapper } from '@/services/api-wrapper';
import Header from '@/components/shared/Header';
import Sidebar from '@/components/shared/Sidebar';
import MobileDrawer from '@/components/shared/MobileDrawer';
import { useIsMobile } from '@/hooks/use-mobile';
import { useShootingActivityPolling } from '@/hooks/useShootingActivityPolling';
import { useInitialSync } from '@/hooks/useInitialSync';
import { useThingsBoardSync } from '@/hooks/useThingsBoardSync';
import { fetchRecentSessions, type RecentSession } from '@/services/profile';
import type { TargetShootingActivity } from '@/hooks/useShootingActivityPolling';
import ShootingStatusBanner from '@/components/shared/ShootingStatusBanner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import dayjs from 'dayjs';

// Modern Stat Card Component with Enhanced Skeleton
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
      {isLoading ? (
        <div className="animate-pulse">
          <div className="flex items-start gap-2">
            <div className="flex-1 space-y-0.5 md:space-y-1 text-center md:text-left">
              <div className="h-3 md:h-4 bg-brand-secondary/20 rounded w-20 md:w-24 mx-auto md:mx-0"></div>
              <div className="h-4 md:h-6 w-10 md:w-14 bg-brand-secondary/20 rounded mx-auto md:mx-0"></div>
              <div className="h-3 md:h-4 bg-brand-secondary/20 rounded w-16 md:w-20 mx-auto md:mx-0"></div>
            </div>
            <div className="flex-shrink-0 p-1 md:p-2 bg-brand-secondary/10 rounded-sm md:rounded-lg">
              <div className="w-3 h-3 md:w-5 md:h-5 bg-brand-secondary/20 rounded"></div>
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-start gap-2">
            <div className="flex-1 space-y-0.5 md:space-y-1 text-center md:text-left">
              <p className="text-xs font-medium text-brand-dark/70 font-body">{title}</p>
              <p className="text-sm md:text-xl lg:text-2xl font-bold text-brand-dark font-heading">{value}</p>
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
          {trend && (
            <div className="mt-1 md:mt-3 flex items-center gap-1 md:gap-2">
              <div className={`flex items-center gap-0.5 md:gap-1 text-xs ${trend.isPositive ? 'text-green-600' : 'text-red-600'}`}>
                <TrendingUp className={`w-2.5 h-2.5 md:w-4 md:h-4 ${!trend.isPositive && 'rotate-180'}`} />
                <span>{trend.value}%</span>
              </div>
              <span className="text-xs text-brand-dark/50 font-body">vs last week</span>
            </div>
          )}
        </>
      )}
    </CardContent>
  </Card>
);

// Activity Chart Component - Real Target Activity
const ActivityChart: React.FC<{
  targetActivity: TargetShootingActivity[];
  hitTrend: Array<{ date: string; hits: number }>;
  isLoading: boolean;
}> = ({ targetActivity, hitTrend, isLoading }) => {
  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        {/* Header Skeleton */}
        <div className="flex items-center justify-between">
          <div>
            <div className="h-6 bg-brand-secondary/20 rounded w-32 mb-2"></div>
            <div className="h-4 bg-brand-secondary/20 rounded w-24"></div>
          </div>
          <div className="h-6 bg-brand-secondary/20 rounded w-16"></div>
        </div>
        
        {/* Activity Status Skeleton */}
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-brand-secondary/20 rounded-full"></div>
                <div className="h-4 bg-brand-secondary/20 rounded w-20"></div>
              </div>
              <div className="h-4 bg-brand-secondary/20 rounded w-6"></div>
            </div>
          ))}
        </div>

        {/* Chart Skeleton */}
        <div className="pt-4 border-t border-gray-200">
          <div className="h-4 bg-brand-secondary/20 rounded w-24 mb-3"></div>
          <div className="flex items-end justify-between gap-2 h-20">
            {[...Array(7)].map((_, i) => (
              <div key={i} className="flex flex-col items-center gap-2 flex-1">
                <div className="flex-1 flex items-end w-full">
                  <div className="w-full bg-brand-secondary/20 rounded-t-lg h-12"></div>
                </div>
                <div className="h-3 bg-brand-secondary/20 rounded w-6"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Calculate real activity metrics
  const activeTargets = targetActivity.filter(t => t.isActivelyShooting).length;
  const recentTargets = targetActivity.filter(t => t.isRecentlyActive).length;
  const totalActiveTargets = activeTargets + recentTargets;
  
  // Calculate total hits from targets with actual hit data
  const targetsWithHits = targetActivity.filter(t => t.totalShots > 0);
  const totalHits = targetsWithHits.reduce((sum, t) => sum + t.totalShots, 0);
  
  // Use hit trend data for the chart
  const chartData = hitTrend.length > 0 ? hitTrend : 
    Array.from({ length: 7 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (6 - i));
      return { 
        date: date.toISOString().split('T')[0], 
        hits: 0 
      };
    });

  const maxHits = Math.max(...chartData.map(d => d.hits), 1);
  const todayHits = chartData[chartData.length - 1]?.hits || 0;
  
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-2xl font-bold text-brand-dark font-heading">
            {totalActiveTargets}
            <span className="text-sm font-normal text-brand-dark/50 ml-1">active targets</span>
          </h3>
          <p className="text-sm text-brand-dark/70 font-body">
            {totalHits > 0 ? `${totalHits} total hits (historical)` : 'No recent activity'}
          </p>
        </div>
        <Badge className="bg-green-500 text-white border-green-500">
          Real-time
        </Badge>
      </div>
      
      {/* Activity Status Bars */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-red-500 rounded-full"></div>
            <span className="text-sm text-brand-dark">Active Shooting</span>
          </div>
          <span className="text-sm font-medium text-brand-dark">{activeTargets}</span>
        </div>
        
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
            <span className="text-sm text-brand-dark">Recent Activity</span>
          </div>
          <span className="text-sm font-medium text-brand-dark">{recentTargets}</span>
        </div>
        
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-gray-400 rounded-full"></div>
            <span className="text-sm text-brand-dark">Standby</span>
          </div>
          <span className="text-sm font-medium text-brand-dark">
            {targetActivity.filter(t => t.isStandby).length}
          </span>
        </div>
      </div>

      {/* Hit Trend Chart */}
      <div className="pt-4 border-t border-gray-200">
        <h4 className="text-sm font-medium text-brand-dark mb-3">7-Day Hit Trend</h4>
        <div className="flex items-end justify-between gap-2 h-20">
          {chartData.map((item, index) => {
            const isToday = index === chartData.length - 1;
            const dayName = dayjs(item.date).format('ddd');
            
            return (
              <div key={index} className="flex flex-col items-center gap-2 flex-1">
                <div className="flex-1 flex items-end w-full">
                  <div
                    className={`w-full rounded-t-lg transition-all duration-300 ${
                      isToday 
                        ? 'bg-brand-primary' 
                        : 'bg-brand-secondary/30 hover:bg-brand-secondary/50'
                    }`}
                    style={{
                      height: `${(item.hits / maxHits) * 100}%`,
                      minHeight: '4px'
                    }}
                    title={`${dayName}: ${item.hits} hits`}
                  />
                </div>
                <span className="text-xs text-brand-dark/50 font-body">{dayName}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// System Overview using simple metric display
const SystemOverview: React.FC<{
  targets: Target[];
  gameSessionsCount: number;
  isLoading: boolean;
}> = ({ targets, gameSessionsCount, isLoading }) => {
  if (isLoading) {
    return (
      <div className="space-y-2 md:space-y-3 animate-pulse">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="flex items-center justify-between p-2 md:p-3 bg-brand-light/30 rounded-sm md:rounded-lg">
            <div className="flex items-center gap-2 md:gap-3">
              <div className="w-1.5 h-1.5 md:w-2 md:h-2 bg-brand-secondary/20 rounded-full"></div>
              <div className="h-3 md:h-4 w-20 md:w-24 bg-brand-secondary/20 rounded-sm md:rounded"></div>
            </div>
            <div className="flex items-center gap-1 md:gap-2">
              <div className="h-4 md:h-5 w-10 md:w-12 bg-brand-secondary/20 rounded-sm md:rounded"></div>
              <div className="h-3 md:h-4 w-6 md:w-8 bg-brand-secondary/20 rounded-sm md:rounded"></div>
            </div>
          </div>
        ))}
        
        {/* Quick Actions Skeleton */}
        <div className="pt-2 md:pt-3 border-t border-gray-200">
          <div className="grid grid-cols-2 gap-1.5 md:gap-2">
            <div className="h-7 bg-brand-secondary/20 rounded-sm md:rounded"></div>
            <div className="h-7 bg-brand-secondary/20 rounded-sm md:rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  const onlineTargets = targets.filter(t => t.status === 'online').length;
  const offlineTargets = targets.filter(t => t.status === 'offline').length;
  const totalTargets = targets.length;
  const totalSessions = gameSessionsCount;
  const completedSessions = totalSessions; // All completed games count

  const metrics = [
    { 
      label: 'Online Targets', 
      value: onlineTargets, 
      total: totalTargets,
      color: 'text-green-600',
      bgColor: 'bg-green-50'
    },
    { 
      label: 'Offline Targets', 
      value: offlineTargets, 
      total: totalTargets,
      color: 'text-gray-600',
      bgColor: 'bg-gray-50'
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
  const [targets, setTargets] = useState<Target[]>([]);
  const [targetsLoading, setTargetsLoading] = useState(false);
  const [recentSessions, setRecentSessions] = useState<RecentSession[]>([]);
  const isFetchingRef = useRef(false);
  
  // Get demo mode state
  const { isDemoMode } = useDemoMode();
  
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
  const { targets: rawTargets, refresh: refreshTargets } = useTargets();
  const { rooms, isLoading: roomsLoading, fetchRooms, getAllTargetsWithAssignments } = useRooms();
  const { gameHistory, loadGameHistory } = useGameFlow();
  
  const { user } = useAuth();
  
  // Initial sync with ThingsBoard (only on dashboard)
  const { syncStatus, isReady } = useInitialSync();
  
  // ThingsBoard sync for manual refresh
  const { forceSync: forceThingsBoardSync } = useThingsBoardSync();

  // Get ThingsBoard token from localStorage
  const tbToken = localStorage.getItem('tb_access');

  // Fetch merged targets with room assignments
  const fetchMergedTargets = useCallback(async () => {
    setTargetsLoading(true);
    try {
      console.log(`🔄 Dashboard: Fetching targets (${isDemoMode ? 'DEMO' : 'LIVE'} mode)...`);
      
      if (isDemoMode) {
        // Demo mode: use mock targets
        const mockTargets = await apiWrapper.getTargets(true);
        setTargets(mockTargets);
        console.log('✅ DEMO: Loaded mock targets:', mockTargets.length);
      } else {
        // Live mode: use real merged targets
        const mergedTargets = await getAllTargetsWithAssignments();
        setTargets(mergedTargets);
        console.log('✅ LIVE: Merged targets loaded:', mergedTargets.length);
      }
      
      setTargetsLoading(false);
    } catch (error) {
      console.error('❌ Dashboard: Error fetching targets:', error);
      setTargets([]);
      setTargetsLoading(false);
    }
  }, [isDemoMode, getAllTargetsWithAssignments]);

  // Fetch recent sessions for average score calculation
  const fetchRecentSessionsData = useCallback(async () => {
    try {
      console.log(`🔄 Dashboard: Fetching recent sessions (${isDemoMode ? 'DEMO' : 'LIVE'} mode)...`);
      
      if (isDemoMode) {
        // Demo mode: ALWAYS use mock sessions
        const mockSessions = await apiWrapper.getRecentSessions(true, 'demo-user', 10);
        setRecentSessions(mockSessions);
        console.log('✅ DEMO: Loaded mock sessions:', mockSessions.length);
      } else {
        // Live mode: ONLY fetch real sessions if user is logged in
        if (!user?.id) {
          console.log('⚠️ LIVE: No user ID, clearing sessions');
          setRecentSessions([]);
          return;
        }
        const sessions = await fetchRecentSessions(user.id, 10);
        setRecentSessions(sessions);
        console.log('✅ LIVE: Recent sessions loaded:', sessions.length);
      }
    } catch (error) {
      console.error('❌ Dashboard: Error fetching recent sessions:', error);
      setRecentSessions([]);
    }
  }, [isDemoMode, user?.id]);

  // Smart polling system with heartbeat detection
  const fetchAllData = useCallback(async () => {
    // Prevent multiple simultaneous fetches
    if (isFetchingRef.current) {
      console.log('🔄 Dashboard: Fetch already in progress, skipping...');
      return;
    }

    isFetchingRef.current = true;
    try {
      console.log(`🔄 Dashboard: Fetching all data (${isDemoMode ? 'DEMO' : 'LIVE'} mode)...`);
      
      if (isDemoMode) {
        // Demo mode: only fetch mock data
        console.log('🎭 DEMO: Using mock data for all dashboard stats');
        await Promise.all([
          fetchMergedTargets(),
          fetchRecentSessionsData(),
          loadGameHistory(true) // Load mock game history
        ]);
      } else {
        // Live mode: fetch real data
        const promises = [
          fetchRooms(),
          refreshDashboardStats(),
          fetchRecentSessionsData()
        ];

        // Fetch merged targets separately
        fetchMergedTargets();

        // Try to fetch from ThingsBoard if available
        if (tbToken) {
          promises.push(
            fetchStats(tbToken),
            refreshTargets()
          );
        }
        
        // Load real game history from Supabase
        promises.push(loadGameHistory(false));

        await Promise.allSettled(promises);
      }
      
      console.log('✅ Dashboard: Data fetch completed');
    } catch (error) {
      console.error('❌ Dashboard: Error fetching data:', error);
    } finally {
      isFetchingRef.current = false;
    }
  }, [isDemoMode, tbToken, fetchStats, refreshTargets, fetchRooms, refreshDashboardStats, fetchMergedTargets, fetchRecentSessionsData, loadGameHistory]);

  // Comprehensive refresh function for manual refresh button
  const comprehensiveRefresh = useCallback(async () => {
    console.log(`🔄 Dashboard: Starting comprehensive refresh (${isDemoMode ? 'DEMO' : 'LIVE'} mode)...`);
    
    try {
      if (isDemoMode) {
        // Demo mode: only refresh mock data
        console.log('🎭 DEMO: Refreshing mock data...');
        await fetchAllData();
      } else {
        // Live mode: full sync
        // 1. Sync with ThingsBoard (targets and sessions)
        console.log('🔄 Syncing with ThingsBoard...');
        await forceThingsBoardSync();
        
        // 2. Refresh Supabase rooms
        console.log('🔄 Refreshing Supabase rooms...');
        await fetchRooms();
        
        // 3. Refresh all other data
        console.log('🔄 Refreshing all dashboard data...');
        await fetchAllData();
      }
      
      console.log('✅ Dashboard: Comprehensive refresh completed');
    } catch (error) {
      console.error('❌ Dashboard: Error during comprehensive refresh:', error);
      // Still try to refresh basic data even if sync fails
      try {
        await fetchAllData();
      } catch (fallbackError) {
        console.error('❌ Dashboard: Fallback refresh also failed:', fallbackError);
      }
    }
  }, [isDemoMode, forceThingsBoardSync, fetchRooms, fetchAllData]);

  // Disable shooting activity polling in demo mode (no real-time data)
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
  } = useShootingActivityPolling(
    isDemoMode ? async () => {} : fetchAllData, // Don't poll in demo mode
    {
      activeInterval: 10000,
      recentInterval: 30000,
      standbyInterval: 60000,
      activeThreshold: 30000,
      standbyThreshold: 600000
    }
  );

  // Initial data fetch - start immediately, don't wait for sync
  // Re-fetch when demo mode changes and clear old data
  useEffect(() => {
    console.log(`🔄 Dashboard: Mode changed to ${isDemoMode ? 'DEMO' : 'LIVE'}, clearing old data...`);
    
    // Clear all data when switching modes to prevent leakage
    setTargets([]);
    setRecentSessions([]);
    setTargetsLoading(false);
    
    console.log(`🧹 Dashboard: Cleared old data. Fetching ${isDemoMode ? 'MOCK' : 'REAL'} data...`);
    
    // Fetch new data for the current mode
    fetchAllData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDemoMode]);

  // Additional fetch after sync completes (if it does) - skip in demo mode
  useEffect(() => {
    if (!isDemoMode && isReady && syncStatus.isComplete) {
      console.log('🔄 Dashboard: Sync completed, refreshing data...');
      fetchAllData();
    }
  }, [isDemoMode, isReady, syncStatus.isComplete, fetchAllData]);

  // Use targets based on mode
  // In demo mode, always use our fetched mock targets
  // In live mode, use merged targets if available, otherwise fallback to raw targets
  const currentTargets = isDemoMode 
    ? targets 
    : (targets.length > 0 ? targets : rawTargets);
  
  // Generate mock target activity data for demo mode
  const mockTargetActivity = isDemoMode ? [
    {
      deviceId: 'mock-target-001',
      deviceName: 'Target Alpha',
      isActivelyShooting: true, // Currently shooting
      isRecentlyActive: true,
      isStandby: false,
      lastShotTime: Date.now() - 5000, // 5 seconds ago
      totalShots: 45
    },
    {
      deviceId: 'mock-target-002',
      deviceName: 'Target Bravo',
      isActivelyShooting: false,
      isRecentlyActive: true, // Shot recently but not active now
      isStandby: false,
      lastShotTime: Date.now() - 25000, // 25 seconds ago
      totalShots: 32
    },
    {
      deviceId: 'mock-target-003',
      deviceName: 'Target Charlie',
      isActivelyShooting: true, // Currently shooting
      isRecentlyActive: true,
      isStandby: false,
      lastShotTime: Date.now() - 8000, // 8 seconds ago
      totalShots: 38
    },
    {
      deviceId: 'mock-target-005',
      deviceName: 'Target Echo',
      isActivelyShooting: false,
      isRecentlyActive: false,
      isStandby: true, // Standby mode
      lastShotTime: Date.now() - 800000, // 13+ minutes ago
      totalShots: 12
    },
    {
      deviceId: 'mock-target-006',
      deviceName: 'Target Foxtrot',
      isActivelyShooting: false,
      isRecentlyActive: false,
      isStandby: true, // Standby mode
      lastShotTime: Date.now() - 1200000, // 20 minutes ago
      totalShots: 8
    }
  ] : targetActivity;
  
  // Generate mock hit trend for demo mode with realistic progression
  const mockHitTrend = isDemoMode ? apiWrapper.getHitTrend(true) : hitTrend;
  
  // Don't show loading if we have data
  const shouldShowTargetsLoading = targetsLoading && currentTargets.length === 0;
  
  // Calculate statistics based on mode
  const onlineTargets = currentTargets.filter(target => target.status === 'online').length;
  // In demo mode, show mock room count (3), in live mode show real rooms
  const totalRooms = isDemoMode ? 3 : rooms.length;
  const recentGames = gameHistory.slice(0, 3);
  
  // Calculate average score from recent sessions (same data source as profile page)
  const avgScore = recentSessions.length > 0 
    ? Math.round(recentSessions.reduce((sum, s) => sum + (s.score || 0), 0) / recentSessions.length)
    : lastScenarioScore;

  // Calculate room utilization based on assigned targets vs total targets
  const assignedTargets = currentTargets.filter(target => target.roomId).length;
  const totalTargets = currentTargets.length;
  const roomUtilization = totalTargets > 0 ? Math.round((assignedTargets / totalTargets) * 100) : 0;
  
  // Debug logging for room utilization
  console.log('📊 Room Utilization Calculation:', {
    dataSource: targets.length > 0 ? 'merged' : 'raw',
    totalTargets,
    assignedTargets,
    unassignedTargets: totalTargets - assignedTargets,
    roomUtilization: `${roomUtilization}%`,
    roomDetails: rooms.map(room => ({ name: room.name, targetCount: room.targetCount })),
    targetDetails: currentTargets.map(t => ({ name: t.name, roomId: t.roomId, hasRoomId: !!t.roomId }))
  });

  // Debug logging for raw data from ThingsBoard
  console.log('🔍 Raw ThingsBoard Data Debug:', {
    rawTargetsCount: rawTargets.length,
    rawTargets: rawTargets.map(t => ({ 
      name: t.name, 
      id: t.id, 
      status: t.status, 
      roomId: t.roomId,
      hasRoomId: !!t.roomId 
    })),
    mergedTargetsCount: targets.length,
    mergedTargets: targets.map(t => ({ 
      name: t.name, 
      id: t.id, 
      status: t.status, 
      roomId: t.roomId,
      hasRoomId: !!t.roomId 
    })),
    loadingStates: {
      targetsLoading,
      shouldShowTargetsLoading,
      roomsLoading
    }
  });

  // Note: Authentication is handled at the route level in App.tsx
  // If we reach this component, the user is already authenticated

  // Debug logging
  console.log('🏠 Dashboard render:', { isReady, syncStatus });

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
            
            {/* Demo Mode Banner */}
            {isDemoMode && (
              <Card className="bg-yellow-50 border-yellow-200">
                <CardContent className="p-3 md:p-4">
                  <div className="flex items-center gap-2">
                    <div className="text-xl">🎭</div>
                    <div>
                      <div className="font-semibold text-yellow-800 text-sm">Demo Mode Active</div>
                      <div className="text-xs text-yellow-700">You're viewing placeholder data. Toggle to Live mode to see real data.</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
            
            {/* Shooting Activity Status Indicator */}
            {!isDemoMode && <ShootingStatusBanner
              hasActiveShooters={hasActiveShooters}
              hasRecentActivity={hasRecentActivity}
              currentMode={currentMode}
              currentInterval={currentInterval}
              activeShotsCount={activeShotsCount}
              recentShotsCount={recentShotsCount}
              targetsCount={targets.length}
              onRefresh={comprehensiveRefresh}
            />}
            
            {/* Stats Cards Grid - Using Real Data */}
            <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-2 md:gap-4">
              <StatCard
                title="Total Registered Targets"
                value={totalTargets}
                subtitle={`${onlineTargets} online`}
                icon={<TargetIcon className="w-6 h-6 -ml-1.5 md:ml-0" />}
                isLoading={shouldShowTargetsLoading}
              />
              <StatCard
                title="Total Rooms"
                value={totalRooms}
                subtitle="Configured spaces"
                icon={<Activity className="w-6 h-6 -ml-1.5 md:ml-0" />}
                isLoading={roomsLoading}
              />
              <StatCard
                title="Average Score"
                value={avgScore ? avgScore : 'N/A'}
                subtitle="hits per session"
                icon={<Trophy className="w-6 h-6 -ml-1.5 md:ml-0" />}
                isLoading={false}
              />
              <StatCard
                title="Target Assignment"
                value={`${roomUtilization}%`}
                subtitle={`${assignedTargets}/${totalTargets} targets assigned`}
                icon={<BarChart3 className="w-6 h-6 -ml-1.5 md:ml-0" />}
                isLoading={shouldShowTargetsLoading || roomsLoading}
              />
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-2 md:gap-4 lg:gap-5">
              
              {/* Activity Chart - Real Target Activity */}
              <Card className="bg-white border-gray-200 shadow-sm rounded-md md:rounded-lg">
                <CardHeader className="pb-1 md:pb-3 p-2 md:p-4">
                  <CardTitle className="text-xs md:text-base lg:text-lg font-heading text-brand-dark">Target Activity</CardTitle>
                </CardHeader>
                <CardContent className="p-2 md:p-4">
                  <ActivityChart 
                    targetActivity={mockTargetActivity} 
                    hitTrend={mockHitTrend} 
                    isLoading={isDemoMode ? false : statsLoading} 
                  />
                </CardContent>
              </Card>

              {/* System Overview - Real Target and Scenario Data */}
              <Card className="bg-white border-gray-200 shadow-sm rounded-md md:rounded-lg">
                <CardHeader className="pb-1 md:pb-3 p-2 md:p-4">
                  <CardTitle className="text-xs md:text-base lg:text-lg font-heading text-brand-dark">System Overview</CardTitle>
                </CardHeader>
                <CardContent className="p-2 md:p-4">
            <SystemOverview 
              targets={currentTargets} 
              gameSessionsCount={gameHistory.length} 
              isLoading={shouldShowTargetsLoading} 
            />
                </CardContent>
              </Card>

              {/* Recent Game/Session Progress */}
              <Card className="bg-white border-gray-200 shadow-sm rounded-md md:rounded-lg">
                <CardHeader className="space-y-1 md:space-y-3 pb-1 md:pb-3 p-2 md:p-4">
                  <>
                    <div className="flex items-center justify-between">
                      <Badge className="bg-red-50 border-red-500 text-red-700 text-xs rounded-sm md:rounded">
                        Latest Game
                      </Badge>
                      {recentGames[0] && (
                        <Badge className="bg-green-600 text-white text-xs rounded-sm md:rounded">
                          Completed
                        </Badge>
                      )}
                    </div>
                    <CardTitle className="text-xs md:text-base lg:text-lg font-heading text-brand-dark">
                      {recentGames[0]?.gameName || 'No Recent Games'}
                    </CardTitle>
                  </>
                </CardHeader>
                <CardContent className="space-y-2 md:space-y-4 p-2 md:p-4">
                  {recentGames[0] ? (
                    <>
                      <p className="text-xs md:text-sm text-brand-dark/70 font-body">
                        Game session - Duration: {recentGames[0].duration}m
                      </p>
                      
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-brand-dark">Total Hits</span>
                          <span className="text-xs font-bold text-brand-dark">
                            {recentGames[0].deviceResults?.reduce((sum, r) => sum + r.hitCount, 0) || 0}
                          </span>
                        </div>
                        <Progress value={Math.min((recentGames[0].deviceResults?.reduce((sum, r) => sum + r.hitCount, 0) || 0), 100)} className="h-1 md:h-2" />
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-xs md:text-sm text-brand-dark/70 font-body">
                          {dayjs(recentGames[0].startTime).format('MMM D, YYYY')}
                        </span>
                      </div>

                      <Button 
                        className="w-full bg-brand-secondary hover:bg-brand-primary text-white font-body"
                        onClick={() => window.location.href = '/dashboard/games'}
                      >
                        View All Games
                      </Button>
                    </>
                  ) : (
                    <div className="text-center py-2 md:py-6">
                      <p className="text-xs text-brand-dark/70 font-body mb-2 md:mb-4">No games yet</p>
                      <Button 
                        className="bg-brand-secondary hover:bg-brand-primary text-white font-body"
                        onClick={() => window.location.href = '/dashboard/games'}
                      >
                        Start Game
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Recent Games List - Enhanced Visual Design */}
            {recentGames.length > 0 && (
              <Card className="bg-white border-gray-200 shadow-sm rounded-md md:rounded-lg">
                <CardHeader className="pb-1 md:pb-3 p-2 md:p-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-xs md:text-base lg:text-lg font-heading text-brand-dark flex items-center gap-2">
                      <Gamepad2 className="h-4 w-4 md:h-5 md:w-5 text-brand-primary" />
                      Recent Games
                    </CardTitle>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      className="text-brand-secondary hover:text-brand-primary text-xs h-6 px-2 rounded-sm md:rounded"
                      onClick={() => window.location.href = '/dashboard/games'}
                    >
                      View All
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="p-2 md:p-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 md:gap-3 lg:gap-4">
                    {recentGames.map((game, index) => {
                      const totalHits = game.deviceResults?.reduce((sum, r) => sum + r.hitCount, 0) || 0;
                      const deviceCount = game.deviceResults?.length || 0;
                      const bestDeviceHits = game.deviceResults?.length > 0 
                        ? Math.max(...game.deviceResults.map(d => d.hitCount))
                        : 0;
                      
                      // Assign different brand colors to each game
                      const cardColors = [
                        'bg-gradient-to-br from-brand-primary/10 to-brand-primary/5 border-brand-primary/30 hover:border-brand-primary',
                        'bg-gradient-to-br from-purple-100/50 to-purple-50/30 border-purple-300/50 hover:border-purple-400',
                        'bg-gradient-to-br from-brand-secondary/10 to-brand-secondary/5 border-brand-secondary/30 hover:border-brand-secondary'
                      ];
                      
                      const iconColors = [
                        'bg-brand-primary/20 text-brand-primary',
                        'bg-purple-200/60 text-purple-700',
                        'bg-brand-secondary/20 text-brand-secondary'
                      ];
                      
                      return (
                        <Card 
                          key={game.gameId} 
                          className={`${cardColors[index % 3]} border-2 rounded-lg transition-all duration-300 hover:shadow-lg sm:hover:scale-105 cursor-pointer`}
                        >
                          <CardContent className="p-3 sm:p-4 space-y-2 sm:space-y-3">
                            {/* Header */}
                            <div className="flex items-center justify-between">
                              <div className={`p-2 rounded-md ${iconColors[index % 3]}`}>
                                <Trophy className="h-4 w-4 sm:h-5 sm:w-5" />
                              </div>
                              <Badge 
                                className="text-[10px] sm:text-xs rounded bg-green-500 text-white border-0 px-2 py-0.5"
                              >
                                ✓ Complete
                              </Badge>
                            </div>
                            
                            {/* Game Name */}
                            <h4 className="font-heading font-semibold text-brand-dark text-sm sm:text-base leading-tight truncate">
                              {game.gameName}
                            </h4>
                            
                            {/* Stats Grid */}
                            <div className="space-y-2">
                              {/* Total Hits - Primary Stat */}
                              <div className="flex items-center justify-between bg-white/50 px-3 py-2 rounded-md shadow-sm">
                                <span className="text-xs sm:text-sm text-brand-dark/70 font-body flex items-center gap-1.5">
                                  <TargetIcon className="h-4 w-4" />
                                  Total Hits
                                </span>
                                <span className="font-bold text-brand-primary text-lg sm:text-xl">{totalHits}</span>
                              </div>
                              
                              {/* Duration & Devices */}
                              <div className="grid grid-cols-2 gap-2">
                                <div className="flex flex-col bg-white/50 px-3 py-2 rounded-md text-center">
                                  <span className="text-[10px] sm:text-xs text-brand-dark/60 font-body mb-0.5">Duration</span>
                                  <span className="font-semibold text-brand-dark text-sm sm:text-base">{game.duration}m</span>
                                </div>
                                <div className="flex flex-col bg-white/50 px-3 py-2 rounded-md text-center">
                                  <span className="text-[10px] sm:text-xs text-brand-dark/60 font-body mb-0.5">Devices</span>
                                  <span className="font-semibold text-brand-dark text-sm sm:text-base">{deviceCount}</span>
                                </div>
                              </div>
                              
                              {/* Best Score */}
                              {bestDeviceHits > 0 && (
                                <div className="flex items-center justify-between bg-yellow-50 px-3 py-2 rounded-md border border-yellow-200 shadow-sm">
                                  <span className="text-xs sm:text-sm text-yellow-700 font-body flex items-center gap-1.5">
                                    <Award className="h-4 w-4" />
                                    Best Score
                                  </span>
                                  <span className="font-bold text-yellow-700 text-sm sm:text-base">{bestDeviceHits} hits</span>
                                </div>
                              )}
                            </div>
                            
                            {/* Date Footer */}
                            <div className="text-[10px] sm:text-xs text-brand-dark/50 text-center pt-2 border-t border-brand-dark/10 font-body">
                              {dayjs(game.startTime).format('MMM D, YYYY • HH:mm')}
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

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