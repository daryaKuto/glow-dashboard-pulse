
import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Target, useTargets } from '@/store/useTargets';
import { useRooms } from '@/store/useRooms';
import { Button } from '@/components/ui/button';
import { plus } from 'lucide-react';
import Header from '@/components/Header';
import Sidebar from '@/components/Sidebar';
import MobileDrawer from '@/components/MobileDrawer';
import { useIsMobile } from '@/hooks/use-mobile';
import TargetCard from '@/components/TargetCard';
import { toast } from '@/components/ui/sonner';

const Targets: React.FC = () => {
  const location = useLocation();
  const isMobile = useIsMobile();
  const { targets, isLoading: targetsLoading, fetchTargets, renameTarget, locateTarget, updateFirmware, deleteTarget } = useTargets();
  const { rooms, fetchRooms } = useRooms();

  // Extract token from URL params
  const token = new URLSearchParams(location.search).get('token') || 'dummy_token';

  useEffect(() => {
    fetchTargets(token);
    fetchRooms(token);
  }, [token]);

  // Group targets by room
  const groupedTargets: Record<string, Target[]> = {};
  
  // First, add a group for unassigned targets
  groupedTargets['Unassigned'] = targets.filter(t => t.roomId === null);
  
  // Then add groups for each room
  rooms.forEach(room => {
    groupedTargets[room.name] = targets.filter(t => t.roomId === room.id);
  });

  // Handler functions
  const handleRename = (id: number, name: string) => {
    renameTarget(id, name, token);
  };

  const handleLocate = (id: number) => {
    locateTarget(id, token);
  };

  const handleFirmwareUpdate = (id: number) => {
    updateFirmware(id, token);
  };

  const handleDelete = (id: number) => {
    if (window.confirm("Are you sure you want to delete this target?")) {
      deleteTarget(id, token);
    }
  };

  // Get room name by room ID
  const getRoomNameById = (roomId: number | null) => {
    if (roomId === null) return null;
    const room = rooms.find(r => r.id === roomId);
    return room?.name || null;
  };

  return (
    <div className="min-h-screen flex flex-col bg-brand-indigo">
      <Header />
      
      <div className="flex flex-1">
        {!isMobile && <Sidebar />}
        {isMobile && <MobileDrawer />}
        
        <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-y-auto">
          <div className="container mx-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-display font-bold text-white">Targets</h2>
              <Button 
                className="bg-brand-lavender hover:bg-brand-lavender/80"
                onClick={() => toast.info('Target pairing functionality coming soon!')}
              >
                <plus className="h-4 w-4 mr-2" /> Pair Target
              </Button>
            </div>
            
            {targetsLoading ? (
              <div className="text-center text-brand-fg-secondary py-8">Loading targets...</div>
            ) : targets.length === 0 ? (
              <div className="text-center py-8">
                <div className="border-2 border-brand-lavender rounded-lg p-8 mx-auto max-w-md">
                  <div className="text-brand-lavender mb-4">No targets found</div>
                  <p className="text-brand-fg-secondary mb-6">
                    Pair a target to get started with your training sessions
                  </p>
                  <Button 
                    className="bg-brand-lavender hover:bg-brand-lavender/80"
                    onClick={() => toast.info('Target pairing functionality coming soon!')}
                  >
                    <plus className="h-4 w-4 mr-2" /> Pair a Target
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-8">
                {Object.entries(groupedTargets).map(([roomName, roomTargets]) => (
                  roomTargets.length > 0 && (
                    <div key={roomName} className="space-y-4">
                      <h3 className="text-xl font-display text-white">{roomName}</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {roomTargets.map(target => (
                          <TargetCard 
                            key={target.id}
                            target={target}
                            roomName={getRoomNameById(target.roomId)}
                            onRename={handleRename}
                            onLocate={handleLocate}
                            onFirmwareUpdate={handleFirmwareUpdate}
                            onDelete={handleDelete}
                          />
                        ))}
                      </div>
                    </div>
                  )
                ))}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

export default Targets;
