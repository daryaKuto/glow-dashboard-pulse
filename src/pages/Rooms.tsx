import React, { useEffect, useState, useMemo, startTransition } from 'react';
import { useLocation } from 'react-router-dom';
import { useRooms } from '@/store/useRooms';
import { useTargets } from '@/store/useTargets';
import { apiWrapper } from '@/services/api-wrapper';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Users, Target, RefreshCw, Eye, X, Check, ArrowRight, ArrowLeft } from 'lucide-react';
import Header from '@/components/shared/Header';
import Sidebar from '@/components/shared/Sidebar';
import MobileDrawer from '@/components/shared/MobileDrawer';
import { useIsMobile } from '@/hooks/use-mobile';
import RoomCard from '@/components/RoomCard';
import DragDropList from '@/components/DragDropList';
import { toast } from '@/components/ui/sonner';
import CreateRoomModal from '@/components/CreateRoomModal';

const Rooms: React.FC = () => {
  const location = useLocation();
  const isMobile = useIsMobile();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const { 
    rooms, 
    isLoading, 
    fetchRooms, 
    createRoom, 
    updateRoom, 
    deleteRoom,
    updateRoomOrder,
    assignTargetToRoom,
    assignTargetsToRoomBatch,
    getAllTargetsWithAssignments,
    updateRoomTargetCount
  } = useRooms();
  const { targets, refresh: refreshTargets } = useTargets();
  
  // Local state
  const [createRoomModalOpen, setCreateRoomModalOpen] = useState(false);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<any>(null);
  const [selectedTarget, setSelectedTarget] = useState<string>('');
  const [roomDetailsOpen, setRoomDetailsOpen] = useState(false);
  const [roomForDetails, setRoomForDetails] = useState<any>(null);
  const [selectedTargets, setSelectedTargets] = useState<string[]>([]);
  const [roomTargets, setRoomTargets] = useState<any[]>([]);
  const [targetsWithAssignments, setTargetsWithAssignments] = useState<any[]>([]);
  const [pendingAssignments, setPendingAssignments] = useState<Map<string, string | null>>(new Map()); // targetId -> roomId
  const [targetsLoading, setTargetsLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  // Helper function to safely get target ID
  const getTargetId = (target: any) => {
    if (target.id?.id) return target.id.id;
    if (target.id) return target.id;
    return 'unknown';
  };

  // Optimistically update local state without API call
  const updateTargetsOptimistically = (targetIds: string[], newRoomId: string | null) => {
    setTargetsWithAssignments(prev => 
      prev.map(target => 
        targetIds.includes(getTargetId(target))
          ? { ...target, roomId: newRoomId }
          : target
      )
    );
    console.log(`✨ [OPTIMISTIC] UI: Updated ${targetIds.length} targets locally to room ${newRoomId}`);
  };

  // Available room icons
  const roomIcons = [
    { value: 'home', label: 'Home' },
    { value: 'sofa', label: 'Living Room' },
    { value: 'utensils', label: 'Dining Room' },
    { value: 'chef-hat', label: 'Kitchen' },
    { value: 'bed', label: 'Bedroom' },
    { value: 'briefcase', label: 'Office' },
    { value: 'building', label: 'Basement' },
    { value: 'car', label: 'Garage' },
    { value: 'tree-pine', label: 'Garden' },
    { value: 'gamepad2', label: 'Game Room' },
    { value: 'dumbbell', label: 'Gym' },
    { value: 'music', label: 'Music Room' },
    { value: 'book-open', label: 'Library' }
  ];

  // Function to refresh targets with assignments
  // NOTE: Demo mode has been removed from this file.
  // If you see errors related to isDemoMode, mockData, or demo services,
  // it's because those systems no longer exist. Use live ThingsBoard/Supabase data only.
  const refreshTargetsWithAssignments = async () => {
    console.info('[Rooms] Refresh assignments requested', {
      source: 'useRooms.getAllTargetsWithAssignments(forceRefresh=true)',
      supabaseEdgeFunction: 'rooms',
      supabaseTablesRead: ['public.user_rooms', 'public.user_room_targets'],
    });
    setTargetsLoading(true);
    try {
      const targetsWithAssignmentsData = await getAllTargetsWithAssignments(true); // forceRefresh on page load
      setTargetsWithAssignments(targetsWithAssignmentsData);
      console.info('[Rooms] Assignments refreshed', {
        totalTargets: targetsWithAssignmentsData.length,
        sourcedFrom: 'Supabase edge function "rooms"',
        sample: targetsWithAssignmentsData.slice(0, 3).map((t) => ({
          id: getTargetId(t),
          name: t.name,
          roomId: t.roomId,
        })),
      });
      return targetsWithAssignmentsData;
    } catch (error) {
      console.error('[Rooms] Failed to refresh assignments', {
        source: 'useRooms.getAllTargetsWithAssignments(forceRefresh=true)',
        message: error.message,
        stack: error.stack
      });
      setTargetsWithAssignments([]);
      return [];
    } finally {
      setTargetsLoading(false);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      console.info('[Rooms] Hydrating page state', {
        navigationPath: typeof window !== 'undefined' ? window.location.pathname : 'unknown',
        dataSources: [
          'Zustand stores (useRooms + useTargets)',
          'Supabase edge function "rooms"',
          'Supabase tables: user_rooms, user_room_targets',
        ],
      });
      setInitialLoading(true);
      
      try {
        // Use data from Zustand stores (populated by useInitialSync)
        console.info('[Rooms] Reading cached store values', {
          store: 'useRooms / useTargets',
          expectedBackingSources: ['Supabase edge cache', 'ThingsBoard telemetry cache'],
        });
        
        // Get targets with assignments (use existing data, no API call)
        const targets = await getAllTargetsWithAssignments(false);
        setTargetsWithAssignments(targets);
        
        // Fetch rooms (light operation from Supabase)
        await fetchRooms();
        
        console.info('[Rooms] Store hydration complete', {
          targetsFromCache: targets.length,
          roomsFetched: rooms.length,
          supabaseEdgeFunction: 'rooms',
        });
      } catch (error) {
        console.error('[Rooms] Initial store hydration failed', error);
        // Fallback: try to fetch fresh data
        try {
          await refreshTargetsWithAssignments();
        } catch (assignError) {
          console.error('[Rooms] Fallback assignment refresh failed', assignError);
        }
      } finally {
        setInitialLoading(false);
      }
    };
    
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (targets.length === 0) {
      refreshTargets().catch((error) => {
        console.warn('⚠️ Rooms page: Failed to refresh targets on mount', error);
      });
    }
  }, [targets.length, refreshTargets]);

  useEffect(() => {
    if (!createRoomModalOpen) {
      return;
    }
    refreshTargets().catch((error) => {
      console.warn('⚠️ Rooms page: Failed to refresh targets when opening create-room modal', error);
    });
  }, [createRoomModalOpen, refreshTargets]);

  const handleCreateRoom = (roomData: {
    name: string;
    icon: string;
    type: string;
    assignedTargets: string[];
  }) => {
    createRoom({
      name: roomData.name,
      room_type: roomData.type,
      icon: roomData.icon,
      assignedTargets: roomData.assignedTargets
    });
    setCreateRoomModalOpen(false);
  };

  const handleRename = async (id: string, name: string) => {
    try {
      await updateRoom(id, { name });
    } catch (error) {
      console.error('Error renaming room:', error);
      toast.error('Failed to rename room');
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm("Are you sure you want to delete this room? This action cannot be undone.")) {
      try {
        await deleteRoom(id);
      } catch (error) {
        console.error('Error deleting room:', error);
        toast.error('Failed to delete room');
      }
    }
  };

  const handleReorder = (reorderedRooms: typeof rooms) => {
    const orderedIds = reorderedRooms.map((room, index) => ({
      id: room.id,
      order: index + 1
    }));
    
    updateRoomOrder(orderedIds);
  };

  const handleAssignTarget = async () => {
    if (!selectedTarget || !selectedRoom) {
      console.log('❌ [ERROR] UI: Cannot assign target - missing selectedTarget or selectedRoom');
      console.log('❌ [ERROR] UI: selectedTarget:', selectedTarget);
      console.log('❌ [ERROR] UI: selectedRoom:', selectedRoom);
      return;
    }
    
    console.log('🎯 [ASSIGNMENT] UI: Starting target assignment...');
    console.log(`🎯 [ASSIGNMENT] UI: Target: ${selectedTarget}, Room: ${selectedRoom.id} (${selectedRoom.name})`);
    console.log(`🔍 [ID-CHECK] UI: Target ID format: ${selectedTarget} (type: ${typeof selectedTarget})`);
    console.log(`🔍 [ID-CHECK] UI: Room ID format: ${selectedRoom.id} (type: ${typeof selectedRoom.id})`);
    
    try {
      console.log('🎯 [ASSIGNMENT] UI: Calling assignTargetToRoom...');
      await assignTargetToRoom(selectedTarget, selectedRoom.id);
      console.log('✅ [SUCCESS] UI: Target assignment completed');
      
      setAssignDialogOpen(false);
      setSelectedTarget('');
      setSelectedRoom(null);
      
      // Remove this line - already refreshed in assignTargetToRoom
      // await refreshTargetsWithAssignments();
      
      toast.success('Target assigned to room successfully');
    } catch (error) {
      console.error('❌ [ERROR] UI: Error assigning target:', error);
      console.error('❌ [ERROR] UI: Error details:', {
        message: error.message,
        stack: error.stack,
        selectedTarget,
        selectedRoom: selectedRoom?.id
      });
      toast.error('Failed to assign target to room');
    }
  };

  const openAssignDialog = (room: any) => {
    setSelectedRoom(room);
    setAssignDialogOpen(true);
  };

  const openRoomDetails = async (room: any) => {
    // Save any existing pending assignments before opening new room
    if (pendingAssignments.size > 0) {
      await savePendingAssignments();
    }
    
    setRoomForDetails(room);
    setRoomDetailsOpen(true);
    setSelectedTargets([]); // Clear selection when opening room details
    setPendingAssignments(new Map()); // Clear pending assignments for new room
    
    console.log('Opening room details for room:', room.id);
    console.log('Available targets with assignments:', targetsWithAssignments.length);
    console.log('Targets for this room:', targetsWithAssignments.filter(t => t.roomId === room.id));
  };

  const handleTargetSelection = (targetId: string, checked: boolean) => {
    if (checked) {
      setSelectedTargets(prev => [...prev, targetId]);
    } else {
      setSelectedTargets(prev => prev.filter(id => id !== targetId));
    }
  };

  const handleBulkAssign = async () => {
    if (selectedTargets.length === 0 || !roomForDetails) {
      return;
    }
    
    console.log(`🎯 [BULK] UI: Assigning ${selectedTargets.length} targets to room ${roomForDetails.id}`);
    
    try {
      // Optimistically update UI immediately for instant feedback
      updateTargetsOptimistically(selectedTargets, roomForDetails.id);
      
      // Clear selection immediately for better UX
      setSelectedTargets([]);
      
      // Use batch assignment in background - includes single refresh
      await assignTargetsToRoomBatch(selectedTargets, roomForDetails.id);
      
      // After batch completes, do one final refresh to ensure sync
      await refreshTargetsWithAssignments();
      
      console.log(`✅ [BULK] UI: ${selectedTargets.length} targets assigned successfully`);
    } catch (error) {
      console.error('❌ [BULK] UI: Error assigning targets:', error);
      // On error, refresh to revert optimistic update
      await refreshTargetsWithAssignments();
      toast.error('Failed to assign targets to room');
    }
  };

  const clearSelection = () => {
    setSelectedTargets([]);
  };

  // Save pending assignments when modal closes
  const savePendingAssignments = async () => {
    if (pendingAssignments.size === 0) {
      return;
    }
    
    console.log(`🎯 [PENDING] UI: Saving ${pendingAssignments.size} pending assignments`);
    
    try {
      // Group assignments by room for batch operations
      const assignmentsByRoom = new Map<string | null, string[]>();
      
      for (const [targetId, roomId] of pendingAssignments.entries()) {
        if (!assignmentsByRoom.has(roomId)) {
          assignmentsByRoom.set(roomId, []);
        }
        assignmentsByRoom.get(roomId)!.push(targetId);
      }
      
      // Batch assign by room
      for (const [roomId, targetIds] of assignmentsByRoom.entries()) {
        await assignTargetsToRoomBatch(targetIds, roomId);
      }
      
      // Clear pending assignments
      setPendingAssignments(new Map());
      
      // Refresh UI
      await refreshTargetsWithAssignments();
      await fetchRooms();
      
      console.log(`✅ [PENDING] UI: All pending assignments saved`);
    } catch (error) {
      console.error('❌ [PENDING] UI: Error saving assignments:', error);
    }
  };

  const handleRefresh = async () => {
    await fetchRooms();
    await refreshTargets();
    await refreshTargetsWithAssignments();
    
    toast.success('Rooms and targets refreshed');
  };

  const sortedRooms = [...rooms].sort((a, b) => a.order - b.order);

  // Get truly unassigned targets (not assigned to ANY room, including pending) - memoized
  const unassignedTargets = useMemo(() => {
    return targetsWithAssignments.filter(target => {
      const targetId = getTargetId(target);
      
      // Check if there's a pending assignment for this target
      const pendingRoomId = pendingAssignments.get(targetId);
      const effectiveRoomId = pendingRoomId !== undefined ? pendingRoomId : target.roomId;
      
      // Target is unassigned only if it has no room assignment (real or pending)
      return !effectiveRoomId || effectiveRoomId === null;
    });
  }, [targetsWithAssignments, pendingAssignments]);

  // Debug logging
  console.groupCollapsed('[Rooms] Snapshot', {
    supabaseEdgeFunction: 'rooms',
    supabaseTables: ['public.user_rooms', 'public.user_room_targets'],
    thingsboardData: 'targets store (hydrated via fetchTargetsWithTelemetry)',
  });
  console.info('targetsWithAssignments.total', targetsWithAssignments.length);
  console.info('targetsWithAssignments.withRoom', targetsWithAssignments.filter(t => t.roomId).length);
  console.info('targetsWithAssignments.withoutRoom', targetsWithAssignments.filter(t => !t.roomId).length);
  console.info('unassignedTargets.total', unassignedTargets.length);
  console.info('rooms.total', rooms.length);
  console.info('roomForDetails', roomForDetails?.id ?? null);
  console.info('sampleTarget', targetsWithAssignments[0] ?? null);
  if (roomForDetails) {
    console.info('activeRoom.targetCount', targetsWithAssignments.filter(t => t.roomId === roomForDetails.id).length);
  }
  console.groupEnd();

  // Get targets assigned to a specific room (including pending assignments) - memoized
  const getRoomTargets = useMemo(() => {
    return (roomId: string) => {
      return targetsWithAssignments.filter(target => {
        const targetId = getTargetId(target);
        
        // Check if there's a pending assignment for this target
        const pendingRoomId = pendingAssignments.get(targetId);
        const effectiveRoomId = pendingRoomId !== undefined ? pendingRoomId : target.roomId;
        
        return effectiveRoomId === roomId;
      });
    };
  }, [targetsWithAssignments, pendingAssignments]);

  // Helper function to safely get target ID for display
  const getTargetDisplayId = (target: any) => {
    const id = getTargetId(target);
    return id !== 'unknown' ? id.substring(0, 8) : 'N/A';
  };

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
          <div className="w-full px-4 py-2 md:container md:mx-auto md:p-4 lg:p-6 responsive-transition h-full">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-6">
              <h2 className="text-h1 font-heading text-brand-dark">Rooms</h2>
              <Button 
                onClick={handleRefresh}
                variant="outline"
                className="border-gray-200 text-brand-dark hover:bg-brand-secondary/10 w-full sm:w-auto"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
            </div>
            
            {/* Stats Overview - Mobile Optimized */}
            <div className="responsive-grid grid-cols-3 mb-6">
              {isLoading || targetsLoading || initialLoading ? (
                // Loading skeleton for stats cards
                <>
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="bg-white rounded-lg p-3 md:p-4 shadow-sm border border-gray-200 animate-pulse">
                      <div className="flex flex-col items-center text-center">
                        <div className="p-2 bg-gray-200 rounded-lg mb-2 w-8 h-8 md:w-10 md:h-10"></div>
                        <div className="h-3 w-12 bg-gray-200 rounded mb-1"></div>
                        <div className="h-6 w-8 bg-gray-200 rounded"></div>
                      </div>
                    </div>
                  ))}
                </>
              ) : (
                <>
                  <div className="bg-white rounded-lg p-3 md:p-4 shadow-sm border border-gray-200">
                    <div className="flex flex-col items-center text-center">
                      <div className="p-2 bg-brand-secondary/10 rounded-lg mb-2">
                        <Users className="h-4 w-4 md:h-5 md:w-5 text-brand-primary" />
                      </div>
                      <p className="text-xs md:text-sm text-brand-dark/70 font-body">Rooms</p>
                      <p className="text-lg md:text-h2 font-heading text-brand-dark">{rooms.length}</p>
                    </div>
                  </div>
                  
                  <div className="bg-white rounded-lg p-3 md:p-4 shadow-sm border border-gray-200">
                    <div className="flex flex-col items-center text-center">
                      <div className="p-2 bg-brand-secondary/10 rounded-lg mb-2">
                        <Target className="h-4 w-4 md:h-5 md:w-5 text-brand-primary" />
                      </div>
                      <p className="text-xs md:text-sm text-brand-dark/70 font-body">Targets</p>
                      <p className="text-lg md:text-h2 font-heading text-brand-dark">{targetsWithAssignments.length}</p>
                    </div>
                  </div>
                  
                  <div className="bg-white rounded-lg p-3 md:p-4 shadow-sm border border-gray-200">
                    <div className="flex flex-col items-center text-center">
                      <div className="p-2 bg-brand-secondary/10 rounded-lg mb-2">
                        <Target className="h-4 w-4 md:h-5 md:w-5 text-brand-primary" />
                      </div>
                      <p className="text-xs md:text-sm text-brand-dark/70 font-body">Unassigned</p>
                      <p className="text-lg md:text-h2 font-heading text-brand-dark">{unassignedTargets.length}</p>
                    </div>
                  </div>
                </>
              )}
            </div>
            
            <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="text-sm text-brand-dark/70 font-body">
                <span className="hidden sm:inline">Create a room and assign targets to organize your shooting practice</span>
                <span className="sm:hidden">Create rooms and assign targets</span>
              </div>
              <Button 
                onClick={() => setCreateRoomModalOpen(true)}
                className="bg-brand-secondary hover:bg-brand-secondary/90 text-white w-full sm:w-auto"
              >
                <Plus className="h-4 w-4 mr-2" /> Add Room
              </Button>
            </div>
            
            {isLoading || initialLoading ? (
              <div className="space-y-4">
                {/* Loading skeleton for rooms */}
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="bg-white border border-gray-200 rounded-lg p-4 animate-pulse">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-gray-200 rounded-lg"></div>
                        <div className="space-y-2">
                          <div className="h-4 w-32 bg-gray-200 rounded"></div>
                          <div className="h-3 w-20 bg-gray-200 rounded"></div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="h-6 w-16 bg-gray-200 rounded"></div>
                        <div className="h-8 w-8 bg-gray-200 rounded"></div>
                      </div>
                    </div>
                  </div>
                ))}
                
                {/* Loading skeleton for targets */}
                <div className="mt-6">
                  <div className="h-4 w-48 bg-gray-200 rounded mb-4 animate-pulse"></div>
                  <div className="space-y-3">
                    {[...Array(4)].map((_, i) => (
                      <div key={i} className="bg-white border border-gray-200 rounded-lg p-3 animate-pulse">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-6 h-6 bg-gray-200 rounded"></div>
                            <div className="space-y-1">
                              <div className="h-3 w-24 bg-gray-200 rounded"></div>
                              <div className="h-2 w-16 bg-gray-200 rounded"></div>
                            </div>
                          </div>
                          <div className="h-6 w-20 bg-gray-200 rounded"></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : rooms.length === 0 ? (
              <div className="text-center py-8">
                <div className="bg-white rounded-lg p-8 mx-auto max-w-md shadow-sm border border-gray-200">
                  <div className="text-brand-primary mb-4 text-h3 font-heading">No rooms yet</div>
                  <p className="text-brand-dark mb-6 font-body">
                    Create your first room to get started
                  </p>
                  <Button className="bg-brand-secondary hover:bg-dark text-white">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Room
                  </Button>
                </div>
              </div>
            ) : (
              <DragDropList
                items={sortedRooms}
                onReorder={handleReorder}
                renderItem={(room) => (
                  <RoomCard
                    key={room.id}
                    room={room}
                    onRename={handleRename}
                    onDelete={handleDelete}
                    onAssignTargets={() => openAssignDialog(room)}
                    onViewDetails={() => openRoomDetails(room)}
                  />
                )}
              />
            )}
          </div>
        </main>
      </div>

      {/* Target Assignment Dialog */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Assign Targets to {selectedRoom?.name}</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-brand-dark mb-2 block">
                Select Target
              </label>
              <Select value={selectedTarget} onValueChange={setSelectedTarget}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Choose a target to assign" />
                </SelectTrigger>
                <SelectContent>
                  {unassignedTargets.map((target) => (
                    <SelectItem key={getTargetId(target)} value={getTargetId(target)}>
                      <div className="flex items-center gap-2">
                        <span>{target.name}</span>
                        <Badge variant="outline" className="text-xs">
                          {target.status}
                        </Badge>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {unassignedTargets.length === 0 && (
              <div className="text-center py-4 text-brand-dark/70">
                <p>No unassigned targets available</p>
                <p className="text-sm">All targets are already assigned to rooms</p>
              </div>
            )}
            
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setAssignDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={handleAssignTarget}
                disabled={!selectedTarget || unassignedTargets.length === 0}
                className="bg-brand-secondary hover:bg-brand-secondary/90 text-white"
              >
                Assign Target
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Room Details Modal */}
      <Dialog open={roomDetailsOpen} onOpenChange={(open) => {
        // Always close modal immediately for smooth UX
        setRoomDetailsOpen(open);
        
        if (!open && pendingAssignments.size > 0) {
          // Save assignments in background after modal is closed
          setTimeout(() => {
            savePendingAssignments().catch(error => {
              console.error('Background save failed:', error);
            });
          }, 100); // Small delay to ensure modal close animation completes
        }
      }}>
        <DialogContent 
          className="w-[calc(100vw-60px)] max-w-2xl max-h-[calc(100vh-55px)] p-6 rounded-lg mx-auto my-auto flex flex-col"
        >
          <DialogHeader className="pb-2 flex-shrink-0">
            <DialogTitle className="flex items-center gap-2 sm:gap-3">
              <div className="p-1.5 sm:p-2 bg-brand-secondary/10 rounded-lg">
                <Target className="h-4 w-4 sm:h-5 sm:w-5 text-brand-primary" />
              </div>
              <div>
                <div className="text-lg sm:text-h3 font-heading text-brand-dark">
                  {roomForDetails?.name} - Room Details
                </div>
                <div className="text-xs sm:text-sm text-brand-dark/70 font-body">
                  Manage targets assigned to this room
                </div>
              </div>
            </DialogTitle>
          </DialogHeader>
          
          {roomForDetails && (
            <div className="space-y-3 sm:space-y-6 flex-1 overflow-hidden">
              {/* Room Info */}
              <div className="bg-brand-secondary/5 rounded-lg p-3 sm:p-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                  <div>
                    <p className="text-xs sm:text-sm text-brand-dark/70 font-body">Room Name</p>
                    <p className="text-sm sm:text-base font-heading text-brand-dark truncate">{roomForDetails.name}</p>
                  </div>
                  <div>
                    <p className="text-xs sm:text-sm text-brand-dark/70 font-body">Target Count</p>
                    <p className="text-sm sm:text-base font-heading text-brand-dark">{getRoomTargets(roomForDetails.id).length}</p>
                  </div>
                  <div>
                    <p className="text-xs sm:text-sm text-brand-dark/70 font-body">Room ID</p>
                    <p className="text-xs sm:text-sm font-mono text-brand-dark/70 truncate">{roomForDetails.id.slice(0, 8)}...</p>
                  </div>
                </div>
              </div>

              {/* Assigned Targets */}
              <div>
                <div className="flex items-center justify-between mb-2 sm:mb-4">
                  <h3 className="text-base sm:text-lg font-heading text-brand-dark">Assigned Targets</h3>
                </div>
                
                {targetsLoading ? (
                  <div className="space-y-3">
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className="bg-white border border-gray-200 rounded-lg p-3 animate-pulse">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-6 h-6 bg-gray-200 rounded"></div>
                            <div className="space-y-1">
                              <div className="h-3 w-24 bg-gray-200 rounded"></div>
                              <div className="h-2 w-16 bg-gray-200 rounded"></div>
                            </div>
                          </div>
                          <div className="h-6 w-20 bg-gray-200 rounded"></div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (() => {
                  const roomTargets = getRoomTargets(roomForDetails.id);
                  
                  return roomTargets.length === 0 ? (
                    <div className="text-center py-4 sm:py-8 bg-brand-secondary/5 rounded-lg">
                      <Target className="h-8 w-8 sm:h-12 sm:w-12 text-brand-primary/50 mx-auto mb-2 sm:mb-4" />
                      <p className="text-sm sm:text-base text-brand-dark/70 font-body">No targets assigned to this room</p>
                      <p className="text-xs sm:text-sm text-brand-dark/50">Click "Assign" to get started</p>
                    </div>
                  ) : (
                    <div className="space-y-2 sm:space-y-3 max-h-60 sm:max-h-80 overflow-y-auto">
                      {roomTargets.map((target) => (
                      <div
                        key={getTargetId(target)}
                        className="flex items-center justify-between p-2 sm:p-4 bg-white border border-gray-200 rounded-lg"
                      >
                        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                          <div className="p-1.5 sm:p-2 bg-brand-secondary/10 rounded-lg flex-shrink-0">
                            <Target className="h-3 w-3 sm:h-4 sm:w-4 text-brand-primary" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm sm:text-base font-heading text-brand-dark truncate">{target.name}</p>
                            <div className="flex items-center gap-1 sm:gap-2 mt-0.5 sm:mt-1">
                              <Badge 
                                variant={target.status === 'online' || target.status === 'standby' ? 'default' : 'secondary'}
                                className={`text-xs ${(target.status === 'online' || target.status === 'standby') ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}
                              >
                                {target.status}
                              </Badge>
                              <span className="text-xs text-brand-dark/70 truncate">
                                ID: {getTargetDisplayId(target)}...
                              </span>
                            </div>
                          </div>
                        </div>
                        
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const targetId = getTargetId(target);
                            console.log('📝 Unassigning target (optimistic update):', targetId);
                            
                            // Optimistic update: Add to pending assignments as unassigned (null)
                            startTransition(() => {
                              const newPendingAssignments = new Map(pendingAssignments);
                              newPendingAssignments.set(targetId, null);
                              setPendingAssignments(newPendingAssignments);
                            });
                            
                            console.log('✅ Target unassigned from room (will save on modal close)');
                          }}
                          className="bg-red-500 border-red-500 text-white hover:bg-brand-primary hover:border-brand-primary text-xs px-2 py-1 flex-shrink-0"
                        >
                          <X className="h-3 w-3 sm:h-4 sm:w-4 mr-0.5 sm:mr-1" />
                          <span className="hidden sm:inline">Unassign</span>
                        </Button>
                      </div>
                    ))}
                  </div>
                  );
                })()}
              </div>

              {/* Available Targets to Assign */}
              {targetsLoading ? (
                <div>
                  <div className="flex items-center justify-between mb-2 sm:mb-4">
                    <h3 className="text-xs sm:text-sm font-heading text-brand-dark">Available Targets to Assign</h3>
                    <div className="flex items-center gap-2">
                      <div className="h-6 w-12 bg-gray-200 rounded animate-pulse"></div>
                      <div className="h-6 w-16 bg-gray-200 rounded animate-pulse"></div>
                    </div>
                  </div>
                  <div className="space-y-2 sm:space-y-3 max-h-60 sm:max-h-80 overflow-y-auto">
                    {[...Array(4)].map((_, i) => (
                      <div key={i} className="bg-brand-secondary/5 border border-gray-200 rounded-lg p-3 animate-pulse">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-4 h-4 bg-gray-200 rounded"></div>
                            <div className="w-6 h-6 bg-gray-200 rounded"></div>
                            <div className="space-y-1">
                              <div className="h-3 w-24 bg-gray-200 rounded"></div>
                              <div className="h-2 w-16 bg-gray-200 rounded"></div>
                            </div>
                          </div>
                          <div className="h-6 w-16 bg-gray-200 rounded"></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : unassignedTargets.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2 sm:mb-4">
                    <h3 className="text-xs sm:text-sm font-heading text-brand-dark">Available Targets to Assign</h3>
                    <div className="flex items-center gap-2">
                      <Button
                        onClick={clearSelection}
                        variant="outline"
                        size="sm"
                        disabled={selectedTargets.length === 0}
                        className={`text-xs px-1.5 py-0.5 h-6 ${
                          selectedTargets.length > 0 
                            ? 'bg-red-500 border-red-500 text-white hover:bg-red-600' 
                            : 'bg-gray-300 border-gray-300 text-gray-500'
                        }`}
                      >
                        Clear
                      </Button>
                      <Button
                        onClick={async () => {
                          await refreshTargets();
                          toast.success('Targets refreshed');
                        }}
                        variant="outline"
                        size="sm"
                        className="text-xs px-1.5 py-0.5 h-6"
                      >
                        <RefreshCw className="h-3 w-3 mr-0.5" />
                        Refresh
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-2 sm:space-y-3 max-h-48 sm:max-h-64 overflow-y-auto">
                    {unassignedTargets.map((target) => (
                      <div
                        key={getTargetId(target)}
                        className="flex items-center justify-between p-2 sm:p-4 bg-brand-secondary/5 border border-gray-200 rounded-lg"
                      >
                        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                          <Checkbox
                            checked={selectedTargets.includes(getTargetId(target))}
                            onCheckedChange={(checked) => handleTargetSelection(getTargetId(target), checked as boolean)}
                            className="flex-shrink-0 data-[state=checked]:bg-red-500 data-[state=checked]:border-red-500 data-[state=checked]:text-white"
                          />
                          <div className="p-1.5 sm:p-2 bg-brand-secondary/10 rounded-lg flex-shrink-0">
                            <Target className="h-3 w-3 sm:h-4 sm:w-4 text-brand-primary" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm sm:text-base font-heading text-brand-dark truncate">{target.name}</p>
                            <div className="flex items-center gap-1 sm:gap-2 mt-0.5 sm:mt-1">
                              <Badge 
                                variant={target.status === 'online' || target.status === 'standby' ? 'default' : 'secondary'}
                                className={`text-xs ${(target.status === 'online' || target.status === 'standby') ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}
                              >
                                {target.status}
                              </Badge>
                              <span className="text-xs text-brand-dark/70 truncate">
                                ID: {getTargetDisplayId(target)}...
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                    
                  </div>
                  
                  {/* Selection Controls */}
                  {selectedTargets.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-gray-200 flex-shrink-0">
                      <div className="flex items-center justify-between">
                        <Badge variant="secondary" className="text-xs px-1 py-0.5 h-5 whitespace-nowrap">
                          {selectedTargets.length} selected
                        </Badge>
                        <Button
                          onClick={handleBulkAssign}
                          className="bg-brand-secondary hover:bg-brand-secondary/90 text-white"
                        >
                          <Check className="h-4 w-4 mr-2" />
                          Assign Selected Targets
                        </Button>
                      </div>
                    </div>
                  )}
                  
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Create Room Modal */}
      <CreateRoomModal
        isOpen={createRoomModalOpen}
        onClose={() => setCreateRoomModalOpen(false)}
        onCreateRoom={handleCreateRoom}
        availableTargets={unassignedTargets.map(target => ({
          id: target.id,
          name: target.name,
          status: target.status || 'active'
        }))}
      />
    </div>
  );
};

export default Rooms;
