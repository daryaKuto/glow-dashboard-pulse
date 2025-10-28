import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useRooms, type Room } from '@/store/useRooms';
import { toast } from '@/components/ui/sonner';
import Header from '@/components/shared/Header';
import Sidebar from '@/components/shared/Sidebar';
import MobileDrawer from '@/components/shared/MobileDrawer';
import { useIsMobile } from '@/hooks/use-mobile';
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
  onEdit: () => void;
  onDelete: () => void;
}> = ({ target, room, onEdit, onDelete }) => {
  const isMobile = useIsMobile();
  const batteryLevel = target.battery; // Real battery data or null
  const wifiStrength = target.wifiStrength; // Real WiFi strength or null

  const totalShots = target.totalShots ?? 0;
  const lastShotTime = target.lastShotTime ?? target.lastActivityTime ?? null;

  const activityStatus = target.activityStatus ?? 'standby';
  const isOnline = target.status === 'online' || target.status === 'standby';
  const ConnectionIcon = isOnline ? Wifi : WifiOff;
  const connectionColor = !isOnline
    ? 'text-gray-400'
    : activityStatus === 'active'
      ? 'text-green-600'
      : activityStatus === 'recent'
        ? 'text-blue-600'
        : 'text-amber-500';
  const connectionLabel = !isOnline
    ? 'Offline'
    : activityStatus === 'standby'
      ? 'Standby'
      : activityStatus === 'recent'
        ? 'Recently Active'
        : 'Online';

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
      activityStatus,
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
              <ConnectionIcon className={`h-2.5 w-2.5 md:h-4 md:w-4 ${connectionColor}`} />
              <span className="text-xs md:text-sm text-brand-dark/70">
                {connectionLabel}
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
              <div className="text-sm md:text-2xl font-bold text-brand-primary font-heading">
                {typeof totalShots === 'number' ? totalShots : 0}
              </div>
              <div className="text-xs md:text-sm text-brand-dark/70 font-body">Total Shots{!isMobile && ' Recorded'}</div>
            </div>
            
            {/* Last Activity */}
            {lastShotTime ? (
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
            )}
          </div>

          {/* Status Badges */}
          <div className="pt-1 md:pt-2 flex justify-center gap-1 md:gap-2">
            <Badge 
              variant={isOnline ? 'default' : 'secondary'}
              className={`text-xs rounded-sm md:rounded ${
                !isOnline
                  ? 'bg-gray-100 text-gray-600 border-gray-200'
                  : activityStatus === 'active'
                    ? 'bg-green-100 text-green-700 border-green-200'
                    : activityStatus === 'recent'
                      ? 'bg-blue-100 text-blue-700 border-blue-200'
                      : 'bg-amber-50 text-amber-700 border-amber-200'
              }`}
            >
              {connectionLabel}
            </Badge>
            {activityStatus && (
              <Badge
                variant="outline"
                className={`text-xs rounded-sm md:rounded ${
                  activityStatus === 'active'
                    ? 'border-green-200 text-green-700'
                    : activityStatus === 'recent'
                      ? 'border-blue-200 text-blue-700'
                      : 'border-gray-200 text-gray-600'
                }`}
              >
                {activityStatus === 'active'
                  ? 'Active'
                  : activityStatus === 'recent'
                    ? 'Recently Active'
                    : 'Standby'}
              </Badge>
            )}
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
  const onlineTargets = targets.filter(t => t.status === 'online' || t.status === 'standby').length;
  const standbyTargets = targets.filter(t => (t.activityStatus ?? 'standby') === 'standby').length;
  const offlineTargets = targets.filter(t => t.status === 'offline').length;
  const unassignedTargets = targets.filter(t => !t.roomId).length;

  const stats = [
    { label: 'Total Targets', value: targets.length, color: 'text-brand-dark' },
    { label: 'Online', value: onlineTargets, color: 'text-green-600' },
    { label: 'Standby', value: standbyTargets, color: 'text-amber-600' },
    { label: 'Offline', value: offlineTargets, color: 'text-gray-600' },
    { label: 'Unassigned', value: unassignedTargets, color: 'text-yellow-600' },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-2 md:gap-4 mb-3 md:mb-6">
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
  const isMobile = useIsMobile();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const { rooms: liveRooms, isLoading: roomsLoading, fetchRooms } = useRooms();
  const {
    targets: storeTargets,
    fetchTargetsFromEdge,
    fetchTargetDetails,
    isLoading: targetsStoreLoading,
    detailsLoading,
  } = useTargets();
  
  // Local state
  const [targets, setTargets] = useState<Target[]>(storeTargets);
  const isLoading = roomsLoading || targetsStoreLoading || detailsLoading;
  
  // Use live rooms
  const rooms = liveRooms;
  const [searchTerm, setSearchTerm] = useState('');
  const [roomFilter, setRoomFilter] = useState<string>('all');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newTargetName, setNewTargetName] = useState('');
  const [newTargetRoomId, setNewTargetRoomId] = useState<string>('');

  const FETCH_DEBUG_DEFAULT = import.meta.env.DEV;

  const isFetchDebugEnabled = useCallback(() => {
    if (typeof window === 'undefined') {
      return FETCH_DEBUG_DEFAULT;
    }

    const flag = window.localStorage?.getItem('DEBUG_TARGET_FETCH');
    if (flag === 'true') {
      return true;
    }
    if (flag === 'false') {
      return false;
    }

    return FETCH_DEBUG_DEFAULT;
  }, [FETCH_DEBUG_DEFAULT]);


  // Sync targets from the shared store and ensure edge data is loaded
  useEffect(() => {
    setTargets(storeTargets);
  }, [storeTargets]);

  const ensureTargets = useCallback(async (force = false) => {
    const debug = isFetchDebugEnabled();
    if (debug) {
      console.info('[Targets] ensureTargets invoked', { force });
    }
    try {
      const fetchedTargets = await fetchTargetsFromEdge(force);
      if (debug) {
        console.info('[Targets] ensureTargets fetched targets', {
          count: fetchedTargets?.length ?? 0,
          fromForce: force,
        });
      }
      setTargets(fetchedTargets);
      return fetchedTargets;
    } catch (error) {
      console.error('❌ [Targets] Failed to fetch targets from edge:', error);
      if (debug) {
        console.info('[Targets] ensureTargets encountered error', error);
      }
      if (force) {
        toast.error('Failed to refresh targets');
      }
      return undefined;
    }
  }, [fetchTargetsFromEdge, isFetchDebugEnabled]);

  const detailsFetchKeyRef = useRef<string>('');
  const detailIntervalRef = useRef<number | undefined>(undefined);

  const targetIdsKey = useMemo(() => {
    if (!storeTargets.length) {
      return '';
    }
    return storeTargets
      .map((target) => target.id)
      .sort()
      .join(',');
  }, [storeTargets]);

  useEffect(() => {
    if (!targetIdsKey) {
      if (detailIntervalRef.current !== undefined && typeof window !== 'undefined') {
        window.clearInterval(detailIntervalRef.current);
        detailIntervalRef.current = undefined;
      }
      detailsFetchKeyRef.current = '';
      return;
    }

    if (typeof window === 'undefined') {
      return;
    }

    const ids = targetIdsKey.split(',');

    const fetchDetails = async (force = false) => {
      try {
        const result = await fetchTargetDetails(ids, {
          includeHistory: true,
          historyRangeMs: 24 * 60 * 60 * 1000,
          recentWindowMs: 5 * 60 * 1000,
          force,
        });
        return Boolean(result);
      } catch (error) {
        console.error('❌ [Targets] Failed to hydrate target details', error);
        return false;
      }
    };

    const shouldForce = detailsFetchKeyRef.current !== targetIdsKey;
    const debug = isFetchDebugEnabled();

    const primeDetails = async () => {
      if (debug) {
        console.info('[Targets] priming target details', { idsCount: ids.length, force: shouldForce });
      }

      const success = await fetchDetails(shouldForce);
      if (success) {
        detailsFetchKeyRef.current = targetIdsKey;
      } else if (shouldForce) {
        detailsFetchKeyRef.current = '';
      }

      if (!success) {
        return;
      }

      if (detailIntervalRef.current !== undefined) {
        window.clearInterval(detailIntervalRef.current);
      }

      detailIntervalRef.current = window.setInterval(() => {
        void fetchDetails();
      }, 30_000);
    };

    void primeDetails();

    return () => {
      if (detailIntervalRef.current !== undefined) {
        window.clearInterval(detailIntervalRef.current);
        detailIntervalRef.current = undefined;
      }
    };
  }, [targetIdsKey, fetchTargetDetails, isFetchDebugEnabled]);

  // Avoid firing multiple concurrent fetches when the store is empty on mount.
  const initialFetchInFlightRef = useRef(false);

  useEffect(() => {
    if (storeTargets.length > 0) {
      initialFetchInFlightRef.current = false;
      return;
    }

    if (initialFetchInFlightRef.current) {
      if (isFetchDebugEnabled()) {
        console.info('[Targets] initial fetch already in flight, skipping');
      }
      return;
    }

    initialFetchInFlightRef.current = true;
    if (isFetchDebugEnabled()) {
      console.info('[Targets] storeTargets empty, triggering ensureTargets(false)');
    }

    void ensureTargets(false).finally(() => {
      initialFetchInFlightRef.current = false;
    });
  }, [storeTargets.length, ensureTargets, isFetchDebugEnabled]);

  useEffect(() => {
    if (!liveRooms.length) {
      void fetchRooms();
    }
  }, [liveRooms.length, fetchRooms]);

  // Consolidated verification summary for easy comparison with check script.
  useEffect(() => {
    if (!targets.length) {
      return;
    }

    if (typeof window === 'undefined') {
      return;
    }

    const debugEnabled = localStorage.getItem('DEBUG_TARGET_VERIFICATION') === 'true';
    if (!debugEnabled) {
      return;
    }

    const activeTargetsLocal = targets.filter(target => target.activityStatus === 'active');
    const recentTargetsLocal = targets.filter(target => target.activityStatus === 'recent');
    const standbyTargetsLocal = targets.filter(target => (target.activityStatus ?? 'standby') === 'standby');
    const recentShotsAggregate = targets.reduce((acc, target) => acc + (target.recentShotsCount ?? 0), 0);

    const timestamp = new Date().toISOString();
    console.log('='.repeat(80));
    console.log(`🔍 [VERIFICATION] Shot Records Summary - ${timestamp}`);
    console.log('='.repeat(80));

    console.log('📊 [VERIFICATION] System Status:', {
      mode: 'LIVE',
      totalTargets: targets.length,
      onlineTargets: targets.filter(t => t.status === 'online' || t.status === 'standby').length,
      standbyTargets: standbyTargetsLocal.length,
      offlineTargets: targets.filter(t => t.status === 'offline').length,
      activeShooters: activeTargetsLocal.length,
      recentlyActiveTargets: recentTargetsLocal.length,
      recentActivity: recentShotsAggregate,
    });

    console.log('📊 [VERIFICATION] Target Details:');
    targets.forEach((target, index) => {
      const mergedShots = target.totalShots ?? 0;
      const mergedShotTime = target.lastShotTime ?? null;

      console.log(`  ${index + 1}. ${target.name} (${target.id}):`, {
        status: target.status,
        activityStatus: target.activityStatus,
        roomId: target.roomId || 'unassigned',
        deviceName: target.deviceName,
        deviceType: target.deviceType,
        battery: target.battery,
        wifiStrength: target.wifiStrength,
        totalShots: mergedShots,
        lastShotTime: mergedShotTime ?? 0,
        lastShotTimeReadable: mergedShotTime ? new Date(mergedShotTime).toISOString() : 'Never'
      });
    });

    console.log('📊 [VERIFICATION] Data Flow Summary:');
    console.log('  1. Supabase Edge → target-details → Telemetry & history');
    console.log('  2. Targets store → Merge edge data into shared state');
    console.log('  3. Targets Page → Render shared state across views');

    console.log('📊 [VERIFICATION] Key Verification Points:');
    console.log('  • Check that totalShots matches ThingsBoard hits value');
    console.log('  • Check that lastShotTime matches ThingsBoard hit_ts value');
    console.log('  • Check that activity status reflects actual data');
    console.log('  • Compare with check script output for device names and IDs');

    console.log('='.repeat(80));
  }, [targets]);

  // Handle cache updates

  // Handle refresh
  const handleRefresh = async () => {
    console.log('🔄 Refreshing targets from edge cache...');

    try {
      const refreshedTargets = await ensureTargets(true);
      const selectedTargets = Array.isArray(refreshedTargets) && refreshedTargets.length > 0
        ? refreshedTargets
        : storeTargets;

      const ids = selectedTargets.map((target) => target.id);
      const idsKey = ids.slice().sort().join(',');

      const tasks: Array<Promise<unknown>> = [fetchRooms()];

      if (ids.length > 0) {
        tasks.push(fetchTargetDetails(ids, {
          includeHistory: true,
          historyRangeMs: 24 * 60 * 60 * 1000,
          recentWindowMs: 5 * 60 * 1000,
          force: true,
        }).then(() => {
          detailsFetchKeyRef.current = idsKey;
        }));
      }

      await Promise.all(tasks);
      toast.success('🔗 Targets refreshed');
    } catch (error) {
      console.error('❌ [Targets] Refresh failed', error);
      toast.error('Failed to refresh targets');
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
      const aOnline = a.status === 'online' || a.status === 'standby';
      const bOnline = b.status === 'online' || b.status === 'standby';
      
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
                          <SelectContent className="bg-white border border-gray-200 text-brand-dark shadow-md">
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
                  <SelectContent className="bg-white border border-gray-200 text-brand-dark shadow-md">
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
                            <span>{roomTargets.filter(t => t.status === 'online' || t.status === 'standby').length} online</span>
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
                          // Use a more reliable key
                          const targetKey = target.id || `target-${index}`;
                          
                          return (
                            <TargetCard
                              key={targetKey}
                              target={target}
                              room={room}
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
