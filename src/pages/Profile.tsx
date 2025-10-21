
import React, { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import { useAuth } from '@/providers/AuthProvider';
import { apiWrapper } from '@/services/api-wrapper';
import { useRooms } from '@/store/useRooms';
import { useUserPrefs } from '@/store/useUserPrefs';
import { useProfile } from '@/store/useProfile';
import { supabase } from '@/integrations/supabase/client';
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
  Save,
  Clock,
  Zap,
  TrendingUp,
  Crosshair,
  Timer,
  Award
} from 'lucide-react';
import type { UserPreferences, TargetPreferences } from '@/store/useUserPrefs';
import { getWifiCredentials } from '@/services/profile';

const Profile: React.FC = () => {
  const isMobile = useIsMobile();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const { user: authUser } = useAuth();
  const { rooms: liveRooms, fetchRooms } = useRooms();
  const { prefs, loading: prefsLoading, load: loadPrefs, save: savePrefs, updatePref } = useUserPrefs();
  const { 
    profileData: liveProfileData, 
    recentSessions: liveRecentSessions, 
    isLoading: profileLoading, 
    isLoadingSessions, 
    isUpdating,
    error: profileError,
    fetchProfile, 
    fetchSessions, 
    updateProfile: updateUserProfileData 
  } = useProfile();
  
  // Local state for rooms
  const [demoRooms, setDemoRooms] = useState<Array<{
    id: string;
    name: string;
    order: number;
    targetCount: number;
    icon?: string;
    room_type?: string;
  }>>([]);
  const [demoProfileData, setDemoProfileData] = useState<{
    userId: string;
    email: string;
    name: string;
    avatarUrl?: string;
    totalSessions: number;
    totalHits: number;
    totalShots: number;
    averageScore?: number;
    bestScore: number;
    avgAccuracy: number;
    avgReactionTime: number | null;
    bestReactionTime: number | null;
    totalDuration: number;
    scoreImprovement: number;
    accuracyImprovement: number;
  } | null>(null);
  const [demoRecentSessions, setDemoRecentSessions] = useState<Array<{
    id: string;
    scenarioName?: string;
    score: number;
    duration: number;
    created_at?: string;
    startedAt?: string;
  }>>([]);
  
  // Use live data
  const profileData = liveProfileData;
  const recentSessions = liveRecentSessions;
  const rooms = liveRooms;
  
  // Debug logging
  console.log(`📊 Profile: Live sessions count: ${liveRecentSessions.length}`);
  console.log(`📊 Profile: Active sessions count: ${recentSessions.length}`);
  
  const [formPrefs, setFormPrefs] = useState<UserPreferences>({});
  const [profileUpdateData, setProfileUpdateData] = useState({ name: '', email: '' });
  const [wifiCredentials, setWifiCredentials] = useState<{ ssid: string; password: string }>({ ssid: '', password: '' });
  const [loadingWifi, setLoadingWifi] = useState(false);
  const [wifiError, setWifiError] = useState<string | null>(null);
  const [wifiFetched, setWifiFetched] = useState(false); // Track if WiFi has been fetched

  // Fetch WiFi credentials from Supabase (synced from ThingsBoard on login)
  const fetchWifiCredentials = useCallback(async () => {
    if (!authUser?.id) {
      setWifiError('No authenticated user found.');
      return;
    }
    
    setLoadingWifi(true);
    setWifiError(null);
    
    try {
      console.log('Fetching WiFi credentials from Supabase for user:', authUser.id);
      
      const wifiCredentials = await getWifiCredentials(authUser.id);
      
      if (wifiCredentials) {
        console.log('WiFi credentials found:', { 
          ssid: wifiCredentials.ssid, 
          hasPassword: !!wifiCredentials.password 
        });
        setWifiCredentials(wifiCredentials);
      } else {
        setWifiError('No WiFi credentials found. Please ensure your devices are provisioned with WiFi credentials.');
      }
    } catch (error) {
      console.error('Error fetching WiFi credentials:', error);
      setWifiError(`Failed to fetch WiFi credentials: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoadingWifi(false);
    }
  }, [authUser?.id]);

  // Fetch data when component mounts
  useEffect(() => {
    const loadData = async () => {
      console.log('🔄 Profile: Loading data...');
      
      if (!authUser?.id) {
        console.log('⚠️ No authenticated user found');
        return;
      }
      
      console.log('🔗 Fetching REAL data from Supabase for user:', authUser.id);
      
      try {
        // Call store methods directly to get REAL Supabase data
        await Promise.all([
          fetchProfile(authUser.id),    // → supabase.from('user_profiles')
          fetchSessions(authUser.id, 10), // → supabase.from('sessions')
          fetchRooms(),                  // → supabase.from('rooms')
          loadPrefs()                    // → supabase.from('user_preferences')
        ]);
        
        console.log('✅ All REAL data loaded from Supabase');
        console.log('✅ Profile data from store:', liveProfileData);
        console.log('✅ Recent sessions from store:', liveRecentSessions.length, 'sessions');
      } catch (error) {
        console.error("❌ Error fetching profile data:", error);
      }
    };
    
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authUser?.id]);

  // Fetch WiFi credentials ONCE when user is authenticated
  useEffect(() => {
    
    // Only fetch once per user authentication
    if (authUser?.id && !wifiFetched && !loadingWifi) {
      console.log('🔗 LIVE: Fetching WiFi credentials from Supabase (one-time)...');
      setWifiFetched(true); // Mark as fetched before calling
      fetchWifiCredentials();
    }
  }, [authUser?.id, wifiFetched, loadingWifi, fetchWifiCredentials]);

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


  const handleSave = async () => {
    try {
      // Save target preferences to Supabase (IP addresses only)
      await savePrefs(formPrefs);
      
      
      // Push to ThingsBoard for each target (only IP addresses)
      const attributeUpdates: Array<{ targetId: string; ipAddress: string }> = [];
      Object.entries(formPrefs).forEach(([targetId, cfg]) => {
        if (cfg && typeof cfg === 'object' && 'ipAddress' in cfg) {
          const targetPrefs = cfg as TargetPreferences;
          if (targetPrefs.ipAddress) {
            attributeUpdates.push({ targetId, ipAddress: targetPrefs.ipAddress });
          }
        }
      });

      for (const update of attributeUpdates) {
        const { error: commandError } = await supabase.functions.invoke('device-command', {
          body: {
            action: 'set-attributes',
            setAttributes: {
              deviceIds: [update.targetId],
              attributes: {
                ipAddress: update.ipAddress,
              },
            },
          },
        });

        if (commandError) {
          throw new Error(commandError.message ?? `Failed to update device ${update.targetId}`);
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
                <TabsTrigger value="sessions" className="text-brand-secondary data-[state=active]:bg-brand-primary data-[state=active]:text-brand-surface hover:text-brand-primary hover:bg-brand-primary/10 transition-colors">Games Played</TabsTrigger>
              </TabsList>
              
              <TabsContent value="overview" className="space-y-6">
                {/* Profile Info */}
                <div className="bg-brand-surface rounded-lg p-6 shadow-sm border border-brand-secondary/20">
                  {profileLoading ? (
                    <div className="flex items-center gap-6 animate-pulse">
                      {/* Avatar Skeleton */}
                      <div className="h-20 w-20 rounded-full bg-brand-secondary/20 border-2 border-brand-primary/30"></div>
                      
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          {/* Name Skeleton */}
                          <div className="h-6 bg-brand-secondary/20 rounded w-48"></div>
                          {/* Edit Button Skeleton */}
                          <div className="h-8 w-8 bg-brand-secondary/20 rounded"></div>
                        </div>
                        {/* Email Skeleton */}
                        <div className="h-4 bg-brand-secondary/20 rounded w-64"></div>
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
                    {/* Total Hits Card Skeleton */}
                    <div className="bg-brand-surface rounded-lg p-6 shadow-sm border border-brand-secondary/20 animate-pulse">
                      <div className="h-4 bg-brand-secondary/20 rounded w-20 mb-2"></div>
                      <div className="h-8 bg-brand-secondary/20 rounded w-16"></div>
                    </div>
                    
                    {/* Best Score Card Skeleton */}
                    <div className="bg-brand-surface rounded-lg p-6 shadow-sm border border-brand-secondary/20 animate-pulse">
                      <div className="h-4 bg-brand-secondary/20 rounded w-16 mb-2"></div>
                      <div className="h-8 bg-brand-secondary/20 rounded w-12"></div>
                    </div>
                    
                    {/* Total Sessions Card Skeleton */}
                    <div className="bg-brand-surface rounded-lg p-6 shadow-sm border border-brand-secondary/20 animate-pulse">
                      <div className="h-4 bg-brand-secondary/20 rounded w-24 mb-2"></div>
                      <div className="h-8 bg-brand-secondary/20 rounded w-14"></div>
                    </div>
                    
                    {/* Avg Accuracy Card Skeleton */}
                    <div className="bg-brand-surface rounded-lg p-6 shadow-sm border border-brand-secondary/20 animate-pulse">
                      <div className="h-4 bg-brand-secondary/20 rounded w-20 mb-2"></div>
                      <div className="h-8 bg-brand-secondary/20 rounded w-12"></div>
                    </div>
                    
                    {/* Avg Reaction Time Card Skeleton */}
                    <div className="bg-brand-surface rounded-lg p-6 shadow-sm border border-brand-secondary/20 animate-pulse md:col-span-2 lg:col-span-2">
                      <div className="h-4 bg-brand-secondary/20 rounded w-32 mb-2"></div>
                      <div className="h-8 bg-brand-secondary/20 rounded w-20"></div>
                    </div>
                    
                    {/* Best Reaction Time Card Skeleton */}
                    <div className="bg-brand-surface rounded-lg p-6 shadow-sm border border-brand-secondary/20 animate-pulse md:col-span-2 lg:col-span-2">
                      <div className="h-4 bg-brand-secondary/20 rounded w-36 mb-2"></div>
                      <div className="h-8 bg-brand-secondary/20 rounded w-20"></div>
                    </div>
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
                      <div className="text-center text-brand-dark/70 font-body">
                        No rooms found
                      </div>
                    ) : (
                      <>
                        {/* House WiFi Settings - Read Only Display */}
                        <div className="p-4 border border-brand-primary/20 rounded-lg bg-brand-primary/5">
                          <div className="flex items-center justify-between mb-4">
                            <h4 className="font-semibold text-brand-dark flex items-center gap-2">
                              <Wifi className="h-5 w-5" />
                              House WiFi Settings {false && <Badge className="bg-yellow-100 text-yellow-800">Demo</Badge>}
                            </h4>
                            {!false && (
                              <button
                                onClick={fetchWifiCredentials}
                                disabled={loadingWifi}
                                className="text-xs px-3 py-1 bg-brand-primary/10 hover:bg-brand-primary/20 text-brand-primary rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {loadingWifi ? 'Refreshing...' : 'Refresh'}
                              </button>
                            )}
                          </div>
                          
                          {loadingWifi ? (
                            <div className="text-center py-4">
                              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-brand-primary mx-auto mb-2"></div>
                              <div className="text-brand-dark/70">Loading WiFi credentials...</div>
                            </div>
                          ) : wifiError && !false ? (
                            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                              <div className="flex items-center gap-2 text-amber-700">
                                <div className="w-2 h-2 bg-amber-500 rounded-full"></div>
                                <span className="text-sm font-medium">No WiFi credentials available</span>
                              </div>
                              <p className="text-sm text-amber-600 mt-1">{wifiError}</p>
                            </div>
                          ) : (wifiCredentials.ssid || wifiCredentials.password) ? (
                            <div className="space-y-3">
                              <div className="bg-white border border-brand-secondary/20 rounded-lg p-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <div>
                                    <div className="text-xs text-brand-dark/60 font-medium mb-1">WiFi Network</div>
                                    <div className="text-sm font-mono text-brand-dark bg-brand-light/50 px-2 py-1 rounded">
                                      {wifiCredentials.ssid || 'Not set'}
                                    </div>
                                  </div>
                                  <div>
                                    <div className="text-xs text-brand-dark/60 font-medium mb-1">Password</div>
                                    <div className="text-sm font-mono text-brand-dark bg-brand-light/50 px-2 py-1 rounded">
                                      {wifiCredentials.password ? '••••••••' : 'Not set'}
                                    </div>
                            </div>
                          </div>
                        </div>

                              <div className="text-xs text-brand-secondary text-center">
                                {false 
                                  ? '🎭 Demo WiFi credentials - for demonstration purposes only' 
                                  : 'WiFi credentials are managed by ThingsBoard and synced across all devices'
                                }
                              </div>
                                </div>
                              ) : (
                            <div className="text-center py-4 text-brand-dark/60">
                              <Wifi className="h-8 w-8 mx-auto mb-2 text-brand-secondary/50" />
                              <div className="text-sm">No WiFi credentials configured</div>
                              <div className="text-xs text-brand-secondary mt-1">
                                Credentials will appear here when devices are provisioned
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Room Cards */}
                        <div className="space-y-4">
                          <h3 className="text-lg font-heading text-brand-dark flex items-center gap-2">
                            <Target className="h-5 w-5 text-brand-primary" />
                            Room Configuration
                          </h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {prefsLoading ? (
                              // Skeleton loading state for room cards
                              [...Array(6)].map((_, skeletonIndex) => (
                                <Card 
                                  key={`skeleton-${skeletonIndex}`}
                                  className="border border-brand-secondary/20 bg-brand-light/30 animate-pulse"
                                >
                                  <CardHeader className="pb-3">
                                    <div className="flex items-center gap-3">
                                      <div className="w-8 h-8 bg-brand-secondary/20 rounded-lg"></div>
                                      <div className="flex-1 min-w-0">
                                        <div className="h-4 bg-brand-secondary/20 rounded w-24 mb-1"></div>
                                        <div className="h-3 bg-brand-secondary/20 rounded w-16"></div>
                                      </div>
                                    </div>
                                  </CardHeader>
                                  <CardContent className="pt-0">
                                    <div className="space-y-3">
                                      {/* Status skeleton */}
                                      <div className="flex items-center justify-between">
                                        <div className="h-3 bg-brand-secondary/20 rounded w-12"></div>
                                        <div className="flex items-center gap-1">
                                          <div className="w-2 h-2 bg-brand-secondary/20 rounded-full"></div>
                                          <div className="h-3 bg-brand-secondary/20 rounded w-12"></div>
                                        </div>
                                      </div>
                                      
                                      {/* Targets skeleton */}
                                      <div className="flex items-center justify-between">
                                        <div className="h-3 bg-brand-secondary/20 rounded w-16"></div>
                                        <div className="h-5 bg-brand-secondary/20 rounded w-8"></div>
                                      </div>
                                      
                                      {/* Description skeleton */}
                                      <div className="h-3 bg-brand-secondary/20 rounded w-full"></div>
                                    </div>
                                  </CardContent>
                                </Card>
                              ))
                            ) : (
                              rooms.map((room, index) => (
                              <Card 
                                key={room.id} 
                                className={`border transition-all duration-300 hover:shadow-lg hover:scale-105 ${
                                  index % 3 === 0
                                    ? 'bg-gradient-to-br from-brand-primary/5 to-brand-primary/10 border-brand-primary/20'
                                    : index % 3 === 1
                                    ? 'bg-gradient-to-br from-purple-50 to-purple-100/50 border-purple-200/50'
                                    : 'bg-gradient-to-br from-purple-100/30 to-purple-200/40 border-purple-300/50'
                                }`}
                              >
                                <CardHeader className="pb-3">
                                  <div className="flex items-center gap-3">
                                    <div className={`p-2 rounded-lg ${
                                      index % 3 === 0
                                        ? 'bg-brand-primary/10 text-brand-primary'
                                        : index % 3 === 1
                                        ? 'bg-purple-100 text-purple-600'
                                        : 'bg-purple-200 text-purple-700'
                                    }`}>
                                      {getRoomIcon(room.icon)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <CardTitle className="text-sm font-heading text-brand-dark truncate">
                                        {room.name}
                                      </CardTitle>
                                      <p className="text-xs text-brand-dark/60 font-body">
                                        {room.targetCount} target{room.targetCount !== 1 ? 's' : ''}
                                      </p>
                                    </div>
                                  </div>
                                </CardHeader>
                                <CardContent className="pt-0">
                                  <div className="space-y-3">
                                    {/* Room Status */}
                                    <div className="flex items-center justify-between">
                                      <span className="text-xs text-brand-dark/70 font-medium">Status</span>
                                      <div className="flex items-center gap-1">
                                        <div className={`w-2 h-2 rounded-full ${
                                          room.targetCount > 0 
                                            ? 'bg-green-500'  // Online/Active
                                            : 'bg-blue-500'   // Standby/No targets
                                        }`}></div>
                                        <span className={`text-xs font-medium ${
                                          room.targetCount > 0 
                                            ? 'text-green-700'  // Online
                                            : 'text-blue-700'   // Standby
                                        }`}>
                                          {room.targetCount > 0 ? 'Online' : 'Standby'}
                                        </span>
                                      </div>
                                    </div>
                                    
                                    {/* Target Count Badge */}
                                    <div className="flex items-center justify-between">
                                      <span className="text-xs text-brand-dark/70 font-medium">Targets</span>
                                      <Badge 
                                        variant="outline" 
                                        className={`text-xs ${
                                          index % 3 === 0
                                            ? 'border-brand-primary/40 text-brand-primary bg-brand-primary/5'
                                            : index % 3 === 1
                                            ? 'border-purple-400/40 text-purple-600 bg-purple-50'
                                            : 'border-purple-500/40 text-purple-700 bg-purple-100'
                                        }`}
                                      >
                                        {room.targetCount}
                                      </Badge>
                                    </div>
                                    
                                    {/* Room Description */}
                                    <div className="text-xs text-brand-dark/60 font-body">
                                      {room.targetCount > 0 
                                        ? `Configured with ${room.targetCount} target${room.targetCount !== 1 ? 's' : ''}`
                                        : 'No targets assigned to this room'
                                      }
                                    </div>
                                  </div>
                                </CardContent>
                              </Card>
                            ))
                            )}
                          </div>
                        </div>
                        
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
                    <CardTitle className="text-brand-dark">Games Played</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {isLoadingSessions ? (
                      <div className="space-y-4">
                        {[...Array(3)].map((_, i) => (
                          <div key={i} className={`p-6 border border-brand-secondary/10 rounded-lg animate-pulse ${
                            i % 3 === 0 
                              ? 'bg-gradient-to-r from-brand-surface to-brand-light/30' 
                              : i % 3 === 1 
                              ? 'bg-gradient-to-r from-blue-50/50 to-brand-light/20' 
                              : 'bg-gradient-to-r from-green-50/50 to-brand-light/20'
                          }`}>
                            {/* Session Header Skeleton */}
                            <div className="flex justify-between items-start mb-3">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <div className="h-4 bg-brand-secondary/20 rounded w-32"></div>
                                  <div className="h-5 bg-brand-secondary/20 rounded w-16"></div>
                                </div>
                                <div className="h-3 bg-brand-secondary/20 rounded w-40 mb-1"></div>
                                <div className="h-3 bg-brand-secondary/20 rounded w-24"></div>
                              </div>
                              <div className="bg-gradient-to-br from-brand-primary/10 to-brand-primary/5 rounded-lg p-3 border border-brand-primary/20">
                                <div className="h-6 bg-brand-secondary/20 rounded w-8 mb-1"></div>
                                <div className="h-3 bg-brand-secondary/20 rounded w-10"></div>
                              </div>
                            </div>
                            
                            {/* Stats Grid Skeleton */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs mb-4">
                              {/* Hits Card Skeleton */}
                              <div className="bg-gradient-to-br from-brand-primary/10 to-brand-primary/5 border border-brand-primary/20 rounded-lg p-3">
                                <div className="flex items-center gap-1 mb-1">
                                  <div className="h-4 w-4 bg-brand-secondary/20 rounded"></div>
                                  <div className="h-3 bg-brand-secondary/20 rounded w-8"></div>
                                </div>
                                <div className="h-5 bg-brand-secondary/20 rounded w-6 mb-1"></div>
                                <div className="h-3 bg-brand-secondary/20 rounded w-16"></div>
                              </div>
                              
                              {/* Accuracy Card Skeleton */}
                              <div className="bg-gradient-to-br from-green-500/10 to-green-500/5 border border-green-500/20 rounded-lg p-3">
                                <div className="flex items-center gap-1 mb-1">
                                  <div className="h-4 w-4 bg-brand-secondary/20 rounded"></div>
                                  <div className="h-3 bg-brand-secondary/20 rounded w-12"></div>
                                </div>
                                <div className="h-5 bg-brand-secondary/20 rounded w-10 mb-1"></div>
                                <div className="h-3 bg-brand-secondary/20 rounded w-14"></div>
                              </div>
                              
                              {/* Duration Card Skeleton */}
                              <div className="bg-gradient-to-br from-blue-500/10 to-blue-500/5 border border-blue-500/20 rounded-lg p-3">
                                <div className="flex items-center gap-1 mb-1">
                                  <div className="h-4 w-4 bg-brand-secondary/20 rounded"></div>
                                  <div className="h-3 bg-brand-secondary/20 rounded w-12"></div>
                                </div>
                                <div className="h-5 bg-brand-secondary/20 rounded w-8"></div>
                              </div>
                              
                              {/* Reaction Time Card Skeleton */}
                              <div className="bg-gradient-to-br from-purple-500/10 to-purple-500/5 border border-purple-500/20 rounded-lg p-3">
                                <div className="flex items-center gap-1 mb-1">
                                  <div className="h-4 w-4 bg-brand-secondary/20 rounded"></div>
                                  <div className="h-3 bg-brand-secondary/20 rounded w-16"></div>
                                </div>
                                <div className="h-5 bg-brand-secondary/20 rounded w-12 mb-1"></div>
                                <div className="h-3 bg-brand-secondary/20 rounded w-20"></div>
                              </div>
                            </div>

                            {/* Game Summary Details Skeleton */}
                            <div className="mt-4 pt-3 border-t border-brand-secondary/20">
                              <div className="flex items-center gap-1 mb-3 bg-gradient-to-r from-brand-primary/5 to-transparent p-2 rounded-lg">
                                <div className="h-4 w-4 bg-brand-secondary/20 rounded"></div>
                                <div className="h-3 bg-brand-secondary/20 rounded w-32"></div>
                              </div>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                                <div className="flex justify-between items-center bg-gradient-to-r from-orange-500/5 to-orange-500/10 p-2 rounded-lg border border-orange-500/20">
                                  <div className="flex items-center gap-1">
                                    <div className="h-4 w-4 bg-brand-secondary/20 rounded"></div>
                                    <div className="h-3 bg-brand-secondary/20 rounded w-24"></div>
                                  </div>
                                  <div className="h-3 bg-brand-secondary/20 rounded w-8"></div>
                                </div>
                                <div className="flex justify-between items-center bg-gradient-to-r from-cyan-500/5 to-cyan-500/10 p-2 rounded-lg border border-cyan-500/20">
                                  <div className="flex items-center gap-1">
                                    <div className="h-4 w-4 bg-brand-secondary/20 rounded"></div>
                                    <div className="h-3 bg-brand-secondary/20 rounded w-20"></div>
                                  </div>
                                  <div className="h-3 bg-brand-secondary/20 rounded w-6"></div>
                                </div>
                                <div className="flex justify-between items-center bg-gradient-to-r from-indigo-500/5 to-indigo-500/10 p-2 rounded-lg border border-indigo-500/20">
                                  <div className="flex items-center gap-1">
                                    <div className="h-4 w-4 bg-brand-secondary/20 rounded"></div>
                                    <div className="h-3 bg-brand-secondary/20 rounded w-16"></div>
                                  </div>
                                  <div className="h-3 bg-brand-secondary/20 rounded w-4"></div>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : recentSessions.length === 0 ? (
                      <div className="text-center py-8 text-brand-dark/70">
                        <div className="text-h3 font-heading text-brand-dark mb-2">
                          {false ? 'No Demo Sessions' : 'No Sessions Recorded'}
                        </div>
                        <p className="text-brand-dark/70 font-body">
                          No shooting sessions recorded yet. Play a game and it will show here!
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {recentSessions.map((session, index) => {
                          // Debug: Log which session is being rendered
                          if (index === 0) {
                            console.log(`🎯 Profile: Rendering session in LIVE mode:`, {
                              id: session.id,
                              name: session.scenarioName || session.scenarioName || session.scenarioName,
                              isDemoId: session.id.startsWith('mock-'),
                              source: false ? 'Demo Array' : 'Live Array'
                            });
                          }
                          
                          return (
                          <div key={session.id} className={`p-6 border border-brand-secondary/10 rounded-lg hover:shadow-lg hover:border-brand-primary/20 transition-all duration-300 ${
                            index % 3 === 0 
                              ? 'bg-gradient-to-r from-brand-surface to-brand-light/30' 
                              : index % 3 === 1 
                              ? 'bg-gradient-to-r from-blue-50/50 to-brand-light/20' 
                              : 'bg-gradient-to-r from-green-50/50 to-brand-light/20'
                          }`}>
                            <div className="flex justify-between items-start mb-3">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                              <div className="font-medium text-brand-dark font-body">
                                {session.scenarioName || session.scenarioName || 'Untitled Game'}
                                  </div>
                                  {session.scenarioType && (
                                    <Badge variant="outline" className="text-xs border-brand-primary/40 text-brand-primary bg-brand-primary/5">
                                      {session.scenarioType}
                                    </Badge>
                                  )}
                              </div>
                              <div className="text-sm text-brand-dark/70 font-body">
                                {format(new Date(session.startedAt), 'MMM dd, yyyy - HH:mm')}
                                </div>
                                {session.roomName && (
                                  <div className="text-xs text-brand-secondary font-body">
                                    Room: {session.roomName}
                                  </div>
                                )}
                              </div>
                              <div className="text-right bg-gradient-to-br from-brand-primary/10 to-brand-primary/5 rounded-lg p-3 border border-brand-primary/20">
                                <div className="text-xl text-brand-primary font-heading">{session.score}</div>
                                <div className="text-xs text-brand-dark/70 font-body">Score</div>
                              </div>
                            </div>
                            
                            {/* Detailed Stats Grid */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                              <div className="bg-gradient-to-br from-brand-primary/10 to-brand-primary/5 border border-brand-primary/20 rounded-lg p-3 hover:shadow-md transition-all duration-200">
                                <div className="flex items-center gap-1 text-brand-primary font-body mb-1">
                                  <Crosshair className="h-6 w-6" />
                                  Hits
                                </div>
                                <div className="text-lg font-heading text-brand-primary">{session.hitCount}</div>
                                {session.totalShots > 0 && (
                                  <div className="text-brand-dark/60">of {session.totalShots} shots</div>
                                )}
                              </div>
                              
                              <div className="bg-gradient-to-br from-green-500/10 to-green-500/5 border border-green-500/20 rounded-lg p-3 hover:shadow-md transition-all duration-200">
                                <div className="flex items-center gap-1 text-green-600 font-body mb-1">
                                  <Target className="h-6 w-6" />
                                  Accuracy
                                </div>
                                <div className="text-lg font-heading text-green-600">
                                  {session.accuracy ? session.accuracy.toFixed(1) : (session.hitCount && session.totalShots ? ((session.hitCount / session.totalShots) * 100).toFixed(1) : '0.0')}%
                                </div>
                                {session.missCount && session.missCount > 0 && (
                                  <div className="text-brand-dark/60">{session.missCount} misses</div>
                                )}
                              </div>
                              
                              <div className="bg-gradient-to-br from-blue-500/10 to-blue-500/5 border border-blue-500/20 rounded-lg p-3 hover:shadow-md transition-all duration-200">
                                <div className="flex items-center gap-1 text-blue-600 font-body mb-1">
                                  <Clock className="h-6 w-6" />
                                  Duration
                                </div>
                                <div className="text-lg font-heading text-blue-600">{formatDuration(session.duration)}</div>
                              </div>
                              
                              {session.avgReactionTime && (
                                <div className="bg-gradient-to-br from-purple-500/10 to-purple-500/5 border border-purple-500/20 rounded-lg p-3 hover:shadow-md transition-all duration-200">
                                  <div className="flex items-center gap-1 text-purple-600 font-body mb-1">
                                    <Zap className="h-6 w-6" />
                                    Avg Reaction
                                  </div>
                                  <div className="text-lg font-heading text-purple-600">{session.avgReactionTime}ms</div>
                                  {session.bestReactionTime && (
                                    <div className="text-brand-dark/60">Best: {session.bestReactionTime}ms</div>
                                  )}
                                </div>
                              )}
                            </div>

                            {/* Game Summary Details from thingsboard_data */}
                            {session.thingsboardData && (
                              <div className="mt-4 pt-3 border-t border-brand-secondary/20">
                                <div className="flex items-center gap-1 text-xs text-brand-primary font-body mb-3 bg-gradient-to-r from-brand-primary/5 to-transparent p-2 rounded-lg">
                                  <Award className="h-6 w-6" />
                                  Game Summary Details
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                                  {session.thingsboardData.averageHitInterval && (
                                    <div className="flex justify-between items-center bg-gradient-to-r from-orange-500/5 to-orange-500/10 p-2 rounded-lg border border-orange-500/20">
                                      <span className="flex items-center gap-1 text-orange-600">
                                        <Timer className="h-6 w-6" />
                                        Avg Hit Interval:
                                      </span>
                                      <span className="text-orange-600 font-medium">{session.thingsboardData.averageHitInterval.toFixed(1)}s</span>
                                    </div>
                                  )}
                                  {session.thingsboardData.crossTargetStats && (
                                    <div className="flex justify-between items-center bg-gradient-to-r from-cyan-500/5 to-cyan-500/10 p-2 rounded-lg border border-cyan-500/20">
                                      <span className="flex items-center gap-1 text-cyan-600">
                                        <TrendingUp className="h-6 w-6" />
                                        Target Switches:
                                      </span>
                                      <span className="text-cyan-600 font-medium">{session.thingsboardData.crossTargetStats.totalSwitches}</span>
                                    </div>
                                  )}
                                  {session.thingsboardData.targetStats && (
                                    <div className="flex justify-between items-center bg-gradient-to-r from-indigo-500/5 to-indigo-500/10 p-2 rounded-lg border border-indigo-500/20">
                                      <span className="flex items-center gap-1 text-indigo-600">
                                        <Gamepad2 className="h-6 w-6" />
                                        Targets Used:
                                      </span>
                                      <span className="text-indigo-600 font-medium">{session.thingsboardData.targetStats.length}</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                          )
                        })}
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
