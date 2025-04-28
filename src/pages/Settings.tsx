
import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import Header from '@/components/Header';
import Sidebar from '@/components/Sidebar';
import MobileDrawer from '@/components/MobileDrawer';
import { useIsMobile } from '@/hooks/use-mobile';
import NotificationSettings from '@/components/settings/NotificationSettings';
import ThemeSettings from '@/components/settings/ThemeSettings';
import DangerZone from '@/components/settings/DangerZone';

interface NotificationSettingsType {
  email_session_invites: boolean;
  email_firmware_updates: boolean;
  email_target_offline: boolean;
  email_marketing: boolean;
}

const Settings = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  
  const [isLoading, setIsLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettingsType>({
    email_session_invites: true,
    email_firmware_updates: true,
    email_target_offline: false,
    email_marketing: false
  });

  useEffect(() => {
    async function fetchUserSettings() {
      setIsLoading(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        if (user) {
          setUserId(user.id);
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
  
  const handleToggleNotification = async (key: keyof NotificationSettingsType) => {
    if (!userId) return;
    
    const updatedSettings = {
      ...notificationSettings,
      [key]: !notificationSettings[key]
    };
    
    setNotificationSettings(updatedSettings);
    
    try {
      toast.success("Settings updated successfully");
    } catch (error) {
      console.error('Error updating notification settings:', error);
      toast.error("Failed to update settings");
      setNotificationSettings(notificationSettings);
    }
  };
  
  const handleDeleteAccount = async () => {
    try {
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
                <NotificationSettings 
                  settings={notificationSettings}
                  onToggle={handleToggleNotification}
                />
                <ThemeSettings />
                <DangerZone onDeleteAccount={handleDeleteAccount} />
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
