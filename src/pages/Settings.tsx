
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
    email_target_offline: true,
  });

  const token = new URLSearchParams(location.search).get('token') || 'dummy_token';

  useEffect(() => {
    const checkUser = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          setUserId(user.id);
          // Load user settings here
        }
      } catch (error) {
        console.error('Error checking user:', error);
      } finally {
        setIsLoading(false);
      }
    };

    checkUser();
  }, []);

  const handleToggleNotification = async (key: keyof NotificationSettingsType) => {
    try {
      const newSettings = {
        ...notificationSettings,
        [key]: !notificationSettings[key]
      };
      setNotificationSettings(newSettings);
      
      // Save to database
      if (userId) {
        await supabase
          .from('user_settings')
          .upsert({
            user_id: userId,
            notification_settings: newSettings
          });
      }
      
      // toast.success('Settings updated'); // Disabled notifications
    } catch (error) {
      console.error('Error updating settings:', error);
      // toast.error('Failed to update settings'); // Disabled notifications
    }
  };

  const handleDeleteAccount = async () => {
    if (!userId) return;
    
    try {
      // Delete user data
      await supabase.auth.admin.deleteUser(userId);
      // toast.success('Account deleted successfully'); // Disabled notifications
      navigate('/');
    } catch (error) {
      console.error('Error deleting account:', error);
      // toast.error('Failed to delete account'); // Disabled notifications
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-brand-light">
      <Header />
      
      <div className="flex flex-1">
        {!isMobile && <Sidebar />}
        {isMobile && <MobileDrawer />}
        
        <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-y-auto">
          <div className="container mx-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-3xl font-heading text-brand-dark">Settings</h2>
            </div>
            
            {isLoading ? (
              <div className="text-center py-8 text-brand-dark/70 font-body">Loading settings...</div>
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
                <div className="bg-white rounded-lg p-8 mx-auto max-w-md shadow-sm border border-brand-brown/20">
                  <div className="text-brand-brown mb-4 text-xl font-heading">Not logged in</div>
                  <p className="text-brand-dark/70 mb-6 font-body">
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
