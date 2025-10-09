import { useState, useEffect, useRef } from 'react';
import { tbSupabaseSync } from '@/services/thingsboard-supabase-sync';
import { useAuth } from '@/providers/AuthProvider';
import { toast } from '@/components/ui/sonner';

export interface InitialSyncStatus {
  isComplete: boolean;
  isLoading: boolean;
  error: string | null;
  startTime?: number;
  syncedData: {
    targetCount: number;
    roomCount: number;
    sessionCount: number;
    userNotFound?: boolean; // Flag for 401 error from ThingsBoard
  } | null;
}

/**
 * Hook for ONE-TIME sync on login
 * After this completes, all data operations use ONLY Supabase
 */
export const useInitialSync = () => {
  const { user, loading } = useAuth();
  const [syncStatus, setSyncStatus] = useState<InitialSyncStatus>({
    isComplete: false,
    isLoading: false,
    error: null,
    syncedData: null
  });
  
  // Use ref to track if sync has been started to prevent infinite loops
  const syncStartedRef = useRef(false);

  // Reset sync started flag when user changes
  useEffect(() => {
    syncStartedRef.current = false;
  }, [user?.id]);

  // Perform ONE-TIME sync when user is available
  useEffect(() => {
    console.log('🔄 useInitialSync useEffect:', { 
      user: user?.email, 
      isComplete: syncStatus.isComplete, 
      isLoading: syncStatus.isLoading,
      loading: loading,
      syncStarted: syncStartedRef.current
    });
    
    // Check if ThingsBoard is already authenticated
    const tbToken = localStorage.getItem('tb_access');
    if (tbToken) {
      console.log('🔄 ThingsBoard already authenticated, skipping sync');
      setSyncStatus({
        isComplete: true,
        isLoading: false,
        error: null,
        syncedData: { targetCount: 0, roomCount: 0, sessionCount: 0 }
      });
      return;
    }
    
    // Only start sync when user is available and not already syncing
    if (user && !syncStatus.isComplete && !syncStatus.isLoading && !loading && !syncStartedRef.current) {
      console.log('🔄 Triggering sync for user:', user.email);
      syncStartedRef.current = true;
      performInitialSync();
    }
  }, [user, loading]); // Removed syncStatus dependencies to prevent infinite loop

  const performInitialSync = async () => {
    if (!user) {
      console.log('🔄 No user available for sync');
      return;
    }
    
    console.log('🔄 Starting ONE-TIME sync on login for:', user.email);
    
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
      
      const { unifiedDataService } = await import('@/services/unified-data');
      const thingsBoardData = await unifiedDataService.getThingsBoardData(user.id, user.email);
      
      // Store the synced targets in the rooms service
      const { supabaseRoomsService } = await import('@/services/supabase-rooms');
      supabaseRoomsService.setSyncedTargets(thingsBoardData?.targets || []);
      
      console.log('🔍 INITIAL SYNC - Real sync completed:', {
        user: user.email,
        targets: thingsBoardData?.targets.length || 0,
        sessions: thingsBoardData?.sessions.length || 0,
        userNotFound: thingsBoardData?.userNotFound,
        isConnected: thingsBoardData?.isConnected,
        rawTargets: thingsBoardData?.targets.map(t => ({
          name: t.name,
          id: t.id?.id || t.id,
          status: t.status,
          type: t.type
        }))
      });
      
      setSyncStatus({
        isComplete: true,
        isLoading: false,
        error: null,
        syncedData: {
          targetCount: thingsBoardData?.targets.length || 0, // Real target count from ThingsBoard
          roomCount: 0, // Will be loaded from Supabase
          sessionCount: thingsBoardData?.sessions.length || 0, // Real session count
          userNotFound: thingsBoardData?.userNotFound // Flag for 401 error
        }
      });

      // Sync completed silently
      
    } catch (error) {
      console.error('❌ Initial sync failed:', error);
      
      setSyncStatus({
        isComplete: false,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Sync failed',
        syncedData: null
      });

      // Sync failed silently
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
