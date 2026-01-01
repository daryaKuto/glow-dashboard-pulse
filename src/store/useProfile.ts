/**
 * @deprecated This store is deprecated. Use React Query hooks from @/features/profile instead.
 * 
 * Migration guide:
 * - Replace `useProfile()` with `useProfile(userId)` from '@/features/profile'
 * - Replace `fetchSessions()` with `useRecentSessions(userId, limit)` hook
 * - Replace `fetchTrend()` with `useStatsTrend(userId, periodType, days)` hook
 * - Replace `updateProfile()` with `useUpdateProfile()` mutation hook
 * 
 * This file will be removed in a future version.
 */

import { create } from 'zustand';
import { fetchUserProfileData, fetchRecentSessions, updateUserProfile, getUserStatsTrend, type UserProfileData, type RecentSession } from '@/services/profile';
import type { Database } from '@/integrations/supabase/types';

type UserAnalytics = Database['public']['Tables']['user_analytics']['Row'];

interface ProfileState {
  // Data
  profileData: UserProfileData | null;
  recentSessions: RecentSession[];
  statsTrend: UserAnalytics[];
  
  // Loading states
  isLoading: boolean;
  isLoadingSessions: boolean;
  isLoadingTrend: boolean;
  isUpdating: boolean;
  
  // Error states
  error: string | null;
  
  // Actions
  fetchProfile: (userId: string) => Promise<void>;
  fetchSessions: (userId: string, limit?: number) => Promise<void>;
  fetchTrend: (userId: string, periodType?: 'daily' | 'weekly' | 'monthly', days?: number) => Promise<void>;
  updateProfile: (updates: { name?: string; avatarUrl?: string }) => Promise<boolean>;
  refreshAll: (userId: string) => Promise<void>;
  reset: () => void;
}

export const useProfile = create<ProfileState>((set, get) => ({
  // Initial state
  profileData: null,
  recentSessions: [],
  statsTrend: [],
  isLoading: false,
  isLoadingSessions: false,
  isLoadingTrend: false,
  isUpdating: false,
  error: null,

  // Fetch user profile data
  fetchProfile: async (userId: string) => {
    console.log('[Profile Store] Starting fetchProfile for user:', userId);
    set({ isLoading: true, error: null });
    
    try {
      const profileData = await fetchUserProfileData(userId);
      console.log('[Profile Store] Profile data received:', profileData);
      set({ profileData, isLoading: false });
    } catch (error) {
      console.error('[Profile Store] Error in fetchProfile:', error);
      set({ 
        error: error instanceof Error ? error.message : 'Failed to fetch profile data',
        isLoading: false 
      });
    }
  },

  // Fetch recent sessions
  fetchSessions: async (userId: string, limit = 10) => {
    set({ isLoadingSessions: true, error: null });
    
    try {
      const recentSessions = await fetchRecentSessions(userId, limit);
      set({ recentSessions, isLoadingSessions: false });
    } catch (error) {
      console.error('Error in fetchSessions:', error);
      set({ 
        error: error instanceof Error ? error.message : 'Failed to fetch sessions',
        isLoadingSessions: false 
      });
    }
  },

  // Fetch stats trend
  fetchTrend: async (userId: string, periodType = 'daily', days = 30) => {
    set({ isLoadingTrend: true, error: null });
    
    try {
      const statsTrend = await getUserStatsTrend(userId, periodType, days);
      set({ statsTrend, isLoadingTrend: false });
    } catch (error) {
      console.error('Error in fetchTrend:', error);
      set({ 
        error: error instanceof Error ? error.message : 'Failed to fetch stats trend',
        isLoadingTrend: false 
      });
    }
  },

  // Update user profile
  updateProfile: async (updates: { name?: string; avatarUrl?: string }) => {
    set({ isUpdating: true, error: null });
    
    try {
      const success = await updateUserProfile(updates);
      
      if (success) {
        // Update local profile data
        const currentProfile = get().profileData;
        if (currentProfile) {
          set({
            profileData: {
              ...currentProfile,
              name: updates.name || currentProfile.name,
              avatarUrl: updates.avatarUrl || currentProfile.avatarUrl,
            },
            isUpdating: false
          });
        }
      }
      
      return success;
    } catch (error) {
      console.error('Error in updateProfile:', error);
      set({ 
        error: error instanceof Error ? error.message : 'Failed to update profile',
        isUpdating: false 
      });
      return false;
    }
  },

  // Refresh all data
  refreshAll: async (userId: string) => {
    await Promise.all([
      get().fetchProfile(userId),
      get().fetchSessions(userId),
      get().fetchTrend(userId)
    ]);
  },

  // Reset state
  reset: () => {
    set({
      profileData: null,
      recentSessions: [],
      statsTrend: [],
      isLoading: false,
      isLoadingSessions: false,
      isLoadingTrend: false,
      isUpdating: false,
      error: null,
    });
  },
}));
