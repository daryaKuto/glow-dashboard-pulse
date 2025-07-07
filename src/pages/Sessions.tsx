
import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useSessions } from '@/store/useSessions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Play, Users, Calendar, Target } from 'lucide-react';
import Header from '@/components/Header';
import Sidebar from '@/components/Sidebar';
import MobileDrawer from '@/components/MobileDrawer';
import { useIsMobile } from '@/hooks/use-mobile';
import SessionCard from '@/components/sessions/SessionCard';
import CreateSessionDialog from '@/components/sessions/CreateSessionDialog';
import { toast } from '@/components/ui/sonner';

const Sessions: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { 
    sessions, 
    isLoading, 
    fetchSessions, 
    createSession, 
    deleteSession,
    joinSession
  } = useSessions();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [joinToken, setJoinToken] = useState('');

  const token = new URLSearchParams(location.search).get('token') || 'dummy_token';

  useEffect(() => {
    fetchSessions(token);
  }, [token]);

  const handleCreateSession = async (sessionData: { name: string; roomId: number; maxPlayers: number }) => {
    const success = await createSession(sessionData, token);
    if (success) {
      setIsCreateDialogOpen(false);
      // toast.success('Session created successfully'); // Disabled notifications
    }
  };

  const handleJoinSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinToken.trim()) return;
    
    const success = await joinSession(joinToken, token);
    if (success) {
      setJoinToken('');
      // toast.success('Joined session successfully'); // Disabled notifications
      navigate(`/dashboard/sessions/join/${joinToken}`);
    }
  };

  const handleDeleteSession = async (sessionId: number) => {
    if (window.confirm('Are you sure you want to delete this session?')) {
          const success = await deleteSession(sessionId, token);
    if (success) {
      // toast.success('Session deleted successfully'); // Disabled notifications
    }
    }
  };

  const activeSessions = sessions.filter(session => session.status === 'active');
  const completedSessions = sessions.filter(session => session.status === 'completed');

  return (
    <div className="min-h-screen flex flex-col bg-brand-light">
      <Header />
      
      <div className="flex flex-1">
        {!isMobile && <Sidebar />}
        {isMobile && <MobileDrawer />}
        
        <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-y-auto">
          <div className="container mx-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-3xl font-heading text-brand-dark">Sessions</h2>
              <Button 
                onClick={() => setIsCreateDialogOpen(true)}
                className="bg-brand-brown hover:bg-brand-dark text-white"
              >
                <Plus className="h-4 w-4 mr-2" />
                Create Session
              </Button>
            </div>
            
            {/* Join Session Form */}
            <Card className="mb-8 bg-white border-brand-brown/20 shadow-sm">
              <CardHeader>
                <CardTitle className="text-brand-dark flex items-center gap-2">
                  <Play className="h-5 w-5 text-brand-brown" />
                  Join Session
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleJoinSession} className="flex gap-2">
                  <Input
                    placeholder="Enter session token"
                    value={joinToken}
                    onChange={(e) => setJoinToken(e.target.value)}
                    className="bg-white border-brand-brown/30 text-brand-dark"
                  />
                  <Button 
                    type="submit"
                    disabled={!joinToken.trim()}
                    className="bg-brand-brown hover:bg-brand-dark text-white"
                  >
                    Join
                  </Button>
                </form>
              </CardContent>
            </Card>
            
            {isLoading ? (
              <div className="text-center py-8 text-brand-dark/70 font-body">Loading sessions...</div>
            ) : (
              <div className="space-y-8">
                {/* Active Sessions */}
                <div>
                  <h3 className="text-xl font-heading text-brand-dark mb-4 flex items-center gap-2">
                    <Play className="h-5 w-5 text-brand-brown" />
                    Active Sessions ({activeSessions.length})
                  </h3>
                  {activeSessions.length === 0 ? (
                    <div className="text-center py-8 text-brand-dark/70 font-body">No active sessions</div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {activeSessions.map(session => (
                        <SessionCard
                          key={session.id}
                          session={session}
                          onDelete={handleDeleteSession}
                        />
                      ))}
                    </div>
                  )}
                </div>
                
                {/* Completed Sessions */}
                <div>
                  <h3 className="text-xl font-heading text-brand-dark mb-4 flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-brand-brown" />
                    Completed Sessions ({completedSessions.length})
                  </h3>
                  {completedSessions.length === 0 ? (
                    <div className="text-center py-8 text-brand-dark/70 font-body">No completed sessions</div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {completedSessions.map(session => (
                        <SessionCard
                          key={session.id}
                          session={session}
                          onDelete={handleDeleteSession}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
      
      <CreateSessionDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        onCreateSession={handleCreateSession}
      />
    </div>
  );
};

export default Sessions;
