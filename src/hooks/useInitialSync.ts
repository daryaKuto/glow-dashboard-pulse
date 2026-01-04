import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/providers/AuthProvider';
import { useTargets } from '@/store/useTargets';
import { useRooms } from '@/store/useRooms';
import { useSessions } from '@/store/useSessions';

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
    
    setSyncStatus({
      isComplete: false,
      isLoading: true,
      error: null,
      startTime: Date.now(),
      syncedData: null
    });

    try {
      // React Query hooks (useRooms, useTargets) handle fetching rooms and targets
      // We only need to sync sessions here to populate Zustand store
      // This prevents duplicate edge function calls (H3, H4 fixes)
      // Note: Zustand stores for rooms/targets are legacy and React Query handles the data
      
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/833eaf25-0547-420d-a570-1d7cab6b5873',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useInitialSync.ts:57',message:'useInitialSync - skipping targets/rooms fetch (handled by React Query)',data:{userId:user.id},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'H3,H4'})}).catch(()=>{});
      // #endregion
      
      // Get counts from Zustand stores if available (may be empty if React Query hasn't populated yet)
      // These are for sync status reporting only
      const targetCount = useTargets.getState().targets?.length ?? 0;
      const roomCount = useRooms.getState().rooms?.length ?? 0;

      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/833eaf25-0547-420d-a570-1d7cab6b5873',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useInitialSync.ts:70',message:'fetchSessions call from useInitialSync',data:{userId:user.id,limit:100},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'H1'})}).catch(()=>{});
      // #endregion
      await useSessions.getState().fetchSessions(user.id, { includeFullHistory: true, limit: 100 }); // API maximum is 100
      const sessionCount = useSessions.getState().sessions.length;

      setSyncStatus({
        isComplete: true,
        isLoading: false,
        error: null,
        syncedData: {
        targetCount,
        roomCount,
        sessionCount,
        userNotFound: undefined,
      },
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
    if (!user || loading || syncStatus.isComplete || syncStatus.isLoading) {
      return;
    }

    if (syncStartedRef.current) {
      return;
    }

    const now = Date.now();
    const timeSinceLastSync = now - lastSyncTimeRef.current;
    if (timeSinceLastSync < SYNC_COOLDOWN_MS) {
      return;
    }

    syncStartedRef.current = true;
    lastSyncTimeRef.current = now;

    performInitialSync().catch((error) => {
      console.warn('Background sync failed:', error);
    });
  }, [user, loading, syncStatus.isComplete, syncStatus.isLoading]);

  // Manual retry for failed syncs
  const retrySync = async () => {
    if (!user) return;
    await performInitialSync();
  };

  // Ready after sync completes or fails
  const isReady =
    syncStatus.isComplete ||
    !!syncStatus.error ||
    (syncStatus.isLoading && syncStatus.startTime && Date.now() - syncStatus.startTime > 5000);

  return {
    syncStatus,
    retrySync,
    isReady // Ready when sync complete OR failed (use local data)
  };
};
