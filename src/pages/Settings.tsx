
import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { 
  Card, 
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from '@/components/ui/sonner';
import Header from '@/components/Header';
import Sidebar from '@/components/Sidebar';
import MobileDrawer from '@/components/MobileDrawer';
import { useIsMobile } from '@/hooks/use-mobile';

interface NotificationSettings {
  email_session_invites: boolean;
  email_firmware_updates: boolean;
  email_target_offline: boolean;
  email_marketing: boolean;
}

const Settings: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  
  const [isLoading, setIsLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>({
    email_session_invites: true,
    email_firmware_updates: true,
    email_target_offline: false,
    email_marketing: false
  });
  
  // Extract token from URL params
  const token = new URLSearchParams(location.search).get('token') || 'dummy_token';

  useEffect(() => {
    async function fetchUserSettings() {
      setIsLoading(true);
      try {
        // Get user data from Supabase
        const { data: { user } } = await supabase.auth.getUser();
        
        if (user) {
          setUserId(user.id);
          
          // In a real app, we would fetch user settings from a table
          // For now, we'll use mock data
          setNotificationSettings(user.user_metadata?.notification_settings || {
            email_session_invites: true,
            email_firmware_updates: true,
            email_target_offline: false,
            email_marketing: false
          });
        }
      } catch (error) {
        console.error('Error fetching user settings:', error);
      } finally {
        setIsLoading(false);
      }
    }
    
    fetchUserSettings();
  }, []);
  
  const handleToggleNotification = async (key: keyof NotificationSettings) => {
    if (!userId) return;
    
    const updatedSettings = {
      ...notificationSettings,
      [key]: !notificationSettings[key]
    };
    
    setNotificationSettings(updatedSettings);
    
    try {
      // In a real app, we would update user_metadata in Supabase
      // For now, we'll just show a toast
      toast.success("Settings updated successfully");
    } catch (error) {
      console.error('Error updating notification settings:', error);
      toast.error("Failed to update settings");
      
      // Revert the change in UI if the API call fails
      setNotificationSettings(notificationSettings);
    }
  };
  
  const handleDeleteAccount = async () => {
    try {
      // In a real app, we would call an API to delete the user's account
      // For now, we'll just sign out and show a toast
      await supabase.auth.signOut();
      toast.success("Account deleted successfully");
      navigate('/login');
    } catch (error) {
      console.error('Error deleting account:', error);
      toast.error("Failed to delete account");
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-brand-indigo">
      <Header />
      
      <div className="flex flex-1">
        {!isMobile && <Sidebar />}
        {isMobile && <MobileDrawer />}
        
        <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-y-auto">
          <div className="container mx-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-display font-bold text-white">Settings</h2>
            </div>
            
            {isLoading ? (
              <div className="text-center text-brand-fg-secondary py-8">Loading settings...</div>
            ) : userId ? (
              <div className="space-y-6">
                <Card className="bg-brand-surface border-brand-lavender/30">
                  <CardHeader>
                    <CardTitle className="text-white">Email Notifications</CardTitle>
                    <CardDescription className="text-brand-fg-secondary">
                      Manage which emails you receive from us
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label className="text-white">Session Invites</Label>
                        <p className="text-xs text-brand-fg-secondary">
                          Receive emails when you're invited to join a session
                        </p>
                      </div>
                      <Switch 
                        checked={notificationSettings.email_session_invites}
                        onCheckedChange={() => handleToggleNotification('email_session_invites')}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label className="text-white">Firmware Updates</Label>
                        <p className="text-xs text-brand-fg-secondary">
                          Get notified when firmware updates are available for your targets
                        </p>
                      </div>
                      <Switch 
                        checked={notificationSettings.email_firmware_updates}
                        onCheckedChange={() => handleToggleNotification('email_firmware_updates')}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label className="text-white">Target Offline Alerts</Label>
                        <p className="text-xs text-brand-fg-secondary">
                          Receive alerts when a target goes offline
                        </p>
                      </div>
                      <Switch 
                        checked={notificationSettings.email_target_offline}
                        onCheckedChange={() => handleToggleNotification('email_target_offline')}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label className="text-white">Marketing Emails</Label>
                        <p className="text-xs text-brand-fg-secondary">
                          Receive product updates, offers, and news
                        </p>
                      </div>
                      <Switch 
                        checked={notificationSettings.email_marketing}
                        onCheckedChange={() => handleToggleNotification('email_marketing')}
                      />
                    </div>
                  </CardContent>
                </Card>
                
                <Card className="bg-brand-surface border-brand-lavender/30">
                  <CardHeader>
                    <CardTitle className="text-white">Theme</CardTitle>
                    <CardDescription className="text-brand-fg-secondary">
                      Customize the application appearance
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label className="text-white">Dark Mode</Label>
                        <p className="text-xs text-brand-fg-secondary">
                          Application is currently in dark mode by default
                        </p>
                      </div>
                      <Switch checked={true} disabled />
                    </div>
                  </CardContent>
                </Card>
                
                <Card className="bg-brand-surface border-red-900/30 border">
                  <CardHeader>
                    <CardTitle className="text-red-400">Danger Zone</CardTitle>
                    <CardDescription className="text-brand-fg-secondary">
                      These actions cannot be undone
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive">
                          Delete Account
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="bg-brand-surface border-brand-lavender/30">
                        <AlertDialogHeader>
                          <AlertDialogTitle className="text-white">Are you sure?</AlertDialogTitle>
                          <AlertDialogDescription className="text-brand-fg-secondary">
                            This will permanently delete your account and all your data. This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel className="bg-transparent border-gray-700 text-white hover:bg-gray-800">
                            Cancel
                          </AlertDialogCancel>
                          <AlertDialogAction
                            className="bg-red-500 hover:bg-red-600 text-white"
                            onClick={handleDeleteAccount}
                          >
                            Delete Account
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </CardContent>
                </Card>
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="border-2 border-brand-lavender rounded-lg p-8 mx-auto max-w-md">
                  <div className="text-brand-lavender mb-4">Not logged in</div>
                  <p className="text-brand-fg-secondary mb-6">
                    Please log in to access your settings
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

export default Settings;
