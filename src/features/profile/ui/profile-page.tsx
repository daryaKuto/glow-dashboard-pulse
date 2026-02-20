
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/shared/hooks/use-auth';
import {
  useProfile,
  useStatsTrend,
  useUpdateProfile,
  useWifiCredentials,
  useUpdateWifiCredentials,
  useUserPreferences,
  useSaveUserPreferences,
  type UserPreferences,
  type TargetPreferences,
} from '@/features/profile';
import { useGameHistory } from '@/features/games';
import { useSetDeviceAttributes } from '@/features/targets';
import { Button } from '@/components/ui/button';

import ProfileHeroCard from './ProfileHeroCard';
import ProfileStatsGrid from './ProfileStatsGrid';
import PerformanceSummaryCard from './PerformanceSummaryCard';
import WifiCredentialsCard from './WifiCredentialsCard';
import SessionHistoryList from './SessionHistoryList';

// Stable empty object to prevent useEffect infinite loop from new {} on each render
const EMPTY_PREFS: UserPreferences = {};

const PROFILE_TABS = ['Overview', 'Preferences', 'Sessions'] as const;
type ProfileTab = (typeof PROFILE_TABS)[number];

const Profile: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ProfileTab>('Overview');

  const { user: authUser } = useAuth();

  // User preferences
  const { data: prefs = EMPTY_PREFS, isLoading: prefsLoading } =
    useUserPreferences();
  const savePreferencesMutation = useSaveUserPreferences();

  // Profile hooks
  const {
    data: profileData,
    isLoading: profileLoading,
  } = useProfile(authUser?.id);
  const {
    data: gameHistoryData = [],
    isLoading: isLoadingGameHistory,
  } = useGameHistory();
  useStatsTrend(authUser?.id);
  const updateProfileMutation = useUpdateProfile();

  const isUpdating = updateProfileMutation.isPending;
  const profileError = updateProfileMutation.error?.message || null;

  // Profile update form state
  const [profileUpdateData, setProfileUpdateData] = useState({
    name: '',
    email: '',
  });

  // WiFi credentials
  const {
    data: wifiCredentialsData,
    isLoading: loadingWifi,
    refetch: refetchWifiCredentials,
  } = useWifiCredentials(authUser?.id);
  const wifiCredentials = wifiCredentialsData || { ssid: '', password: '' };
  const [wifiFormData, setWifiFormData] = useState({ ssid: '', password: '' });
  const [showWifiPassword, setShowWifiPassword] = useState(false);
  const [wifiFormError, setWifiFormError] = useState<string | null>(null);
  const updateWifiCredentialsMutation = useUpdateWifiCredentials();

  // Device attributes mutation for syncing preferences to ThingsBoard
  const setDeviceAttributesMutation = useSetDeviceAttributes();

  // Preferences form state
  const [formPrefs, setFormPrefs] = useState<UserPreferences>({});

  // Initialize form preferences when prefs are loaded
  useEffect(() => {
    setFormPrefs(prefs);
  }, [prefs]);

  // Initialize profile update form
  useEffect(() => {
    if (profileData) {
      setProfileUpdateData({
        name: profileData.name,
        email: profileData.email,
      });
    }
  }, [profileData]);

  // Initialize WiFi form when credentials are loaded
  useEffect(() => {
    if (wifiCredentials && wifiCredentials.ssid) {
      setWifiFormData((prev) => ({
        ssid: prev.ssid || wifiCredentials.ssid || '',
        password: prev.password,
      }));
    }
  }, [wifiCredentials]);

  // Handle WiFi credentials save
  const handleSaveWifiCredentials = async () => {
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
          password: wifiFormData.password,
        },
      });
      setWifiFormData((prev) => ({ ...prev, password: '' }));
      setWifiFormError(null);
    } catch (error) {
      console.error('Error saving WiFi credentials:', error);
    }
  };

  // Handle preferences save
  const handleSave = async () => {
    try {
      await savePreferencesMutation.mutateAsync(formPrefs);

      const attributeUpdates: Array<{
        targetId: string;
        attributes: Record<string, unknown>;
      }> = [];

      Object.entries(formPrefs).forEach(([targetId, cfg]) => {
        if (cfg && typeof cfg === 'object' && 'ipAddress' in cfg) {
          const targetPrefs = cfg as TargetPreferences;
          const attributes: Record<string, unknown> = {};

          if (targetPrefs.ipAddress) {
            attributes.ipAddress = targetPrefs.ipAddress;
          }
          if (targetPrefs.soundEnabled && targetPrefs.customSoundUrl) {
            attributes.customSoundUrl = targetPrefs.customSoundUrl;
            attributes.soundEnabled = true;
          } else if (targetPrefs.soundEnabled !== undefined) {
            attributes.soundEnabled = false;
          }
          if (targetPrefs.lightEnabled && targetPrefs.lightColor) {
            attributes.lightColor = targetPrefs.lightColor;
            attributes.lightEnabled = true;
          } else if (targetPrefs.lightEnabled !== undefined) {
            attributes.lightEnabled = false;
          }

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
          throw new Error(
            commandError instanceof Error
              ? commandError.message
              : `Failed to update device ${update.targetId}`
          );
        }
      }
    } catch (error) {
      console.error('Error saving preferences:', error);
    }
  };

  // Handle profile update
  const handleProfileUpdate = async () => {
    if (!profileUpdateData.name.trim()) return;
    try {
      await updateProfileMutation.mutateAsync({
        name: profileUpdateData.name.trim(),
      });
    } catch (error) {
      console.error('Error updating profile:', error);
    }
  };

  return (
    <div className="w-full px-4 py-2 md:p-4 lg:p-6 md:max-w-7xl md:mx-auto space-y-2 md:space-y-4 lg:space-y-6 responsive-transition h-full">
      {/* Profile Hero Card */}
      <ProfileHeroCard
        profileData={profileData}
        isLoading={profileLoading}
        error={profileError}
        profileUpdateData={profileUpdateData}
        onProfileUpdateDataChange={setProfileUpdateData}
        onProfileUpdate={handleProfileUpdate}
        isUpdating={isUpdating}
      />

      {/* Tab Bar */}
      <div className="flex border-b border-brand-dark/10">
        {PROFILE_TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`relative px-4 py-2 text-sm font-medium font-body transition-colors duration-200 ${
              activeTab === tab
                ? 'text-brand-primary'
                : 'text-brand-dark/40 hover:text-brand-dark/70'
            }`}
          >
            {tab}
            {activeTab === tab && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-primary rounded-full" />
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        {activeTab === 'Overview' && (
          <motion.div
            key="overview"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="space-y-2 md:space-y-4"
          >
            <ProfileStatsGrid
              profileData={profileData}
              gameHistory={gameHistoryData}
              isLoading={profileLoading}
            />
            <PerformanceSummaryCard profileData={profileData} gameHistory={gameHistoryData} />
          </motion.div>
        )}

        {activeTab === 'Preferences' && (
          <motion.div
            key="preferences"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="space-y-2 md:space-y-4"
          >
            <WifiCredentialsCard
              wifiFormData={wifiFormData}
              onWifiFormDataChange={setWifiFormData}
              wifiFormError={wifiFormError}
              onWifiFormErrorChange={setWifiFormError}
              showWifiPassword={showWifiPassword}
              onTogglePasswordVisibility={() =>
                setShowWifiPassword(!showWifiPassword)
              }
              currentSsid={wifiCredentials.ssid}
              isLoading={loadingWifi}
              isSaving={updateWifiCredentialsMutation.isPending}
              onSave={handleSaveWifiCredentials}
              onRefresh={() => refetchWifiCredentials()}
            />
            <div className="flex justify-end pt-2">
              <Button
                onClick={handleSave}
                disabled={prefsLoading}
                className="bg-brand-primary hover:bg-brand-primary/90 text-white font-body"
              >
                Save Preferences
              </Button>
            </div>
          </motion.div>
        )}

        {activeTab === 'Sessions' && (
          <motion.div
            key="sessions"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            <SessionHistoryList
              games={gameHistoryData}
              isLoading={isLoadingGameHistory}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Profile;
