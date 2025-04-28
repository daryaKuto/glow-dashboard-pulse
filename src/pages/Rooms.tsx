import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useRooms } from '@/store/useRooms';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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

  const token = new URLSearchParams(location.search).get('token') || 'dummy_token';

  useEffect(() => {
    fetchRooms(token);
  }, [token]);

  const handleCreateRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoomName.trim()) return;
    
    createRoom(newRoomName, token);
    setNewRoomName('');
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
    <div className="min-h-screen flex flex-col bg-brand-indigo">
      <Header />
      
      <div className="flex flex-1">
        {!isMobile && <Sidebar />}
        {isMobile && <MobileDrawer />}
        
        <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-y-auto">
          <div className="container mx-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-display font-bold text-white">Rooms</h2>
            </div>
            
            <form onSubmit={handleCreateRoom} className="mb-6 flex gap-2">
              <Input
                placeholder="Room name"
                value={newRoomName}
                onChange={(e) => setNewRoomName(e.target.value)}
                className="bg-transparent border-brand-lavender/30 text-white"
              />
              <Button 
                type="submit"
                className="bg-brand-lavender hover:bg-brand-lavender/80 whitespace-nowrap"
                disabled={!newRoomName.trim()}
              >
                <Plus className="h-4 w-4 mr-2" /> Add Room
              </Button>
            </form>
            
            {isLoading ? (
              <div className="text-center text-brand-fg-secondary py-8">Loading rooms...</div>
            ) : rooms.length === 0 ? (
              <div className="text-center py-8">
                <div className="border-2 border-brand-lavender rounded-lg p-8 mx-auto max-w-md">
                  <div className="text-brand-lavender mb-4">No rooms found</div>
                  <p className="text-brand-fg-secondary mb-6">
                    Create a room to start organizing your targets
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-4 pl-8">
                <p className="text-sm text-brand-fg-secondary">
                  Drag to reorder rooms. Changes are saved automatically.
                </p>
                <DragDropList 
                  items={sortedRooms}
                  onReorder={handleReorder}
                  activationConstraint={{ delay: 100, tolerance: 5 }}
                  renderItem={(room, isDragging) => (
                    <RoomCard
                      room={room}
                      isDragging={isDragging}
                      onRename={handleRename}
                      onDelete={handleDelete}
                    />
                  )}
                />
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

export default Rooms;
