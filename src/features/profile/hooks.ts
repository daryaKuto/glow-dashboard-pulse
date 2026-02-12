import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/components/ui/sonner';
import { supabase } from '@/data/supabase-client';
import {
  getProfileService,
  getRecentSessionsService,
  getStatsTrendService,
  updateProfileService,
  getWifiCredentialsService,
  saveWifiCredentialsService,
} from './service';
import type {
  UserProfileData,
  RecentSession,
  UpdateProfile,
  WifiCredentials,
  UpdateWifiCredentials,
} from './schema';
import type { Database } from '@/integrations/supabase/types';

type UserAnalytics = Database['public']['Tables']['user_analytics']['Row'];

/**
 * Target preferences for customization (sound, light color, etc.)
 */
export interface TargetPreferences {
  ipAddress?: string;
  customSoundUrl?: string;
  lightColor?: string;
  soundEnabled?: boolean;
  lightEnabled?: boolean;
}

/**
 * User preferences keyed by target ID
 */
export interface UserPreferences {
  [targetId: string]: TargetPreferences | undefined;
}

/**
 * React Query hooks for Profile feature
 */

// Query keys
export const profileKeys = {
  all: ['profile'] as const,
  detail: (userId: string) => [...profileKeys.all, 'detail', userId] as const,
  sessions: (userId: string, limit?: number) =>
    [...profileKeys.all, 'sessions', userId, limit] as const,
  trend: (userId: string, periodType?: string, days?: number) =>
    [...profileKeys.all, 'trend', userId, periodType, days] as const,
  wifiCredentials: (userId: string) =>
    [...profileKeys.all, 'wifi', userId] as const,
  userPreferences: () => [...profileKeys.all, 'user-preferences'] as const,
};

/**
 * Get user profile
 */
export function useProfile(userId: string | null | undefined) {
  return useQuery({
    queryKey: profileKeys.detail(userId || ''),
    queryFn: async () => {
      if (!userId) throw new Error('User ID is required');
      const result = await getProfileService(userId);
      if (!result.ok) {
        throw new Error(result.error.message);
      }
      return result.data;
    },
    enabled: !!userId,
    staleTime: 60 * 1000, // 1 minute
  });
}

/**
 * Get recent sessions
 */
export function useRecentSessions(
  userId: string | null | undefined,
  limit = 10
) {
  return useQuery({
    queryKey: profileKeys.sessions(userId || '', limit),
    queryFn: async () => {
      if (!userId) throw new Error('User ID is required');
      const result = await getRecentSessionsService(userId, limit);
      if (!result.ok) {
        throw new Error(result.error.message);
      }
      return result.data;
    },
    enabled: !!userId,
    staleTime: 30 * 1000, // 30 seconds
  });
}

/**
 * Get stats trend
 */
export function useStatsTrend(
  userId: string | null | undefined,
  periodType: 'daily' | 'weekly' | 'monthly' = 'daily',
  days = 30
) {
  return useQuery({
    queryKey: profileKeys.trend(userId || '', periodType, days),
    queryFn: async () => {
      if (!userId) throw new Error('User ID is required');
      const result = await getStatsTrendService(userId, periodType, days);
      if (!result.ok) {
        throw new Error(result.error.message);
      }
      return result.data;
    },
    enabled: !!userId,
    staleTime: 60 * 1000, // 1 minute
  });
}

/**
 * Update profile
 */
export function useUpdateProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (updates: UpdateProfile) => {
      const result = await updateProfileService(updates);
      if (!result.ok) {
        throw new Error(result.error.message);
      }
      return result.data;
    },
    onSuccess: () => {
      // Invalidate profile queries
      queryClient.invalidateQueries({ queryKey: profileKeys.all });
      toast.success('Profile updated successfully');
    },
    onError: (error: Error) => {
      toast.error(`Failed to update profile: ${error.message}`);
    },
  });
}

/**
 * Get WiFi credentials for user
 */
