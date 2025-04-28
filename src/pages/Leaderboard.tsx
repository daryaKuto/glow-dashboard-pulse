
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
  
  // Check for user and phone verification - only show phone verification if user exists
  useEffect(() => {
    if (user && !hasVerifiedPhone) {
      setPhoneVerifyModalOpen(true);
    }
    
    // Do not redirect to login anymore
  }, [user, hasVerifiedPhone, setPhoneVerifyModalOpen]);
  
  // Load friends data when user exists
  useEffect(() => {
    if (user) {
      loadFriends();
    }
  }, [loadFriends, user]);
  
  // Generate mock leaderboard data
  useEffect(() => {
    // Mock data for global leaderboard
    if (scope === 'global') {
      const mockData = Array.from({ length: 20 }, (_, i) => ({
        id: `user-${i+1}`,
        name: `Player ${i+1}`,
        score: Math.floor(Math.random() * 1000) + 500,
        avatar: `https://i.pravatar.cc/150?u=user-${i+1}`
      }));
      
      mockData.sort((a, b) => b.score - a.score);
      setLeaderboardData(mockData);
    } 
    // Use actual friends data for friends leaderboard
    else if (scope === 'friends' && user) {
      const friendsData = friends
        .filter(friend => friend.status === 'accepted')
        .map(friend => ({
          id: friend.id,
          name: friend.name,
          score: friend.score,
          avatar: friend.avatar
        }));
      
      // Add current user
      friendsData.push({
        id: 'current-user',
        name: 'You',
        score: Math.floor(Math.random() * 1000) + 500,
        avatar: `https://i.pravatar.cc/150?u=current-user`
      });
      
      friendsData.sort((a, b) => b.score - a.score);
      setLeaderboardData(friendsData);
    }
  }, [scope, timeRange, friends, user]);
  
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
                    <TabsTrigger value="friends" className="flex-1 data-[state=active]:bg-brand-lavender data-[state=active]:text-white">
                      Friends
                    </TabsTrigger>
                    <TabsTrigger value="find" className="flex-1 data-[state=active]:bg-brand-lavender data-[state=active]:text-white">
                      Find Friends
                    </TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="global" className="mt-0">
                    <LeaderboardTable data={leaderboardData} />
                  </TabsContent>
                  
                  <TabsContent value="friends" className="mt-0">
                    {user ? (
                      friends.filter(f => f.status === 'accepted').length === 0 ? (
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
                      )
                    ) : (
                      <div className="text-center py-8 text-brand-fg-secondary">
                        <p>Please sign in to view your friends leaderboard.</p>
                        <button
                          onClick={() => navigate('/login')}
                          className="bg-brand-lavender text-white px-4 py-2 rounded mt-2 hover:bg-brand-lavender/80"
                        >
                          Sign in
                        </button>
                      </div>
                    )}
                  </TabsContent>
                  
                  <TabsContent value="find" className="mt-0">
                    {user ? (
                      <FindFriendsTab />
                    ) : (
                      <div className="text-center py-8 text-brand-fg-secondary">
                        <p>Please sign in to find friends.</p>
                        <button
                          onClick={() => navigate('/login')}
                          className="bg-brand-lavender text-white px-4 py-2 rounded mt-2 hover:bg-brand-lavender/80"
                        >
                          Sign in
                        </button>
                      </div>
                    )}
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
