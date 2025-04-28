
import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useSessions } from '@/store/useSessions';
import Header from '@/components/Header';
import Sidebar from '@/components/Sidebar';
import MobileDrawer from '@/components/MobileDrawer';
import { useIsMobile } from '@/hooks/use-mobile';
import { useSessionWebSocket } from '@/hooks/useSessionWebSocket';
import CreateSessionDialog from '@/components/sessions/CreateSessionDialog';
import SessionCard from '@/components/sessions/SessionCard';
import ActiveSession from '@/components/sessions/ActiveSession';

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
    createInvite
  } = useSessions();

  const token = new URLSearchParams(location.search).get('token') || 'dummy_token';
  const { connected } = useSessionWebSocket(currentSession?.id.toString() || null);

  useEffect(() => {
    fetchSessions(token);
  }, [token]);
  
  const handleStartSession = async (scenarioId: number, roomIds: number[]) => {
    await startSession(scenarioId, roomIds, token);
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
                connected={connected}
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
