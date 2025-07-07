
import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import Header from '@/components/Header';
import Sidebar from '@/components/Sidebar';
import MobileDrawer from '@/components/MobileDrawer';
import { useIsMobile } from '@/hooks/use-mobile';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Edit } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useSessions } from '@/store/useSessions';
import { format } from 'date-fns';

const Profile: React.FC = () => {
  const location = useLocation();
  const isMobile = useIsMobile();
  const { sessions, fetchSessions } = useSessions();
  const [isLoading, setIsLoading] = useState(true);
  
  const [user, setUser] = useState({
    name: 'Test User',
    email: 'test_user@example.com',
    avatarUrl: 'https://github.com/shadcn.png',
    totalHits: 1248,
    bestScore: 95,
  });

  // Get token from URL or localStorage
  const token = new URLSearchParams(location.search).get('token') || 'dummy_token';

  // Fetch sessions when component mounts
  useEffect(() => {
    const loadSessions = async () => {
      try {
        await fetchSessions(token);
      } catch (error) {
        console.error("Error fetching sessions:", error);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadSessions();
  }, [token, fetchSessions]);

  // Get the 5 most recent sessions
  const recentSessions = sessions
    .slice(0, 5)
    .map(session => ({
      id: session.id,
      name: session.name,
      date: format(new Date(session.date), 'yyyy-MM-dd'),
      score: session.score
    }));

  return (
    <div className="min-h-screen flex flex-col bg-brand-light">
      <Header />
      
      <div className="flex flex-1">
        {!isMobile && <Sidebar />}
        {isMobile && <MobileDrawer />}
        
        <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-y-auto">
          <div className="container mx-auto">
            <h2 className="text-3xl font-heading text-brand-dark mb-8">Profile</h2>
            
            {/* Profile Info */}
            <div className="bg-white rounded-lg p-6 shadow-sm border border-brand-brown/20 mb-6">
              <div className="flex items-center gap-6">
                <Avatar className="h-20 w-20 border-2 border-brand-brown/20">
                  <AvatarImage src={user.avatarUrl} />
                  <AvatarFallback className="bg-brand-brown text-white text-xl font-heading">
                    {user.name.split(' ').map(n => n[0]).join('')}
                  </AvatarFallback>
                </Avatar>
                
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-2xl font-heading text-brand-dark">{user.name}</h3>
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="ghost" size="sm" className="text-brand-brown hover:text-brand-dark">
                          <Edit className="h-4 w-4" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="bg-white border-brand-brown/20 text-brand-dark">
                        <DialogHeader>
                          <DialogTitle className="text-xl font-heading">Edit Profile</DialogTitle>
                          <DialogDescription className="text-brand-dark/70 font-body">
                            Update your profile information
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div>
                            <label className="text-sm text-brand-dark font-body">Display Name</label>
                            <Input defaultValue={user.name} className="bg-white border-brand-brown/30 text-brand-dark" />
                          </div>
                          <div>
                            <label className="text-sm text-brand-dark font-body">Email</label>
                            <Input defaultValue={user.email} disabled className="bg-white border-brand-brown/30 text-brand-dark/50" />
                            <p className="text-xs text-brand-dark/50 font-body">Email cannot be changed</p>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                  <p className="text-brand-dark/70 font-body">{user.email}</p>
                </div>
              </div>
            </div>
            
            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <div className="bg-white rounded-lg p-6 shadow-sm border border-brand-brown/20">
                <div className="text-sm text-brand-dark/70 font-body">Total Hits</div>
                <div className="text-3xl text-brand-dark font-heading">{user.totalHits}</div>
              </div>
              <div className="bg-white rounded-lg p-6 shadow-sm border border-brand-brown/20">
                <div className="text-sm text-brand-dark/70 font-body">Best Score</div>
                <div className="text-3xl text-brand-dark font-heading">{user.bestScore}</div>
              </div>
            </div>
            
            {/* Recent Sessions */}
            <div className="bg-white rounded-lg shadow-sm border border-brand-brown/20">
              <h3 className="text-xl font-heading text-brand-dark p-6 border-b border-brand-brown/20">Recent Sessions</h3>
              {isLoading ? (
                <div className="p-6 text-center text-brand-dark/70 font-body">Loading sessions...</div>
              ) : recentSessions.length === 0 ? (
                <div className="p-6 text-center text-brand-dark/70 font-body">No sessions yet</div>
              ) : (
                <div className="divide-y divide-brand-brown/10">
                  {recentSessions.map((session) => (
                    <div key={session.id} className="p-6 flex justify-between items-center">
                      <div>
                        <div className="font-medium text-brand-dark font-body">{session.name}</div>
                        <div className="text-sm text-brand-dark/70 font-body">{session.date}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-xl text-brand-dark font-heading">{session.score}</div>
                        <div className="text-xs text-brand-dark/70 font-body">Score</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default Profile;
