import { useState, useEffect, useRef } from 'react';
import { tbSupabaseSync } from '@/services/thingsboard-supabase-sync';
import { useAuth } from '@/store/useAuth';

export interface InitialSyncStatus {
  isComplete: boolean;
  isLoading: boolean;
  error: string | null;
  startTime?: number;
  syncedData: {
    targetCount: number;
    roomCount: number;
    sessionCount: number;
  } | null;
}

/**
 * Hook for ONE-TIME sync on login
 * After this completes, all data operations use ONLY Supabase
 */
export const useInitialSync = () => {
  const { user } = useAuth();
  const [syncStatus, setSyncStatus] = useState<InitialSyncStatus>({
    isComplete: false,
    isLoading: false,
    error: null,
    syncedData: null
  });
  const hasStartedSync = useRef(false);

  // Perform ONE-TIME sync immediately (don't wait for user)
  useEffect(() => {
    console.log('🔄 useInitialSync useEffect:', { 
      user: !!user, 
      isComplete: syncStatus.isComplete, 
      isLoading: syncStatus.isLoading,
      hasStartedSync: hasStartedSync.current
    });
    
    // Start sync immediately, don't wait for user, but only once
    if (!syncStatus.isComplete && !syncStatus.isLoading && !hasStartedSync.current) {
      console.log('🔄 Triggering immediate sync');
      hasStartedSync.current = true;
      performInitialSync();
    }
  }, []); // Empty dependency array to run only once

  const performInitialSync = async () => {
    console.log('🔄 Starting ONE-TIME sync on login for:', user?.email);
    
    setSyncStatus({
      isComplete: false,
      isLoading: true,
      error: null,
      startTime: Date.now(),
      syncedData: null
    });

    try {
      // Actually sync with ThingsBoard to get real target count
      console.log('🔄 Fetching real data from ThingsBoard...');
      
      const { tbSupabaseSync } = await import('@/services/thingsboard-supabase-sync');
      const result = await tbSupabaseSync.syncAllData();
      
      // Store the synced targets in the rooms service
      const { supabaseRoomsService } = await import('@/services/supabase-rooms');
      supabaseRoomsService.setSyncedTargets(result.targets);
      
      console.log('✅ Real sync completed:', {
        targets: result.targets.length,
        sessions: result.sessions.length
      });
      
      setSyncStatus({
        isComplete: true,
        isLoading: false,
        error: null,
        syncedData: {
          targetCount: result.targets.length, // Real target count from ThingsBoard
          roomCount: 0, // Will be loaded from Supabase
          sessionCount: result.sessions.length // Real session count
        }
      });

      console.log(`✅ Synced ${result.targets.length} targets from ThingsBoard`);
      
    } catch (error) {
      console.error('❌ Initial sync failed:', error);
      
      setSyncStatus({
        isComplete: false,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Sync failed',
        syncedData: null
      });

      console.log('⚠️ Failed to sync - using local data');
    }
  };

  // Manual retry for failed syncs
  const retrySync = async () => {
    if (!user) return;
    await performInitialSync();
  };

  // Ready if sync is complete, failed, or if we've been trying for more than 10 seconds
  const isReady = syncStatus.isComplete || !!syncStatus.error || (syncStatus.isLoading && syncStatus.startTime && Date.now() - syncStatus.startTime > 10000);
  
  console.log('🔄 useInitialSync status:', {
    isComplete: syncStatus.isComplete,
    isLoading: syncStatus.isLoading,
    error: syncStatus.error,
    isReady
  });

  return {
    syncStatus,
    retrySync,
    isReady // Ready when sync complete OR failed (use local data)
  };
};
