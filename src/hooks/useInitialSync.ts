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
  const lastSyncTimeRef = useRef(0);
  const SYNC_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes cooldown between syncs

  // Reset sync started flag when user changes
  useEffect(() => {
    syncStartedRef.current = false;
  }, [user?.id]);

  const performInitialSync = async () => {
    if (!user) {
      return;
    }
    
    // Check if we already have fresh data from a recent sync
    const tbToken = localStorage.getItem('tb_access');
    if (tbToken && syncStatus.syncedData && syncStatus.syncedData.targetCount > 0) {
      return;
    }
    
    setSyncStatus({
      isComplete: false,
      isLoading: true,
      error: null,
      startTime: Date.now(),
      syncedData: null
    });

    try {
      // Actually sync with ThingsBoard to get real target count
      const { unifiedDataService } = await import('@/services/unified-data');
      const thingsBoardData = await unifiedDataService.getThingsBoardData(user.id, user.email);
      
      // Store the synced targets in the rooms service
      const { supabaseRoomsService } = await import('@/services/supabase-rooms');
      supabaseRoomsService.setSyncedTargets(thingsBoardData?.targets || []);
      
      // NEW: Populate Zustand stores after sync completes
      const { useTargets } = await import('@/store/useTargets');
      const { useRooms } = await import('@/store/useRooms');
      const { useSessions } = await import('@/store/useSessions');
      const { fetchRecentSessions } = await import('@/services/profile');
      
      // Store targets in Zustand WITH room assignments from Supabase
      const targetsWithAssignments = await supabaseRoomsService.getAllTargetsWithAssignments(true);
      useTargets.getState().setTargets(targetsWithAssignments);
      
      // Fetch and store rooms
      const rooms = await supabaseRoomsService.getRoomsWithTargetCounts();
      const transformedRooms = rooms.map(room => ({
        id: room.id,
        name: room.name,
        order: room.order_index,
        targetCount: room.target_count || 0,
        icon: room.icon,
        room_type: room.room_type
      }));
      useRooms.getState().setRooms(transformedRooms);
      
      // Fetch and store sessions
      const sessions = await fetchRecentSessions(user.id, 10);
      useSessions.getState().setSessions(sessions);
      
      setSyncStatus({
        isComplete: true,
        isLoading: false,
        error: null,
        syncedData: {
          targetCount: thingsBoardData?.targets.length || 0, // Real target count from ThingsBoard
          roomCount: transformedRooms.length, // Real room count from Supabase
          sessionCount: sessions.length, // Real session count from Supabase
          userNotFound: thingsBoardData?.userNotFound // Flag for 401 error
        }
      });
      
    } catch (error) {
      console.error('❌ Initial sync failed:', error);
      
      setSyncStatus({
        isComplete: false,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Sync failed',
        syncedData: null
      });
    }
  };

  // Perform ONE-TIME sync when user is available - NON-BLOCKING
  useEffect(() => {
    // Check if ThingsBoard is already authenticated
    const tbToken = localStorage.getItem('tb_access');
    if (tbToken) {
      // Verify token is still valid by testing it asynchronously
      const verifyToken = async () => {
        try {
          const { thingsBoardService } = await import('@/services/thingsboard');
          await thingsBoardService.getDevices(1, 0); // Test call
          
          // Token is valid, but we still need to perform the full sync to populate stores
          console.log('✅ Existing token is valid, performing full sync...');
          await performInitialSync();
        } catch (error) {
          // Token is invalid, will trigger re-authentication below
          console.log('🔄 Token invalid, will re-authenticate');
          await performInitialSync();
        }
      };
      
      verifyToken();
      return;
    }
    
    // Only start sync when user is available and not already syncing
    if (user && !syncStatus.isComplete && !syncStatus.isLoading && !loading && !syncStartedRef.current) {
      // Check if we've synced recently to avoid redundant calls
      const now = Date.now();
      const timeSinceLastSync = now - lastSyncTimeRef.current;
      
      if (timeSinceLastSync < SYNC_COOLDOWN_MS) {
        return;
      }
      
      syncStartedRef.current = true;
      lastSyncTimeRef.current = now;
      // Don't await - let sync run in background
      performInitialSync().catch(error => {
        console.warn('Background sync failed:', error);
      });
    }
  }, [user, loading]); // Removed syncStatus dependencies to prevent infinite loop

  // Manual retry for failed syncs
  const retrySync = async () => {
    if (!user) return;
    await performInitialSync();
  };

  // Ready immediately if ThingsBoard token exists, otherwise after sync completes or fails
  const tbToken = localStorage.getItem('tb_access');
  const isReady = !!tbToken || syncStatus.isComplete || !!syncStatus.error || (syncStatus.isLoading && syncStatus.startTime && Date.now() - syncStatus.startTime > 5000);

  return {
    syncStatus,
    retrySync,
    isReady // Ready when sync complete OR failed (use local data)
  };
};
