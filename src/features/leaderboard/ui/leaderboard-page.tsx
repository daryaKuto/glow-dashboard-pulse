
import React, { useState } from 'react';
import { useStats } from '@/state/useStats';
import Header from '@/components/shared/Header';
import Sidebar from '@/components/shared/Sidebar';
import MobileDrawer from '@/components/shared/MobileDrawer';
import { useIsMobile } from '@/shared/hooks/use-mobile';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Trophy, Target, Users } from 'lucide-react';
import { useLeaderboardEntries } from '../hooks';
import type { LeaderboardEntry, LeaderboardQuery } from '../schema';

const Leaderboard: React.FC = () => {
  const isMobile = useIsMobile();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const { wsConnected } = useStats();
  const [timeframe, setTimeframe] = useState<LeaderboardQuery['timeframe']>('week');
  const [activeTab, setActiveTab] = useState<LeaderboardQuery['sortBy']>('score');

  const { data: leaderboardEntries = [], isLoading, error } = useLeaderboardEntries({
    timeframe,
    sortBy: activeTab,
    limit: 10,
  });

  const handleTimeframeChange = (value: string) => {
    setTimeframe(value as LeaderboardQuery['timeframe']);
  };

  const handleTabChange = (value: string) => {
    setActiveTab(value as LeaderboardQuery['sortBy']);
  };

  const getRankIcon = (rank: number) => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return `#${rank}`;
  };

  const renderEntries = (entries: LeaderboardEntry[], metric: LeaderboardQuery['sortBy']) => {
    if (isLoading) {
      return (
        <div className="text-center py-8 text-brand-dark/70 font-body">
          Loading leaderboard...
        </div>
      );
    }

    if (error) {
      return (
        <div className="text-center py-8 text-brand-dark/70 font-body">
          Unable to load leaderboard data
        </div>
      );
    }

    if (entries.length === 0) {
      return (
        <div className="text-center py-8 text-brand-dark/70 font-body">
          No leaderboard data available
        </div>
      );
    }

    return entries.map((entry) => {
      const metricValue = metric === 'score' ? entry.score : metric === 'hits' ? entry.hits : entry.accuracy;
      const metricLabel = metric === 'score' ? 'points' : metric === 'hits' ? 'hits' : 'accuracy';
      const displayValue = metric === 'accuracy' ? `${Math.round(metricValue)}%` : metricValue;
      const subLabel =
        metric === 'score'
          ? `Score: ${metricValue}`
          : metric === 'hits'
          ? `Hits: ${metricValue}`
          : `Accuracy: ${Math.round(metricValue)}%`;

      return (
        <div key={entry.id} className="flex items-center justify-between p-4 bg-brand-secondary/5 rounded-lg border border-primary/10">
          <div className="flex items-center gap-4">
            <div className="text-2xl font-bold text-brand-primary">{getRankIcon(entry.rank)}</div>
            <div>
              <div className="font-medium text-brand-dark font-body">{entry.name}</div>
              <div className="text-sm text-brand-dark/70 font-body">{subLabel}</div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-h3 font-heading text-brand-dark">{displayValue}</div>
            <div className="text-sm text-brand-dark/70 font-body">{metricLabel}</div>
          </div>
        </div>
      );
    });
  };

  return (
    <div className="min-h-screen flex flex-col bg-brand-light">
      <Header onMenuClick={() => setIsMobileMenuOpen(true)} />
      
      <div className="flex flex-1">
        {!isMobile && <Sidebar />}
        <MobileDrawer 
          isOpen={isMobileMenuOpen} 
          onClose={() => setIsMobileMenuOpen(false)} 
        />
        
        <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-y-auto">
          <div className="container mx-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-h1 font-heading text-brand-dark">Leaderboard</h2>
              <div className="flex items-center gap-4">
                <div className={`px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-2 
                  ${wsConnected ? 'bg-green-500/20 text-green-700 border border-green-500/30' : 'bg-red-500/20 text-red-700 border border-red-500/30'}`}>
                  <span className={`w-2 h-2 rounded-full ${wsConnected ? 'bg-green-500' : 'bg-red-500'}`}></span>
                  <span>{wsConnected ? 'Live' : 'Offline'}</span>
                </div>
                <Select value={timeframe} onValueChange={handleTimeframeChange}>
                  <SelectTrigger className="w-32 bg-white border-gray-200 text-brand-dark">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white border-gray-200">
                    <SelectItem value="day" className="text-brand-dark hover:bg-brand-secondary/10">Today</SelectItem>
                    <SelectItem value="week" className="text-brand-dark hover:bg-brand-secondary/10">This Week</SelectItem>
                    <SelectItem value="month" className="text-brand-dark hover:bg-brand-secondary/10">This Month</SelectItem>
                    <SelectItem value="all" className="text-brand-dark hover:bg-brand-secondary/10">All Time</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <Card className="bg-white border-gray-200 shadow-sm">
              <CardHeader>
                <CardTitle className="text-brand-dark font-heading">Top Performers</CardTitle>
              </CardHeader>
              <CardContent>
                <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
                  <TabsList className="bg-brand-secondary/10 mb-4 w-full">
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
                    {renderEntries(leaderboardEntries, 'score')}
                  </TabsContent>
                  
                  <TabsContent value="hits" className="space-y-4">
                    {renderEntries(leaderboardEntries, 'hits')}
                  </TabsContent>
                  
                  <TabsContent value="accuracy" className="space-y-4">
                    {renderEntries(leaderboardEntries, 'accuracy')}
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
};

export default Leaderboard;
