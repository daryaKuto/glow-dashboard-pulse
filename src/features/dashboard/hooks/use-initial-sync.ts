/**
 * Hook for one-time data sync on login
 *
 * @migrated from src/hooks/useInitialSync.ts
 * @see src/_legacy/README.md for migration details
 *
 * Note: The following legacy hooks were deprecated during migration:
 * - useHistoricalActivity (replaced by React Query patterns)
 * - useShootingActivityPolling (replaced by React Query polling)
 * - useSmartPolling (replaced by React Query stale-while-revalidate)
 */

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/shared/hooks/use-auth';
import { useTargets } from '@/features/targets';
import { useRooms } from '@/features/rooms';
import { useSessions } from '@/state/useSessions';

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
  const targetsQuery = useTargets(false);
  const roomsQuery = useRooms(false);
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

      // Get counts from Zustand stores if available (may be empty if React Query hasn't populated yet)
      // These are for sync status reporting only
      const targetCount = targetsQuery.data?.targets.length ?? 0;
      const roomCount = roomsQuery.data?.rooms.length ?? 0;

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
