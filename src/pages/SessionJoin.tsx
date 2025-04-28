
import React, { useEffect } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import Header from '@/components/Header';
import Sidebar from '@/components/Sidebar';
import MobileDrawer from '@/components/MobileDrawer';
import { useIsMobile } from '@/hooks/use-mobile';
import { useSessionWebSocket } from '@/hooks/useSessionWebSocket';
import { useSessions } from '@/store/useSessions';
import { Button } from '@/components/ui/button';
import SessionScoreboard from '@/components/SessionScoreboard';
import { toast } from '@/components/ui/sonner';

const SessionJoin: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  
  // Extract auth token from URL params
  const authToken = new URLSearchParams(location.search).get('token') || 'dummy_token';
  
  const { 
    setActiveSession, 
    players, 
    clearSession 
  } = useSessions();
  
  const { connected } = useSessionWebSocket(token || null);
  
  // Set up mock session on first render
  useEffect(() => {
    if (token) {
      // In a real app, we would validate the token with the server
      // For now, we'll create a mock session based on the token
      const mockSession = {
        id: parseInt(token.substring(0, 3), 16) || 1,
        name: "Invited Session",
        date: new Date().toISOString(),
        duration: 0,
        score: 0,
        accuracy: 0
      };
      
      setActiveSession(mockSession);
      toast.success("Joined session successfully!");
    }
    
    return () => {
      clearSession();
    };
  }, [token, setActiveSession, clearSession]);
  
  const handleLeave = () => {
    clearSession();
    navigate('/dashboard/sessions');  // Updated to include /dashboard prefix
  };
  
  if (!token) {
    return <div>Invalid session invite</div>;
  }
  
  return (
    <div className="min-h-screen flex flex-col bg-brand-indigo">
      <Header />
      
      <div className="flex flex-1">
        {!isMobile && <Sidebar />}
        {isMobile && <MobileDrawer />}
        
        <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-y-auto">
          <div className="container mx-auto">
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-display font-bold text-white">
                  Joined Session
                </h2>
                <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs ${
                  connected ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400'
                }`}>
                  {connected ? (
                    <>
                      <circle className="h-2 w-2 fill-current" />
                      <span>Connected</span>
                    </>
                  ) : (
                    <>
                      <circle className="h-2 w-2 fill-current" />
                      <span>Connecting...</span>
                    </>
                  )}
                </div>
              </div>
              
              <Button 
                variant="outline"
                className="border-brand-lavender/30 text-brand-lavender hover:bg-brand-lavender/10"
                onClick={handleLeave}
              >
                Leave Session
              </Button>
              
              <SessionScoreboard players={players} />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default SessionJoin;
