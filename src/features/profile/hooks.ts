import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/components/ui/sonner';
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

