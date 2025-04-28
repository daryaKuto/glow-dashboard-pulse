import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '@/components/Header';
import Sidebar from '@/components/Sidebar';
import MobileDrawer from '@/components/MobileDrawer';
import { useIsMobile } from '@/hooks/use-mobile';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import PhoneVerifyModal from '@/components/PhoneVerifyModal';
import FindFriendsTab from '@/components/FindFriendsTab';
import { useAuth } from '@/providers/AuthProvider';
import { useFriends } from '@/store/useFriends';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { API } from '@/lib/api';

type LeaderboardScope = 'global' | 'friends' | 'find';
type TimeRange = 'today' | 'week' | 'alltime';

interface LeaderboardEntry {
  id: string;
  name: string;
  score: number;
  avatar: string;
}

const LeaderboardPage: React.FC = () => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [scope, setScope] = useState<LeaderboardScope>('global');
  const [timeRange, setTimeRange] = useState<TimeRange>('week');
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardEntry[]>([]);
  
  const { user, hasVerifiedPhone, setPhoneVerifyModalOpen } = useAuth();
  const { friends, loadFriends } = useFriends();
  
  useEffect(() => {
    if (user && !hasVerifiedPhone) {
      setPhoneVerifyModalOpen(true);
    }
  }, [user, hasVerifiedPhone, setPhoneVerifyModalOpen]);
  
  useEffect(() => {
    if (user) {
      loadFriends();
    }
  }, [loadFriends, user]);
  
  useEffect(() => {
    const fetchLeaderboardData = async () => {
      try {
        if (scope === 'find') return;
        
        const data = await API.getLeaderboard('dummy-token', scope === 'friends' ? 'friends' : 'global');
        setLeaderboardData(data);
      } catch (error) {
        console.error('Failed to fetch leaderboard data:', error);
      }
    };

    fetchLeaderboardData();
  }, [scope]);
  
  useEffect(() => {
    if (!user && (scope === 'friends' || scope === 'find')) {
      setScope('global');
    }
  }, [user, scope]);
  
  return (
    <div className="min-h-screen flex flex-col bg-brand-indigo">
      <Header />
      
      <div className="flex flex-1">
        {!isMobile && <Sidebar />}
        {isMobile && <MobileDrawer />}
        
        <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-y-auto">
          <div className="container mx-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-display font-bold text-white">Leaderboard</h2>
            </div>
            
            <Card className="bg-brand-surface border-brand-lavender/30">
              <CardHeader className="pb-2">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <CardTitle className="text-white">Player Rankings</CardTitle>
                  
                  {scope !== 'find' && (
                    <Select value={timeRange} onValueChange={(value) => setTimeRange(value as TimeRange)}>
                      <SelectTrigger className="w-32 bg-brand-surface-light border-brand-lavender/30 text-white">
                        <SelectValue placeholder="Time Range" />
                      </SelectTrigger>
                      <SelectContent className="bg-brand-surface border-brand-lavender/30">
                        <SelectItem value="today" className="text-white hover:bg-brand-surface-light">Today</SelectItem>
                        <SelectItem value="week" className="text-white hover:bg-brand-surface-light">This Week</SelectItem>
                        <SelectItem value="alltime" className="text-white hover:bg-brand-surface-light">All Time</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </CardHeader>
              
              <CardContent>
                <Tabs value={scope} onValueChange={(value) => setScope(value as LeaderboardScope)} className="w-full">
                  <TabsList className="bg-brand-surface-light mb-4 w-full">
                    <TabsTrigger value="global" className="flex-1 data-[state=active]:bg-brand-lavender data-[state=active]:text-white">
                      Global
                    </TabsTrigger>
                    <TabsTrigger 
                      value="friends" 
                      disabled={!user}
                      className="flex-1 data-[state=active]:bg-brand-lavender data-[state=active]:text-white"
                    >
                      Friends
                    </TabsTrigger>
                    <TabsTrigger 
                      value="find" 
                      disabled={!user}
                      className="flex-1 data-[state=active]:bg-brand-lavender data-[state=active]:text-white"
                    >
                      Find Friends
                    </TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="global" className="mt-0">
                    <LeaderboardTable data={leaderboardData} />
                  </TabsContent>
                  
                  <TabsContent value="friends" className="mt-0">
                    {friends.filter(f => f.status === 'accepted').length === 0 ? (
                      <div className="text-center py-8 text-brand-fg-secondary">
                        <p>You haven't added any friends yet.</p>
                        <button 
                          onClick={() => setScope('find')}
                          className="text-brand-lavender hover:underline mt-2"
                        >
                          Find friends to add
                        </button>
                      </div>
                    ) : (
                      <LeaderboardTable data={leaderboardData} />
                    )}
                  </TabsContent>
                  
                  <TabsContent value="find" className="mt-0">
                    <FindFriendsTab />
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
      
      {user && <PhoneVerifyModal />}
    </div>
  );
};

interface LeaderboardTableProps {
  data: LeaderboardEntry[];
}

const LeaderboardTable: React.FC<LeaderboardTableProps> = ({ data }) => {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-16 text-brand-lavender">Rank</TableHead>
          <TableHead className="text-brand-lavender">Player</TableHead>
          <TableHead className="text-right text-brand-lavender">Score</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((entry, index) => (
          <TableRow key={entry.id} className={entry.id === 'current-user' ? 'bg-brand-lavender/10' : ''}>
            <TableCell className="font-medium">{index + 1}</TableCell>
            <TableCell>
              <div className="flex items-center space-x-2">
                <img 
                  src={entry.avatar} 
                  alt={entry.name}
                  className="h-8 w-8 rounded-full object-cover"
                />
                <span className={entry.id === 'current-user' ? 'font-bold text-brand-lavender' : ''}>{entry.name}</span>
              </div>
            </TableCell>
            <TableCell className="text-right font-semibold">{entry.score}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};

export default LeaderboardPage;
