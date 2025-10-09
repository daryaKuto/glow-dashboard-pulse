import React, { useEffect, useState, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { useRooms, type Room } from '@/store/useRooms';
import { toast } from '@/components/ui/sonner';
import { useDemoMode } from '@/providers/DemoModeProvider';
import { apiWrapper } from '@/services/api-wrapper';
import Header from '@/components/shared/Header';
import Sidebar from '@/components/shared/Sidebar';
import MobileDrawer from '@/components/shared/MobileDrawer';
import { useIsMobile } from '@/hooks/use-mobile';
import { useShootingActivityPolling, type TargetShootingActivity } from '@/hooks/useShootingActivityPolling';
import { useThingsBoardSync } from '@/hooks/useThingsBoardSync';
import ShootingStatusBanner from '@/components/shared/ShootingStatusBanner';
import { Target } from '@/store/useTargets';
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
  const isOnline = target.status === 'online';
  const batteryLevel = target.battery || 0; // Use real battery data or 0 if not available
  
  // Get shooting activity status from the polling system
  const shootingStatus = activity ? {
    isActivelyShooting: activity.isActivelyShooting,
    isRecentlyActive: activity.isRecentlyActive,
    isStandby: activity.isStandby,
    lastShotTime: activity.lastShotTime,
    totalShots: activity.totalShots
  } : {
    isActivelyShooting: false,
    isRecentlyActive: false,
    isStandby: true,
    lastShotTime: 0,
    totalShots: 0
  };

  return (
    <Card className="bg-white border-gray-200 shadow-sm hover:shadow-md transition-all duration-200 rounded-sm md:rounded-lg">
      <CardContent className="p-2 md:p-6">
        <div className="flex items-start justify-between mb-2 md:mb-4">
          <div className="flex-1 flex flex-col items-center">
            <div className="flex items-center gap-1 md:gap-2 mb-1">
              <div className={`w-2 h-2 md:w-4 md:h-4 rounded-full ${isOnline ? 'bg-green-500' : 'bg-gray-400'}`}></div>
              <h3 className="font-heading font-semibold text-brand-dark text-xs md:text-base text-center">{target.name}</h3>
            </div>
          </div>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-5 w-5 md:h-8 md:w-8 p-0 flex-shrink-0">
                <MoreVertical className="h-2.5 w-2.5 md:h-4 md:w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
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
            
            {isOnline && (
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
            
            <div className="flex items-center justify-center gap-1">
              {shootingStatus.isActivelyShooting ? (
                <>
                  <div className="w-1.5 h-1.5 md:w-2 md:h-2 bg-red-500 rounded-full animate-pulse"></div>
                  <span className="text-xs md:text-sm text-red-600 font-medium">Active</span>
                </>
              ) : shootingStatus.isRecentlyActive ? (
                <>
                  <div className="w-1.5 h-1.5 md:w-2 md:h-2 bg-yellow-500 rounded-full"></div>
                  <span className="text-xs md:text-sm text-yellow-600 font-medium">Recent</span>
                </>
              ) : (
                <>
                  <div className="w-1.5 h-1.5 md:w-2 md:h-2 bg-gray-400 rounded-full"></div>
                  <span className="text-xs md:text-sm text-gray-600 font-medium">Standby</span>
                </>
              )}
            </div>
          </div>

          {/* Target Statistics */}
          <div className="space-y-1 md:space-y-2 pt-1 md:pt-2 border-t border-gray-100">
            <div className="text-center">
              <div className="text-sm md:text-2xl font-bold text-brand-primary font-heading">
                {shootingStatus.totalShots}
              </div>
              <div className="text-xs md:text-sm text-brand-dark/70 font-body">Total Shots{!isMobile && ' Recorded'}</div>
            </div>
            
            {/* Last Activity */}
            {shootingStatus.lastShotTime > 0 ? (
              <div className="text-center pt-0.5 md:pt-2">
                <div className="text-xs text-brand-dark/50 font-body">
                  Last: {new Date(shootingStatus.lastShotTime).toLocaleDateString()}{!isMobile && ` at ${new Date(shootingStatus.lastShotTime).toLocaleTimeString()}`}
                </div>
              </div>
            ) : (
              <div className="text-center pt-0.5 md:pt-2">
                <div className="text-xs text-brand-dark/50 font-body">
                  No activity{!isMobile && ' recorded'}
                </div>
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
            
            <Badge 
              variant="outline"
              className={`text-xs rounded-sm md:rounded ${
                shootingStatus.isActivelyShooting 
                  ? 'bg-red-50 text-red-700 border-red-200' 
                  : shootingStatus.isRecentlyActive
                  ? 'bg-yellow-50 text-yellow-700 border-yellow-200'
                  : 'bg-gray-50 text-gray-600 border-gray-200'
              }`}
            >
              {shootingStatus.isActivelyShooting ? '🎯' + (!isMobile ? ' Shooting' : '') : 
               shootingStatus.isRecentlyActive ? '⏱️' + (!isMobile ? ' Recent' : '') : 
               '😴' + (!isMobile ? ' Standby' : '')}
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
  const { isDemoMode } = useDemoMode();
  const { rooms: liveRooms, isLoading: roomsLoading, fetchRooms, getAllTargetsWithAssignments } = useRooms();
  const { forceSync: forceThingsBoardSync } = useThingsBoardSync();
  
  // Local state
  const [demoRooms, setDemoRooms] = useState<Room[]>([]);
  const [targets, setTargets] = useState<Target[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  // Data caching for performance optimization
  const [dataCache, setDataCache] = useState<{
    targets: Target[];
    fetchTime: number;
  } | null>(null);
  
  const CACHE_DURATION = 30000; // 30 seconds
  
  // Use demo or live rooms based on mode
  const rooms = isDemoMode ? demoRooms : liveRooms;
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
    // Check cache first
    if (dataCache && Date.now() - dataCache.fetchTime < CACHE_DURATION) {
      console.log('✅ Using cached targets data');
      setTargets(dataCache.targets);
      return;
    }

    setIsLoading(true);
    try {
      console.log(`🔄 Targets page: Fetching targets (${isDemoMode ? 'DEMO' : 'LIVE'} mode)...`);
      
      if (isDemoMode) {
        // Demo mode: use mock targets
        const mockTargets = await apiWrapper.getTargets(true);
        setTargets(mockTargets);
        setDataCache({ targets: mockTargets, fetchTime: Date.now() });
        console.log('✅ DEMO: Loaded mock targets:', mockTargets.length);
      } else {
        // Live mode: use real targets with assignments
        const targetsWithAssignments = await getAllTargetsWithAssignments();
        setTargets(targetsWithAssignments);
        setDataCache({ targets: targetsWithAssignments, fetchTime: Date.now() });
        console.log('✅ LIVE: Loaded real targets:', targetsWithAssignments.length);
      }
    } catch (error) {
      console.error('Error fetching targets:', error);
      setTargets([]);
    } finally {
      setIsLoading(false);
    }
  }, [isDemoMode, getAllTargetsWithAssignments, dataCache]);

  // Smart polling system for targets data (optimized with parallel fetching)
  const fetchTargetsData = useCallback(async () => {
    console.log('🔄 Setting loading to true');
    setIsLoading(true);
    try {
      console.log(`🔄 Polling targets data (${isDemoMode ? 'DEMO' : 'LIVE'} mode)...`);
      
      if (isDemoMode) {
        // Demo mode: fetch in parallel
        const [mockRooms, mockTargets] = await Promise.all([
          apiWrapper.getRooms(true),
          apiWrapper.getTargets(true)
        ]);
        
        const transformedRooms = mockRooms.map((room) => ({
          id: room.id,
          name: room.name,
          order: room.order_index || 0,
          targetCount: 0,
          icon: room.icon,
          room_type: room.room_type
        }));
        
        setDemoRooms(transformedRooms);
        setTargets(mockTargets);
        setDataCache({ targets: mockTargets, fetchTime: Date.now() });
        console.log('✅ DEMO: Set targets and cache:', mockTargets.length, 'targets');
      } else {
        // Live mode: fetch in parallel with proper error handling
        const [, targetsData] = await Promise.all([
          fetchRooms(),
          getAllTargetsWithAssignments()
        ]);
        
        setTargets(targetsData);
        setDataCache({ targets: targetsData, fetchTime: Date.now() });
        console.log('✅ LIVE: Set targets and cache:', targetsData.length, 'targets');
      }
    } catch (error) {
      console.error('Error fetching targets data:', error);
      setTargets([]);
    } finally {
      console.log('🔄 Setting loading to false');
      setIsLoading(false);
    }
  }, [isDemoMode, fetchRooms, getAllTargetsWithAssignments]);

  // Comprehensive refresh function for manual refresh button (optimized)
  const comprehensiveRefresh = useCallback(async () => {
    console.log(`🔄 Targets: Starting comprehensive refresh...`);
    
    // Invalidate cache
    setDataCache(null);
    
    try {
      if (isDemoMode) {
        // Demo mode: just refresh mock data
        console.log('🎭 DEMO: Refreshing mock data...');
        await fetchTargetsWithAssignments();
      } else {
        // Live mode: parallel execution for faster refresh
        await Promise.all([
          forceThingsBoardSync(),
          fetchRooms()
        ]);
        
        await fetchTargetsData();
      }
      
      console.log('✅ Targets: Comprehensive refresh completed');
    } catch (error) {
      console.error('❌ Targets: Error during comprehensive refresh:', error);
      // Fallback to basic refresh
      await fetchTargetsData();
    }
  }, [isDemoMode, forceThingsBoardSync, fetchRooms, fetchTargetsData, fetchTargetsWithAssignments]);

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
    isDemoMode ? async () => {} : fetchTargetsData, // Don't poll in demo mode
    {
      activeInterval: 10000,
      recentInterval: 30000,
      standbyInterval: 60000,
      activeThreshold: 30000,
      standbyThreshold: 600000
    }
  );

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

    console.log(`🔄 Targets: Mode changed to ${isDemoMode ? 'DEMO' : 'LIVE'}, fetching data...`);
    
    // Clear old data and set loading state
    setTargets([]);
    setDemoRooms([]);
    setIsLoading(true);
    
    // Fetch new data
    fetchTargetsData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDemoMode]); // Remove dataCache from deps to prevent infinite loop

  // Handle refresh
  const handleRefresh = async () => {
    if (isDemoMode) {
      console.log('🎭 DEMO: Refreshing mock targets...');
      await fetchTargetsWithAssignments();
      toast.success('🎭 Demo targets refreshed');
    } else {
      await forceUpdate();
      toast.success('🔗 Targets refreshed from ThingsBoard');
    }
  };

  // Filter targets by search term and room
  const filteredTargets = targets.filter(target => {
    const matchesSearch = target.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRoom = roomFilter === 'all' || 
                       (roomFilter === 'unassigned' && !target.roomId) ||
                       (target.roomId && target.roomId.toString() === roomFilter);
    return matchesSearch && matchesRoom;
  });


  // Debug: Log the actual assignments and check for duplicates
  console.log('🔍 Debugging room assignments:');
  console.log('📋 All targets with roomId:', targets.map(t => ({ name: t.name, id: t.id, roomId: t.roomId, roomIdType: typeof t.roomId })));
  console.log('🏠 Available rooms:', rooms.map(r => ({ id: r.id, name: r.name, idType: typeof r.id })));
  
  // Check for duplicates in the raw targets data
  const targetIds = targets.map(t => t.id);
  const duplicateIds = targetIds.filter((id, index) => targetIds.indexOf(id) !== index);
  if (duplicateIds.length > 0) {
    console.warn('🚨 Duplicate target IDs found in raw data:', duplicateIds);
    duplicateIds.forEach(dupId => {
      const duplicates = targets.filter(t => t.id === dupId);
      console.log(`   ID ${dupId}:`, duplicates.map(t => ({ name: t.name, roomId: t.roomId })));
    });
  }
  
  // Debug: Check specific targets
  const dryfire4 = targets.find(t => t.name === 'Dryfire-4');
  if (dryfire4) {
    console.log('🔍 Dryfire-4 details:', {
      name: dryfire4.name,
      roomId: dryfire4.roomId,
      roomIdType: typeof dryfire4.roomId,
      hasRoomId: 'roomId' in dryfire4,
      allKeys: Object.keys(dryfire4)
    });
  }
  
  // Debug: Check for Game manager targets specifically
  const gameManagers = targets.filter(t => t.name === 'Game manager');
  if (gameManagers.length > 0) {
    console.log(`🔍 Found ${gameManagers.length} Game manager targets:`, gameManagers.map((gm, i) => ({
      index: i,
      id: gm.id,
      name: gm.name,
      roomId: gm.roomId,
      status: gm.status
    })));
  }

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

  console.log(`🔍 Deduplication: ${filteredTargets.length} → ${uniqueTargets.length} targets`);

  // Group targets by room
  const groupedTargets = uniqueTargets.reduce((groups: Record<string, Target[]>, target) => {
    const roomId = target.roomId || 'unassigned';
    if (!groups[roomId]) {
      groups[roomId] = [];
    }
    groups[roomId].push(target);
    return groups;
  }, {});

  // Sort groups to show assigned targets first, then unassigned
  const sortedGroupKeys = Object.keys(groupedTargets).sort((a, b) => {
    if (a === 'unassigned') return 1; // Move unassigned to end
    if (b === 'unassigned') return -1; // Keep assigned at start
    return 0; // Keep assigned groups in their original order
  });

  // Create sorted grouped targets
  const sortedGroupedTargets: Record<string, Target[]> = {};
  sortedGroupKeys.forEach(key => {
    sortedGroupedTargets[key] = groupedTargets[key];
  });

  console.log('📊 Grouped targets:', Object.keys(groupedTargets).map(roomId => ({
    roomId,
    count: groupedTargets[roomId].length,
    targets: groupedTargets[roomId].map((t: Target) => ({ name: t.name, roomId: t.roomId }))
  })));
  
  console.log('🔍 Current state:', {
    isLoading,
    targetsCount: targets.length,
    roomsCount: rooms.length,
    hasDataCache: !!dataCache,
    cacheTargetsCount: dataCache?.targets?.length || 0
  });
  
  // Debug: Check what's in each group
  Object.entries(sortedGroupedTargets).forEach(([roomId, targets]) => {
    console.log(`📊 Sorted Group "${roomId}":`, targets.map((t: Target) => ({ name: t.name, roomId: t.roomId })));
  });

  // Get room object for display
  const getRoom = (roomId?: string | number) => {
    if (!roomId) return null;
    const roomIdStr = roomId.toString();
    return rooms.find(room => room.id === roomIdStr);
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
            
            {/* Demo Mode Banner */}
            {isDemoMode && (
              <Card className="bg-yellow-50 border-yellow-200">
                <CardContent className="p-3 md:p-4">
                  <div className="flex items-center gap-2">
                    <div className="text-xl">🎭</div>
                    <div>
                      <div className="font-semibold text-yellow-800 text-sm">Demo Mode Active</div>
                      <div className="text-xs text-yellow-700">Viewing 6 mock targets. Toggle to Live mode to see real ThingsBoard data.</div>
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

            {/* Page Header */}
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-4">
                <h1 className="text-3xl font-heading font-semibold text-brand-dark">Targets</h1>
                <div className="flex-shrink-0">
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
                      className="bg-brand-primary hover:bg-brand-primary/90 text-white"
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
                      <div className="flex items-center gap-2 mb-2 md:mb-4">
                        <h2 className="text-sm md:text-xl font-heading font-semibold text-brand-dark">
                          {room ? room.name : 'Unassigned Targets'}
                        </h2>
                        <Badge className="bg-red-50 border-red-500 text-red-700 text-xs rounded-lg md:rounded-xl">
                          {roomTargets.length} target{roomTargets.length !== 1 ? 's' : ''}
                        </Badge>
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