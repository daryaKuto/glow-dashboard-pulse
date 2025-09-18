import React, { useEffect, useState, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { useTargets } from '@/store/useTargets';
import { useRooms } from '@/store/useRooms';
import { toast } from '@/components/ui/sonner';
import Header from '@/components/Header';
import Sidebar from '@/components/Sidebar';
import MobileDrawer from '@/components/MobileDrawer';
import { useIsMobile } from '@/hooks/use-mobile';
import { useShootingActivityPolling } from '@/hooks/useShootingActivityPolling';
import ShootingStatusBanner from '@/components/ShootingStatusBanner';
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

// Modern Target Card Component
const TargetCard: React.FC<{
  target: any;
  room?: any;
  activity?: any;
  onEdit: () => void;
  onDelete: () => void;
}> = ({ target, room, activity, onEdit, onDelete }) => {
  const isMobile = useIsMobile();
  const isOnline = target.status === 'online';
  const batteryLevel = target.battery || Math.floor(Math.random() * 100); // Mock battery for demo
  
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
  targets: any[];
  rooms: any[];
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
        <Card key={index} className="bg-white border-gray-200 shadow-sm rounded-sm md:rounded-lg">
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
  const { targets, isLoading, refresh, clearCache } = useTargets();
  const { rooms, isLoading: roomsLoading, fetchRooms } = useRooms();
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

  // Smart polling system for targets data
  const fetchTargetsData = useCallback(async () => {
    try {
      await Promise.all([
        refresh(),
        fetchRooms(tbToken || '')
      ]);
    } catch (error) {
      console.error('Error fetching targets data:', error);
    }
  }, [refresh, fetchRooms, tbToken]);

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
  } = useShootingActivityPolling(fetchTargetsData, {
    activeInterval: 10000,     // 10 seconds during active shooting
    recentInterval: 30000,     // 30 seconds if shot within last 30s but not active
    standbyInterval: 60000,    // 60 seconds if no shots for 10+ minutes
    activeThreshold: 30000,    // 30 seconds - active shooting threshold
    standbyThreshold: 600000   // 10 minutes - standby mode threshold
  });

  // Initial data fetch
  useEffect(() => {
    fetchTargetsData();
  }, [fetchTargetsData]);

  // Handle refresh with cache clearing
  const handleRefresh = async () => {
    clearCache();
    await forceUpdate();
    toast.success('Targets refreshed from ThingsBoard');
  };

  // Filter targets by search term and room
  const filteredTargets = targets.filter(target => {
    const matchesSearch = target.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRoom = roomFilter === 'all' || 
                       (roomFilter === 'unassigned' && !target.roomId) ||
                       (target.roomId && target.roomId.toString() === roomFilter);
    return matchesSearch && matchesRoom;
  });

  // Group targets by room
  const groupedTargets = filteredTargets.reduce((groups: any, target) => {
    const roomId = target.roomId || 'unassigned';
    if (!groups[roomId]) {
      groups[roomId] = [];
    }
    groups[roomId].push(target);
    return groups;
  }, {});

  // Get room object for display
  const getRoom = (roomId?: number) => {
    if (!roomId) return null;
    return rooms.find(room => room.id === roomId);
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

  if (isLoading && targets.length === 0) {
    return (
      <div className="min-h-screen flex flex-col bg-brand-light">
        <Header />
        <div className="flex flex-1">
          {!isMobile && <Sidebar />}
          <main className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary mx-auto mb-4"></div>
              <p className="text-brand-dark/70 font-body">Loading targets...</p>
            </div>
          </main>
        </div>
      </div>
    );
  }

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
          <div className="p-2 md:p-4 lg:p-6 max-w-7xl mx-auto space-y-3 md:space-y-4 lg:space-y-6">
            
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
            <TargetsSummary targets={targets} rooms={rooms} />

            {/* Search and Filters */}
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

            {/* Targets Grid */}
            {Object.keys(groupedTargets).length === 0 ? (
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
                {Object.entries(groupedTargets).map(([roomId, roomTargets]: [string, any[]]) => {
                  const room = roomId !== 'unassigned' ? getRoom(Number(roomId)) : null;
                  
                  return (
                    <div key={roomId}>
                      {/* Room Section Header */}
                      <div className="flex items-center gap-2 mb-2 md:mb-4">
                        <h2 className="text-sm md:text-xl font-heading font-semibold text-brand-dark">
                          {room ? room.name : 'Unassigned Targets'}
                        </h2>
                        <Badge variant="outline" className="border-brand-secondary text-brand-secondary text-xs rounded-sm md:rounded">
                          {roomTargets.length} target{roomTargets.length !== 1 ? 's' : ''}
                        </Badge>
                      </div>
                      
                      {/* Targets Grid */}
                      <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-2 md:gap-6">
                        {roomTargets.map((target) => {
                          // Find activity data for this target
                          const targetActivityData = targetActivity.find(activity => activity.deviceId === target.id);
                          
                          return (
                            <TargetCard
                              key={target.id}
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