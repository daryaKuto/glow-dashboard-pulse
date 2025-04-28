
import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Checkbox } from '@/components/ui/checkbox';
import { CheckCircle, Circle, Plus } from 'lucide-react';
import { useSessions } from '@/store/useSessions';
import { useRooms } from '@/store/useRooms';

interface CreateSessionDialogProps {
  onStart: (scenarioId: number, roomIds: number[]) => void;
}

const CreateSessionDialog: React.FC<CreateSessionDialogProps> = ({ onStart }) => {
  const [selectedScenario, setSelectedScenario] = React.useState<number | null>(null);
  const [selectedRooms, setSelectedRooms] = React.useState<number[]>([]);
  const { scenarios, fetchScenarios } = useSessions();
  const { rooms, fetchRooms } = useRooms();
  const location = useLocation();
  const token = new URLSearchParams(location.search).get('token') || 'dummy_token';
  
  useEffect(() => {
    fetchScenarios(token);
    fetchRooms(token);
  }, [token]);
  
  const toggleRoomSelection = (roomId: number) => {
    setSelectedRooms(prev => 
      prev.includes(roomId) 
        ? prev.filter(id => id !== roomId)
        : [...prev, roomId]
    );
  };
  
  const handleStart = () => {
    if (selectedScenario !== null) {
      onStart(selectedScenario, selectedRooms);
    }
  };
  
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button className="bg-brand-lavender hover:bg-brand-lavender/80">
          <Plus className="h-4 w-4 mr-2" />
          New Session
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-brand-surface border-brand-lavender/30 text-white max-w-md">
        <DialogHeader>
          <DialogTitle className="text-white">Start New Session</DialogTitle>
          <DialogDescription className="text-brand-fg-secondary">
            Choose a scenario and select rooms to include
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-white">Select Scenario</h4>
            <div className="grid gap-2">
              {scenarios.map((scenario) => (
                <div 
                  key={scenario.id}
                  className={`flex items-center justify-between p-3 rounded-lg cursor-pointer border ${
                    selectedScenario === scenario.id 
                      ? 'border-brand-lavender bg-brand-lavender/10' 
                      : 'border-gray-700'
                  }`}
                  onClick={() => setSelectedScenario(scenario.id)}
                >
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">{scenario.name}</span>
                    <span className="text-xs text-brand-fg-secondary capitalize">{scenario.difficulty}</span>
                  </div>
                  {selectedScenario === scenario.id ? (
                    <CheckCircle size={16} className="text-brand-lavender" />
                  ) : (
                    <Circle size={16} className="text-gray-600" />
                  )}
                </div>
              ))}
            </div>
          </div>
          
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-white">Include Rooms</h4>
            <div className="space-y-2">
              {rooms.map((room) => (
                <div key={room.id} className="flex items-center space-x-2">
                  <Checkbox 
                    id={`room-${room.id}`}
                    checked={selectedRooms.includes(room.id)}
                    onCheckedChange={() => toggleRoomSelection(room.id)}
                  />
                  <label htmlFor={`room-${room.id}`} className="text-sm font-medium">
                    {room.name} ({room.targetCount} targets)
                  </label>
                </div>
              ))}
            </div>
          </div>
        </div>
        
        <div className="flex justify-end">
          <Button
            className="bg-brand-lavender hover:bg-brand-lavender/80"
            disabled={selectedScenario === null}
            onClick={handleStart}
          >
            Start Session
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CreateSessionDialog;
