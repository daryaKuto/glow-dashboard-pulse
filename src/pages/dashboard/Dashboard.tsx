
import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Target, Users, Calendar, Bell } from 'lucide-react';
import { useStats } from '@/store/useStats';
import { connectWebSocket, MockWebSocket } from '@/lib/api';
import { toast } from '@/components/ui/sonner';
import Header from '@/components/Header';
import Sidebar from '@/components/Sidebar';
import MobileDrawer from '@/components/MobileDrawer';
import StatCard from '@/components/StatCard';
import TrendChart from '@/components/TrendChart';
import { useIsMobile } from '@/hooks/use-mobile';

const Dashboard: React.FC = () => {
  const location = useLocation();
  const isMobile = useIsMobile();
  const { 
    activeTargets, roomsCreated, lastSessionScore, pendingInvites, hitTrend,
    isLoading, fetchStats, updateHit, setWsConnected 
  } = useStats();
  const [socket, setSocket] = useState<MockWebSocket | null>(null);

  // Extract token from URL params (or use stored session token)
  const sessionToken = localStorage.getItem('authSession') 
    ? JSON.parse(localStorage.getItem('authSession')!).access_token 
    : null;
  const token = new URLSearchParams(location.search).get('token') || sessionToken || 'dummy_token';

  useEffect(() => {
    console.log("Dashboard: Fetching stats with token:", token);
    fetchStats(token);

    // Setup WebSocket connection
    const ws = connectWebSocket(token);
    setSocket(ws);

    ws.onopen = () => {
      console.log("WebSocket connected");
      setWsConnected(true);
      // toast.success('Connected to game server'); // Disabled notifications
    };

    ws.onclose = () => {
      console.log("WebSocket disconnected");
      setWsConnected(false);
      // toast.error('Disconnected from game server'); // Disabled notifications
    };

    ws.onmessage = (event) => {
      try {
        console.log("WebSocket message received:", event.data);
        const data = JSON.parse(event.data);
        if (data.type === 'hit') {
          updateHit(data.targetId.toString(), data.score);
          // toast.success(`Hit registered! Score: ${data.score}`); // Disabled hit notifications
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    return () => {
      if (socket) {
        socket.close();
      }
    };
  }, [token, fetchStats, setWsConnected, updateHit]);

  return (
    <div className="min-h-screen flex flex-col bg-brand-light">
      <Header />
      
      <div className="flex flex-1">
        {!isMobile && <Sidebar />}
        {isMobile && <MobileDrawer />}
        
        <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-y-auto">
          <div className="container mx-auto">
            <h2 className="text-3xl font-heading text-brand-dark mb-8">Game Stats</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <StatCard 
                title="Active Targets" 
                value={activeTargets} 
                icon={<Target className="w-6 h-6 text-brand-brown" />}
                isLoading={isLoading}
              />
              <StatCard 
                title="Rooms Created" 
                value={roomsCreated}
                icon={<Users className="w-6 h-6 text-brand-brown" />} 
                isLoading={isLoading}
              />
              <StatCard 
                title="Last Session Score" 
                value={lastSessionScore}
                icon={<Calendar className="w-6 h-6 text-brand-brown" />} 
                isLoading={isLoading}
              />
              <StatCard 
                title="Pending Invites" 
                value={pendingInvites}
                icon={<Bell className="w-6 h-6 text-brand-brown" />} 
                isLoading={isLoading}
              />
            </div>
            
            <div className="bg-white rounded-lg p-6 shadow-sm border border-brand-brown/20">
              <h3 className="text-xl font-heading text-brand-dark mb-4">Hit Trend</h3>
              <div className="h-64 md:h-80">
                <TrendChart data={hitTrend} isLoading={isLoading} />
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default Dashboard;
