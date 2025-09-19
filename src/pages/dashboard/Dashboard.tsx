import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { Target as TargetIcon, Users, Calendar, Bell, Clock, Zap, Trophy, TrendingUp, Activity, BarChart3, Play, User, X, Gamepad2, BarChart, Award } from 'lucide-react';
import { useStats } from '@/store/useStats';
import { useDashboardStats } from '@/store/useDashboardStats';
import { useTargets, type Target } from '@/store/useTargets';
import { useRooms } from '@/store/useRooms';
import { useScenarios, type ScenarioHistory } from '@/store/useScenarios';
import { useAuth } from '@/providers/AuthProvider';
import Header from '@/components/shared/Header';
import Sidebar from '@/components/shared/Sidebar';
import MobileDrawer from '@/components/shared/MobileDrawer';
import { useIsMobile } from '@/hooks/use-mobile';
import { useShootingActivityPolling } from '@/hooks/useShootingActivityPolling';
import { useInitialSync } from '@/hooks/useInitialSync';
import type { TargetShootingActivity } from '@/hooks/useShootingActivityPolling';
import ShootingStatusBanner from '@/components/shared/ShootingStatusBanner';
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
}> = ({ targetActivity, hitTrend, isLoading }) => {
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
  scenarios: ScenarioHistory[];
  isLoading: boolean;
}> = ({ targets, scenarios, isLoading }) => {
  if (isLoading) {
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

  const onlineTargets = targets.filter(t => t.status === 'online').length;
  const offlineTargets = targets.filter(t => t.status === 'offline').length;
  const totalTargets = targets.length;
  const completedScenarios = scenarios.filter(s => s.score > 0).length;
  const totalScenarios = scenarios.length;

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
      value: completedScenarios, 
      total: totalScenarios,
      color: 'text-brand-primary',
      bgColor: 'bg-orange-50'
    },
    { 
      label: 'Total Sessions', 
      value: totalScenarios, 
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
  const isFetchingRef = useRef(false);
  
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
  const { scenarioHistory, isLoading: scenariosLoading, fetchScenarios } = useScenarios();
  
  const { user } = useAuth();
  
  // Initial sync with ThingsBoard (only on dashboard)
  const { syncStatus, isReady } = useInitialSync();

  // Get ThingsBoard token from localStorage
  const tbToken = localStorage.getItem('tb_access');

  // Fetch merged targets with room assignments
  const fetchMergedTargets = useCallback(async () => {
    setTargetsLoading(true);
    try {
      console.log('🔄 Dashboard: Fetching merged targets with assignments...');
      const mergedTargets = await getAllTargetsWithAssignments();
      setTargets(mergedTargets);
      setTargetsLoading(false);
      console.log('✅ Dashboard: Merged targets loaded:', mergedTargets.length);
    } catch (error) {
      console.error('❌ Dashboard: Error fetching merged targets:', error);
      // Fallback to empty array if merged fetch fails
      setTargets([]);
      setTargetsLoading(false);
    }
  }, [getAllTargetsWithAssignments]);

  // Smart polling system with heartbeat detection
  const fetchAllData = useCallback(async () => {
    // Prevent multiple simultaneous fetches
    if (isFetchingRef.current) {
      console.log('🔄 Dashboard: Fetch already in progress, skipping...');
      return;
    }

    isFetchingRef.current = true;
    try {
      console.log('🔄 Dashboard: Fetching all data...');
      
      // Always try to fetch from Supabase first (rooms, targets with assignments)
      const promises = [
        fetchRooms(), // This should work from Supabase
        refreshDashboardStats() // This should work from Supabase
      ];

      // Fetch merged targets separately to avoid dependency issues
      fetchMergedTargets();

      // Try to fetch from ThingsBoard if available
      if (tbToken) {
        promises.push(
          fetchStats(tbToken),
          refreshTargets(),
          fetchScenarios(tbToken)
        );
      }

      await Promise.allSettled(promises); // Use allSettled to not fail if some requests fail
      
      console.log('✅ Dashboard: Data fetch completed');
    } catch (error) {
      console.error('❌ Dashboard: Error fetching data:', error);
    } finally {
      isFetchingRef.current = false;
    }
  }, [tbToken, fetchStats, refreshTargets, fetchRooms, fetchScenarios, refreshDashboardStats, fetchMergedTargets]);

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
  } = useShootingActivityPolling(fetchAllData, {
    activeInterval: 10000,     // 10 seconds during active shooting
    recentInterval: 30000,     // 30 seconds if shot within last 30s but not active
    standbyInterval: 60000,    // 60 seconds if no shots for 10+ minutes
    activeThreshold: 30000,    // 30 seconds - active shooting threshold
    standbyThreshold: 600000   // 10 minutes - standby mode threshold
  });

  // Initial data fetch - start immediately, don't wait for sync
  useEffect(() => {
    console.log('🔄 Dashboard: Starting initial data fetch...');
    fetchAllData();
  }, [fetchAllData]);

  // Additional fetch after sync completes (if it does)
  useEffect(() => {
    if (isReady && syncStatus.isComplete) {
      console.log('🔄 Dashboard: Sync completed, refreshing data...');
      fetchAllData();
    }
  }, [isReady, syncStatus.isComplete, fetchAllData]);

  // Use merged targets if available, otherwise fallback to raw targets
  const currentTargets = targets.length > 0 ? targets : rawTargets;
  
  // Don't show loading if we have data
  const shouldShowTargetsLoading = targetsLoading && currentTargets.length === 0;
  
  // Calculate real statistics
  const onlineTargets = currentTargets.filter(target => target.status === 'online').length;
  const totalRooms = rooms.length;
  const recentScenarios = scenarioHistory.slice(0, 3);
  
  // Calculate average score from recent scenarios
  const avgScore = recentScenarios.length > 0 
    ? Math.round(recentScenarios.reduce((sum, s) => sum + (s.score || 0), 0) / recentScenarios.length)
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
      roomsLoading,
      scenariosLoading
    }
  });

  // Note: Authentication is handled at the route level in App.tsx
  // If we reach this component, the user is already authenticated

  // Debug logging
  console.log('🏠 Dashboard render:', { isReady, syncStatus });
  
  // Show loading screen only if we have no data at all and sync is still loading
  const hasAnyData = rooms.length > 0 || targets.length > 0 || scenarioHistory.length > 0;
  const shouldShowLoading = !isReady && !hasAnyData && syncStatus.isLoading;

  if (shouldShowLoading) {
    return (
      <div className="min-h-screen flex flex-col bg-brand-light">
        <Header onMenuClick={() => setIsMobileMenuOpen(true)} />
        <div className="flex flex-1">
          {!isMobile && <Sidebar />}
          <MobileDrawer 
            isOpen={isMobileMenuOpen} 
            onClose={() => setIsMobileMenuOpen(false)} 
          />
          
          <main className="flex-1 overflow-auto">
            <div className="p-2 md:p-4 lg:p-6 max-w-7xl mx-auto">
              <div className="text-center py-16">
                <div className="bg-white rounded-lg p-8 mx-auto max-w-md shadow-sm border border-gray-200">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary mx-auto mb-4"></div>
                  <div className="text-brand-primary mb-4 text-h3 font-heading">Loading Dashboard</div>
                  <p className="text-brand-dark mb-4 font-body">
                    {syncStatus.isLoading ? 'Syncing with ThingsBoard...' : 'Loading your data...'}
                  </p>
                  {syncStatus.error && (
                    <div className="text-red-600 text-sm">
                      <p>Sync failed - using available data</p>
                      <button 
                        onClick={() => window.location.reload()} 
                        className="mt-2 px-3 py-1 bg-red-100 hover:bg-red-200 rounded text-xs"
                      >
                        Retry
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>
    );
  }

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
            
            {/* Shooting Activity Status Indicator */}
            <ShootingStatusBanner
              hasActiveShooters={hasActiveShooters}
              hasRecentActivity={hasRecentActivity}
              currentMode={currentMode}
              currentInterval={currentInterval}
              activeShotsCount={activeShotsCount}
              recentShotsCount={recentShotsCount}
              onRefresh={forceUpdate}
            />
            
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
                value={avgScore ? `${avgScore}%` : 'N/A'}
                subtitle="Recent sessions"
                icon={<Trophy className="w-6 h-6 -ml-1.5 md:ml-0" />}
                isLoading={scenariosLoading}
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
                    targetActivity={targetActivity} 
                    hitTrend={hitTrend} 
                    isLoading={statsLoading} 
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
              scenarios={scenarioHistory} 
              isLoading={shouldShowTargetsLoading || scenariosLoading} 
            />
                </CardContent>
              </Card>

              {/* Recent Session/Course Progress */}
              <Card className="bg-white border-gray-200 shadow-sm rounded-md md:rounded-lg">
                <CardHeader className="space-y-1 md:space-y-3 pb-1 md:pb-3 p-2 md:p-4">
                  <div className="flex items-center justify-between">
                    <Badge className="bg-red-50 border-red-500 text-red-700 text-xs rounded-sm md:rounded">
                      Latest Session
                    </Badge>
                    {recentScenarios[0]?.score !== undefined && (
                      <Badge className={`${
                        recentScenarios[0].score > 0 ? 'bg-green-600' : 'bg-brand-secondary'
                      } text-white text-xs rounded-sm md:rounded`}>
                        {recentScenarios[0].score > 0 ? 'Completed' : 'Pending'}
                      </Badge>
                    )}
                  </div>
                  <CardTitle className="text-xs md:text-base lg:text-lg font-heading text-brand-dark">
                    {recentScenarios[0]?.name || 'No Recent Sessions'}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 md:space-y-4 p-2 md:p-4">
                  {recentScenarios[0] ? (
                    <>
                      <p className="text-xs md:text-sm text-brand-dark/70 font-body">
                        Training session - Duration: {recentScenarios[0].duration}s
                      </p>
                      
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-brand-dark">Score</span>
                          <span className="text-xs font-bold text-brand-dark">
                            {recentScenarios[0].score ? `${recentScenarios[0].score}%` : 'N/A'}
                          </span>
                        </div>
                        {recentScenarios[0].score && (
                          <Progress value={recentScenarios[0].score} className="h-1 md:h-2" />
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-xs md:text-sm text-brand-dark/70 font-body">
                          {dayjs(recentScenarios[0].date).format('MMM D, YYYY')}
                        </span>
                      </div>

                      <Button 
                        className="w-full bg-brand-secondary hover:bg-brand-primary text-white font-body"
                        onClick={() => window.location.href = '/dashboard/scenarios'}
                      >
                        View All Sessions
                      </Button>
                    </>
                  ) : (
                    <div className="text-center py-2 md:py-6">
                      <p className="text-xs text-brand-dark/70 font-body mb-2 md:mb-4">No sessions yet</p>
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

            {/* Recent Sessions List - Real Data */}
            {recentScenarios.length > 0 && (
              <Card className="bg-white border-gray-200 shadow-sm rounded-md md:rounded-lg">
                <CardHeader className="pb-1 md:pb-3 p-2 md:p-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-xs md:text-base lg:text-lg font-heading text-brand-dark">Recent Sessions</CardTitle>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      className="text-brand-secondary hover:text-brand-primary text-xs h-6 px-2 rounded-sm md:rounded"
                      onClick={() => window.location.href = '/dashboard/scenarios'}
                    >
                      View All
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="p-2 md:p-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-1.5 md:gap-3">
                    {recentScenarios.map((session, index) => (
                      <Card key={session.id} className="border-gray-200 bg-gray-50 rounded-sm md:rounded-lg">
                        <CardContent className="p-1.5 md:p-3 space-y-1 md:space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-brand-dark/70">
                              {dayjs(session.date).format('MMM D, HH:mm')}
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
                            {session.name}
                          </h4>
                          
                          {session.score && (
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-brand-dark/70">Score:</span>
                              <span className="font-bold text-brand-dark">{session.score}%</span>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
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