
import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useTargets } from '@/store/useTargets';
import { useRooms } from '@/store/useRooms';
import { toast } from '@/components/ui/sonner';
import Header from '@/components/Header';
import Sidebar from '@/components/Sidebar';
import MobileDrawer from '@/components/MobileDrawer';
import { useIsMobile } from '@/hooks/use-mobile';
import TargetCard from '@/components/TargetCard';
import SearchInput from '@/components/SearchInput';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Plus,
  RefreshCw,
  Sofa,
  Utensils,
  ChefHat,
  Bed,
  Briefcase,
  Home,
  Building,
  Car,
  TreePine,
  Gamepad2,
  Dumbbell,
  Music,
  BookOpen
} from 'lucide-react';
import API from '@/lib/api';

// Group targets by room for better organization
const groupTargetsByRoom = (targets: any[], roomId?: number) => {
  if (roomId) {
    return { [roomId]: targets.filter(target => target.roomId === roomId) };
  }
  
  const grouped: { [key: number]: any[] } = {};
  targets.forEach(target => {
    const roomId = target.roomId || 0;
    if (!grouped[roomId]) {
      grouped[roomId] = [];
    }
    grouped[roomId].push(target);
  });
  
  return grouped;
};

const Targets: React.FC = () => {
  const location = useLocation();
  const isMobile = useIsMobile();
  const { targets, isLoading, refresh, clearCache } = useTargets();
  const { rooms, isLoading: roomsLoading, fetchRooms } = useRooms();
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newTargetName, setNewTargetName] = useState('');
  const [newTargetRoomId, setNewTargetRoomId] = useState<string>('');

  // Extract token and optional roomId filter from URL params
  const params = new URLSearchParams(location.search);
  // TODO: Get proper token from auth context
  const token = ''; // We need to implement proper token handling
  const roomIdParam = params.get('roomId');
  const roomId = roomIdParam ? Number(roomIdParam) : undefined;

  useEffect(() => {
    refresh();
    fetchRooms(token);
  }, [refresh, token, fetchRooms]);

  // Handle refresh with cache clearing
  const handleRefresh = async () => {
    clearCache();
    await refresh();
    toast.success('Targets refreshed from ThingsBoard');
  };

  // Filter targets by search term
  const filteredTargets = targets.filter(target => 
    target.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const groupedTargets = groupTargetsByRoom(filteredTargets, roomId);
  
  // Get room names for display
  const getRoomName = (roomId?: number) => {
    if (!roomId) return null;
    const room = rooms.find(room => room.id === roomId);
    return room ? room.name : 'Unknown Room';
  };

  // Get room object for display
  const getRoom = (roomId?: number) => {
    if (!roomId) return null;
    return rooms.find(room => room.id === roomId);
  };

  // Get icon component based on icon name
  const getRoomIcon = (iconName?: string) => {
    switch (iconName) {
      case 'sofa': return <Sofa className="h-5 w-5" />;
      case 'utensils': return <Utensils className="h-5 w-5" />;
      case 'chef-hat': return <ChefHat className="h-5 w-5" />;
      case 'bed': return <Bed className="h-5 w-5" />;
      case 'briefcase': return <Briefcase className="h-5 w-5" />;
      case 'home': return <Home className="h-5 w-5" />;
      case 'building': return <Building className="h-5 w-5" />;
      case 'car': return <Car className="h-5 w-5" />;
      case 'tree-pine': return <TreePine className="h-5 w-5" />;
      case 'gamepad2': return <Gamepad2 className="h-5 w-5" />;
      case 'dumbbell': return <Dumbbell className="h-5 w-5" />;
      case 'music': return <Music className="h-5 w-5" />;
      case 'book-open': return <BookOpen className="h-5 w-5" />;
      case 'basement': return <Building className="h-5 w-5" />;
      default: return <Home className="h-5 w-5" />;
    }
  };

  // Handle target actions
  const handleCreateTarget = async () => {
    if (!newTargetName.trim()) {
      toast.error('Target name is required');
      return;
    }
    
    // TODO: Implement with ThingsBoard API
    toast.error('Create target not implemented with ThingsBoard yet');
    
    // Reset form and close dialog
    setNewTargetName('');
    setNewTargetRoomId('');
    setIsAddDialogOpen(false);
  };
  
  const handleRenameTarget = async (id: string, name: string) => {
    try {
      // Convert string ID to number for the API
      const numericId = parseInt(id, 10);
      
      // Call the API to rename the target
      await API.renameTarget(numericId, name);
      
      // Refresh the targets to show the updated name
      await refresh();
      
      toast.success(`Target renamed to "${name}"`);
    } catch (error) {
      console.error('Error renaming target:', error);
      toast.error(`Failed to rename target: ${error.message}`);
    }
  };
  
  const handleLocateTarget = (id: string) => {
    // TODO: Implement with ThingsBoard API
    toast.error('Locate target not implemented with ThingsBoard yet');
  };
  
  const handleFirmwareUpdate = (id: string) => {
    // TODO: Implement with ThingsBoard API
    toast.error('Firmware update not implemented with ThingsBoard yet');
  };
  
  const handleDeleteTarget = (id: string) => {
    if (window.confirm('Are you sure you want to delete this target?')) {
      // TODO: Implement with ThingsBoard API
      toast.error('Delete target not implemented with ThingsBoard yet');
    }
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
              <h2 className="text-3xl font-heading text-brand-dark">Targets</h2>
              <div className="flex gap-2">
                <Button onClick={handleRefresh} variant="outline" className="border-brand-brown/30 text-brand-dark hover:bg-brand-brown hover:text-white transition-colors">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh
                </Button>
                <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                  <DialogTrigger asChild>
                    <Button className="bg-brand-brown hover:bg-brand-dark text-white">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Target
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                      <DialogTitle>Add New Target</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div className="grid gap-2">
                        <Label htmlFor="target-name">Target Name</Label>
                        <Input
                          id="target-name"
                          value={newTargetName}
                          onChange={(e) => setNewTargetName(e.target.value)}
                          placeholder="Enter target name"
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="target-room">Room (Optional)</Label>
                        <Select value={newTargetRoomId} onValueChange={setNewTargetRoomId}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a room" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">No Room</SelectItem>
                            {rooms.map(room => (
                              <SelectItem key={room.id} value={room.id.toString()}>
                                <div className="flex items-center gap-2">
                                  <div className="p-1 bg-brand-brown/10 rounded">
                                    {getRoomIcon(room.icon)}
                                  </div>
                                  <span>{room.name}</span>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={() => setIsAddDialogOpen(false)} className="border-brand-brown/30 text-brand-dark hover:bg-brand-brown hover:text-white transition-colors">
                        Cancel
                      </Button>
                      <Button onClick={handleCreateTarget} className="bg-brand-brown hover:bg-brand-dark">
                        Create Target
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
            
            <div className="flex flex-col md:flex-row gap-4 mb-6">
              <SearchInput
                placeholder="Search targets..."
                value={searchTerm}
                onChange={setSearchTerm}
                className="flex-1"
              />
              <Select value={roomId?.toString() || 'all'} onValueChange={(value) => {
                if (value === 'all') {
                  window.history.replaceState({}, '', window.location.pathname);
                } else {
                  window.history.replaceState({}, '', `${window.location.pathname}?roomId=${value}`);
                }
              }}>
                <SelectTrigger className="w-full md:w-48">
                  <SelectValue placeholder="Filter by room" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Rooms</SelectItem>
                  {rooms.map(room => (
                    <SelectItem key={room.id} value={room.id.toString()}>
                      <div className="flex items-center gap-2">
                        <div className="p-1 bg-brand-brown/10 rounded">
                          {getRoomIcon(room.icon)}
                        </div>
                        <span>{room.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {isLoading ? (
              <div className="text-center py-8 text-brand-dark/70 font-body">Loading targets...</div>
            ) : Object.keys(groupedTargets).length === 0 ? (
              <div className="text-center py-8 text-brand-dark/70 font-body">No targets found</div>
            ) : (
              <div className="space-y-6">
                {Object.entries(groupedTargets).map(([roomId, roomTargets]) => {
                  const room = getRoom(Number(roomId));
                  return (
                    <div key={roomId} className="bg-white rounded-lg p-6 shadow-sm border border-brand-brown/20">
                      {roomId !== '0' && room && (
                        <h3 className="text-xl font-heading text-brand-dark mb-4 flex items-center gap-2">
                          <div className="p-1 bg-brand-brown/10 rounded">
                            {getRoomIcon(room.icon)}
                          </div>
                          {room.name}
                        </h3>
                      )}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {roomTargets.map(target => (
                        <TargetCard
                          key={target.id}
                          target={target}
                          roomName={getRoomName(target.roomId)}
                          onRename={handleRenameTarget}
                          onLocate={handleLocateTarget}
                          onFirmwareUpdate={handleFirmwareUpdate}
                          onDelete={handleDeleteTarget}
                        />
                      ))}
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
