
import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useStats } from '@/store/useStats';
import Header from '@/components/Header';
import Sidebar from '@/components/Sidebar';
import MobileDrawer from '@/components/MobileDrawer';
import { useIsMobile } from '@/hooks/use-mobile';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Trophy, Target, Users } from 'lucide-react';

interface LeaderboardEntry {
  id: number;
  name: string;
  score: number;
  hits: number;
  accuracy: number;
  rank: number;
}

const Leaderboard: React.FC = () => {
  const location = useLocation();
  const isMobile = useIsMobile();
  const { wsConnected } = useStats();
  const [timeframe, setTimeframe] = useState('week');
  const [activeTab, setActiveTab] = useState('score');

  // Get token from localStorage
  const token = localStorage.getItem('tb_access');
  // Instead, get token from session or context (implement as needed)
  // REMOVE: useState with mock leaderboard data

  useEffect(() => {
    // Fetch leaderboard data based on timeframe
    console.log('Fetching leaderboard data for timeframe:', timeframe);
  }, [timeframe]);

  const getRankIcon = (rank: number) => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return `#${rank}`;
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
              <h2 className="text-3xl font-heading text-brand-dark">Leaderboard</h2>
              <div className="flex items-center gap-4">
                <div className={`px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-2 
                  ${wsConnected ? 'bg-green-500/20 text-green-700 border border-green-500/30' : 'bg-red-500/20 text-red-700 border border-red-500/30'}`}>
                  <span className={`w-2 h-2 rounded-full ${wsConnected ? 'bg-green-500' : 'bg-red-500'}`}></span>
                  <span>{wsConnected ? 'Live' : 'Offline'}</span>
                </div>
                <Select value={timeframe} onValueChange={setTimeframe}>
                  <SelectTrigger className="w-32 bg-white border-brand-brown/30 text-brand-dark">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white border-brand-brown/30">
                    <SelectItem value="today" className="text-brand-dark hover:bg-brand-brown/10">Today</SelectItem>
                    <SelectItem value="week" className="text-brand-dark hover:bg-brand-brown/10">This Week</SelectItem>
                    <SelectItem value="alltime" className="text-brand-dark hover:bg-brand-brown/10">All Time</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <Card className="bg-white border-brand-brown/20 shadow-sm">
              <CardHeader>
                <CardTitle className="text-brand-dark font-heading">Top Performers</CardTitle>
              </CardHeader>
              <CardContent>
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                  <TabsList className="bg-brand-brown/10 mb-4 w-full">
                    <TabsTrigger value="score" className="flex-1 text-brand-dark data-[state=active]:bg-brand-brown data-[state=active]:text-white">
                      <Trophy className="h-4 w-4 mr-2" />
                      Score
                    </TabsTrigger>
                    <TabsTrigger value="hits" className="flex-1 text-brand-dark data-[state=active]:bg-brand-brown data-[state=active]:text-white">
                      <Target className="h-4 w-4 mr-2" />
                      Hits
                    </TabsTrigger>
                    <TabsTrigger value="accuracy" className="flex-1 text-brand-dark data-[state=active]:bg-brand-brown data-[state=active]:text-white">
                      <Users className="h-4 w-4 mr-2" />
                      Accuracy
                    </TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="score" className="space-y-4">
                    {/* leaderboardData.map((entry) => ( */}
                      <div key={1} className="flex items-center justify-between p-4 bg-brand-brown/5 rounded-lg border border-brand-brown/10">
                        <div className="flex items-center gap-4">
                          <div className="text-2xl font-bold text-brand-brown">{getRankIcon(1)}</div>
                          <div>
                            <div className="font-medium text-brand-dark font-body">John Doe</div>
                            <div className="text-sm text-brand-dark/70 font-body">Score: 95</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-xl font-heading text-brand-dark">95</div>
                          <div className="text-sm text-brand-dark/70 font-body">points</div>
                        </div>
                      </div>
                    {/* ))} */}
                  </TabsContent>
                  
                  <TabsContent value="hits" className="space-y-4">
                    {/* leaderboardData.map((entry) => ( */}
                      <div key={1} className="flex items-center justify-between p-4 bg-brand-brown/5 rounded-lg border border-brand-brown/10">
                        <div className="flex items-center gap-4">
                          <div className="text-2xl font-bold text-brand-brown">{getRankIcon(1)}</div>
                          <div>
                            <div className="font-medium text-brand-dark font-body">John Doe</div>
                            <div className="text-sm text-brand-dark/70 font-body">Hits: 48</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-xl font-heading text-brand-dark">48</div>
                          <div className="text-sm text-brand-dark/70 font-body">hits</div>
                        </div>
                      </div>
                    {/* ))} */}
                  </TabsContent>
                  
                  <TabsContent value="accuracy" className="space-y-4">
                    {/* leaderboardData.map((entry) => ( */}
                      <div key={1} className="flex items-center justify-between p-4 bg-brand-brown/5 rounded-lg border border-brand-brown/10">
                        <div className="flex items-center gap-4">
                          <div className="text-2xl font-bold text-brand-brown">{getRankIcon(1)}</div>
                          <div>
                            <div className="font-medium text-brand-dark font-body">John Doe</div>
                            <div className="text-sm text-brand-dark/70 font-body">Accuracy: 96%</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-xl font-heading text-brand-dark">96%</div>
                          <div className="text-sm text-brand-dark/70 font-body">accuracy</div>
                        </div>
                      </div>
                    {/* ))} */}
                  </TabsContent>
                </Tabs>
                
                {/* leaderboardData.length === 0 && ( */}
                  <div className="text-center py-8 text-brand-dark/70 font-body">
                    No leaderboard data available
                  </div>
                {/* ) */}
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
};

export default Leaderboard;
