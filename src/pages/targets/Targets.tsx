import React, { useEffect, useState, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { useRooms, type Room } from '@/store/useRooms';
import { toast } from '@/components/ui/sonner';
import Header from '@/components/shared/Header';
import Sidebar from '@/components/shared/Sidebar';
import MobileDrawer from '@/components/shared/MobileDrawer';
import { useIsMobile } from '@/hooks/use-mobile';
import { useShootingActivityPolling, type TargetShootingActivity } from '@/hooks/useShootingActivityPolling';
import { useThingsBoardSync } from '@/hooks/useThingsBoardSync';
import { Target, useTargets } from '@/store/useTargets';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { 
  Plus,
  RefreshCw,
  Search,
  Wifi,
  WifiOff,
  Zap,
  Battery,
  MapPin,
  MoreVertical,
  Settings,
  Trash2
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
// Modern Target Card Component with ThingsBoard integration
const TargetCard: React.FC<{
  target: Target;
  room?: Room;
  activity?: TargetShootingActivity;
  onEdit: () => void;
  onDelete: () => void;
}> = ({ target, room, activity, onEdit, onDelete }) => {
  const isMobile = useIsMobile();
  const batteryLevel = target.battery; // Real battery data or null
  const wifiStrength = target.wifiStrength; // Real WiFi strength or null
  
  // Use activity data directly from ThingsBoard (no custom calculations)
  const totalShots = activity?.totalShots || 0;
  const lastShotTime = activity?.lastShotTime || 0;

  // Use ThingsBoard status as single source of truth
  const isOnline = target.status === 'online';

  // Log displayed values for verification (only in debug mode)
  const isDebugMode = localStorage.getItem('DEBUG_SHOT_RECORDS') === 'true';
  if (isDebugMode) {
    console.log(`📊 [TargetCard] ${target.name} (${target.id}) - ThingsBoard data only:`, {
      deviceId: target.id,
      deviceName: target.name,
      status: target.status,
      roomId: target.roomId,
      battery: target.battery,
      wifiStrength: target.wifiStrength,
      totalShots: totalShots,
      lastShotTime: lastShotTime,
      lastShotTimeReadable: lastShotTime ? new Date(lastShotTime).toISOString() : 'Never'
    });
  }

  return (
    <Card className="bg-white border-gray-200 shadow-sm hover:shadow-md transition-all duration-200 rounded-sm md:rounded-lg">
      <CardContent className="p-2 md:p-6">
        <div className="flex items-start justify-between mb-2 md:mb-4 gap-2">
          <div className="flex-1 flex flex-col items-center min-w-0">
            <div className="flex items-center gap-1 md:gap-2 mb-1 w-full max-w-full">
              <div className={`w-2 h-2 md:w-4 md:h-4 rounded-full flex-shrink-0 ${isOnline ? 'bg-green-500' : 'bg-gray-400'}`}></div>
              <h3 className="font-heading font-semibold text-brand-dark text-xs md:text-base text-center break-words overflow-hidden text-ellipsis flex-1 min-w-0" title={target.name}>{target.name}</h3>
            </div>
          </div>
          
          <div className="flex-shrink-0">
            <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-5 w-5 md:h-8 md:w-8 p-0 flex-shrink-0">
                <MoreVertical className="h-2.5 w-2.5 md:h-4 md:w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-white border border-gray-200 shadow-lg">
              <DropdownMenuItem onClick={onEdit}>
                <Settings className="h-3 w-3 md:h-4 md:w-4 mr-2" />
                <span className="text-xs md:text-sm">Edit</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onDelete} className="text-red-600">
                <Trash2 className="h-3 w-3 md:h-4 md:w-4 mr-2" />
                <span className="text-xs md:text-sm">Delete</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          </div>
        </div>

        <div className="space-y-1 md:space-y-3">
          {/* Status Indicators */}
          <div className="flex items-center justify-center gap-2 md:gap-4">
            <div className="flex items-center gap-1 md:gap-2">
              {isOnline ? (
                <Wifi className="h-2.5 w-2.5 md:h-4 md:w-4 text-green-600" />
              ) : (
                <WifiOff className="h-2.5 w-2.5 md:h-4 md:w-4 text-gray-400" />
              )}
              <span className="text-xs md:text-sm text-brand-dark/70">
                {isOnline ? 'Connected' : 'Disconnected'}
              </span>
            </div>
            
            {isOnline && batteryLevel !== null && (
              <div className="flex items-center gap-1 md:gap-2">
                <Battery className="h-2.5 w-2.5 md:h-4 md:w-4 text-brand-secondary" />
                <span className="text-xs md:text-sm text-brand-dark/70">{batteryLevel}%</span>
              </div>
            )}
          </div>

          {/* Room Assignment and Shooting Activity - Same Line */}
          <div className="flex justify-center gap-4">
            <div className="flex items-center justify-center gap-1">
              {room ? (
                <>
                  <MapPin className="h-2.5 w-2.5 md:h-4 md:w-4 text-brand-primary" />
                  <span className="text-xs md:text-sm font-medium text-brand-dark">{room.name}</span>
                </>
              ) : (
                <span className="text-xs md:text-sm text-brand-dark/50">No Room</span>
              )}
            </div>
            
          </div>

          {/* Target Statistics */}
          <div className="space-y-1 md:space-y-2 pt-1 md:pt-2 border-t border-gray-100">
            <div className="text-center">
              {activity ? (
                <div className="text-sm md:text-2xl font-bold text-brand-primary font-heading">
                  {totalShots}
                </div>
              ) : (
                <div className="h-6 md:h-8 w-12 md:w-16 bg-gray-200 rounded mx-auto animate-pulse"></div>
              )}
              <div className="text-xs md:text-sm text-brand-dark/70 font-body">Total Shots{!isMobile && ' Recorded'}</div>
            </div>
            
            {/* Last Activity */}
            {activity ? (
              lastShotTime > 0 ? (
                <div className="text-center pt-0.5 md:pt-2">
                  <div className="text-xs text-brand-dark/50 font-body">
                    Last: {new Date(lastShotTime).toLocaleDateString()}{!isMobile && ` at ${new Date(lastShotTime).toLocaleTimeString()}`}
                  </div>
                </div>
              ) : (
                <div className="text-center pt-0.5 md:pt-2">
                  <div className="text-xs text-brand-dark/50 font-body">
                    No activity{!isMobile && ' recorded'}
                  </div>
                </div>
              )
            ) : (
              <div className="text-center pt-0.5 md:pt-2">
                <div className="h-3 w-32 md:w-40 bg-gray-200 rounded mx-auto animate-pulse"></div>
              </div>
            )}
          </div>

          {/* Status Badges */}
          <div className="pt-1 md:pt-2 flex justify-center gap-1 md:gap-2">
            <Badge 
              variant={isOnline ? 'default' : 'secondary'}
              className={`text-xs rounded-sm md:rounded ${
                isOnline 
                  ? 'bg-green-100 text-green-700 border-green-200' 
                  : 'bg-gray-100 text-gray-600 border-gray-200'
              }`}
            >
              {isOnline ? 'Online' : 'Offline'}
            </Badge>
            
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// Stats Summary Component
const TargetsSummary: React.FC<{
  targets: Target[];
  rooms: Room[];
}> = ({ targets, rooms }) => {
  const onlineTargets = targets.filter(t => t.status === 'online').length;
  const offlineTargets = targets.filter(t => t.status === 'offline').length;
  const unassignedTargets = targets.filter(t => !t.roomId).length;

  const stats = [
    { label: 'Total Targets', value: targets.length, color: 'text-brand-dark' },
    { label: 'Online', value: onlineTargets, color: 'text-green-600' },
    { label: 'Offline', value: offlineTargets, color: 'text-gray-600' },
    { label: 'Unassigned', value: unassignedTargets, color: 'text-yellow-600' },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4 mb-3 md:mb-6">
      {stats.map((stat, index) => (
        <Card key={`stat-${stat.label}-${index}`} className="bg-white border-gray-200 shadow-sm rounded-sm md:rounded-lg">
          <CardContent className="p-2 md:p-4 text-center">
            <div className={`text-sm md:text-2xl font-bold ${stat.color} font-heading`}>
              {stat.value}
            </div>
            <div className="text-xs md:text-sm text-brand-dark/70 font-body">
              {stat.label}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

const Targets: React.FC = () => {
  const location = useLocation();
  const isMobile = useIsMobile();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const { rooms: liveRooms, isLoading: roomsLoading, fetchRooms, getAllTargetsWithAssignments } = useRooms();
  const { forceSync: forceThingsBoardSync } = useThingsBoardSync();
  const { setTargets: setTargetsStore } = useTargets();
  
  // Local state
  const [targets, setTargets] = useState<Target[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  // Data caching for performance optimization
  const [dataCache, setDataCache] = useState<{
    targets: Target[];
    fetchTime: number;
  } | null>(null);
  
  const CACHE_DURATION = 30000; // 30 seconds
  
  // Use live rooms
  const rooms = liveRooms;
  const [searchTerm, setSearchTerm] = useState('');
  const [roomFilter, setRoomFilter] = useState<string>('all');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newTargetName, setNewTargetName] = useState('');
  const [newTargetRoomId, setNewTargetRoomId] = useState<string>('');

  // Extract token and optional roomId filter from URL params
  const params = new URLSearchParams(location.search);
  const tbToken = localStorage.getItem('tb_access');
  const roomIdParam = params.get('roomId');
  const roomId = roomIdParam ? Number(roomIdParam) : undefined;

  // Fetch targets with room assignments (optimized with caching)
  const fetchTargetsWithAssignments = useCallback(async () => {
    console.log('🔍 [Targets] fetchTargetsWithAssignments() called');
    
    // Check cache first
    if (dataCache && Date.now() - dataCache.fetchTime < CACHE_DURATION) {
      console.log('✅ [Targets] Using cached targets data:', dataCache.targets.length, 'targets');
      console.log('✅ [Targets] Cached targets summary:', dataCache.targets.map(t => ({
        id: t.id,
        name: t.name,
        status: t.status,
        roomId: t.roomId
      })));
      setTargets(dataCache.targets);
      return;
    }

    setIsLoading(true);
    try {
      console.log('🔄 [Targets] Fetching targets (LIVE mode)...');
      
      // Live mode: use real targets directly from API
      console.log('🔄 [Targets] LIVE: Fetching targets directly from API...');
      try {
        const { API } = await import('@/lib/api');
        const rawTargets = await API.getTargets();
        console.log('🔄 [Targets] LIVE: API.getTargets returned:', {
          count: Array.isArray(rawTargets) ? rawTargets.length : 0,
          isArray: Array.isArray(rawTargets),
          sample: Array.isArray(rawTargets) ? rawTargets[0] : 'No data'
        });
        
        // Transform to Target format
        const transformedTargets = Array.isArray(rawTargets) ? rawTargets.map((target: any) => ({
          id: target.id?.id || target.id,
          name: target.name,
          status: target.status || 'offline', // Use real status from ThingsBoard, default to offline
          battery: target.battery || null, // Real battery or null (no default!)
          wifiStrength: target.wifiStrength || null, // Real WiFi or null (no default!)
          roomId: target.roomId || null,
          telemetry: target.telemetry || {},
          lastEvent: target.lastEvent || null,
          lastGameId: target.lastGameId || null,
          lastGameName: target.lastGameName || null,
          lastHits: target.lastHits || null,
          lastActivity: target.lastActivity || null,
          lastActivityTime: target.lastActivityTime || null, // Include lastActivityTime from ThingsBoard
          deviceName: target.deviceName || target.name,
          deviceType: target.deviceType || 'default',
          createdTime: target.createdTime || null,
          additionalInfo: target.additionalInfo || {},
        })) : [];
        
        console.log('🔄 [Targets] LIVE: Transformed targets:', transformedTargets.map(t => ({
          id: t.id,
          name: t.name,
          status: t.status,
          roomId: t.roomId,
          deviceName: t.deviceName,
          deviceType: t.deviceType
        })));
        
        setTargets(transformedTargets);
        setDataCache({ targets: transformedTargets, fetchTime: Date.now() });
        console.log('✅ [Targets] LIVE: Loaded real targets:', transformedTargets.length);
        
        // Populate Zustand store for shooting activity polling
        console.log('🔄 [Targets] LIVE: Populating Zustand store with real targets...');
        console.log('🔄 [Targets] LIVE: About to call setTargetsStore with:', transformedTargets.length, 'targets');
        setTargetsStore(transformedTargets);
        console.log('🔄 [Targets] LIVE: setTargetsStore called successfully');
      } catch (error) {
        console.error('❌ [Targets] LIVE: Error fetching targets directly:', error);
        setTargets([]);
      }
    } catch (error) {
      console.error('❌ [Targets] Error fetching targets:', error);
      setTargets([]);
    } finally {
      setIsLoading(false);
    }
  }, [getAllTargetsWithAssignments, dataCache]);

  // Smart polling system for targets data (optimized with parallel fetching)
  const fetchTargetsData = useCallback(async () => {
    console.log('🔄 Setting loading to true');
    setIsLoading(true);
    try {
      console.log('🔄 Polling targets data (LIVE mode)...');
      
      // Live mode: fetch in parallel with direct API calls
      try {
          const [roomsResult, targetsResult] = await Promise.allSettled([
            fetchRooms(),
            (async () => {
              const { API } = await import('@/lib/api');
              const rawTargets = await API.getTargets();
              
              // Transform to Target format
              return Array.isArray(rawTargets) ? rawTargets.map((target: any) => ({
                id: target.id?.id || target.id,
                name: target.name,
                status: target.status || 'offline', // Use real status from ThingsBoard, default to offline
                battery: target.battery || null, // Real battery or null (no default!)
                wifiStrength: target.wifiStrength || null, // Real WiFi or null (no default!)
                roomId: target.roomId || null,
                telemetry: target.telemetry || {},
                lastEvent: target.lastEvent || null,
                lastGameId: target.lastGameId || null,
                lastGameName: target.lastGameName || null,
                lastHits: target.lastHits || null,
                lastActivity: target.lastActivity || null,
                lastActivityTime: target.lastActivityTime || null, // Include lastActivityTime from ThingsBoard
                deviceName: target.deviceName || target.name,
                deviceType: target.deviceType || 'default',
                createdTime: target.createdTime || null,
                additionalInfo: target.additionalInfo || {},
              })) : [];
            })()
          ]);
          
          // Handle results with proper error checking
          
          if (roomsResult.status === 'rejected') {
            console.error('❌ LIVE: Failed to fetch rooms:', roomsResult.reason);
          }
          
          if (targetsResult.status === 'rejected') {
            console.error('❌ LIVE: Failed to fetch targets:', targetsResult.reason);
            setTargets([]);
            return;
          }
          
          const targetsDataValue = targetsResult.value;
          console.log('🔄 LIVE: Parallel fetch - targets data:', {
            count: targetsDataValue?.length || 0,
            isArray: Array.isArray(targetsDataValue),
            sample: targetsDataValue?.[0] || 'No data'
          });
          setTargets(targetsDataValue || []);
          setDataCache({ targets: targetsDataValue || [], fetchTime: Date.now() });
          console.log('✅ LIVE: Set targets and cache:', targetsDataValue?.length || 0, 'targets');
          
          // Populate Zustand store for shooting activity polling IMMEDIATELY
          console.log('🔄 LIVE: Populating Zustand store with targets...');
          console.log('🔄 LIVE: About to call setTargetsStore with:', targetsDataValue?.length || 0, 'targets');
          setTargetsStore(targetsDataValue || []);
          console.log('🔄 LIVE: setTargetsStore called successfully');
          
          // Trigger shooting activity polling immediately after targets are set
          // This ensures shot records start fetching as soon as targets are available
          console.log('🔄 LIVE: Triggering immediate shooting activity check...');
          // The useShootingActivityPolling hook will automatically detect the new targets
          // and start fetching telemetry data in parallel
          
        } catch (error) {
          console.error('❌ LIVE: Error in parallel fetch:', error);
          console.error('❌ LIVE: Error details:', {
            message: error.message,
            stack: error.stack,
            name: error.name
          });
          setTargets([]);
        }
    } catch (error) {
      console.error('Error fetching targets data:', error);
      setTargets([]);
    } finally {
      console.log('🔄 Setting loading to false');
      setIsLoading(false);
    }
  }, [fetchRooms, getAllTargetsWithAssignments, setTargetsStore]);

  // Comprehensive refresh function for manual refresh button (optimized)
  const comprehensiveRefresh = useCallback(async () => {
    console.log(`🔄 Targets: Starting comprehensive refresh...`);
    
    // Invalidate cache
    setDataCache(null);
    
    try {
      // Live mode: parallel execution for faster refresh with error handling
      try {
        await Promise.allSettled([
          forceThingsBoardSync(),
          fetchRooms()
        ]);
        
        await fetchTargetsData();
      } catch (error) {
        console.error('❌ Error during parallel refresh:', error);
        // Fallback to basic refresh
        await fetchTargetsData();
      }
      
      console.log('✅ Targets: Comprehensive refresh completed');
    } catch (error) {
      console.error('❌ Targets: Error during comprehensive refresh:', error);
      // Fallback to basic refresh
      await fetchTargetsData();
    }
  }, [forceThingsBoardSync, fetchRooms, fetchTargetsData, fetchTargetsWithAssignments]);

  // Shooting activity polling for real-time telemetry data
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
    fetchTargetsData, // Always poll for real-time data
    {
      activeInterval: 10000,
      recentInterval: 30000,
      standbyInterval: 60000,
      activeThreshold: 30000,
      standbyThreshold: 600000
    }
  );

  // Log targetActivity data when it changes
  useEffect(() => {
    const isDebugMode = localStorage.getItem('DEBUG_SHOT_RECORDS') === 'true';
    // Always log for now to help with verification
    if (targetActivity && targetActivity.length > 0) {
      console.log('📊 [Targets] targetActivity data received:', {
        totalActivityRecords: targetActivity.length,
        activityData: targetActivity.map(activity => ({
          deviceId: activity.deviceId,
          totalShots: activity.totalShots,
          lastShotTime: activity.lastShotTime,
          lastShotTimeReadable: activity.lastShotTime ? new Date(activity.lastShotTime).toISOString() : 'Never',
          isActivelyShooting: activity.isActivelyShooting,
          isRecentlyActive: activity.isRecentlyActive,
          isStandby: activity.isStandby
        })),
        pollingMode: currentMode,
        pollingInterval: currentInterval,
        activeShooters: activeShotsCount,
        recentActivity: recentShotsCount
      });
    } else {
      console.log('📊 [Targets] No targetActivity data available');
    }
  }, [targetActivity, currentMode, currentInterval, activeShotsCount, recentShotsCount]);

  // Consolidated verification summary for easy comparison with check script
  const logVerificationSummary = useCallback(() => {
    const timestamp = new Date().toISOString();
    console.log('='.repeat(80));
    console.log(`🔍 [VERIFICATION] Shot Records Summary - ${timestamp}`);
    console.log('='.repeat(80));
    
    console.log('📊 [VERIFICATION] System Status:', {
      mode: 'LIVE',
      pollingMode: currentMode,
      pollingInterval: `${currentInterval}s`,
      totalTargets: targets.length,
      onlineTargets: targets.filter(t => t.status === 'online').length,
      offlineTargets: targets.filter(t => t.status === 'offline').length,
      activeShooters: activeShotsCount,
      recentActivity: recentShotsCount
    });

    console.log('📊 [VERIFICATION] Target Details:');
    targets.forEach((target, index) => {
      const activity = targetActivity.find(a => a.deviceId === target.id);
      console.log(`  ${index + 1}. ${target.name} (${target.id}):`, {
        status: target.status,
        roomId: target.roomId || 'unassigned',
        deviceName: target.deviceName,
        deviceType: target.deviceType,
        battery: target.battery,
        wifiStrength: target.wifiStrength,
        totalShots: activity?.totalShots || 0,
        lastShotTime: activity?.lastShotTime || 0,
        lastShotTimeReadable: activity?.lastShotTime ? new Date(activity.lastShotTime).toISOString() : 'Never'
      });
    });

    console.log('📊 [VERIFICATION] Data Flow Summary:');
    console.log('  1. ThingsBoard API → getLatestTelemetry() → Raw telemetry data');
    console.log('  2. useShootingActivityPolling → Process hits data → Activity calculations');
    console.log('  3. Targets Page → Map activity to targets → Display values');
    console.log('  4. TargetCard → Render final UI values');
    
    console.log('📊 [VERIFICATION] Key Verification Points:');
    console.log('  • Check that totalShots matches ThingsBoard hits value');
    console.log('  • Check that lastShotTime matches ThingsBoard hit_ts value');
    console.log('  • Check that activity status reflects actual data');
    console.log('  • Compare with check script output for device names and IDs');
    
    console.log('='.repeat(80));
  }, [targets, targetActivity, currentMode, currentInterval, activeShotsCount, recentShotsCount]);

  // Log verification summary when targets or activity data changes
  useEffect(() => {
    if (targets.length > 0) {
      logVerificationSummary();
    }
  }, [targets, targetActivity, logVerificationSummary]);

  // Handle cache updates
  useEffect(() => {
    if (dataCache && dataCache.targets.length > 0) {
      console.log('✅ Cache updated, setting targets:', dataCache.targets.length);
      setTargets(dataCache.targets);
      setIsLoading(false);
    }
  }, [dataCache]);

  // Initial data fetch - optimized with cache checking
  useEffect(() => {
    // Skip if data is fresh
    if (dataCache && Date.now() - dataCache.fetchTime < CACHE_DURATION) {
      console.log('✅ Using cached data on mount');
      setTargets(dataCache.targets);
      setIsLoading(false);
      return;
    }

    console.log('🔄 Targets: Mode changed to LIVE, fetching data...');
    
    // Clear old data and set loading state
    setTargets([]);
    setIsLoading(true);
    
    // Fetch new data
    fetchTargetsData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Remove dataCache from deps to prevent infinite loop

  // Handle refresh
  const handleRefresh = async () => {
    console.log('🔄 Refreshing targets from ThingsBoard...');
    await forceUpdate();
    toast.success('🔗 Targets refreshed from ThingsBoard');
  };

  // Filter targets by search term and room
  const filteredTargets = targets.filter(target => {
    const matchesSearch = target.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRoom = roomFilter === 'all' || 
                       (roomFilter === 'unassigned' && !target.roomId) ||
                       (target.roomId && target.roomId.toString() === roomFilter);
    return matchesSearch && matchesRoom;
  });




  // Deduplicate targets by ID before grouping
  const uniqueTargets = filteredTargets.reduce((acc: Target[], target) => {
    const existingIndex = acc.findIndex(t => t.id === target.id);
    if (existingIndex === -1) {
      acc.push(target);
    } else {
      console.warn(`⚠️ Duplicate target found: ${target.name} (ID: ${target.id})`);
      // Keep the one with more complete data (has roomId or more properties)
      const existing = acc[existingIndex];
      if (target.roomId && !existing.roomId) {
        acc[existingIndex] = target; // Replace with the one that has roomId
        console.log(`   → Replaced with version that has roomId: ${target.roomId}`);
      } else if (Object.keys(target).length > Object.keys(existing).length) {
        acc[existingIndex] = target; // Replace with more complete data
        console.log(`   → Replaced with more complete version`);
      }
    }
    return acc;
  }, []);

  // Group targets by room
  const groupedTargets = uniqueTargets.reduce((groups: Record<string, Target[]>, target) => {
    // Normalize roomId - treat null, undefined, empty string, and 'unassigned' as unassigned
    let roomId: string;
    const rawRoomId = target.roomId;
    
    // Convert to string first, then check for empty values
    const roomIdStr = String(rawRoomId);
    
    if (!rawRoomId || 
        roomIdStr === 'unassigned' || 
        roomIdStr === '' || 
        roomIdStr === 'null' ||
        roomIdStr === 'undefined') {
      roomId = 'unassigned';
    } else {
      roomId = roomIdStr;
    }
    
    if (!groups[roomId]) {
      groups[roomId] = [];
    }
    groups[roomId].push(target);
    return groups;
  }, {});


  // Sort groups: assigned rooms first (alphabetically), then unassigned
  const sortedGroupKeys = Object.keys(groupedTargets).sort((a, b) => {
    // Unassigned targets go to the end
    if (a === 'unassigned') return 1;
    if (b === 'unassigned') return -1;
    
    // Sort assigned rooms alphabetically by name
    const roomA = rooms.find(r => r.id === a);
    const roomB = rooms.find(r => r.id === b);
    const nameA = roomA?.name || a;
    const nameB = roomB?.name || b;
    
    return nameA.localeCompare(nameB);
  });

  // Create sorted grouped targets with comprehensive sorting
  const sortedGroupedTargets: Record<string, Target[]> = {};
  sortedGroupKeys.forEach(key => {
    const targetsInGroup = groupedTargets[key];
    const sortedTargets = [...targetsInGroup].sort((a, b) => {
      // Primary sort: Online status (online first)
      const aOnline = a.status === 'online';
      const bOnline = b.status === 'online';
      
      if (aOnline && !bOnline) return -1; // Online comes first
      if (!aOnline && bOnline) return 1;  // Offline comes after
      
      // Secondary sort: By name (alphabetical)
      return a.name.localeCompare(b.name);
    });
    
    sortedGroupedTargets[key] = sortedTargets;
  });

  // Get room object for display
  const getRoom = (roomId?: string | number) => {
    if (!roomId) return null;
    return rooms.find(room => String(room.id) === String(roomId));
  };

  // Handle target actions
  const handleCreateTarget = async () => {
    if (!newTargetName.trim()) {
      toast.error('Target name is required');
      return;
    }
    
    toast.error('Create target not implemented with ThingsBoard yet');
    
    setNewTargetName('');
    setNewTargetRoomId('');
    setIsAddDialogOpen(false);
  };

  // Remove simple loading spinner - use inline conditional rendering instead

  return (
    <div className="min-h-screen flex flex-col bg-brand-light">
      <Header onMenuClick={() => setIsMobileMenuOpen(true)} />
      
      <div className="flex flex-1">
        {!isMobile && <Sidebar />}
        <MobileDrawer 
          isOpen={isMobileMenuOpen} 
          onClose={() => setIsMobileMenuOpen(false)} 
        />
        
        <main className="flex-1 overflow-y-auto">
          <div className="p-3 md:p-4 lg:p-6 max-w-7xl mx-auto space-y-3 md:space-y-4 lg:space-y-6">
            
            

            {/* Page Header */}
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-4">
                <h1 className="text-3xl font-heading font-semibold text-brand-dark">Targets</h1>
                <div className="flex items-center gap-2">
                  <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                  <DialogTrigger asChild>
                    <Button className="bg-brand-primary hover:bg-brand-primary/90 text-white">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Target
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                      <DialogTitle className="font-heading">Add New Target</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div className="grid gap-2">
                        <Label htmlFor="target-name" className="text-brand-dark font-body">Target Name</Label>
                        <Input
                          id="target-name"
                          value={newTargetName}
                          onChange={(e) => setNewTargetName(e.target.value)}
                          placeholder="Enter target name"
                          className="bg-white border-gray-200 text-brand-dark"
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="target-room" className="text-brand-dark font-body">Room (Optional)</Label>
                        <Select value={newTargetRoomId} onValueChange={setNewTargetRoomId}>
                          <SelectTrigger className="bg-white border-gray-200 text-brand-dark">
                            <SelectValue placeholder="Select a room" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">No Room</SelectItem>
                            {rooms.map(room => (
                              <SelectItem key={room.id} value={room.id.toString()}>
                                {room.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <Button 
                        onClick={handleCreateTarget}
                        className="bg-brand-primary hover:bg-brand-primary/90 text-white"
                      >
                        Create Target
                      </Button>
                    </div>
                  </DialogContent>
                  </Dialog>
                </div>
              </div>
              <p className="text-brand-dark/70 font-body">Manage your shooting targets and monitor their status</p>
            </div>

            {/* Stats Summary */}
            {isLoading ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4 mb-3 md:mb-6">
                {[...Array(4)].map((_, i) => (
                  <Card key={i} className="bg-white border-gray-200 shadow-sm rounded-sm md:rounded-lg animate-pulse">
                    <CardContent className="p-2 md:p-4 text-center">
                      <div className="h-6 md:h-8 w-12 md:w-16 bg-gray-200 rounded mx-auto mb-2"></div>
                      <div className="h-3 md:h-4 w-16 md:w-20 bg-gray-200 rounded mx-auto"></div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <TargetsSummary targets={targets} rooms={rooms} />
            )}

            {/* Search and Filters */}
            {isLoading ? (
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1 h-10 bg-gray-200 rounded animate-pulse"></div>
                <div className="w-full md:w-48 h-10 bg-gray-200 rounded animate-pulse"></div>
              </div>
            ) : (
              <div className="flex flex-col md:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-brand-dark/50" />
                  <Input
                    placeholder="Search targets..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 bg-white border-gray-200 text-brand-dark placeholder:text-brand-dark/50"
                  />
                </div>
                
                <Select value={roomFilter} onValueChange={setRoomFilter}>
                  <SelectTrigger className="w-full md:w-48 bg-white border-gray-200 text-brand-dark">
                    <SelectValue placeholder="Filter by room" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Rooms</SelectItem>
                    <SelectItem value="unassigned">Unassigned</SelectItem>
                    {rooms.map(room => (
                      <SelectItem key={room.id} value={room.id.toString()}>
                        {room.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}


            {/* Targets Grid */}
            {isLoading ? (
              <div className="space-y-8">
                {/* Skeleton for 2 room sections */}
                {[...Array(2)].map((_, sectionIndex) => (
                  <div key={sectionIndex}>
                    {/* Room section header skeleton */}
                    <div className="flex items-center gap-2 mb-2 md:mb-4">
                      <div className="h-5 md:h-6 w-32 md:w-40 bg-gray-200 rounded animate-pulse"></div>
                      <div className="h-6 w-16 bg-gray-200 rounded-full animate-pulse"></div>
                    </div>
                    
                    {/* Target cards skeleton - 3 cards per row */}
                    <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-2 md:gap-6">
                      {[...Array(3)].map((_, cardIndex) => (
                        <Card key={cardIndex} className="bg-white border-gray-200 shadow-sm rounded-sm md:rounded-lg animate-pulse">
                          <CardContent className="p-2 md:p-6">
                            {/* Target name with status dot */}
                            <div className="flex items-center justify-between mb-2 md:mb-4">
                              <div className="flex-1 flex flex-col items-center">
                                <div className="flex items-center gap-1 md:gap-2 mb-1">
                                  <div className="w-2 h-2 md:w-4 md:h-4 rounded-full bg-gray-200"></div>
                                  <div className="h-3 md:h-4 w-24 md:w-32 bg-gray-200 rounded"></div>
                                </div>
                              </div>
                              <div className="h-5 w-5 md:h-8 md:w-8 bg-gray-200 rounded"></div>
                            </div>

                            <div className="space-y-1 md:space-y-3">
                              {/* Status indicators */}
                              <div className="flex items-center justify-center gap-2 md:gap-4">
                                <div className="h-3 md:h-4 w-20 md:w-24 bg-gray-200 rounded"></div>
                                <div className="h-3 md:h-4 w-16 md:w-20 bg-gray-200 rounded"></div>
                              </div>

                              {/* Room and activity */}
                              <div className="flex justify-center gap-4">
                                <div className="h-3 md:h-4 w-16 md:w-20 bg-gray-200 rounded"></div>
                                <div className="h-3 md:h-4 w-16 md:w-20 bg-gray-200 rounded"></div>
                              </div>

                              {/* Stats section */}
                              <div className="space-y-1 md:space-y-2 pt-1 md:pt-2 border-t border-gray-100">
                                <div className="text-center">
                                  <div className="h-6 md:h-8 w-12 bg-gray-200 rounded mx-auto mb-1"></div>
                                  <div className="h-3 w-20 md:w-28 bg-gray-200 rounded mx-auto"></div>
                                </div>
                                
                                <div className="text-center pt-0.5 md:pt-2">
                                  <div className="h-3 w-32 md:w-40 bg-gray-200 rounded mx-auto"></div>
                                </div>
                              </div>

                              {/* Status badges */}
                              <div className="pt-1 md:pt-2 flex justify-center gap-1 md:gap-2">
                                <div className="h-5 w-14 md:w-16 bg-gray-200 rounded"></div>
                                <div className="h-5 w-14 md:w-16 bg-gray-200 rounded"></div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : Object.keys(groupedTargets).length === 0 ? (
              <Card className="bg-white border-gray-200 shadow-sm">
                <CardContent className="p-12 text-center">
                  <div className="text-brand-dark/50 mb-4">
                    <Zap className="h-12 w-12 mx-auto mb-4" />
                  </div>
                  <h3 className="text-lg font-heading text-brand-dark mb-2">No targets found</h3>
                  <p className="text-brand-dark/70 font-body mb-6">
                    {searchTerm || roomFilter !== 'all' 
                      ? 'Try adjusting your search or filter criteria.'
                      : 'Get started by adding your first target device.'
                    }
                  </p>
                  
                  
                  {!searchTerm && roomFilter === 'all' && (
                    <Button 
                      onClick={() => setIsAddDialogOpen(true)}
                      className="bg-brand-primary hover:bg-brand-primary/90 text-white mt-4"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add First Target
                    </Button>
                  )}
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-8">
                {Object.entries(sortedGroupedTargets).map(([roomId, roomTargets]: [string, Target[]]) => {
                  const room = roomId !== 'unassigned' ? getRoom(roomId) : null;
                  
                  return (
                    <div key={roomId}>
                      {/* Room Section Header */}
                      <div className="flex items-center justify-between mb-2 md:mb-4">
                        <div className="flex items-center gap-2">
                          <h2 className="text-sm md:text-xl font-heading font-semibold text-brand-dark">
                            {room ? room.name : 'Unassigned Targets'}
                          </h2>
                          <Badge className="bg-red-50 border-red-500 text-red-700 text-xs rounded-lg md:rounded-xl">
                            {roomTargets.length} target{roomTargets.length !== 1 ? 's' : ''}
                          </Badge>
                        </div>
                        
                        {/* Status Summary */}
                        <div className="flex items-center gap-2 text-xs text-brand-dark/70">
                          <div className="flex items-center gap-1">
                            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                            <span>{roomTargets.filter(t => t.status === 'online').length} online</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                            <span>{roomTargets.filter(t => t.status !== 'online').length} offline</span>
                          </div>
                        </div>
                      </div>
                      
                      {/* Targets Grid */}
                      <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-2 md:gap-6">
                        {roomTargets.map((target, index) => {
                          // Find activity data for this target
                          const targetActivityData = targetActivity.find(activity => activity.deviceId === target.id);
                          
                          // Use a more reliable key
                          const targetKey = target.id || `target-${index}`;
                          
                          return (
                            <TargetCard
                              key={targetKey}
                              target={target}
                              room={room}
                              activity={targetActivityData}
                              onEdit={() => {
                                toast.info('Edit functionality coming soon');
                              }}
                              onDelete={() => {
                                toast.info('Delete functionality coming soon');
                              }}
                            />
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

          </div>
        </main>
      </div>
    </div>
  );
};

export default Targets;