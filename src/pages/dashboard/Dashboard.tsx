
import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Target, Users, Calendar, Bell, Clock, Zap, Trophy } from 'lucide-react';
import { useStats } from '@/store/useStats';
import { useDashboardStats } from '@/store/useDashboardStats';
import API, { MockWebSocket } from '@/lib/api';
import { toast } from '@/components/ui/sonner';
import Header from '@/components/Header';
import Sidebar from '@/components/Sidebar';
import MobileDrawer from '@/components/MobileDrawer';
import StatCard from '@/components/StatCard';
import TrendChart from '@/components/TrendChart';
import { useIsMobile } from '@/hooks/use-mobile';
import dayjs from 'dayjs';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts';

const StatTile = ({ label, value, icon }: { label: string; value: string | number; icon: React.ReactNode }) => (
  <div className="bg-white p-4 rounded-lg shadow-sm border border-brand-brown/20 flex flex-col items-center">
    <div className="text-brand-brown mb-2">{icon}</div>
    <span className="text-sm text-brand-dark/70 font-body">{label}</span>
    <span className="text-xl font-heading font-semibold text-brand-dark">{value}</span>
  </div>
);

const Dashboard: React.FC = () => {
  const location = useLocation();
  const isMobile = useIsMobile();
  const { 
    activeTargets, roomsCreated, lastSessionScore, pendingInvites, hitTrend,
    isLoading, fetchStats, updateHit, setWsConnected 
  } = useStats();
  const [socket, setSocket] = useState<MockWebSocket | null>(null);
  const [range, setRange] = useState<'latest' | 'week' | 'month' | 'all'>('latest');
  const { slices, refresh } = useDashboardStats();

  // Extract token from URL params (or use stored session token)
  const sessionToken = localStorage.getItem('authSession') 
    ? JSON.parse(localStorage.getItem('authSession')!).access_token 
    : null;
  const token = new URLSearchParams(location.search).get('token') || sessionToken || 'dummy_token';

  useEffect(() => {
    console.log("Dashboard: Fetching stats with token:", token);
    fetchStats(token);
    refresh(); // Load metrics data

    // Setup WebSocket connection
    const ws = API.connectWebSocket(token);
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
  }, [token, fetchStats, setWsConnected, updateHit, refresh]);

  const slice = slices[range];

  return (
    <div className="min-h-screen flex flex-col bg-brand-light">
      <Header />
      
      <div className="flex flex-1">
        {!isMobile && <Sidebar />}
        {isMobile && <MobileDrawer />}
        
        <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-y-auto">
          <div className="container mx-auto">
            <h2 className="text-3xl font-heading text-brand-dark mb-8">Game Stats</h2>
            
            {/* Original Stats Cards */}
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

            {/* Reaction Time Metrics Section */}
            <div className="bg-white rounded-lg p-6 shadow-sm border border-brand-brown/20 mb-8">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
                <h3 className="text-xl font-heading text-brand-dark">Reaction Time Metrics</h3>
                
                {/* Range selector */}
                <div className="flex gap-2 mt-4 sm:mt-0">
                  {(['latest', 'week', 'month', 'all'] as const).map((opt) => (
                    <button
                      key={opt}
                      onClick={() => setRange(opt)}
                      className={`px-3 py-1 rounded-md text-sm transition-colors font-body ${
                        range === opt 
                          ? 'bg-brand-brown text-white' 
                          : 'bg-brand-brown/10 text-brand-dark hover:bg-brand-brown/20'
                      }`}
                    >
                      {opt === 'latest' ? 'Last Scenario'
                       : opt === 'week' ? 'Past Week'
                       : opt === 'month' ? 'Past Month'
                       : 'All-time'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Reaction Time Stats Tiles */}
              {slice.loading ? (
                <div className="text-center py-8">
                  <div className="text-brand-dark/70 font-body">Loading metrics...</div>
                </div>
              ) : slice.data ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                  <StatTile 
                    label="Avg RT" 
                    value={`${slice.data.avgRT} ms`} 
                    icon={<Clock className="h-5 w-5" />}
                  />
                  <StatTile 
                    label="Fastest RT" 
                    value={`${slice.data.bestRT} ms`} 
                    icon={<Zap className="h-5 w-5" />}
                  />
                  <StatTile 
                    label="Total Hits" 
                    value={slice.data.hitCount} 
                    icon={<Target className="h-5 w-5" />}
                  />
                  <StatTile 
                    label="Scenarios" 
                    value={range === 'latest' ? 1 : '—'} 
                    icon={<Trophy className="h-5 w-5" />}
                  />
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="text-brand-dark/70 font-body">No reaction time data available</div>
                </div>
              )}

              {/* Reaction-time chart */}
              {slice.series?.length ? (
                <div className="h-64 md:h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={slice.series}>
                      <XAxis
                        dataKey="ts"
                        tickFormatter={(t) =>
                          dayjs(t).format(
                            range === 'week'
                              ? 'DD MMM'
                              : range === 'month'
                              ? 'DD MMM'
                              : 'MMM YY'
                          )}
                        tick={{ fontSize: 12, fill: '#6B7280' }}
                      />
                      <YAxis 
                        tickFormatter={(v) => `${v} ms`} 
                        tick={{ fontSize: 12, fill: '#6B7280' }}
                      />
                      <Tooltip
                        labelFormatter={(t) => dayjs(t).format('DD MMM HH:mm')}
                        formatter={(v) => [`${v} ms`, 'Reaction Time']}
                        contentStyle={{
                          backgroundColor: 'white',
                          border: '1px solid #E5E7EB',
                          borderRadius: '8px',
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="rt"
                        stroke="#b99156"
                        fill="#dec9ae"
                        fillOpacity={0.3}
                        strokeWidth={2}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="text-brand-dark/70 font-body">No chart data available</div>
                </div>
              )}
            </div>
            
            {/* Original Hit Trend Chart */}
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
