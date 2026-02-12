
import React from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '@/components/shared/Header';
import Sidebar from '@/components/shared/Sidebar';
import MobileDrawer from '@/components/shared/MobileDrawer';
import { useIsMobile } from '@/shared/hooks/use-mobile';
import NotificationSettings from '@/features/settings/ui/NotificationSettings';
import ThemeSettings from '@/features/settings/ui/ThemeSettings';
import PasswordSettings from '@/features/settings/ui/PasswordSettings';
import DangerZone from '@/features/settings/ui/DangerZone';
import { useAuth } from '@/shared/hooks/use-auth';
import {
  useNotificationSettings,
  useToggleNotificationSetting,
  useDeleteAccount,
  type NotificationSettings as NotificationSettingsType,
} from '@/features/settings';

const Settings = () => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();


  // Get user from auth context
  const { user, loading: authLoading } = useAuth();
  const userId = user?.id ?? null;

  // Use feature hooks for data fetching
  const {
    data: notificationSettings,
    isLoading: settingsLoading,
  } = useNotificationSettings(userId);

  const toggleNotificationMutation = useToggleNotificationSetting();
  const deleteAccountMutation = useDeleteAccount();

  const isLoading = authLoading || settingsLoading;

  const handleToggleNotification = async (key: keyof NotificationSettingsType) => {
    if (!userId || !notificationSettings) return;

    try {
      await toggleNotificationMutation.mutateAsync({
        userId,
        currentSettings: notificationSettings,
        key,
      });
    } catch (error) {
      console.error('Error updating settings:', error);
    }
  };

  const handleDeleteAccount = async () => {
    if (!userId) return;

    try {
      await deleteAccountMutation.mutateAsync(userId);
      navigate('/');
    } catch (error) {
      console.error('Error deleting account:', error);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-brand-light pt-[116px] lg:pt-16">
      <Header />
      {isMobile && <MobileDrawer />}

      {!isMobile && <Sidebar />}
      <div className="flex flex-1 lg:pl-64">
        <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-y-auto">
          <div className="container mx-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-h1 font-heading text-brand-dark">Settings</h2>
            </div>

            {isLoading ? (
              <div className="text-center py-8 text-brand-dark/70 font-body">Loading settings...</div>
            ) : userId && notificationSettings ? (
              <div className="space-y-6">
                <PasswordSettings />
                <NotificationSettings
                  settings={notificationSettings}
                  onToggle={handleToggleNotification}
                />
                <ThemeSettings />
                <DangerZone onDeleteAccount={handleDeleteAccount} />
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="bg-white rounded-lg p-8 mx-auto max-w-md shadow-sm border border-gray-200">
                  <div className="text-brand-primary mb-4 text-h3 font-heading">Not logged in</div>
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
