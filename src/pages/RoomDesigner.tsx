
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useRoomDesigner } from '@/store/useRoomDesigner';
import { useRooms } from '@/store/useRooms';
import { useTargets } from '@/store/useTargets';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Save, Undo, Redo, Grid } from 'lucide-react';
import Header from '@/components/Header';
import Sidebar from '@/components/Sidebar';
import MobileDrawer from '@/components/MobileDrawer';
import { useIsMobile } from '@/hooks/use-mobile';
import RoomCanvas from '@/components/RoomCanvas';
import PalettePanel from '@/components/PalettePanel';
import InspectorPanel from '@/components/InspectorPanel';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from '@/components/ui/sonner';

const RoomDesigner: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const roomId = parseInt(id || '0');
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useIsMobile();
  
  const { setRoom, fetchLayout, toggleSnapToGrid, snapToGrid, undo, redo, saveLayout } = useRoomDesigner();
  const { rooms, fetchRooms } = useRooms();
  const { targets, fetchTargets } = useTargets();
  
  const [activeTab, setActiveTab] = useState<string>('palette');
  
  // Get token from query params
  const token = new URLSearchParams(location.search).get('token') || 'dummy_token';
  
  // Find current room
  const currentRoom = rooms.find(room => room.id === roomId);
  
  useEffect(() => {
    // Set the current room ID in the designer store
    setRoom(roomId);
    
    // Fetch room data if not loaded
    if (rooms.length === 0) {
      fetchRooms(token);
    }
    
    // Fetch targets if not loaded
    if (targets.length === 0) {
      fetchTargets(token);
    }
    
    // Fetch the room layout
    fetchLayout(token);
  }, [roomId, token]);

  // Set up keyboard shortcuts for undo/redo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'z' && e.ctrlKey && !e.shiftKey) {
        e.preventDefault();
        undo(token);
      } else if ((e.key === 'Z' && e.ctrlKey) || (e.key === 'z' && e.ctrlKey && e.shiftKey)) {
        e.preventDefault();
        redo(token);
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [token]);

  const handleSave = async () => {
    const success = await saveLayout(token);
    if (success) {
      toast.success('Room layout saved');
    }
  };

  const handleBack = () => {
    navigate('/rooms');
  };

  return (
    <div className="min-h-screen flex flex-col bg-brand-indigo">
      <Header />
      
      <div className="flex flex-1">
        {!isMobile && <Sidebar />}
        {isMobile && <MobileDrawer />}
        
        <main className="flex-1 flex flex-col overflow-hidden">
          {/* Toolbar */}
          <div className="bg-brand-surface p-3 border-b border-brand-lavender/20 flex justify-between items-center">
            <div className="flex items-center">
              <Button variant="ghost" size="sm" onClick={handleBack} className="text-brand-lavender">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <h2 className="text-xl font-display font-bold text-white ml-4">
                {currentRoom ? currentRoom.name : 'Loading...'}
              </h2>
            </div>
            
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => toggleSnapToGrid()}
                className={`${snapToGrid ? 'bg-brand-lavender/20' : ''} text-brand-lavender`}
              >
                <Grid className="h-4 w-4 mr-2" />
                Grid Snap
              </Button>
              <Button variant="outline" size="sm" onClick={() => undo(token)} className="text-brand-lavender">
                <Undo className="h-4 w-4 mr-2" />
                Undo
              </Button>
              <Button variant="outline" size="sm" onClick={() => redo(token)} className="text-brand-lavender">
                <Redo className="h-4 w-4 mr-2" />
                Redo
              </Button>
              <Button onClick={handleSave} className="bg-brand-lavender hover:bg-brand-lavender/80">
                <Save className="h-4 w-4 mr-2" />
                Save
              </Button>
            </div>
          </div>
          
          {/* Main content */}
          <div className="flex flex-1 overflow-hidden">
            {/* Canvas (75%) */}
            <div className="w-3/4 relative overflow-hidden bg-brand-indigo border-r border-brand-lavender/20">
              <RoomCanvas />
            </div>
            
            {/* Right panel (25%) */}
            <div className="w-1/4 bg-brand-surface">
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="w-full grid grid-cols-2">
                  <TabsTrigger value="palette">Palette</TabsTrigger>
                  <TabsTrigger value="inspector">Inspector</TabsTrigger>
                </TabsList>
                <TabsContent value="palette" className="mt-0 p-0">
                  <PalettePanel targets={targets} />
                </TabsContent>
                <TabsContent value="inspector" className="mt-0 p-0">
                  <InspectorPanel />
                </TabsContent>
              </Tabs>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default RoomDesigner;
