
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

const Profile: React.FC = () => {
  const location = useLocation();
  const isMobile = useIsMobile();
  const [user, setUser] = useState({
    name: 'Jane Doe',
    email: 'jane@example.com',
    avatarUrl: 'https://github.com/shadcn.png',
    totalHits: 1248,
    bestScore: 95,
    recentSessions: [
      { id: 1, name: 'Quick Training', date: '2023-04-25', score: 87 },
      { id: 2, name: 'Accuracy Focus', date: '2023-04-22', score: 95 },
      { id: 3, name: 'Speed Run', date: '2023-04-18', score: 72 },
      { id: 4, name: 'Beginner Mode', date: '2023-04-15', score: 65 },
      { id: 5, name: 'Custom Scenario', date: '2023-04-10', score: 83 }
    ]
  });

  return (
    <div className="min-h-screen flex flex-col bg-brand-indigo">
      <Header />
      
      <div className="flex flex-1">
        {!isMobile && <Sidebar />}
        {isMobile && <MobileDrawer />}
        
        <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-y-auto">
          <div className="container mx-auto max-w-4xl">
            <h2 className="text-2xl font-display font-bold text-white mb-6">Profile</h2>
            
            <div className="bg-brand-surface rounded-xl p-6 shadow-card mb-6">
              <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
                <Avatar className="w-24 h-24 border-4 border-brand-lavender/30">
                  <AvatarImage src={user.avatarUrl} alt={user.name} />
                  <AvatarFallback className="bg-brand-lavender text-3xl">{user.name.charAt(0)}</AvatarFallback>
                </Avatar>
                
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h3 className="text-2xl font-display text-white">{user.name}</h3>
                    
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm" className="text-brand-lavender hover:bg-brand-lavender/20">
                          <Edit className="h-4 w-4 mr-2" />
                          Edit
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="bg-brand-surface border-brand-lavender/30 text-white">
                        <DialogHeader>
                          <DialogTitle className="text-white">Edit Profile</DialogTitle>
                          <DialogDescription className="text-brand-fg-secondary">
                            Update your profile information
                          </DialogDescription>
                        </DialogHeader>
                        
                        <div className="space-y-4 py-4">
                          <div className="text-center mb-4">
                            <Avatar className="w-24 h-24 border-4 border-brand-lavender/30 mx-auto">
                              <AvatarImage src={user.avatarUrl} />
                              <AvatarFallback className="bg-brand-lavender text-3xl">{user.name.charAt(0)}</AvatarFallback>
                            </Avatar>
                            <Button variant="link" className="mt-2 text-brand-lavender">
                              Change avatar
                            </Button>
                          </div>
                          
                          <div className="space-y-2">
                            <label className="text-sm text-brand-fg-secondary">Display Name</label>
                            <Input defaultValue={user.name} className="bg-brand-indigo border-brand-lavender/30" />
                          </div>
                          
                          <div className="space-y-2">
                            <label className="text-sm text-brand-fg-secondary">Email</label>
                            <Input defaultValue={user.email} disabled className="bg-brand-indigo border-brand-lavender/30 text-brand-fg-secondary" />
                            <p className="text-xs text-brand-fg-secondary">Email cannot be changed</p>
                          </div>
                        </div>
                        
                        <div className="flex justify-end gap-2">
                          <Button variant="outline">Cancel</Button>
                          <Button className="bg-brand-lavender hover:bg-brand-lavender/80">Save Changes</Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                  
                  <p className="text-brand-fg-secondary mt-1">{user.email}</p>
                  
                  <div className="grid grid-cols-2 gap-4 mt-4">
                    <div>
                      <div className="text-sm text-brand-fg-secondary">Total Hits</div>
                      <div className="text-2xl text-white font-display">{user.totalHits}</div>
                    </div>
                    <div>
                      <div className="text-sm text-brand-fg-secondary">Best Score</div>
                      <div className="text-2xl text-white font-display">{user.bestScore}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="bg-brand-surface rounded-xl shadow-card">
              <h3 className="text-xl font-display text-white p-6 border-b border-brand-lavender/20">Recent Sessions</h3>
              
              <ul className="divide-y divide-brand-lavender/20">
                {user.recentSessions.map(session => (
                  <li key={session.id} className="p-4 flex justify-between items-center">
                    <div>
                      <div className="text-white font-medium">{session.name}</div>
                      <div className="text-sm text-brand-fg-secondary">{session.date}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xl text-white font-display">{session.score}</div>
                      <div className="text-xs text-brand-fg-secondary">Score</div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default Profile;
