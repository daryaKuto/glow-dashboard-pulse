import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useRooms } from '@/store/useRooms';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus } from 'lucide-react';
import Header from '@/components/Header';
import Sidebar from '@/components/Sidebar';
import MobileDrawer from '@/components/MobileDrawer';
import { useIsMobile } from '@/hooks/use-mobile';
import RoomCard from '@/components/RoomCard';
import DragDropList from '@/components/DragDropList';

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
    updateRoomOrder
  } = useRooms();
  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomIcon, setNewRoomIcon] = useState('home');

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

  const token = new URLSearchParams(location.search).get('token') || 'dummy_token';

  useEffect(() => {
    fetchRooms(token);
  }, [token]);

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

  const sortedRooms = [...rooms].sort((a, b) => a.order - b.order);

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
                  <Button className="bg-brand-brown hover:bg-brand-dark text-white">
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
                  />
                )}
              />
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

export default Rooms;
