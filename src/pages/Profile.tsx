
import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { useAuth } from '@/providers/AuthProvider';
import { useRooms } from '@/store/useRooms';
import { useUserPrefs } from '@/store/useUserPrefs';
import { useProfile } from '@/store/useProfile';
import { updateSharedAttributes } from '@/services/thingsboard';
import { useIsMobile } from '@/hooks/use-mobile';
import Header from '@/components/shared/Header';
import Sidebar from '@/components/shared/Sidebar';
import MobileDrawer from '@/components/shared/MobileDrawer';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import TargetPreferencesSkeleton from '@/pages/targets/TargetPreferencesSkeleton';
import { 
  Target, 
  Edit, 
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
  BookOpen,
  Wifi,
  WifiOff,
  Save
} from 'lucide-react';
import type { UserPreferences, TargetPreferences, HouseWifiSettings } from '@/store/useUserPrefs';

const Profile: React.FC = () => {
  const isMobile = useIsMobile();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const { user: authUser } = useAuth();
  const { rooms, fetchRooms } = useRooms();
  const { prefs, loading: prefsLoading, load: loadPrefs, save: savePrefs, updatePref } = useUserPrefs();
  const { 
    profileData, 
    recentSessions, 
    isLoading: profileLoading, 
    isLoadingSessions, 
    isUpdating,
    error: profileError,
    fetchProfile, 
    fetchSessions, 
    updateProfile: updateUserProfileData 
  } = useProfile();
  const [formPrefs, setFormPrefs] = useState<UserPreferences>({});
  const [profileUpdateData, setProfileUpdateData] = useState({ name: '', email: '' });

  // Fetch data when component mounts
  useEffect(() => {
    const loadData = async () => {
      if (!authUser?.id) return;
      
      try {
        // Get token for rooms data (ThingsBoard)
        const token = localStorage.getItem('tb_access');
        
        await Promise.all([
          fetchProfile(authUser.id),
          fetchSessions(authUser.id, 10),
          fetchRooms(),
          loadPrefs()
        ]);
      } catch (error) {
        console.error("Error fetching data:", error);
      }
    };
    
    loadData();
  }, [authUser?.id, fetchProfile, fetchSessions, fetchRooms, loadPrefs]);

  // Initialize form preferences when prefs are loaded
  useEffect(() => {
    setFormPrefs(prefs);
  }, [prefs]);

  // Initialize profile update form
  useEffect(() => {
    if (profileData) {
      setProfileUpdateData({
        name: profileData.name,
        email: profileData.email
      });
    }
  }, [profileData]);

  const handleChange = (targetId: string, field: keyof TargetPreferences, value: string) => {
    setFormPrefs(prev => ({
      ...prev,
      [targetId]: {
        ...(prev[targetId] as TargetPreferences || {}),
        [field]: value
      }
    }));
  };

  const handleHouseWifiChange = (field: keyof HouseWifiSettings, value: string) => {
    setFormPrefs(prev => ({
      ...prev,
      houseWifi: {
        ssid: '',
        password: '',
        ...(prev.houseWifi as HouseWifiSettings || {}),
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
        if (targetId !== 'houseWifi' && cfg && typeof cfg === 'object' && 'ipAddress' in cfg) {
          const targetPrefs = cfg as TargetPreferences;
          if (targetPrefs.ipAddress) {
            try {
              await updateSharedAttributes(targetId, {
                ipAddress: targetPrefs.ipAddress,
                // WiFi credentials are stored in Supabase, not sent to ThingsBoard
              });
            } catch (error) {
              console.error(`Failed to update ThingsBoard attributes for target ${targetId}:`, error);
            }
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

  // Handle profile update
  const handleProfileUpdate = async () => {
    if (!profileUpdateData.name.trim()) return;
    
    const success = await updateUserProfileData({
      name: profileUpdateData.name.trim()
    });
    
    if (success && authUser?.id) {
      // Refresh profile data
      await fetchProfile(authUser.id);
    }
  };

  // Format duration helper
  const formatDuration = (milliseconds: number) => {
    const minutes = Math.floor(milliseconds / 60000);
    const seconds = Math.floor((milliseconds % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
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
        
        <main className="flex-1 overflow-y-auto">
          <div className="container mx-auto p-4 md:p-6 lg:p-8">
            <h2 className="text-h1 font-heading text-brand-dark mb-8">Profile</h2>
            
            <Tabs defaultValue="overview" className="space-y-6">
              <TabsList className="grid w-full grid-cols-3 bg-brand-surface border border-brand-secondary/20">
                <TabsTrigger value="overview" className="text-brand-secondary data-[state=active]:bg-brand-primary data-[state=active]:text-brand-surface hover:text-brand-primary hover:bg-brand-primary/10 transition-colors">Overview</TabsTrigger>
                <TabsTrigger value="preferences" className="text-brand-secondary data-[state=active]:bg-brand-primary data-[state=active]:text-brand-surface hover:text-brand-primary hover:bg-brand-primary/10 transition-colors">Target Preferences</TabsTrigger>
                <TabsTrigger value="sessions" className="text-brand-secondary data-[state=active]:bg-brand-primary data-[state=active]:text-brand-surface hover:text-brand-primary hover:bg-brand-primary/10 transition-colors">Recent Sessions</TabsTrigger>
              </TabsList>
              
              <TabsContent value="overview" className="space-y-6">
                {/* Profile Info */}
                <div className="bg-brand-surface rounded-lg p-6 shadow-sm border border-brand-secondary/20">
                  {profileLoading ? (
                    <div className="flex items-center gap-6">
                      <div className="h-20 w-20 rounded-full bg-brand-secondary/20 animate-pulse" />
                      <div className="flex-1 space-y-2">
                        <div className="h-6 bg-brand-secondary/20 rounded animate-pulse w-48" />
                        <div className="h-4 bg-brand-secondary/20 rounded animate-pulse w-64" />
                      </div>
                    </div>
                  ) : profileData ? (
                    <div className="flex items-center gap-6">
                      <Avatar className="h-20 w-20 border-2 border-brand-primary/30">
                        <AvatarImage src={profileData.avatarUrl} />
                        <AvatarFallback className="bg-brand-primary text-brand-surface text-h3 font-heading">
                          {profileData.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-h2 font-heading text-brand-dark">{profileData.name}</h3>
                          <Dialog>
                            <DialogTrigger asChild>
                            <Button variant="ghost" size="sm" className="text-brand-secondary hover:text-brand-primary hover:bg-brand-primary/10 transition-colors">
                              <Edit className="h-4 w-4" />
                            </Button>
                            </DialogTrigger>
                            <DialogContent className="bg-brand-surface border-brand-secondary/20 text-brand-dark">
                              <DialogHeader>
                                <DialogTitle className="text-h3 font-heading text-brand-dark">Edit Profile</DialogTitle>
                                <DialogDescription className="text-brand-dark/70 font-body">
                                  Update your profile information
                                </DialogDescription>
                              </DialogHeader>
                              <div className="space-y-4">
                                <div>
                                  <label className="text-sm text-brand-dark font-body">Display Name</label>
                                  <Input 
                                    value={profileUpdateData.name}
                                    onChange={(e) => setProfileUpdateData(prev => ({ ...prev, name: e.target.value }))}
                                    className="bg-brand-light border-brand-secondary/30 text-brand-dark focus:border-brand-primary" 
                                  />
                                </div>
                                <div>
                                  <label className="text-sm text-brand-dark font-body">Email</label>
                                  <Input value={profileUpdateData.email} disabled className="bg-brand-secondary/10 border-brand-secondary/20 text-brand-dark/70" />
                                  <p className="text-xs text-brand-dark/70 font-body">Email cannot be changed</p>
                                </div>
                                <div className="flex justify-end gap-2">
                                  <DialogTrigger asChild>
                                    <Button variant="outline" className="border-brand-secondary/30 text-brand-secondary hover:bg-brand-secondary/10">Cancel</Button>
                                  </DialogTrigger>
                                  <Button 
                                    onClick={handleProfileUpdate}
                                    disabled={isUpdating}
                                    className="bg-brand-primary hover:bg-brand-primary/90 text-brand-surface"
                                  >
                                    {isUpdating ? 'Updating...' : 'Save Changes'}
                                  </Button>
                                </div>
                              </div>
                            </DialogContent>
                          </Dialog>
                        </div>
                        <p className="text-brand-dark/70 font-body">{profileData.email}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-brand-dark/70">
                      <div className="text-h3 font-heading text-brand-dark mb-2">No Profile Data</div>
                      <p className="text-brand-dark/70 font-body">
                        {profileError || 'No profile data available. Please complete your profile setup.'}
                      </p>
                    </div>
                  )}
                </div>
                
                {/* Stats */}
                {profileLoading ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {[...Array(4)].map((_, i) => (
                      <div key={i} className="bg-brand-surface rounded-lg p-6 shadow-sm border border-brand-secondary/20">
                        <div className="h-4 bg-brand-secondary/20 rounded animate-pulse mb-2" />
                        <div className="h-8 bg-brand-secondary/20 rounded animate-pulse w-20" />
                      </div>
                    ))}
                  </div>
                ) : profileData ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <div className="bg-brand-surface rounded-lg p-6 shadow-sm border border-brand-secondary/20 hover:border-brand-primary/30 transition-colors">
                      <div className="text-sm text-brand-dark/70 font-body">Total Hits</div>
                      <div className="text-3xl text-brand-primary font-heading">{profileData.totalHits.toLocaleString()}</div>
                    </div>
                    <div className="bg-brand-surface rounded-lg p-6 shadow-sm border border-brand-secondary/20 hover:border-brand-primary/30 transition-colors">
                      <div className="text-sm text-brand-dark/70 font-body">Best Score</div>
                      <div className="text-3xl text-brand-primary font-heading">{profileData.bestScore}</div>
                    </div>
                    <div className="bg-brand-surface rounded-lg p-6 shadow-sm border border-brand-secondary/20 hover:border-brand-primary/30 transition-colors">
                      <div className="text-sm text-brand-dark/70 font-body">Total Sessions</div>
                      <div className="text-3xl text-brand-primary font-heading">{profileData.totalSessions.toLocaleString()}</div>
                    </div>
                    <div className="bg-brand-surface rounded-lg p-6 shadow-sm border border-brand-secondary/20 hover:border-brand-primary/30 transition-colors">
                      <div className="text-sm text-brand-dark/70 font-body">Avg Accuracy</div>
                      <div className="text-3xl text-brand-primary font-heading">{profileData.avgAccuracy.toFixed(1)}%</div>
                    </div>
                    {profileData.avgReactionTime && (
                      <div className="bg-brand-surface rounded-lg p-6 shadow-sm border border-brand-secondary/20 hover:border-brand-primary/30 transition-colors md:col-span-2 lg:col-span-2">
                        <div className="text-sm text-brand-dark/70 font-body">Avg Reaction Time</div>
                        <div className="text-3xl text-brand-secondary font-heading">{profileData.avgReactionTime.toFixed(0)}ms</div>
                      </div>
                    )}
                    {profileData.bestReactionTime && (
                      <div className="bg-brand-surface rounded-lg p-6 shadow-sm border border-brand-secondary/20 hover:border-brand-primary/30 transition-colors md:col-span-2 lg:col-span-2">
                        <div className="text-sm text-brand-dark/70 font-body">Best Reaction Time</div>
                        <div className="text-3xl text-brand-secondary font-heading">{profileData.bestReactionTime.toFixed(0)}ms</div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-8 text-brand-dark/70">
                    <div className="text-h3 font-heading text-brand-dark mb-2">No Data Recorded</div>
                    <p className="text-brand-dark/70 font-body">
                      No shooting sessions recorded yet. Start practicing to see your statistics!
                    </p>
                  </div>
                )}
              </TabsContent>
              
              <TabsContent value="preferences" className="space-y-6">
                <Card className="bg-brand-surface border-brand-secondary/20 shadow-sm">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-brand-dark">
                      <Target className="h-5 w-5 text-brand-primary" />
                      Target Network Preferences
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {prefsLoading ? (
                      <TargetPreferencesSkeleton />
                    ) : rooms.length === 0 ? (
                      <div className="text-center text-brand-dark/70 font-body">No rooms found</div>
                    ) : (
                      <>
                        {/* House WiFi Settings */}
                        <div className="p-4 border border-brand-primary/20 rounded-lg bg-brand-primary/5">
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
                                value={(formPrefs.houseWifi as HouseWifiSettings)?.ssid || ''}
                                onChange={(e) => handleHouseWifiChange('ssid', e.target.value)}
                                className="bg-brand-light border-brand-secondary/30 text-brand-dark placeholder:text-brand-dark/50 focus:border-brand-primary"
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
                                value={(formPrefs.houseWifi as HouseWifiSettings)?.password || ''}
                                onChange={(e) => handleHouseWifiChange('password', e.target.value)}
                                className="bg-brand-light border-brand-secondary/30 text-brand-dark placeholder:text-brand-dark/50 focus:border-brand-primary"
                              />
                            </div>
                          </div>
                        </div>

                        {/* Target IP Addresses */}
                        {rooms.map((room) => (
                          <div key={room.id} className="space-y-4">
                            <h3 className="text-lg font-heading text-brand-dark border-b border-brand-secondary/20 pb-2 flex items-center gap-2">
                              <div className="p-1 bg-brand-secondary/10 rounded text-brand-secondary">
                                {getRoomIcon(room.icon)}
                              </div>
                              {room.name} ({room.targetCount} targets)
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {/* Real targets for each room - fetch actual targets from database */}
                              {room.targetCount > 0 ? (
                                <div className="text-sm text-gray-600">
                                  {room.targetCount} target{room.targetCount !== 1 ? 's' : ''} assigned to this room
                                </div>
                              ) : (
                                <div className="text-sm text-gray-500">No targets assigned</div>
                              )}
                            </div>
                          </div>
                        ))}
                        
                        <div className="flex justify-end pt-4 border-t border-brand-secondary/20">
                          <Button 
                            onClick={handleSave}
                            disabled={prefsLoading}
                            className="bg-brand-primary hover:bg-brand-primary/90 text-brand-surface font-body"
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
                <Card className="bg-brand-surface border-brand-secondary/20 shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-brand-dark">Recent Sessions</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {isLoadingSessions ? (
                      <div className="space-y-4">
                        {[...Array(3)].map((_, i) => (
                          <div key={i} className="flex justify-between items-center p-4">
                            <div className="space-y-2">
                              <div className="h-4 bg-brand-secondary/20 rounded animate-pulse w-32" />
                              <div className="h-3 bg-brand-secondary/20 rounded animate-pulse w-24" />
                            </div>
                            <div className="text-right space-y-2">
                              <div className="h-5 bg-brand-secondary/20 rounded animate-pulse w-12" />
                              <div className="h-3 bg-brand-secondary/20 rounded animate-pulse w-16" />
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : recentSessions.length === 0 ? (
                      <div className="text-center py-8 text-brand-dark/70">
                        <div className="text-h3 font-heading text-brand-dark mb-2">No Sessions Recorded</div>
                        <p className="text-brand-dark/70 font-body">
                          No shooting sessions recorded yet. Start practicing to see your session history!
                        </p>
                      </div>
                    ) : (
                      <div className="divide-y divide-brand-secondary/20">
                        {recentSessions.map((session) => (
                          <div key={session.id} className="p-6 flex justify-between items-center hover:bg-brand-light/50 transition-colors">
                            <div>
                              <div className="font-medium text-brand-dark font-body">
                                {session.scenarioName || 'Untitled Session'}
                              </div>
                              <div className="text-sm text-brand-dark/70 font-body">
                                {format(new Date(session.startedAt), 'MMM dd, yyyy - HH:mm')}
                              </div>
                              <div className="text-xs text-brand-secondary font-body mt-1">
                                {session.hitCount} hits • {session.accuracy.toFixed(1)}% accuracy • {formatDuration(session.duration)}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-xl text-brand-primary font-heading">{session.score}</div>
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
