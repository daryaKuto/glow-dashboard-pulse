import React, { useState, useMemo, startTransition } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
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
import { Card, CardContent } from '@/components/ui/card';
import { Plus, Users, Target, RefreshCw, Eye, X, Check, ArrowRight, ArrowLeft, PenTool, Monitor } from 'lucide-react';
import Header from '@/components/shared/Header';
import Sidebar from '@/components/shared/Sidebar';
import MobileDrawer from '@/components/shared/MobileDrawer';
import StatCard from '@/components/shared/StatCard';
import { useIsMobile } from '@/shared/hooks/use-mobile';
import RoomCard from '@/components/RoomCard';
import { toast } from '@/components/ui/sonner';
import CreateRoomModal from '@/components/CreateRoomModal';
import { logger } from '@/shared/lib/logger';
import {
  useRooms,
  useCreateRoom,
  useUpdateRoom,
  useDeleteRoom,
  useAssignTargetToRoom,
  useAssignTargetsToRoom,
  type Room,
  type EdgeRoom,
} from '../index';
import { useTargets } from '@/features/targets';

const RoomsPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const isMobile = useIsMobile();


  // React Query hooks
  const { data: roomsData, isLoading, refetch: refetchRooms } = useRooms(true);
  const createRoomMutation = useCreateRoom();
  const updateRoomMutation = useUpdateRoom();
  const deleteRoomMutation = useDeleteRoom();
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

  // Fetch accurate target statuses (rooms edge function returns stale status)
  const { data: targetsData } = useTargets();

  // Extract rooms and unassigned targets from React Query data
  const rooms = roomsData?.rooms || [];
  const unassignedTargetsFromQuery = roomsData?.unassignedTargets || [];

  // Build a lookup map for accurate target status from targets-with-telemetry
  const targetStatusMap = useMemo(() => {
    const map = new Map<string, 'online' | 'standby' | 'offline'>();
    for (const t of targetsData?.targets ?? []) {
      const id = typeof t.id === 'string' ? t.id : (t.id as any)?.id;
      if (id) map.set(id, t.status);
    }
    return map;
  }, [targetsData]);

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

  // StatCard data for the 4 room stats
  const roomStatCards = [
    {
      title: 'Rooms',
      value: rooms.length,
      subtitle: rooms.length === 1 ? '1 room configured' : `${rooms.length} rooms configured`,
      icon: <Users className="w-4 h-4" />,
    },
    {
      title: 'Total Targets',
      value: rooms.reduce((sum, r) => sum + r.targetCount, 0) + unassignedTargets.length,
      subtitle: 'Registered devices',
      icon: <Target className="w-4 h-4" />,
    },
    {
      title: 'Assigned',
      value: assignedTargetCount,
      subtitle: 'Targets in rooms',
      icon: <Check className="w-4 h-4" />,
    },
    {
      title: 'Unassigned',
      value: unassignedTargets.length,
      subtitle: unassignedTargets.length > 0 ? 'Need room assignment' : 'All targets assigned',
      icon: <Target className="w-4 h-4" />,
    },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-brand-light responsive-container pt-[116px] lg:pt-16">
      <Header />
      {isMobile && <MobileDrawer />}

      {!isMobile && <Sidebar />}
      <div className="flex flex-1 no-overflow lg:pl-64">
        <main className="flex-1 overflow-y-auto responsive-container">
          <div className="w-full px-4 py-2 md:p-4 lg:p-6 md:max-w-7xl md:mx-auto space-y-2 md:space-y-4 lg:space-y-6 responsive-transition h-full">
            {/* Page Header */}
            <div>
              <div className="flex items-center justify-between gap-2 md:gap-4">
                <h1 className="text-xl md:text-3xl font-heading font-semibold text-brand-dark text-left">Rooms</h1>
                <div className="flex items-center gap-1.5 md:gap-2 shrink-0">
                  <Button
                    onClick={() => setCreateRoomModalOpen(true)}
                    size="sm"
                    className="bg-brand-primary hover:bg-brand-primary/90 text-white md:h-10 md:px-5 md:text-sm"
                  >
                    <Plus className="h-4 w-4 md:mr-2" />
                    <span className="hidden md:inline">Add Room</span>
                  </Button>
                  {/* Desktop-only Room Layout button */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate('/dashboard/rooms/layout/new')}
                    className="hidden lg:inline-flex md:h-10 md:px-5 md:text-sm"
                  >
                    <PenTool className="h-4 w-4 md:mr-2" />
                    <span className="hidden md:inline">Create a Custom Room Layout</span>
                  </Button>
                </div>
              </div>
              <p className="text-xs md:text-sm text-brand-dark/55 font-body mt-0.5 text-left">Manage your rooms and target assignments</p>
            </div>

            {/* Stats Overview — NO stagger animation (matches Dashboard pattern) */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 md:gap-4">
              {roomStatCards.map((card) => (
                <StatCard
                  key={card.title}
                  title={card.title}
                  value={card.value}
                  subtitle={card.subtitle}
                  icon={card.icon}
                  isLoading={isLoading}
                />
              ))}
            </div>

            {/* Mobile banner — room layout requires desktop */}
            <div className="lg:hidden flex items-center gap-3 rounded-[var(--radius-lg)] bg-brand-secondary px-4 py-3">
              <Monitor className="w-5 h-5 text-white shrink-0" />
              <p className="text-xs text-white font-body">
                Use a desktop or laptop to design and customize your room layouts
              </p>
            </div>

            {/* Room Cards */}
            {isLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 md:gap-4 lg:gap-5">
                {[...Array(4)].map((_, i) => (
                  <Card key={i} className="shadow-card bg-gradient-to-br from-white to-brand-secondary/[0.04]">
                    <CardContent className="p-3 md:p-4 lg:p-5 animate-pulse">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 md:gap-3">
                          <div className="w-4 h-4 bg-gray-200 rounded" />
                          <div>
                            <div className="h-3.5 md:h-4 w-24 md:w-32 bg-gray-200 rounded" />
                            <div className="h-2.5 w-16 bg-gray-200 rounded mt-1" />
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <div className="w-7 h-7 md:w-8 md:h-8 bg-gray-200 rounded-full" />
                          <div className="w-7 h-7 md:w-8 md:h-8 bg-gray-200 rounded-full" />
                        </div>
                      </div>
                      <div className="mt-2 md:mt-3 pt-2 md:pt-2.5 border-t border-[rgba(28,25,43,0.06)]">
                        <div className="flex justify-between">
                          <div className="h-6 md:h-8 w-20 md:w-24 bg-gray-200 rounded-full" />
                          <div className="h-6 md:h-8 w-16 md:w-20 bg-gray-200 rounded-full" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : rooms.length === 0 ? (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease: 'easeOut' }}
                className="text-center py-6 md:py-8"
              >
                <Card className="shadow-card mx-auto max-w-sm md:max-w-md">
                  <CardContent className="p-6 md:p-8">
                    <Users className="w-6 h-6 md:w-8 md:h-8 text-brand-dark/30 mx-auto mb-3 md:mb-4" />
                    <h3 className="text-base md:text-lg font-heading font-semibold text-brand-dark mb-1.5 md:mb-2">No rooms yet</h3>
                    <p className="text-xs md:text-sm text-brand-dark/55 font-body mb-4 md:mb-6">
                      Create your first room to get started
                    </p>
                    <Button
                      onClick={() => setCreateRoomModalOpen(true)}
                      className="bg-brand-primary hover:bg-brand-primary/90 text-white w-full sm:w-auto"
                    >
                      <Plus className="h-4 w-4 mr-2" /> Create Room
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 md:gap-4 lg:gap-5">
                {sortedRooms.map((room) => (
                  <RoomCard
                    key={room.id}
                    room={room}
                    targets={rooms.find(r => r.id === room.id)?.targets?.map(t => {
                      const id = typeof t.id === 'string' ? t.id : (t.id as any)?.id;
                      return { name: t.name, status: targetStatusMap.get(id) ?? t.status };
                    }) ?? []}
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
                ))}
              </div>
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
        <AlertDialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md mx-auto">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base md:text-lg font-heading text-brand-dark">
              Delete room {roomPendingDelete ? `"${roomPendingDelete.name}"` : ''}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs md:text-sm text-brand-dark/70">
              This will remove the room and unassign any targets currently linked to it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingRoom} className="w-full sm:w-auto">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button
                variant="destructive"
                onClick={handleConfirmDelete}
                disabled={isDeletingRoom}
                className="w-full sm:w-auto"
              >
                {isDeletingRoom ? 'Deleting…' : 'Delete Room'}
              </Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Target Assignment Dialog */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md mx-auto">
          <DialogHeader>
            <DialogTitle className="text-base md:text-lg font-heading text-brand-dark">
              Assign Targets to {selectedRoom?.name}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 md:space-y-4">
            <div>
              <label className="text-[10px] md:text-label text-brand-dark/55 font-body uppercase tracking-wide mb-1.5 md:mb-2 block">
                Select Target
              </label>
              <Select value={selectedTarget} onValueChange={setSelectedTarget}>
                <SelectTrigger className="w-full h-10 bg-white border border-[rgba(28,25,43,0.1)] rounded-[var(--radius)] text-brand-dark text-sm">
                  <SelectValue placeholder="Choose a target to assign" />
                </SelectTrigger>
                <SelectContent className="bg-white shadow-lg border-0">
                  {unassignedTargets.map((target) => (
                    <SelectItem key={getTargetId(target)} value={getTargetId(target)}>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-body">{target.name}</span>
                        <span className="text-[10px] text-brand-dark/55 font-body">{target.status}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {unassignedTargets.length === 0 && (
              <div className="text-center py-4 text-brand-dark/55 font-body">
                <p className="text-sm">No unassigned targets available</p>
              </div>
            )}

            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
              <Button
                variant="secondary"
                onClick={() => setAssignDialogOpen(false)}
                className="w-full sm:w-auto"
              >
                Cancel
              </Button>
              <Button
                onClick={handleAssignTarget}
                disabled={!selectedTarget || unassignedTargets.length === 0}
                className="w-full sm:w-auto"
              >
                Assign Target
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Room Details Modal */}
      <Dialog open={roomDetailsOpen} onOpenChange={(open) => {
        setRoomDetailsOpen(open);
        if (!open && pendingAssignments.size > 0) {
          setTimeout(() => {
            savePendingAssignments().catch(console.error);
          }, 100);
        }
      }}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-2xl mx-auto max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 md:w-12 md:h-12 rounded-[var(--radius-lg)] bg-brand-primary/10 flex items-center justify-center shrink-0">
                <Users className="w-5 h-5 md:w-6 md:h-6 text-brand-primary" />
              </div>
              <div>
                <DialogTitle className="text-lg md:text-xl font-heading text-brand-dark">
                  {roomForDetails?.name}
                </DialogTitle>
                <p className="text-[11px] text-brand-dark/45 font-body mt-0.5">
                  {getRoomTargets(roomForDetails?.id ?? '').length} assigned target{getRoomTargets(roomForDetails?.id ?? '').length !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
          </DialogHeader>

          {roomForDetails && (
            <div className="space-y-4 md:space-y-5">
              {/* Assigned Targets Section */}
              <div>
                <div className="flex items-center gap-2.5 mb-3 md:mb-4">
                  <div className="w-7 h-7 rounded-[var(--radius)] bg-brand-primary/10 flex items-center justify-center shrink-0">
                    <Target className="w-4 h-4 text-brand-primary" />
                  </div>
                  <h3 className="text-label text-brand-primary font-body uppercase tracking-wide">
                    Assigned Targets
                  </h3>
                  <span className="ml-auto bg-brand-primary/10 text-brand-primary text-[10px] font-bold font-body tabular-nums px-2 py-0.5 rounded-full">
                    {getRoomTargets(roomForDetails.id).length}
                  </span>
                </div>
                {getRoomTargets(roomForDetails.id).length === 0 ? (
                  <div className="rounded-[var(--radius-lg)] bg-brand-primary/[0.03] border border-dashed border-brand-primary/15 py-8 text-center">
                    <Target className="w-6 h-6 text-brand-dark/15 mx-auto mb-2" />
                    <p className="text-sm text-brand-dark/40 font-body">No targets assigned yet</p>
                    <p className="text-[10px] text-brand-dark/25 font-body mt-0.5">Use the section below to assign targets</p>
                  </div>
                ) : (
                  <div className="space-y-2 md:space-y-2.5">
                    {getRoomTargets(roomForDetails.id).map((target, i) => {
                      const tid = getTargetId(target);
                      const status = targetStatusMap.get(tid) ?? target.status;
                      const statusDot = status === 'online' ? 'bg-green-500'
                        : status === 'standby' ? 'bg-amber-400'
                        : 'bg-gray-400';
                      const statusLabel = status === 'online' ? 'Online'
                        : status === 'standby' ? 'Standby'
                        : 'Offline';
                      const statusTextColor = status === 'online' ? 'text-green-600'
                        : status === 'standby' ? 'text-amber-600'
                        : 'text-brand-dark/40';
                      const rowBg = status === 'online'
                        ? 'bg-gradient-to-r from-green-500/[0.06] via-green-500/[0.02] to-white'
                        : status === 'standby'
                        ? 'bg-gradient-to-r from-amber-400/[0.06] via-amber-400/[0.02] to-white'
                        : 'bg-gradient-to-r from-gray-200/[0.35] via-gray-100/[0.15] to-white';
                      const badgeBg = status === 'online'
                        ? 'bg-green-500/10'
                        : status === 'standby'
                        ? 'bg-amber-400/10'
                        : 'bg-brand-dark/[0.06]';
                      return (
                      <div
                        key={tid}
                        className={`flex items-center justify-between p-3 md:p-3.5 ${rowBg} shadow-subtle rounded-[var(--radius-lg)] group hover:shadow-card transition-all duration-200`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`relative w-9 h-9 rounded-[var(--radius)] ${badgeBg} flex items-center justify-center shrink-0`}>
                            <span className="text-xs font-bold text-brand-dark/60 font-body tabular-nums">{i + 1}</span>
                            <span className={`absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-white ${statusDot}`} />
                          </div>
                          <div className="min-w-0">
                            <span className="text-sm md:text-[15px] font-medium font-body text-brand-dark truncate block">{target.name}</span>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className={`text-[10px] font-medium font-body ${statusTextColor}`}>
                                {statusLabel}
                              </span>
                              <span className="text-[10px] text-brand-dark/20">&middot;</span>
                              <span className="text-[10px] text-brand-dark/30 font-body">
                                {getTargetDisplayId(target)}
                              </span>
                            </div>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="shrink-0 h-8 text-[11px] px-3 text-brand-dark/40 hover:text-red-600 hover:bg-red-600/[0.08] opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                          onClick={() => {
                            const targetId = getTargetId(target);
                            startTransition(() => {
                              const newPendingAssignments = new Map(pendingAssignments);
                              newPendingAssignments.set(targetId, null);
                              setPendingAssignments(newPendingAssignments);
                            });
                          }}
                        >
                          <X className="w-3 h-3 mr-1" />
                          Unassign
                        </Button>
                      </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Divider */}
              {unassignedTargets.length > 0 && (
                <div className="border-t border-[rgba(28,25,43,0.06)]" />
              )}

              {/* Available Targets Section */}
              {unassignedTargets.length > 0 && (
                <div>
                  <div className="flex items-center gap-2.5 mb-3 md:mb-4">
                    <div className="w-7 h-7 rounded-[var(--radius)] bg-brand-secondary/10 flex items-center justify-center shrink-0">
                      <ArrowRight className="w-4 h-4 text-brand-secondary" />
                    </div>
                    <h3 className="text-label text-brand-secondary font-body uppercase tracking-wide">
                      Available Targets
                    </h3>
                    <span className="ml-auto bg-brand-secondary/10 text-brand-secondary text-[10px] font-bold font-body tabular-nums px-2 py-0.5 rounded-full">
                      {unassignedTargets.length}
                    </span>
                  </div>
                  <div className="space-y-2 md:space-y-2.5 max-h-52 md:max-h-64 overflow-y-auto">
                    {[...unassignedTargets].sort((a, b) => {
                      const order: Record<string, number> = { online: 0, standby: 1, offline: 2 };
                      const aStatus = targetStatusMap.get(getTargetId(a)) ?? a.status ?? 'offline';
                      const bStatus = targetStatusMap.get(getTargetId(b)) ?? b.status ?? 'offline';
                      return (order[aStatus] ?? 2) - (order[bStatus] ?? 2);
                    }).map((target) => {
                      const isSelected = selectedTargets.includes(getTargetId(target));
                      const accurateStatus = targetStatusMap.get(getTargetId(target)) ?? target.status;
                      const statusDotColor = accurateStatus === 'online' ? 'bg-green-500'
                        : accurateStatus === 'standby' ? 'bg-amber-400'
                        : 'bg-gray-400';
                      const statusTextColor = accurateStatus === 'online' ? 'text-green-600'
                        : accurateStatus === 'standby' ? 'text-amber-600'
                        : 'text-brand-dark/40';
                      const statusLabelText = accurateStatus === 'online' ? 'Online'
                        : accurateStatus === 'standby' ? 'Standby'
                        : 'Offline';
                      const rowBg = isSelected
                        ? 'bg-brand-primary/[0.06] ring-1 ring-brand-primary/20 shadow-subtle'
                        : accurateStatus === 'online'
                        ? 'bg-gradient-to-r from-green-500/[0.04] to-white hover:from-green-500/[0.07]'
                        : accurateStatus === 'standby'
                        ? 'bg-gradient-to-r from-amber-400/[0.04] to-white hover:from-amber-400/[0.07]'
                        : 'bg-gradient-to-r from-gray-200/[0.2] to-white hover:from-gray-200/[0.35]';
                      return (
                        <div
                          key={getTargetId(target)}
                          className={`flex items-center justify-between p-3 md:p-3.5 rounded-[var(--radius-lg)] transition-all duration-200 cursor-pointer ${rowBg}`}
                          onClick={() => handleTargetSelection(getTargetId(target), !isSelected)}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="relative w-9 h-9 rounded-[var(--radius)] bg-brand-dark/[0.04] flex items-center justify-center shrink-0">
                              <Target className="w-4 h-4 text-brand-primary" />
                              <span className={`absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-white ${statusDotColor}`} />
                            </div>
                            <div className="min-w-0">
                              <span className="text-sm md:text-[15px] font-medium font-body text-brand-dark truncate block">{target.name}</span>
                              <span className={`text-[10px] font-medium font-body ${statusTextColor}`}>
                                {statusLabelText}
                              </span>
                            </div>
                          </div>
                          <div
                            className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ml-2 transition-all duration-200 ${
                              isSelected
                                ? 'border-brand-primary bg-brand-primary'
                                : 'border-brand-dark/20'
                            }`}
                          >
                            {isSelected && (
                              <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="none">
                                <path d="M2.5 6L5 8.5L9.5 3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {selectedTargets.length > 0 && (
                    <div className="mt-3 md:mt-4 flex items-center justify-between bg-brand-primary/[0.06] rounded-[var(--radius-lg)] p-3.5 shadow-subtle">
                      <span className="text-xs font-medium text-brand-dark/60 font-body">
                        {selectedTargets.length} target{selectedTargets.length !== 1 ? 's' : ''} selected
                      </span>
                      <Button onClick={handleBulkAssign} size="sm" className="h-8 shadow-sm">
                        <ArrowRight className="w-3.5 h-3.5 mr-1.5" />
                        Assign Selected
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
