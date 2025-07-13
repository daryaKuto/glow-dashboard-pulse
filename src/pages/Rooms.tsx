import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useRooms } from '@/store/useRooms';
import { useTargets } from '@/store/useTargets';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Plus, Users, Target, RefreshCw, Eye, X, ArrowRight, ArrowLeft } from 'lucide-react';
import Header from '@/components/Header';
import Sidebar from '@/components/Sidebar';
import MobileDrawer from '@/components/MobileDrawer';
import { useIsMobile } from '@/hooks/use-mobile';
import RoomCard from '@/components/RoomCard';
import DragDropList from '@/components/DragDropList';
import { toast } from '@/components/ui/sonner';

const Rooms: React.FC = () => {
  const location = useLocation();
  const isMobile = useIsMobile();
  const { 
    rooms, 
    isLoading, 
    fetchRooms, 
    createRoom, 
    updateRoom, 
    deleteRoom,
    updateRoomOrder,
    assignTargetToRoom
  } = useRooms();
  const { targets, refresh: refreshTargets } = useTargets();
  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomIcon, setNewRoomIcon] = useState('home');
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<any>(null);
  const [selectedTarget, setSelectedTarget] = useState<string>('');
  const [roomDetailsOpen, setRoomDetailsOpen] = useState(false);
  const [roomForDetails, setRoomForDetails] = useState<any>(null);

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

  // TODO: Get proper token from auth context
  const token = ''; // We need to implement proper token handling

  useEffect(() => {
    fetchRooms(token);
    refreshTargets();
  }, [token, fetchRooms, refreshTargets]);

  const handleCreateRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoomName.trim()) return;
    
    createRoom(newRoomName, token, newRoomIcon);
    setNewRoomName('');
    setNewRoomIcon('home');
  };

  const handleRename = (id: number, name: string) => {
    updateRoom(id, name, token);
  };

  const handleDelete = (id: number) => {
    if (window.confirm("Are you sure you want to delete this room?")) {
      deleteRoom(id, token);
    }
  };

  const handleReorder = (reorderedRooms: typeof rooms) => {
    const orderedIds = reorderedRooms.map((room, index) => ({
      id: room.id,
      order: index + 1
    }));
    
    updateRoomOrder(orderedIds, token);
  };

  const handleAssignTarget = async () => {
    if (!selectedTarget || !selectedRoom) return;
    
    try {
      await assignTargetToRoom(selectedTarget, selectedRoom.thingsBoardId);
      setAssignDialogOpen(false);
      setSelectedTarget('');
      setSelectedRoom(null);
    } catch (error) {
      console.error('Error assigning target:', error);
    }
  };

  const openAssignDialog = (room: any) => {
    setSelectedRoom(room);
    setAssignDialogOpen(true);
  };

  const openRoomDetails = (room: any) => {
    setRoomForDetails(room);
    setRoomDetailsOpen(true);
  };

  const handleRefresh = async () => {
    await fetchRooms(token);
    await refreshTargets();
    toast.success('Rooms and targets refreshed');
  };

  const sortedRooms = [...rooms].sort((a, b) => a.order - b.order);

  // Get unassigned targets
  const unassignedTargets = targets.filter(target => !target.roomId);
  console.log('Unassigned targets:', unassignedTargets.map(t => ({ 
    name: t.name, 
    id: t.id, 
    roomId: t.roomId 
  })));

  // Get targets assigned to a specific room
  const getRoomTargets = (roomId: number) => {
    const roomTargets = targets.filter(target => target.roomId === roomId);
    console.log(`Room ${roomId} targets:`, roomTargets.map(t => ({ 
      name: t.name, 
      id: t.id, 
      roomId: t.roomId 
    })));
    return roomTargets;
  };

  // Helper function to safely get target ID
  const getTargetId = (target: any) => {
    if (target.id?.id) return target.id.id;
    if (target.id) return target.id;
    return 'unknown';
  };

  // Helper function to safely get target ID for display
  const getTargetDisplayId = (target: any) => {
    const id = getTargetId(target);
    return id !== 'unknown' ? id.substring(0, 8) : 'N/A';
  };

  return (
    <div className="min-h-screen flex flex-col bg-brand-light">
      <Header />
      
      <div className="flex flex-1">
        {!isMobile && <Sidebar />}
        {isMobile && <MobileDrawer />}
        
        <main className="flex-1 overflow-y-auto">
          <div className="container mx-auto p-4 md:p-6 lg:p-8">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-3xl font-heading text-brand-dark">Rooms</h2>
              <Button 
                onClick={handleRefresh}
                variant="outline"
                className="border-brand-brown/30 text-brand-dark hover:bg-brand-brown/10"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
            </div>
            
            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-white rounded-lg p-4 shadow-sm border border-brand-brown/20">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-brand-brown/10 rounded-lg">
                    <Users className="h-5 w-5 text-brand-brown" />
                  </div>
                  <div>
                    <p className="text-sm text-brand-dark/70 font-body">Total Rooms</p>
                    <p className="text-2xl font-heading text-brand-dark">{rooms.length}</p>
                  </div>
                </div>
              </div>
              
              <div className="bg-white rounded-lg p-4 shadow-sm border border-brand-brown/20">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-brand-brown/10 rounded-lg">
                    <Target className="h-5 w-5 text-brand-brown" />
                  </div>
                  <div>
                    <p className="text-sm text-brand-dark/70 font-body">Total Targets</p>
                    <p className="text-2xl font-heading text-brand-dark">{targets.length}</p>
                  </div>
                </div>
              </div>
              
              <div className="bg-white rounded-lg p-4 shadow-sm border border-brand-brown/20">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-brand-brown/10 rounded-lg">
                    <Target className="h-5 w-5 text-brand-brown" />
                  </div>
                  <div>
                    <p className="text-sm text-brand-dark/70 font-body">Unassigned</p>
                    <p className="text-2xl font-heading text-brand-dark">{unassignedTargets.length}</p>
                  </div>
                </div>
              </div>
            </div>
            
            <form onSubmit={handleCreateRoom} className="mb-6 flex gap-2">
              <Input
                placeholder="Room name"
                value={newRoomName}
                onChange={(e) => setNewRoomName(e.target.value)}
                className="bg-white border-brand-brown/30 text-brand-dark flex-1"
              />
              <Select value={newRoomIcon} onValueChange={setNewRoomIcon}>
                <SelectTrigger className="w-48 bg-white border-brand-brown/30 text-brand-dark">
                  <SelectValue placeholder="Select icon" />
                </SelectTrigger>
                <SelectContent>
                  {roomIcons.map((icon) => (
                    <SelectItem key={icon.value} value={icon.value}>
                      <div className="flex items-center gap-2">
                        <span className="text-brand-brown">{icon.label}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button 
                type="submit"
                className="bg-brand-brown hover:bg-brand-dark text-white whitespace-nowrap"
                disabled={!newRoomName.trim()}
              >
                <Plus className="h-4 w-4 mr-2" /> Add Room
              </Button>
            </form>
            
            {isLoading ? (
              <div className="text-center py-8 text-brand-dark font-body">Loading rooms...</div>
            ) : rooms.length === 0 ? (
              <div className="text-center py-8">
                <div className="bg-white rounded-lg p-8 mx-auto max-w-md shadow-sm border border-brand-brown/20">
                  <div className="text-brand-brown mb-4 text-xl font-heading">No rooms yet</div>
                  <p className="text-brand-dark mb-6 font-body">
                    Create your first room to get started
                  </p>
                  <Button className="bg-brand-brown hover:bg-dark text-white">
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
                className="bg-brand-brown hover:bg-brand-dark text-white"
              >
                Assign Target
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Room Details Modal */}
      <Dialog open={roomDetailsOpen} onOpenChange={setRoomDetailsOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <div className="p-2 bg-brand-brown/10 rounded-lg">
                <Target className="h-5 w-5 text-brand-brown" />
              </div>
              <div>
                <div className="text-xl font-heading text-brand-dark">
                  {roomForDetails?.name} - Room Details
                </div>
                <div className="text-sm text-brand-dark/70 font-body">
                  Manage targets assigned to this room
                </div>
              </div>
            </DialogTitle>
          </DialogHeader>
          
          {roomForDetails && (
            <div className="space-y-6">
              {/* Room Info */}
              <div className="bg-brand-brown/5 rounded-lg p-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <p className="text-sm text-brand-dark/70 font-body">Room Name</p>
                    <p className="font-heading text-brand-dark">{roomForDetails.name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-brand-dark/70 font-body">Target Count</p>
                    <p className="font-heading text-brand-dark">{roomForDetails.targetCount}</p>
                  </div>
                  <div>
                    <p className="text-sm text-brand-dark/70 font-body">Room ID</p>
                    <p className="font-heading text-brand-dark">{roomForDetails.id}</p>
                  </div>
                </div>
              </div>

              {/* Assigned Targets */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-heading text-brand-dark">Assigned Targets</h3>
                  <Button
                    onClick={() => {
                      setRoomDetailsOpen(false);
                      openAssignDialog(roomForDetails);
                    }}
                    className="bg-brand-brown hover:bg-brand-dark text-white"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Assign More Targets
                  </Button>
                </div>
                
                {getRoomTargets(roomForDetails.id).length === 0 ? (
                  <div className="text-center py-8 bg-brand-brown/5 rounded-lg">
                    <Target className="h-12 w-12 text-brand-brown/50 mx-auto mb-4" />
                    <p className="text-brand-dark/70 font-body">No targets assigned to this room</p>
                    <p className="text-sm text-brand-dark/50">Click "Assign More Targets" to get started</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {getRoomTargets(roomForDetails.id).map((target) => (
                      <div
                        key={getTargetId(target)}
                        className="flex items-center justify-between p-4 bg-white border border-brand-brown/20 rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-brand-brown/10 rounded-lg">
                            <Target className="h-4 w-4 text-brand-brown" />
                          </div>
                          <div>
                            <p className="font-heading text-brand-dark">{target.name}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge 
                                variant={target.status === 'online' ? 'default' : 'secondary'}
                                className={target.status === 'online' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}
                              >
                                {target.status}
                              </Badge>
                              <span className="text-sm text-brand-dark/70">
                                ID: {getTargetDisplayId(target)}...
                              </span>
                            </div>
                          </div>
                        </div>
                        
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={async () => {
                                                         try {
                               // Unassign target from room
                               await assignTargetToRoom(getTargetId(target), null);
                               // Refresh data
                               await fetchRooms(token);
                               await refreshTargets();
                             } catch (error) {
                               console.error('Error unassigning target:', error);
                               toast.error('Failed to unassign target');
                             }
                          }}
                          className="border-red-300 text-red-600 hover:bg-red-50"
                        >
                          <X className="h-4 w-4 mr-1" />
                          Unassign
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Available Targets to Assign */}
              {unassignedTargets.length > 0 && (
                <div>
                  <h3 className="text-lg font-heading text-brand-dark mb-4">Available Targets to Assign</h3>
                  <div className="space-y-3">
                    {unassignedTargets.slice(0, 5).map((target) => (
                      <div
                        key={getTargetId(target)}
                        className="flex items-center justify-between p-4 bg-brand-brown/5 border border-brand-brown/20 rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-brand-brown/10 rounded-lg">
                            <Target className="h-4 w-4 text-brand-brown" />
                          </div>
                          <div>
                            <p className="font-heading text-brand-dark">{target.name}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge 
                                variant={target.status === 'online' ? 'default' : 'secondary'}
                                className={target.status === 'online' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}
                              >
                                {target.status}
                              </Badge>
                              <span className="text-sm text-brand-dark/70">
                                ID: {getTargetDisplayId(target)}...
                              </span>
                            </div>
                          </div>
                        </div>
                        
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={async () => {
                                                         try {
                               // Assign target to room
                               await assignTargetToRoom(getTargetId(target), roomForDetails.thingsBoardId);
                               // Refresh data
                               await fetchRooms(token);
                               await refreshTargets();
                             } catch (error) {
                               console.error('Error assigning target:', error);
                               toast.error('Failed to assign target');
                             }
                          }}
                          className="border-brand-brown/30 text-brand-brown hover:bg-brand-brown/10"
                        >
                          <ArrowRight className="h-4 w-4 mr-1" />
                          Assign
                        </Button>
                      </div>
                    ))}
                    
                    {unassignedTargets.length > 5 && (
                      <div className="text-center py-2">
                        <p className="text-sm text-brand-dark/70">
                          And {unassignedTargets.length - 5} more unassigned targets...
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Rooms;