export function useWifiCredentials(userId: string | null | undefined) {
  return useQuery({
    queryKey: profileKeys.wifiCredentials(userId || ''),
    queryFn: async () => {
      if (!userId) throw new Error('User ID is required');
      const result = await getWifiCredentialsService(userId);
      if (!result.ok) {
        throw new Error(result.error.message);
      }
      return result.data;
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000, // 5 minutes - WiFi credentials don't change often
    retry: 1, // Only retry once for WiFi credentials
  });
}

/**
 * Update WiFi credentials
 */
export function useUpdateWifiCredentials() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, credentials }: { userId: string; credentials: UpdateWifiCredentials }) => {
      const result = await saveWifiCredentialsService(userId, credentials);
      if (!result.ok) {
        throw new Error(result.error.message);
      }
      return result.data;
    },
    onSuccess: (_data, variables) => {
      // Invalidate WiFi credentials query to refetch updated data
      queryClient.invalidateQueries({ queryKey: profileKeys.wifiCredentials(variables.userId) });
      toast.success('WiFi credentials updated successfully');
    },
    onError: (error: Error) => {
      toast.error(`Failed to update WiFi credentials: ${error.message}`);
    },
  });
}

// ============================================================================
// User Preferences Hooks
// These hooks replace the Zustand useUserPrefs store with React Query.
// ============================================================================

/**
 * Get user preferences (target customizations)
 * Replaces Zustand useUserPrefs.load()
 */
export function useUserPreferences() {
  return useQuery({
    queryKey: profileKeys.userPreferences(),
    queryFn: async () => {
      const { data: { user }, error: authError } = await supabase.auth.getUser();

      if (authError) {
        throw new Error(`Authentication error: ${authError.message}`);
      }

      if (!user) {
        throw new Error('No authenticated user found');
      }

      const { data, error } = await supabase
        .from('user_profiles')
        .select('target_preferences')
        .eq('id', user.id)
        .single();

      if (error) {
        throw new Error(`Failed to load preferences: ${error.message}`);
      }

      return (data?.target_preferences as UserPreferences) || {};
    },
    staleTime: 60 * 1000, // 1 minute
    refetchOnMount: false,
  });
}

/**
 * Save user preferences (replaces all preferences)
 * Replaces Zustand useUserPrefs.save()
 */
export function useSaveUserPreferences() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (prefs: UserPreferences) => {
      const { data: { user }, error: authError } = await supabase.auth.getUser();

      if (authError) {
        throw new Error(`Authentication error: ${authError.message}`);
      }

      if (!user) {
        throw new Error('User not authenticated');
      }

      const { error } = await supabase
        .from('user_profiles')
        .update({
          target_preferences: prefs,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);

      if (error) {
        throw new Error(`Failed to save preferences: ${error.message}`);
      }

      return prefs;
    },
    onSuccess: (savedPrefs) => {
      // Update the cache with the saved preferences
      queryClient.setQueryData(profileKeys.userPreferences(), savedPrefs);
      toast.success('Preferences saved successfully');
    },
    onError: (error: Error) => {
      toast.error(`Failed to save preferences: ${error.message}`);
    },
  });
}

/**
 * Update a single target's preference
 * This is a convenience hook that updates one target's preferences without affecting others.
 */
export function useUpdateTargetPreference() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      targetId,
      field,
      value,
    }: {
      targetId: string;
      field: keyof TargetPreferences;
      value: string | boolean;
    }) => {
      // Get current preferences from cache or fetch
      const currentPrefs = queryClient.getQueryData<UserPreferences>(profileKeys.userPreferences()) || {};

      const updatedPrefs: UserPreferences = {
        ...currentPrefs,
        [targetId]: {
          ...currentPrefs[targetId],
          [field]: value,
        },
      };

      const { data: { user }, error: authError } = await supabase.auth.getUser();

      if (authError) {
        throw new Error(`Authentication error: ${authError.message}`);
      }

      if (!user) {
        throw new Error('User not authenticated');
      }

      const { error } = await supabase
        .from('user_profiles')
        .update({
          target_preferences: updatedPrefs,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);

      if (error) {
        throw new Error(`Failed to update preference: ${error.message}`);
      }

      return updatedPrefs;
    },
    onSuccess: (savedPrefs) => {
      // Update the cache with the saved preferences
      queryClient.setQueryData(profileKeys.userPreferences(), savedPrefs);
    },
    onError: (error: Error) => {
      toast.error(`Failed to update preference: ${error.message}`);
    },
  });
}

