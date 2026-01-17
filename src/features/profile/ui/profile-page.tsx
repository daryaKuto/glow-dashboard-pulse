
import React, { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import { useAuth } from '@/shared/hooks/use-auth';
import { useRooms } from '@/features/rooms';
import { useUserPrefs } from '@/state/useUserPrefs';
import { useProfile, useRecentSessions, useStatsTrend, useUpdateProfile, useWifiCredentials, useUpdateWifiCredentials, profileKeys } from '@/features/profile';
import { useSetDeviceAttributes } from '@/features/targets';
import { fetchTargetsWithTelemetry } from '@/features/games/lib/thingsboard-targets';
import { useQueryClient } from '@tanstack/react-query';
import { useIsMobile } from '@/shared/hooks/use-mobile';
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
import TargetPreferencesSkeleton from '@/components/targets/TargetPreferencesSkeleton';
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
  Award,
  Eye,
  EyeOff,
  Settings
} from 'lucide-react';
import type { UserPreferences, TargetPreferences } from '@/state/useUserPrefs';

const Profile: React.FC = () => {
  const isMobile = useIsMobile();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const { user: authUser } = useAuth();
  // Use new React Query hooks
  const { data: roomsData, refetch: refetchRooms } = useRooms();
  const liveRooms = roomsData?.rooms || [];
  
  // Fetch targets with accurate status directly from ThingsBoard (same approach as Games page)
  // This uses getBatchServerAttributes to get the real-time 'active' server attribute
  const [targetStatusMap, setTargetStatusMap] = React.useState<Map<string, string>>(new Map());
  
  React.useEffect(() => {
    fetchTargetsWithTelemetry(false).then(({ targets }) => {
      const map = new Map<string, string>();
      targets.forEach(target => {
        map.set(target.id, target.status);
      });
      setTargetStatusMap(map);
    }).catch(err => {
      console.error('Failed to fetch targets from ThingsBoard:', err);
    });
  }, []);
  
  const { prefs, loading: prefsLoading, load: loadPrefs, save: savePrefs, updatePref } = useUserPrefs();
  
  // Profile hooks (React Query)
  const queryClient = useQueryClient();
  const { data: liveProfileData, isLoading: profileLoading, refetch: refetchProfile } = useProfile(authUser?.id);
  const { data: liveRecentSessions = [], isLoading: isLoadingSessions, refetch: refetchSessions } = useRecentSessions(authUser?.id, 10);
  const { data: statsTrendData = [] } = useStatsTrend(authUser?.id);
  const updateProfileMutation = useUpdateProfile();
  
  // Derived state from mutations
  const isUpdating = updateProfileMutation.isPending;
  const profileError = updateProfileMutation.error?.message || null;
  
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
  
  // Debug logging - throttled to prevent excessive logs on every render
  // Removed excessive console.log calls that were firing on every render
  // Use React DevTools Profiler for rendering analysis instead
  
  const [formPrefs, setFormPrefs] = useState<UserPreferences>({});
  const [profileUpdateData, setProfileUpdateData] = useState({ name: '', email: '' });
  
  // WiFi credentials via React Query hook
  const { 
    data: wifiCredentialsData, 
    isLoading: loadingWifi, 
    error: wifiQueryError,
    refetch: refetchWifiCredentials 
  } = useWifiCredentials(authUser?.id);
  
  // Derive wifi state from query
  const wifiCredentials = wifiCredentialsData || { ssid: '', password: '' };
  
  // WiFi credentials edit state
  const [wifiFormData, setWifiFormData] = useState({ ssid: '', password: '' });
  const [showWifiPassword, setShowWifiPassword] = useState(false);
  const [wifiFormError, setWifiFormError] = useState<string | null>(null);
  const updateWifiCredentialsMutation = useUpdateWifiCredentials();
  
  // Device attributes mutation for syncing preferences to ThingsBoard
  const setDeviceAttributesMutation = useSetDeviceAttributes();

  // Load user preferences when component mounts
  // Note: Profile and session data are automatically fetched by React Query hooks
  useEffect(() => {
    if (authUser?.id) {
      loadPrefs();
    }
  }, [authUser?.id, loadPrefs]);

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

  // Initialize WiFi form when credentials are loaded
  useEffect(() => {
    if (wifiCredentials && wifiCredentials.ssid) {
      setWifiFormData(prev => ({
        ssid: prev.ssid || wifiCredentials.ssid || '',
        password: prev.password // Keep password as user entered it
      }));
    }
  }, [wifiCredentials]);

  // Handle WiFi credentials save
  const handleSaveWifiCredentials = async () => {
    // Validate form
    if (!wifiFormData.ssid.trim()) {
      setWifiFormError('WiFi network name is required');
      return;
    }
    if (!wifiFormData.password || wifiFormData.password.length < 8) {
      setWifiFormError('Password must be at least 8 characters');
      return;
    }

    if (!authUser?.id) {
      setWifiFormError('User not authenticated');
      return;
    }

    try {
      await updateWifiCredentialsMutation.mutateAsync({
        userId: authUser.id,
        credentials: {
          ssid: wifiFormData.ssid.trim(),
          password: wifiFormData.password
        }
      });
      // Clear password field after successful save (keep ssid for reference)
      setWifiFormData(prev => ({ ...prev, password: '' }));
      setWifiFormError(null);
    } catch (error) {
      // Error is handled by the mutation's onError
      console.error('Error saving WiFi credentials:', error);
    }
  };

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
      
      
      // Push to ThingsBoard for each target (IP addresses, sounds, and colors)
      const attributeUpdates: Array<{ 
        targetId: string; 
        attributes: Record<string, unknown>;
      }> = [];
      
      Object.entries(formPrefs).forEach(([targetId, cfg]) => {
        if (cfg && typeof cfg === 'object' && 'ipAddress' in cfg) {
          const targetPrefs = cfg as TargetPreferences;
          const attributes: Record<string, unknown> = {};
          
          // IP Address (existing)
          if (targetPrefs.ipAddress) {
            attributes.ipAddress = targetPrefs.ipAddress;
          }
          
          // Sound customization (premium feature)
          if (targetPrefs.soundEnabled && targetPrefs.customSoundUrl) {
            attributes.customSoundUrl = targetPrefs.customSoundUrl;
            attributes.soundEnabled = true;
          } else if (targetPrefs.soundEnabled !== undefined) {
            attributes.soundEnabled = false;
          }
          
          // Light color customization (premium feature)
          if (targetPrefs.lightEnabled && targetPrefs.lightColor) {
            attributes.lightColor = targetPrefs.lightColor;
            attributes.lightEnabled = true;
          } else if (targetPrefs.lightEnabled !== undefined) {
            attributes.lightEnabled = false;
          }
          
          // Only add if there are attributes to update
          if (Object.keys(attributes).length > 0) {
            attributeUpdates.push({ targetId, attributes });
          }
        }
      });

      for (const update of attributeUpdates) {
        try {
          await setDeviceAttributesMutation.mutateAsync({
            deviceIds: [update.targetId],
            attributes: update.attributes,
          });
        } catch (commandError) {
          throw new Error(commandError instanceof Error ? commandError.message : `Failed to update device ${update.targetId}`);
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
    
    try {
      await updateProfileMutation.mutateAsync({
        name: profileUpdateData.name.trim()
      });
      // React Query will automatically refetch the profile data
    } catch (error) {
      console.error('Error updating profile:', error);
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
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
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
                    
                  </div>
                ) : profileData ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
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
                        {/* House WiFi Settings - Editable */}
                        <div className="p-4 border border-brand-primary/20 rounded-lg bg-brand-primary/5">
                          <div className="flex items-center justify-between mb-4">
                            <h4 className="font-semibold text-brand-dark flex items-center gap-2">
                              <Wifi className="h-5 w-5" />
                              Network Credentials
                            </h4>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => refetchWifiCredentials()}
                                disabled={loadingWifi}
                                className="text-xs px-3 py-1 bg-brand-primary/10 hover:bg-brand-primary/20 text-brand-primary rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {loadingWifi ? 'Refreshing...' : 'Refresh'}
                              </button>
                            </div>
                          </div>
                          
                          {loadingWifi ? (
                            <div className="text-center py-4">
                              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-brand-primary mx-auto mb-2"></div>
                              <div className="text-brand-dark/70">Loading WiFi credentials...</div>
                            </div>
                          ) : (
                            <div className="space-y-4">
                              {/* Form Error */}
                              {wifiFormError && (
                                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                                  <p className="text-sm text-red-600">{wifiFormError}</p>
                                </div>
                              )}
                              
                              {/* WiFi Form */}
                              <div className="bg-white border border-brand-secondary/20 rounded-lg p-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <div>
                                    <Label htmlFor="wifi-ssid" className="text-xs text-brand-dark/60 font-medium mb-1 block">
                                      WiFi Network Name (SSID)
                                    </Label>
                                    <Input
                                      id="wifi-ssid"
                                      type="text"
                                      placeholder="Enter network name"
                                      value={wifiFormData.ssid}
                                      onChange={(e) => {
                                        setWifiFormData(prev => ({ ...prev, ssid: e.target.value }));
                                        setWifiFormError(null);
                                      }}
                                      className="bg-brand-light/50 border-brand-secondary/30 text-brand-dark focus:border-brand-primary"
                                      maxLength={32}
                                    />
                                  </div>
                                  <div>
                                    <Label htmlFor="wifi-password" className="text-xs text-brand-dark/60 font-medium mb-1 block">
                                      Password
                                    </Label>
                                    <div className="relative">
                                      <Input
                                        id="wifi-password"
                                        type={showWifiPassword ? 'text' : 'password'}
                                        placeholder="Enter password (min 8 characters)"
                                        value={wifiFormData.password}
                                        onChange={(e) => {
                                          setWifiFormData(prev => ({ ...prev, password: e.target.value }));
                                          setWifiFormError(null);
                                        }}
                                        className="bg-brand-light/50 border-brand-secondary/30 text-brand-dark focus:border-brand-primary pr-10"
                                        maxLength={63}
                                      />
                                      <button
                                        type="button"
                                        onClick={() => setShowWifiPassword(!showWifiPassword)}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 text-brand-secondary hover:text-brand-primary transition-colors"
                                      >
                                        {showWifiPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                      </button>
                                    </div>
                                  </div>
                                </div>
                                
                                {/* Current credentials info */}
                                {wifiCredentials.ssid && (
                                  <div className="mt-3 pt-3 border-t border-brand-secondary/10">
                                    <div className="flex items-center gap-2 text-xs text-brand-dark/60">
                                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                                      <span>Current network: <span className="font-mono font-medium text-brand-dark">{wifiCredentials.ssid}</span></span>
                                    </div>
                                  </div>
                                )}
                              </div>
                              
                              {/* Save Button */}
                              <div className="flex items-center justify-between">
                                <div className="text-xs text-brand-secondary">
                                  WiFi credentials will be synced to all your devices
                                </div>
                                <Button
                                  onClick={handleSaveWifiCredentials}
                                  disabled={updateWifiCredentialsMutation.isPending || !wifiFormData.ssid.trim() || wifiFormData.password.length < 8}
                                  className="bg-brand-primary hover:bg-brand-primary/90 text-brand-surface"
                                >
                                  {updateWifiCredentialsMutation.isPending ? (
                                    <>
                                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                      Saving...
                                    </>
                                  ) : (
                                    <>
                                      <Save className="h-4 w-4 mr-2" />
                                      Save Credentials
                                    </>
                                  )}
                                </Button>
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
                              rooms.map((room, index) => {
                              // Calculate online targets count using accurate status from ThingsBoard
                              const targets = (room as any).targets || [];
                              const onlineTargetsCount = targets.filter((t: any) => {
                                // Use accurate status from ThingsBoard (same data source as Games page)
                                const accurateStatus = targetStatusMap.get(t.id) || t.status;
                                return accurateStatus && accurateStatus.toLowerCase() !== 'offline';
                              }).length;
                              const hasOnlineTargets = onlineTargetsCount > 0;
                              
                              return (
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
                                    {/* Room Status - based on actual target online status */}
                                    <div className="flex items-center justify-between">
                                      <span className="text-xs text-brand-dark/70 font-medium">Status</span>
                                      <div className="flex items-center gap-1">
                                        <div className={`w-2 h-2 rounded-full ${
                                          hasOnlineTargets 
                                            ? 'bg-green-500'  // Online/Active
                                            : room.targetCount > 0
                                            ? 'bg-gray-400'   // All targets offline
                                            : 'bg-blue-500'   // No targets assigned
                                        }`}></div>
                                        <span className={`text-xs font-medium ${
                                          hasOnlineTargets 
                                            ? 'text-green-700'  // Online
                                            : room.targetCount > 0
                                            ? 'text-gray-600'   // Offline
                                            : 'text-blue-700'   // Standby
                                        }`}>
                                          {hasOnlineTargets 
                                            ? `${onlineTargetsCount} Online` 
                                            : room.targetCount > 0 
                                            ? 'All Offline' 
                                            : 'No Targets'}
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
                                        {onlineTargetsCount}/{room.targetCount}
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
                              );
                            })
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
                          // Removed excessive debug logging - was logging on every render
                          // Use React DevTools Profiler for rendering analysis instead
                          
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
