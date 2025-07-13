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
import { useScenarios } from '@/store/useScenarios';
import { useRooms } from '@/store/useRooms';

interface CreateScenarioDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateScenario: (scenarioData: { scenarioId: number; roomIds: number[] }) => void;
}

const CreateScenarioDialog: React.FC<CreateScenarioDialogProps> = ({ 
  open, 
  onOpenChange, 
  onCreateScenario 
}) => {
  const [selectedScenario, setSelectedScenario] = React.useState<number | null>(null);
  const [selectedRooms, setSelectedRooms] = React.useState<number[]>([]);
  const { scenarios, fetchScenarios } = useScenarios();
  const { rooms, fetchRooms } = useRooms();
  const location = useLocation();
  // TODO: Get proper token from auth context
  const token = ''; // We need to implement proper token handling
  
  useEffect(() => {
    fetchScenarios(token);
    fetchRooms(token);
  }, [token, fetchScenarios, fetchRooms]);
  
  const toggleRoomSelection = (roomId: number) => {
    setSelectedRooms(prev => 
      prev.includes(roomId) 
        ? prev.filter(id => id !== roomId)
        : [...prev, roomId]
    );
  };
  
  const handleStart = () => {
    if (selectedScenario !== null) {
      onCreateScenario({ scenarioId: selectedScenario, roomIds: selectedRooms });
    }
  };
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-white border-brand-brown/20 max-w-md">
        <DialogHeader>
          <DialogTitle className="text-brand-dark font-heading">Start New Scenario</DialogTitle>
          <DialogDescription className="text-brand-dark/70 font-body">
            Choose a scenario and select rooms to include
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-brand-dark font-body">Select Scenario</h4>
            <div className="grid gap-2">
              {scenarios.map((scenario) => (
                <div 
                  key={scenario.id}
                  className={`flex items-center justify-between p-3 rounded-lg cursor-pointer border transition-colors ${
                    selectedScenario === scenario.id 
                      ? 'border-brand-brown bg-brand-brown/5' 
                      : 'border-brand-brown/20 hover:border-brand-brown/40'
                  }`}
                  onClick={() => setSelectedScenario(scenario.id)}
                >
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-brand-dark font-body">{scenario.name}</span>
                    <span className="text-xs text-brand-dark/70 font-body capitalize">
                      {scenario.difficulty} • {scenario.targetCount || 0} targets
                    </span>
                  </div>
                  {selectedScenario === scenario.id ? (
                    <CheckCircle size={16} className="text-brand-brown" />
                  ) : (
                    <Circle size={16} className="text-brand-brown/40" />
                  )}
                </div>
              ))}
            </div>
          </div>
          
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-brand-dark font-body">Include Rooms</h4>
            <div className="space-y-2">
              {rooms.map((room) => (
                <div key={room.id} className="flex items-center space-x-2">
                  <Checkbox 
                    id={`room-${room.id}`}
                    checked={selectedRooms.includes(room.id)}
                    onCheckedChange={() => toggleRoomSelection(room.id)}
                    className="border-brand-brown/30 data-[state=checked]:bg-brand-brown data-[state=checked]:border-brand-brown"
                  />
                  <label htmlFor={`room-${room.id}`} className="text-sm font-medium text-brand-dark font-body">
                    {room.name} ({room.targetCount} targets)
                  </label>
                </div>
              ))}
            </div>
          </div>
        </div>
        
        <div className="flex justify-end">
          <Button
            className="bg-brand-brown hover:bg-brand-dark text-white font-body"
            disabled={selectedScenario === null}
            onClick={handleStart}
          >
            Start Scenario
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CreateScenarioDialog; 