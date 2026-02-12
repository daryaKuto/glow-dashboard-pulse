import React, { useState, useMemo, startTransition } from 'react';
import { useLocation } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Users, Target, RefreshCw, Eye, X, Check, ArrowRight, ArrowLeft } from 'lucide-react';
import Header from '@/components/shared/Header';
import Sidebar from '@/components/shared/Sidebar';
import MobileDrawer from '@/components/shared/MobileDrawer';
import { useIsMobile } from '@/shared/hooks/use-mobile';
import RoomCard from '@/components/RoomCard';
import DragDropList from '@/components/DragDropList';
import { toast } from '@/components/ui/sonner';
import CreateRoomModal from '@/components/CreateRoomModal';
import { logger } from '@/shared/lib/logger';
import {
  useRooms,
  useCreateRoom,
  useUpdateRoom,
  useDeleteRoom,
  useUpdateRoomOrder,
  useAssignTargetToRoom,
  useAssignTargetsToRoom,
  type Room,
  type EdgeRoom,
} from '../index';

const RoomsPage: React.FC = () => {
  const location = useLocation();
  const isMobile = useIsMobile();

  
  // React Query hooks
  const { data: roomsData, isLoading, refetch: refetchRooms } = useRooms(true);
  const createRoomMutation = useCreateRoom();
  const updateRoomMutation = useUpdateRoom();
  const deleteRoomMutation = useDeleteRoom();
  const updateRoomOrderMutation = useUpdateRoomOrder();
  const assignTargetMutation = useAssignTargetToRoom();
  const assignTargetsMutation = useAssignTargetsToRoom();
  const queryClient = useQueryClient();
  
  // Local state
  const [createRoomModalOpen, setCreateRoomModalOpen] = useState(false);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<EdgeRoom | null>(null);
  const [selectedTarget, setSelectedTarget] = useState<string>('');
  const [roomDetailsOpen, setRoomDetailsOpen] = useState(false);
  const [roomForDetails, setRoomForDetails] = useState<EdgeRoom | null>(null);
  const [selectedTargets, setSelectedTargets] = useState<string[]>([]);
  const [pendingAssignments, setPendingAssignments] = useState<Map<string, string | null>>(new Map());
  const [roomPendingDelete, setRoomPendingDelete] = useState<Room | null>(null);
  const [isDeletingRoom, setIsDeletingRoom] = useState(false);

  // Extract rooms and unassigned targets from React Query data
  const rooms = roomsData?.rooms || [];
  const unassignedTargetsFromQuery = roomsData?.unassignedTargets || [];

  // Helper function to safely get target ID
  const getTargetId = (target: any) => {
    if (target.id?.id) return target.id.id;
    if (target.id) return target.id;
    return 'unknown';
  };

  // Optimistically update local state without API call
  const updateTargetsOptimistically = (targetIds: string[], newRoomId: string | null) => {
    // This will be handled by React Query cache updates
    logger.debug(`✨ [OPTIMISTIC] UI: Updated ${targetIds.length} targets locally to room ${newRoomId}`);
  };

  const handleCreateRoom = async (roomData: {
    name: string;
    icon: string;
    type: string;
    assignedTargets: string[];
  }) => {
    try {
      // Get next order index
      const nextOrder = rooms.length > 0 ? Math.max(...rooms.map(r => r.order)) + 1 : 0;
      
      await createRoomMutation.mutateAsync({
        name: roomData.name,
        room_type: roomData.type,
        icon: roomData.icon,
        order_index: nextOrder,
        assignedTargets: roomData.assignedTargets,
      });
      
      setCreateRoomModalOpen(false);
    } catch (error) {
      // Error handled by mutation hook
      console.error('Error creating room:', error);
    }
  };

  const handleRename = async (id: string, name: string) => {
    try {
      await updateRoomMutation.mutateAsync({ roomId: id, updates: { name } });
    } catch (error) {
      console.error('Error renaming room:', error);
    }
  };

  const handleDeleteRequest = (room: Room) => {
    setRoomPendingDelete(room);
  };

  const handleConfirmDelete = async () => {
    if (!roomPendingDelete) {
      return;
    }
    setIsDeletingRoom(true);
    try {
      await deleteRoomMutation.mutateAsync(roomPendingDelete.id);
      await Promise.all([
        refetchRooms(),
        queryClient.invalidateQueries({ queryKey: ['targets'] }),
      ]);
      setRoomPendingDelete(null);
    } catch (error) {
      console.error('Error deleting room:', error);
    } finally {
      setIsDeletingRoom(false);
    }
  };

  const handleReorder = (reorderedRooms: typeof rooms) => {
    const orderedIds = reorderedRooms.map((room, index) => ({
      id: room.id,
      order_index: index + 1,
    }));
    
    updateRoomOrderMutation.mutate(orderedIds);
  };

  const handleAssignTarget = async () => {
    if (!selectedTarget || !selectedRoom) {
      return;
    }
    
    try {
      await assignTargetMutation.mutateAsync({
        targetId: selectedTarget,
        roomId: selectedRoom.id,
      });
      
      setAssignDialogOpen(false);
      setSelectedTarget('');
      setSelectedRoom(null);
    } catch (error) {
      console.error('Error assigning target:', error);
    }
  };

  const openAssignDialog = (room: EdgeRoom) => {
    setSelectedRoom(room);
    setAssignDialogOpen(true);
  };

  const openRoomDetails = async (room: EdgeRoom) => {
    if (pendingAssignments.size > 0) {
      await savePendingAssignments();
    }
    
    setRoomForDetails(room);
    setRoomDetailsOpen(true);
    setSelectedTargets([]);
    setPendingAssignments(new Map());
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
    
    // Capture target IDs before clearing state
    const targetIdsToAssign = [...selectedTargets];
    const roomId = roomForDetails.id;
    
    try {
      updateTargetsOptimistically(targetIdsToAssign, roomId);
      
      await assignTargetsMutation.mutateAsync({
        targetIds: targetIdsToAssign,
        roomId,
      });
      
      // Clear selection only after successful mutation
      setSelectedTargets([]);
      await refetchRooms();
    } catch (error) {
      console.error('Error assigning targets:', error);
      await refetchRooms();
      // Don't clear selection on error so user can retry
    }
  };

  const clearSelection = () => {
    setSelectedTargets([]);
  };

  const savePendingAssignments = async () => {
    if (pendingAssignments.size === 0) {
      return;
    }
    
    try {
      const assignmentsByRoom = new Map<string | null, string[]>();
      
      for (const [targetId, roomId] of pendingAssignments.entries()) {
        if (!assignmentsByRoom.has(roomId)) {
          assignmentsByRoom.set(roomId, []);
        }
        assignmentsByRoom.get(roomId)!.push(targetId);
      }
      
      for (const [roomId, targetIds] of assignmentsByRoom.entries()) {
        await assignTargetsMutation.mutateAsync({
          targetIds,
          roomId,
        });
      }
      
      setPendingAssignments(new Map());
      await refetchRooms();
    } catch (error) {
      console.error('Error saving assignments:', error);
    }
  };

  // Convert EdgeRoom to Room format for RoomCard
  const roomsForDisplay: Room[] = useMemo(() => {
    return rooms.map(room => ({
      id: room.id,
      name: room.name,
      room_type: room.room_type || '',
      icon: room.icon || 'home',
      order_index: room.order,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      target_count: room.targetCount,
      targets: room.targets || [],
    }));
  }, [rooms]);

  const sortedRooms = useMemo(
    () => [...roomsForDisplay].sort((a, b) => a.order_index - b.order_index),
    [roomsForDisplay],
  );

  // Get targets assigned to a specific room
  const getRoomTargets = useMemo(() => {
    return (roomId: string) => {
      const room = rooms.find(r => r.id === roomId);
      return room?.targets || [];
    };
  }, [rooms]);

  const getTargetDisplayId = (target: any) => {
    const id = getTargetId(target);
    return id !== 'unknown' ? id.substring(0, 8) : 'N/A';
  };

  // Use unassigned targets from query, fallback to empty array
  const unassignedTargets = unassignedTargetsFromQuery;

  const assignedTargetCount = useMemo(
    () => rooms.reduce((sum, room) => sum + room.targetCount, 0),
    [rooms],
  );

  return (
    <div className="min-h-screen flex flex-col bg-brand-light responsive-container pt-[116px] lg:pt-16">
      <Header />
      {isMobile && <MobileDrawer />}

      {!isMobile && <Sidebar />}
      <div className="flex flex-1 no-overflow lg:pl-64">
        <main className="flex-1 overflow-y-auto responsive-container">
          <div className="w-full px-4 py-2 md:container md:mx-auto md:p-4 lg:p-6 responsive-transition h-full">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-6">
              <h2 className="text-h1 font-heading text-brand-dark">Rooms</h2>
            </div>
            
            {/* Stats Overview */}
            <div className="responsive-grid grid-cols-2 md:grid-cols-4 mb-6">
              {isLoading ? (
                <>
                  {[...Array(4)].map((_, i) => (
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
                      <p className="text-lg md:text-h2 font-heading text-brand-dark">
                        {rooms.reduce((sum, r) => sum + r.targetCount, 0) + unassignedTargets.length}
                      </p>
                    </div>
                  </div>

                  <div className="bg-white rounded-lg p-3 md:p-4 shadow-sm border border-gray-200">
                    <div className="flex flex-col items-center text-center">
                      <div className="p-2 bg-brand-secondary/10 rounded-lg mb-2">
                        <Check className="h-4 w-4 md:h-5 md:w-5 text-brand-primary" />
                      </div>
                      <p className="text-xs md:text-sm text-brand-dark/70 font-body">Assigned</p>
                      <p className="text-lg md:text-h2 font-heading text-brand-dark">{assignedTargetCount}</p>
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
            
            {isLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="bg-white border border-gray-200 rounded-lg p-4 md:p-5 animate-pulse">
                    <div className="flex items-start justify-between gap-3 md:gap-4">
                      <div className="flex items-start gap-3 md:gap-4">
                        <div className="w-10 h-10 md:w-12 md:h-12 bg-gray-200 rounded-lg" />
                        <div className="space-y-2">
                          <div className="h-4 w-32 bg-gray-200 rounded" />
                          <div className="flex items-center gap-2">
                            <div className="h-5 w-12 bg-gray-200 rounded-full" />
                            <div className="h-4 w-16 bg-gray-200 rounded" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : rooms.length === 0 ? (
              <div className="text-center py-8">
                <div className="bg-white rounded-lg p-8 mx-auto max-w-md shadow-sm border border-gray-200">
                  <div className="text-brand-primary mb-4 text-h3 font-heading">No rooms yet</div>
                  <p className="text-brand-dark mb-6 font-body">
                    Create your first room to get started
                  </p>
                  <Button 
                    onClick={() => setCreateRoomModalOpen(true)}
                    className="bg-brand-secondary hover:bg-dark text-white"
                  >
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
                    onDelete={handleDeleteRequest}
                    onAssignTargets={() => {
                      const edgeRoom = rooms.find(r => r.id === room.id);
                      if (edgeRoom) openAssignDialog(edgeRoom);
                    }}
                    onViewDetails={() => {
                      const edgeRoom = rooms.find(r => r.id === room.id);
                      if (edgeRoom) openRoomDetails(edgeRoom);
                    }}
                  />
                )}
              />
            )}
          </div>
        </main>
      </div>

      {/* Delete Room Dialog */}
      <AlertDialog
        open={Boolean(roomPendingDelete)}
        onOpenChange={(open) => {
          if (!open && !isDeletingRoom) {
            setRoomPendingDelete(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete room {roomPendingDelete ? `"${roomPendingDelete.name}"` : ''}
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the room and unassign any targets currently linked to it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingRoom}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button
                variant="destructive"
                onClick={handleConfirmDelete}
                disabled={isDeletingRoom}
              >
                {isDeletingRoom ? 'Deleting…' : 'Delete Room'}
              </Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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

      {/* Room Details Modal - Simplified for now */}
      <Dialog open={roomDetailsOpen} onOpenChange={(open) => {
        setRoomDetailsOpen(open);
        if (!open && pendingAssignments.size > 0) {
          setTimeout(() => {
            savePendingAssignments().catch(console.error);
          }, 100);
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {roomForDetails?.name} - Room Details
            </DialogTitle>
          </DialogHeader>
          
          {roomForDetails && (
            <div className="space-y-4">
              <div>
                <h3 className="font-heading text-brand-dark mb-2">Assigned Targets</h3>
                {getRoomTargets(roomForDetails.id).length === 0 ? (
                  <p className="text-sm text-brand-dark/70">No targets assigned</p>
                ) : (
                  <div className="space-y-2">
                    {getRoomTargets(roomForDetails.id).map((target) => (
                      <div key={getTargetId(target)} className="flex items-center justify-between p-2 bg-white border rounded-lg">
                        <span>{target.name}</span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const targetId = getTargetId(target);
                            startTransition(() => {
                              const newPendingAssignments = new Map(pendingAssignments);
                              newPendingAssignments.set(targetId, null);
                              setPendingAssignments(newPendingAssignments);
                            });
                          }}
                        >
                          Unassign
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {unassignedTargets.length > 0 && (
                <div>
                  <h3 className="font-heading text-brand-dark mb-2">Available Targets</h3>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {unassignedTargets.map((target) => (
                      <div key={getTargetId(target)} className="flex items-center justify-between p-2 bg-gray-50 border rounded-lg">
                        <div className="flex items-center gap-2">
                          <Checkbox
                            checked={selectedTargets.includes(getTargetId(target))}
                            onCheckedChange={(checked) => handleTargetSelection(getTargetId(target), checked as boolean)}
                          />
                          <span>{target.name}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  {selectedTargets.length > 0 && (
                    <div className="mt-4 flex justify-end">
                      <Button onClick={handleBulkAssign}>
                        Assign Selected ({selectedTargets.length})
                      </Button>
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
          id: getTargetId(target),
          name: target.name,
          status: target.status ?? null,
          activityStatus: target.activityStatus ?? null,
        }))}
      />
    </div>
  );
};

export default RoomsPage;

