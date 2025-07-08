
import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import Header from '@/components/Header';
import Sidebar from '@/components/Sidebar';
import MobileDrawer from '@/components/MobileDrawer';
import { useIsMobile } from '@/hooks/use-mobile';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  Edit, 
  Save, 
  Target,
  Sofa,
  Utensils,
  ChefHat,
  Bed,
  Briefcase,
  Home,
  Building,
  Car,
  TreePine,
  Gamepad2,
  Dumbbell,
  Music,
  BookOpen
} from 'lucide-react';
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
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useScenarios } from '@/store/useScenarios';
import { useRooms } from '@/store/useRooms';
import { useUserPrefs, type UserPreferences } from '@/store/useUserPrefs';
import { updateSharedAttributes } from '@/services/thingsboard';
import { format } from 'date-fns';
import TargetPreferencesSkeleton from '@/components/TargetPreferencesSkeleton';

const Profile: React.FC = () => {
  const location = useLocation();
  const isMobile = useIsMobile();
  const { scenarioHistory, fetchScenarios } = useScenarios();
  const { rooms, fetchRooms } = useRooms();
  const { prefs, loading: prefsLoading, load: loadPrefs, save: savePrefs, updateHouseWifi } = useUserPrefs();
  const [isLoading, setIsLoading] = useState(true);
  const [formPrefs, setFormPrefs] = useState<UserPreferences>({});
  
  const [user, setUser] = useState({
    name: 'Test User',
    email: 'test_user@example.com',
    avatarUrl: 'https://github.com/shadcn.png',
    totalHits: 1248,
    bestScore: 95,
  });

  // Get token from URL or localStorage
  const token = new URLSearchParams(location.search).get('token') || 'dummy_token';

  // Fetch data when component mounts
  useEffect(() => {
    const loadData = async () => {
      try {
        await Promise.all([
          fetchScenarios(token),
          fetchRooms(token),
          loadPrefs()
        ]);
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadData();
  }, [token, fetchScenarios, fetchRooms, loadPrefs]);

  // Initialize form preferences when prefs are loaded
  useEffect(() => {
    setFormPrefs(prefs);
  }, [prefs]);

  const handleChange = (targetId: string, field: string, value: string) => {
    setFormPrefs(prev => ({
      ...prev,
      [targetId]: {
        ...prev[targetId],
        [field]: value
      }
    }));
  };

  const handleSave = async () => {
    try {
      // Save to Supabase
      await savePrefs(formPrefs);
      
      // Push to ThingsBoard for each target (only IP addresses)
      for (const [targetId, cfg] of Object.entries(formPrefs)) {
        if (targetId !== 'houseWifi' && cfg.ipAddress) {
          try {
            await updateSharedAttributes(targetId, {
              ipAddress: cfg.ipAddress,
              // WiFi credentials are stored in Supabase, not sent to ThingsBoard
            });
          } catch (error) {
            console.error(`Failed to update ThingsBoard attributes for target ${targetId}:`, error);
          }
        }
      }
    } catch (error) {
      console.error('Error saving preferences:', error);
    }
  };

  // Get icon component based on icon name
  const getRoomIcon = (iconName?: string) => {
    switch (iconName) {
      case 'sofa': return <Sofa className="h-5 w-5" />;
      case 'utensils': return <Utensils className="h-5 w-5" />;
      case 'chef-hat': return <ChefHat className="h-5 w-5" />;
      case 'bed': return <Bed className="h-5 w-5" />;
      case 'briefcase': return <Briefcase className="h-5 w-5" />;
      case 'home': return <Home className="h-5 w-5" />;
      case 'building': return <Building className="h-5 w-5" />;
      case 'car': return <Car className="h-5 w-5" />;
      case 'tree-pine': return <TreePine className="h-5 w-5" />;
      case 'gamepad2': return <Gamepad2 className="h-5 w-5" />;
      case 'dumbbell': return <Dumbbell className="h-5 w-5" />;
      case 'music': return <Music className="h-5 w-5" />;
      case 'book-open': return <BookOpen className="h-5 w-5" />;
      case 'basement': return <Building className="h-5 w-5" />;
      default: return <Home className="h-5 w-5" />;
    }
  };

  // Get the 5 most recent scenarios
  const recentScenarios = scenarioHistory
    .slice(0, 5)
    .map(scenario => ({
      id: scenario.id,
      name: scenario.name,
      date: format(new Date(scenario.date), 'yyyy-MM-dd'),
      score: scenario.score
    }));

  return (
    <div className="min-h-screen flex flex-col bg-brand-light">
      <Header />
      
      <div className="flex flex-1">
        {!isMobile && <Sidebar />}
        {isMobile && <MobileDrawer />}
        
        <main className="flex-1 overflow-y-auto">
          <div className="container mx-auto p-4 md:p-6 lg:p-8">
            <h2 className="text-3xl font-heading text-brand-dark mb-8">Profile</h2>
            
            <Tabs defaultValue="overview" className="space-y-6">
              <TabsList className="grid w-full grid-cols-3 bg-white border border-brand-brown/20">
                <TabsTrigger value="overview" className="text-[#785a46] data-[state=active]:bg-brand-brown data-[state=active]:text-white hover:text-[#785a46]">Overview</TabsTrigger>
                <TabsTrigger value="preferences" className="text-[#785a46] data-[state=active]:bg-brand-brown data-[state=active]:text-white hover:text-[#785a46]">Target Preferences</TabsTrigger>
                <TabsTrigger value="sessions" className="text-[#785a46] data-[state=active]:bg-brand-brown data-[state=active]:text-white hover:text-[#785a46]">Recent Sessions</TabsTrigger>
              </TabsList>
              
              <TabsContent value="overview" className="space-y-6">
                {/* Profile Info */}
                <div className="bg-white rounded-lg p-6 shadow-sm border border-brand-brown/20">
                  <div className="flex items-center gap-6">
                                          <Avatar className="h-20 w-20 border-2 border-brand-brown/30">
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
                            <Button variant="ghost" size="sm" className="text-brand-brown hover:text-[#785a46] hover:bg-brand-brown/20">
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
                                <Input defaultValue={user.email} disabled className="bg-white border-brand-brown/30 text-brand-dark/70" />
                                <p className="text-xs text-brand-dark/70 font-body">Email cannot be changed</p>
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-white rounded-lg p-6 shadow-sm border border-brand-brown/20">
                    <div className="text-sm text-brand-dark/70 font-body">Total Hits</div>
                    <div className="text-3xl text-brand-dark font-heading">{user.totalHits}</div>
                  </div>
                  <div className="bg-white rounded-lg p-6 shadow-sm border border-brand-brown/20">
                    <div className="text-sm text-brand-dark/70 font-body">Best Score</div>
                    <div className="text-3xl text-brand-dark font-heading">{user.bestScore}</div>
                  </div>
                </div>
              </TabsContent>
              
              <TabsContent value="preferences" className="space-y-6">
                <Card className="bg-white border-brand-brown/20 shadow-sm">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-brand-dark">
                      <Target className="h-5 w-5 text-brand-brown" />
                      Target Network Preferences
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {isLoading || prefsLoading ? (
                      <TargetPreferencesSkeleton />
                    ) : rooms.length === 0 ? (
                      <div className="text-center text-brand-dark/70 font-body">No rooms found</div>
                    ) : (
                      <>
                        {/* House WiFi Settings */}
                        <div className="p-4 border border-brand-brown/20 rounded-lg bg-brand-brown/5">
                          <h4 className="font-semibold text-brand-dark mb-4">House WiFi Settings</h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label htmlFor="house-wifi" className="text-sm text-brand-dark/70">
                                WiFi SSID
                              </Label>
                              <Input
                                id="house-wifi"
                                type="text"
                                placeholder="MyWiFi"
                                value={formPrefs.houseWifi?.ssid || ''}
                                onChange={(e) => updateHouseWifi('ssid', e.target.value)}
                                className="bg-white border-brand-brown/30 text-brand-dark placeholder:text-brand-dark/50"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="house-password" className="text-sm text-brand-dark/70">
                                WiFi Password
                              </Label>
                              <Input
                                id="house-password"
                                type="password"
                                placeholder="••••••••"
                                value={formPrefs.houseWifi?.password || ''}
                                onChange={(e) => updateHouseWifi('password', e.target.value)}
                                className="bg-white border-brand-brown/30 text-brand-dark placeholder:text-brand-dark/50"
                              />
                            </div>
                          </div>
                        </div>

                        {/* Target IP Addresses */}
                        {rooms.map((room) => (
                          <div key={room.id} className="space-y-4">
                            <h3 className="text-lg font-heading text-brand-dark border-b border-brand-brown/20 pb-2 flex items-center gap-2">
                              <div className="p-1 bg-brand-brown/10 rounded">
                                {getRoomIcon(room.icon)}
                              </div>
                              {room.name} ({room.targetCount} targets)
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {/* Mock targets for each room - in real implementation, fetch actual targets */}
                              {Array.from({ length: room.targetCount }, (_, index) => {
                                const targetId = `${room.id}-${index + 1}`;
                                const targetPrefs = formPrefs[targetId] || {};
                                
                                return (
                                  <div key={targetId} className="p-4 border border-brand-brown/20 rounded-lg bg-brand-brown/5">
                                    <h4 className="font-semibold text-brand-dark mb-3">
                                      Target {index + 1}
                                    </h4>
                                    <div className="space-y-2">
                                      <Label htmlFor={`${targetId}-ip`} className="text-sm text-brand-dark/70">
                                        IP Address
                                      </Label>
                                      <Input
                                        id={`${targetId}-ip`}
                                        type="text"
                                        placeholder="192.168.1.100"
                                        value={targetPrefs.ipAddress || ''}
                                        onChange={(e) => handleChange(targetId, 'ipAddress', e.target.value)}
                                        className="bg-white border-brand-brown/30 text-brand-dark placeholder:text-brand-dark/50"
                                      />
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                        
                        <div className="flex justify-end pt-4 border-t border-brand-brown/20">
                          <Button 
                            onClick={handleSave}
                            disabled={prefsLoading}
                            className="bg-brand-brown hover:bg-[#785a46] text-white font-body"
                          >
                            <Save className="h-4 w-4 mr-2" />
                            Save Preferences
                          </Button>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
              
              <TabsContent value="sessions" className="space-y-6">
                <Card className="bg-white border-brand-brown/20 shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-brand-dark">Recent Sessions</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {isLoading ? (
                      <div className="text-center text-brand-dark/70 font-body">Loading sessions...</div>
                    ) : recentScenarios.length === 0 ? (
                      <div className="text-center text-brand-dark/70 font-body">No sessions yet</div>
                    ) : (
                      <div className="divide-y divide-brand-brown/20">
                        {recentScenarios.map((scenario) => (
                          <div key={scenario.id} className="p-6 flex justify-between items-center">
                            <div>
                              <div className="font-medium text-brand-dark font-body">{scenario.name}</div>
                              <div className="text-sm text-brand-dark/70 font-body">{scenario.date}</div>
                            </div>
                            <div className="text-right">
                              <div className="text-xl text-brand-dark font-heading">{scenario.score}</div>
                              <div className="text-xs text-brand-dark/70 font-body">Score</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </main>
      </div>
    </div>
  );
};

export default Profile;
