
import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useSessions, Session } from '@/store/useSessions';
import { Button } from '@/components/ui/button';
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { 
  Calendar as CalendarIcon, 
  plus,
  circle-check,
  circle
} from 'lucide-react';
import Header from '@/components/Header';
import Sidebar from '@/components/Sidebar';
import MobileDrawer from '@/components/MobileDrawer';
import { useIsMobile } from '@/hooks/use-mobile';
import { useRooms } from '@/store/useRooms';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { format } from 'date-fns';
import SessionScoreboard from '@/components/SessionScoreboard';
import InviteModal from '@/components/InviteModal';
import { useSessionWebSocket } from '@/hooks/useSessionWebSocket';

const SessionCard: React.FC<{
  session: Session;
}> = ({ session }) => {
  const formattedDate = format(new Date(session.date), 'MMM d, yyyy • h:mm a');
  
  return (
    <Card className="w-full bg-brand-surface border-brand-lavender/30 shadow-md">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-semibold text-white">
          {session.name}
        </CardTitle>
        <div className="flex items-center gap-1 text-sm text-brand-fg-secondary">
          <CalendarIcon size={14} className="text-brand-lavender" />
          <span>{formattedDate}</span>
        </div>
      </CardHeader>
      <CardContent className="pb-2">
        <div className="grid grid-cols-3 gap-2">
          <div className="text-center">
            <div className="text-sm text-brand-fg-secondary">Duration</div>
            <div className="text-lg text-white">{session.duration} min</div>
          </div>
          <div className="text-center">
            <div className="text-sm text-brand-fg-secondary">Score</div>
            <div className="text-lg text-white">{session.score}</div>
          </div>
          <div className="text-center">
            <div className="text-sm text-brand-fg-secondary">Accuracy</div>
            <div className="text-lg text-white">{session.accuracy}%</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

const CreateSessionDialog: React.FC<{
  onStart: (scenarioId: number, roomIds: number[]) => void;
}> = ({ onStart }) => {
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
          <plus className="h-4 w-4 mr-2" />
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
                    <circle-check size={16} className="text-brand-lavender" />
                  ) : (
                    <circle size={16} className="text-gray-600" />
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

const ActiveSession: React.FC<{
  session: Session;
  onEndSession: () => void;
  onCreateInvite: (sessionId: number) => Promise<string | null>;
}> = ({ session, onEndSession, onCreateInvite }) => {
  const { players } = useSessions();
  const { connected } = useSessionWebSocket(String(session.id));
  
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-display text-white">
          Active Session: {session.name}
        </h3>
        <div className="flex items-center gap-2">
          <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs ${
            connected ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400'
          }`}>
            {connected ? (
              <>
                <circle-check size={12} />
                <span>Connected</span>
              </>
            ) : (
              <>
                <circle size={12} />
                <span>Disconnected</span>
              </>
            )}
          </div>
        </div>
      </div>
      
      <div className="flex flex-wrap gap-4 justify-between">
        <div className="flex gap-2">
          <InviteModal 
            sessionId={session.id}
            onCreateInvite={onCreateInvite}
          />
          <Button 
            variant="destructive"
            onClick={onEndSession}
          >
            End Session
          </Button>
        </div>
      </div>
      
      <SessionScoreboard players={players} />
    </div>
  );
};

const Sessions: React.FC = () => {
  const location = useLocation();
  const isMobile = useIsMobile();
  const { 
    sessions, 
    currentSession,
    isLoading,
    fetchSessions,
    startSession,
    endSession,
    createInvite,
    setActiveSession
  } = useSessions();

  // Extract token from URL params
  const token = new URLSearchParams(location.search).get('token') || 'dummy_token';

  useEffect(() => {
    fetchSessions(token);
  }, [token]);
  
  const handleStartSession = async (scenarioId: number, roomIds: number[]) => {
    const session = await startSession(scenarioId, roomIds, token);
  };
  
  const handleEndSession = () => {
    if (currentSession) {
      endSession(currentSession.id, token);
    }
  };
  
  const handleCreateInvite = async (sessionId: number) => {
    return await createInvite(sessionId, token);
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
              <h2 className="text-2xl font-display font-bold text-white">
                Sessions
              </h2>
              {!currentSession && (
                <CreateSessionDialog onStart={handleStartSession} />
              )}
            </div>
            
            {currentSession ? (
              <ActiveSession 
                session={currentSession} 
                onEndSession={handleEndSession}
                onCreateInvite={handleCreateInvite}
              />
            ) : (
              <>
                {isLoading ? (
                  <div className="text-center text-brand-fg-secondary py-8">
                    Loading sessions...
                  </div>
                ) : sessions.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="border-2 border-brand-lavender rounded-lg p-8 mx-auto max-w-md">
                      <div className="text-brand-lavender mb-4">No sessions yet</div>
                      <p className="text-brand-fg-secondary mb-6">
                        Create your first training session to get started
                      </p>
                      <CreateSessionDialog onStart={handleStartSession} />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <h3 className="text-xl font-display text-white">Session History</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {sessions.map((session) => (
                        <SessionCard key={session.id} session={session} />
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

export default Sessions;
