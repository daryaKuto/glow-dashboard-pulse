import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useRoomDesigner } from '@/store/useRoomDesigner';
import Header from '@/components/Header';
import Sidebar from '@/components/Sidebar';
import MobileDrawer from '@/components/MobileDrawer';
import { useIsMobile } from '@/hooks/use-mobile';
import RoomCanvas from '@/components/RoomCanvas';
import InspectorPanel from '@/components/InspectorPanel';
import PalettePanel from '@/components/PalettePanel';
import { Button } from '@/components/ui/button';
import { Save, ArrowLeft, RotateCcw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from '@/components/ui/sonner';

const RoomDesigner: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { 
    room, 
    targets, 
    selectedTarget, 
    setSelectedTarget, 
    addTarget, 
    updateTarget, 
    deleteTarget, 
    saveRoom,
    resetRoom,
    isLoading 
  } = useRoomDesigner();

  // TODO: Get proper token from auth context
  const token = ''; // We need to implement proper token handling

  const handleSave = async () => {
    try {
      await saveRoom(token);
      toast.success('Room saved successfully!');
    } catch (error) {
      console.error('Error saving room:', error);
      toast.error('Failed to save room');
    }
  };

  const handleReset = () => {
    resetRoom();
    toast.success('Room reset to default');
  };

  const handleBack = () => {
    navigate('/dashboard/rooms');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col bg-brand-light">
        <Header />
        <div className="flex flex-1">
          {!isMobile && <Sidebar />}
          {isMobile && <MobileDrawer />}
          <main className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="text-brand-dark/70 font-body">Loading room designer...</div>
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-brand-light">
      <Header />
      
      <div className="flex flex-1">
        {!isMobile && <Sidebar />}
        {isMobile && <MobileDrawer />}
        
        <div className="flex-1 flex flex-col">
          {/* Toolbar */}
          <div className="bg-white p-3 border-b border-brand-brown/20 flex justify-between items-center">
            <div className="flex items-center gap-4">
              <Button 
                onClick={handleBack}
                variant="ghost" 
                size="sm"
                className="text-brand-brown hover:text-brand-dark"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <h2 className="text-xl font-heading font-bold text-brand-dark ml-4">
                {room?.name || 'Room Designer'}
              </h2>
            </div>
            
            <div className="flex items-center gap-2">
              <Button 
                onClick={handleReset}
                variant="outline" 
                size="sm"
                className="border-brand-brown text-brand-brown hover:bg-brand-brown hover:text-white"
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Reset
              </Button>
              <Button 
                onClick={handleSave}
                size="sm"
                className="bg-brand-brown hover:bg-brand-dark text-white"
              >
                <Save className="h-4 w-4 mr-2" />
                Save
              </Button>
            </div>
          </div>
          
          {/* Main Content */}
          <div className="flex flex-1 overflow-hidden">
            {/* Canvas Area */}
            <div className="w-3/4 relative overflow-hidden bg-white border-r border-brand-brown/20">
              <RoomCanvas 
                room={room}
                targets={targets}
                selectedTarget={selectedTarget}
                onTargetSelect={setSelectedTarget}
                onTargetAdd={addTarget}
                onTargetUpdate={updateTarget}
                onTargetDelete={deleteTarget}
              />
            </div>
            
            {/* Sidebar */}
            <div className="w-1/4 bg-white">
              {selectedTarget ? (
                <InspectorPanel 
                  target={selectedTarget}
                  onUpdate={updateTarget}
                  onDelete={deleteTarget}
                />
              ) : (
                <PalettePanel onAddTarget={addTarget} />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RoomDesigner;
