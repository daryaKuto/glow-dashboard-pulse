
import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useTargets, Target } from '@/store/useTargets';
import { useRooms } from '@/store/useRooms';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import Header from '@/components/Header';
import Sidebar from '@/components/Sidebar';
import MobileDrawer from '@/components/MobileDrawer';
import TargetCard from '@/components/TargetCard';
import { useIsMobile } from '@/hooks/use-mobile';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/sonner';

// Helper to group targets by room
const groupTargetsByRoom = (targets: Target[], roomId?: number) => {
  // If roomId is provided, filter targets by that room
  const filteredTargets = roomId 
    ? targets.filter(target => target.roomId === roomId)
    : targets;

  return filteredTargets.reduce((acc, target) => {
    const roomId = target.roomId || 0;
    if (!acc[roomId]) {
      acc[roomId] = [];
    }
    acc[roomId].push(target);
    return acc;
  }, {} as Record<number, Target[]>);
};

const Targets: React.FC = () => {
  const location = useLocation();
  const isMobile = useIsMobile();
  const { targets, isLoading, fetchTargets, renameTarget, locateTarget, updateFirmware, deleteTarget } = useTargets();
  const { rooms, isLoading: roomsLoading, fetchRooms } = useRooms();
  const [searchTerm, setSearchTerm] = useState('');

  // Extract token and optional roomId filter from URL params
  const params = new URLSearchParams(location.search);
  const token = params.get('token') || 'dummy_token';
  const roomIdParam = params.get('roomId');
  const roomId = roomIdParam ? Number(roomIdParam) : undefined;

  useEffect(() => {
    fetchTargets(token);
    fetchRooms(token);
  }, [token]);

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

  // Handle target actions
  const handleRenameTarget = (id: number, name: string) => {
    renameTarget(id, name, token);
    toast.success(`Target renamed to "${name}"`);
  };
  
  const handleLocateTarget = (id: number) => {
    locateTarget(id, token);
    toast.success('Target location signal sent');
  };
  
  const handleFirmwareUpdate = (id: number) => {
    updateFirmware(id, token);
    toast.success('Firmware update initiated');
  };
  
  const handleDeleteTarget = (id: number) => {
    if (window.confirm('Are you sure you want to delete this target?')) {
      deleteTarget(id, token);
      toast.success('Target deleted');
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-brand-indigo">
      <Header />
      
      <div className="flex flex-1">
        {!isMobile && <Sidebar />}
        {isMobile && <MobileDrawer />}
        
        <main className="flex-1 px-4 py-6 md:p-8 lg:p-10 overflow-y-auto w-full">
          <div className="max-w-7xl mx-auto">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
              <h2 className="text-2xl font-display font-bold text-white">
                {roomId ? `Targets in ${getRoomName(roomId)}` : 'All Targets'}
              </h2>
              
              <div className="flex flex-col sm:flex-row w-full sm:w-auto gap-3">
                <Input
                  placeholder="Search targets..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="bg-transparent border-brand-lavender/30 text-white w-full sm:w-[200px]"
                />
                <Button className="bg-brand-lavender hover:bg-brand-lavender/80 whitespace-nowrap">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Target
                </Button>
              </div>
            </div>
            
            {isLoading || roomsLoading ? (
              <div className="text-center text-brand-fg-secondary py-8">
                Loading targets...
              </div>
            ) : Object.keys(groupedTargets).length === 0 ? (
              <div className="text-center py-8">
                <div className="border-2 border-brand-lavender rounded-lg p-6 md:p-8 mx-auto max-w-md">
                  <div className="text-brand-lavender mb-4 text-xl">No targets found</div>
                  <p className="text-brand-fg-secondary mb-6">
                    {searchTerm 
                      ? `No targets match "${searchTerm}"`
                      : 'Pair a new target to get started'
                    }
                  </p>
                  <Button className="bg-brand-lavender hover:bg-brand-lavender/80">
                    <Plus className="h-4 w-4 mr-2" />
                    Pair a Target
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-8">
                {Object.entries(groupedTargets).map(([roomIdStr, targets]) => {
                  const roomName = getRoomName(Number(roomIdStr));
                  return (
                    <div key={roomIdStr} className="space-y-4">
                      <h3 className="text-xl font-display text-white">
                        {roomName || 'Unassigned Targets'}
                      </h3>
                      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                        {targets.map(target => (
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
