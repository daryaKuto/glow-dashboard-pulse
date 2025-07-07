
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useSessions } from '@/store/useSessions';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Target, Clock, Trophy } from 'lucide-react';
import Header from '@/components/Header';
import Sidebar from '@/components/Sidebar';
import MobileDrawer from '@/components/MobileDrawer';
import { useIsMobile } from '@/hooks/use-mobile';
import SessionScoreboard from '@/components/SessionScoreboard';
import { toast } from '@/components/ui/sonner';

const SessionJoin: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useIsMobile();
  const { joinSession, currentSession, isLoading } = useSessions();
  const [isJoining, setIsJoining] = useState(false);

  const sessionToken = new URLSearchParams(location.search).get('token') || 'dummy_token';

  useEffect(() => {
    if (token && !currentSession) {
      handleJoinSession();
    }
  }, [token]);

  const handleJoinSession = async () => {
    if (!token) return;
    
    setIsJoining(true);
    try {
      const success = await joinSession(token, sessionToken);
      if (success) {
        // toast.success('Successfully joined session!'); // Disabled notifications
      } else {
        // toast.error('Failed to join session'); // Disabled notifications
        navigate('/dashboard/sessions');
      }
    } catch (error) {
      console.error('Error joining session:', error);
      // toast.error('Failed to join session'); // Disabled notifications
      navigate('/dashboard/sessions');
    } finally {
      setIsJoining(false);
    }
  };

  const handleLeaveSession = () => {
    navigate('/dashboard/sessions');
  };

  if (isLoading || isJoining) {
    return (
      <div className="min-h-screen flex flex-col bg-brand-light">
        <Header />
        <div className="flex flex-1">
          {!isMobile && <Sidebar />}
          {isMobile && <MobileDrawer />}
          <main className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="text-brand-dark/70 font-body">Joining session...</div>
            </div>
          </main>
        </div>
      </div>
    );
  }

  if (!currentSession) {
    return (
      <div className="min-h-screen flex flex-col bg-brand-light">
        <Header />
        <div className="flex flex-1">
          {!isMobile && <Sidebar />}
          {isMobile && <MobileDrawer />}
          <main className="flex-1 flex items-center justify-center">
            <Card className="w-full max-w-md bg-white border-brand-brown/20 shadow-lg">
              <CardHeader className="text-center">
                <CardTitle className="text-xl font-heading text-brand-dark">Session Not Found</CardTitle>
                <CardDescription className="text-brand-dark/70 font-body">
                  The session you're looking for doesn't exist or has expired.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button 
                  onClick={() => navigate('/dashboard/sessions')}
                  className="w-full bg-brand-brown hover:bg-brand-dark text-white"
                >
                  Back to Sessions
                </Button>
              </CardContent>
            </Card>
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
        
        <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-y-auto">
          <div className="container mx-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-3xl font-heading text-brand-dark">Active Session</h2>
              <Button 
                onClick={handleLeaveSession}
                variant="outline"
                className="border-brand-brown text-brand-brown hover:bg-brand-brown hover:text-white"
              >
                Leave Session
              </Button>
            </div>
            
            {/* Session Info */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <Card className="bg-white border-brand-brown/20 shadow-sm">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3">
                    <Users className="h-6 w-6 text-brand-brown" />
                    <div>
                      <div className="text-sm text-brand-dark/70 font-body">Players</div>
                      <div className="text-2xl font-heading text-brand-dark">{currentSession.players?.length || 0}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="bg-white border-brand-brown/20 shadow-sm">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3">
                    <Target className="h-6 w-6 text-brand-brown" />
                    <div>
                      <div className="text-sm text-brand-dark/70 font-body">Targets</div>
                      <div className="text-2xl font-heading text-brand-dark">{currentSession.targets?.length || 0}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="bg-white border-brand-brown/20 shadow-sm">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3">
                    <Clock className="h-6 w-6 text-brand-brown" />
                    <div>
                      <div className="text-sm text-brand-dark/70 font-body">Duration</div>
                      <div className="text-2xl font-heading text-brand-dark">15:30</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
            
            {/* Scoreboard */}
            <Card className="bg-white border-brand-brown/20 shadow-sm">
              <CardHeader>
                <CardTitle className="text-brand-dark font-heading flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-brand-brown" />
                  Live Scoreboard
                </CardTitle>
                <CardDescription className="text-brand-dark/70 font-body">
                  Real-time scores and rankings
                </CardDescription>
              </CardHeader>
              <CardContent>
                <SessionScoreboard sessionId={currentSession.id} />
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
};

export default SessionJoin;
