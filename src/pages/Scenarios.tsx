import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Target, AlertCircle } from 'lucide-react';
import Header from '@/components/Header';
import Sidebar from '@/components/Sidebar';
import MobileDrawer from '@/components/MobileDrawer';
import { useIsMobile } from '@/hooks/use-mobile';
import { SCENARIOS } from '@/data/scenarios';
import { useScenarioRun } from '@/store/useScenarioRun';
import { useRooms } from '@/store/useRooms';
import { toast } from '@/components/ui/sonner';

const Scenarios: React.FC = () => {
  const location = useLocation();
  const isMobile = useIsMobile();
  const { rooms } = useRooms();
  const { active, current, error, start, stop } = useScenarioRun();
  const [selectedRoomId, setSelectedRoomId] = useState<string>('');

  const token = new URLSearchParams(location.search).get('token') || 'dummy_token';

  // Auto-select first room if available
  React.useEffect(() => {
    if (rooms.length > 0 && !selectedRoomId) {
      setSelectedRoomId(rooms[0].id);
    }
  }, [rooms, selectedRoomId]);

  const handleStartScenario = async (scenarioTemplate: any) => {
    if (!selectedRoomId) {
      toast.error('Please select a room first');
      return;
    }

    try {
      await start(scenarioTemplate, selectedRoomId);
      toast.success(`Started ${scenarioTemplate.name} scenario`);
    } catch (err) {
      toast.error('Failed to start scenario');
    }
  };

  const handleStopScenario = () => {
    stop();
    toast.success('Scenario stopped');
  };

  return (
    <div className="min-h-screen flex flex-col bg-brand-light">
      <Header />
      
      <div className="flex flex-1">
        {!isMobile && <Sidebar />}
        {isMobile && <MobileDrawer />}
        
        <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-y-auto">
          <div className="container mx-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-3xl font-heading text-brand-dark">Scenario Templates</h2>
              {active && (
                <Button 
                  onClick={handleStopScenario}
                  variant="destructive"
                  className="bg-red-600 hover:bg-red-700 text-white"
                >
                  Stop Active Scenario
                </Button>
              )}
            </div>

            {/* Room Selection */}
            {rooms.length > 0 && (
              <Card className="mb-6 bg-white border-brand-brown/20 shadow-sm">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <label className="text-sm font-medium text-brand-dark">Select Room:</label>
                    <select
                      value={selectedRoomId}
                      onChange={(e) => setSelectedRoomId(e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-brown"
                    >
                      {rooms.map(room => (
                        <option key={room.id} value={room.id}>
                          {room.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Active Scenario Status */}
            {active && current && (
              <Card className="mb-6 bg-green-50 border-green-200 shadow-sm">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 text-green-800">
                    <Target className="h-5 w-5" />
                    <span className="font-semibold">Active: {current.name}</span>
                  </div>
                  <p className="text-sm text-green-700 mt-1">{current.description}</p>
                </CardContent>
              </Card>
            )}

            {/* Error Display */}
            {error && (
              <Card className="mb-6 bg-red-50 border-red-200 shadow-sm">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 text-red-800">
                    <AlertCircle className="h-5 w-5" />
                    <span className="font-semibold">Error: {error}</span>
                  </div>
                </CardContent>
              </Card>
            )}
            
            {/* Scenario Templates */}
            <Card className="mb-8 bg-white border-brand-brown/20 shadow-sm">
              <CardHeader>
                <CardTitle className="text-brand-dark flex items-center gap-2">
                  <Target className="h-5 w-5 text-brand-brown" />
                  Available Templates
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {SCENARIOS.map(template => (
                    <Card key={template.id} className="w-full bg-white border-brand-brown/20 shadow-sm hover:shadow-md transition-shadow duration-200">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-brand-brown/10 rounded-lg">
                              <Target className="h-5 w-5 text-brand-brown" />
                            </div>
                            <div>
                              <CardTitle className="text-lg font-heading text-brand-dark">
                                {template.name}
                              </CardTitle>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-sm text-brand-dark/70 font-body">
                                  {template.targetCount} targets
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </CardHeader>
                      
                      <CardContent className="space-y-4">
                        {/* Stats */}
                        <div className="grid grid-cols-2 gap-4">
                          <div className="text-center p-3 bg-brand-brown/5 rounded-lg">
                            <div className="text-2xl font-heading text-brand-dark">
                              {template.targetCount}
                            </div>
                            <div className="text-sm text-brand-dark/70 font-body">Targets</div>
                          </div>
                          <div className="text-center p-3 bg-brand-brown/5 rounded-lg">
                            <div className="text-2xl font-heading text-brand-dark">
                              {template.timeLimitMs / 1000}s
                            </div>
                            <div className="text-sm text-brand-dark/70 font-body">Time Limit</div>
                          </div>
                        </div>
                        
                        {/* Description */}
                        <div className="p-3 bg-brand-brown/5 rounded-lg">
                          <p className="text-sm text-brand-dark/80 font-body">
                            {template.description}
                          </p>
                        </div>
                        
                        {/* Action Button */}
                        <Button 
                          onClick={() => handleStartScenario(template)}
                          disabled={active || !selectedRoomId}
                          className="w-full bg-brand-brown hover:bg-brand-dark text-white font-body"
                        >
                          <Target className="h-4 w-4 mr-2" />
                          Start Scenario
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
};

export default Scenarios; 