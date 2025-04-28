
import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { edit } from 'lucide-react';
import Header from '@/components/Header';
import Sidebar from '@/components/Sidebar';
import MobileDrawer from '@/components/MobileDrawer';
import { useIsMobile } from '@/hooks/use-mobile';
import { useSessions, Session } from '@/store/useSessions';
import { format } from 'date-fns';

const Profile: React.FC = () => {
  const location = useLocation();
  const isMobile = useIsMobile();
  const { sessions, fetchSessions } = useSessions();
  const [userData, setUserData] = useState<{ 
    id: string;
    email: string;
    name: string;
    avatarUrl: string | null;
    totalHits: number;
    bestScore: number;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Extract token from URL params
  const token = new URLSearchParams(location.search).get('token') || 'dummy_token';

  useEffect(() => {
    async function fetchUserData() {
      setIsLoading(true);
      try {
        // Get user data from Supabase
        const { data: { user } } = await supabase.auth.getUser();
        
        if (user) {
          // In a real app, we would fetch user stats from the API
          // For now, we'll use mock data
          setUserData({
            id: user.id,
            email: user.email || '',
            name: user.user_metadata?.name || 'User',
            avatarUrl: user.user_metadata?.avatar_url || null,
            totalHits: 847,
            bestScore: 96
          });
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
      } finally {
        setIsLoading(false);
      }
    }
    
    fetchUserData();
    fetchSessions(token);
  }, [token]);

  // Get the 5 most recent sessions
  const recentSessions = [...sessions].sort((a, b) => 
    new Date(b.date).getTime() - new Date(a.date).getTime()
  ).slice(0, 5);

  return (
    <div className="min-h-screen flex flex-col bg-brand-indigo">
      <Header />
      
      <div className="flex flex-1">
        {!isMobile && <Sidebar />}
        {isMobile && <MobileDrawer />}
        
        <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-y-auto">
          <div className="container mx-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-display font-bold text-white">My Profile</h2>
              <Button 
                variant="outline" 
                className="text-brand-lavender border-brand-lavender/30 hover:bg-brand-lavender/10"
              >
                <edit className="h-4 w-4 mr-2" />
                Edit Profile
              </Button>
            </div>
            
            {isLoading ? (
              <div className="text-center text-brand-fg-secondary py-8">Loading profile...</div>
            ) : userData ? (
              <div className="space-y-6">
                <Card className="bg-brand-surface border-brand-lavender/30">
                  <CardContent className="pt-6">
                    <div className="flex flex-col md:flex-row items-center gap-6">
                      <Avatar className="h-24 w-24">
                        <AvatarImage src={userData.avatarUrl || undefined} />
                        <AvatarFallback className="bg-brand-lavender text-xl">
                          {userData.name.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      
                      <div className="space-y-2 text-center md:text-left">
                        <h3 className="text-xl font-semibold text-white">{userData.name}</h3>
                        <p className="text-brand-fg-secondary">{userData.email}</p>
                      </div>
                      
                      <div className="md:ml-auto grid grid-cols-2 gap-4 mt-4 md:mt-0">
                        <div className="text-center p-4 bg-brand-indigo rounded-lg">
                          <div className="text-brand-fg-secondary text-sm">Total Hits</div>
                          <div className="text-white text-2xl font-bold">{userData.totalHits}</div>
                        </div>
                        <div className="text-center p-4 bg-brand-indigo rounded-lg">
                          <div className="text-brand-fg-secondary text-sm">Best Score</div>
                          <div className="text-white text-2xl font-bold">{userData.bestScore}</div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                
                <Card className="bg-brand-surface border-brand-lavender/30">
                  <CardHeader>
                    <CardTitle className="text-lg text-white">Recent Sessions</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {recentSessions.length === 0 ? (
                      <p className="text-center text-brand-fg-secondary py-4">
                        No recent sessions found
                      </p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="border-b border-gray-700">
                              <th className="text-left py-2 text-sm font-medium text-brand-fg-secondary">Session</th>
                              <th className="text-left py-2 text-sm font-medium text-brand-fg-secondary">Date</th>
                              <th className="text-right py-2 text-sm font-medium text-brand-fg-secondary">Duration</th>
                              <th className="text-right py-2 text-sm font-medium text-brand-fg-secondary">Score</th>
                              <th className="text-right py-2 text-sm font-medium text-brand-fg-secondary">Accuracy</th>
                            </tr>
                          </thead>
                          <tbody>
                            {recentSessions.map((session) => (
                              <tr key={session.id} className="border-b border-gray-700/50">
                                <td className="py-3 text-white">{session.name}</td>
                                <td className="py-3 text-brand-fg-secondary">
                                  {format(new Date(session.date), 'MMM d, yyyy')}
                                </td>
                                <td className="py-3 text-right text-brand-fg-secondary">
                                  {session.duration} min
                                </td>
                                <td className="py-3 text-right text-white font-medium">
                                  {session.score}
                                </td>
                                <td className="py-3 text-right text-white">
                                  {session.accuracy}%
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="border-2 border-brand-lavender rounded-lg p-8 mx-auto max-w-md">
                  <div className="text-brand-lavender mb-4">Not logged in</div>
                  <p className="text-brand-fg-secondary mb-6">
                    Please log in to view your profile
                  </p>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

export default Profile;
