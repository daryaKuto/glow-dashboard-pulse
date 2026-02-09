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
 *
 * Migration Note (Phase 1A):
 * - Sessions are now handled by useDashboardSessions React Query hook
 * - No need to manually sync sessions via Zustand store
 * - This hook now primarily tracks when initial data fetch is complete
 */

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/shared/hooks/use-auth';
import { useTargets } from '@/features/targets';
import { useRooms } from '@/features/rooms';
import { useDashboardSessions } from '@/features/dashboard';

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
 *
 * Note: Now that all data is fetched via React Query, this hook primarily
 * serves to track when the initial data load is complete for UI feedback.
 */
export const useInitialSync = () => {
  const { user, loading } = useAuth();
  const targetsQuery = useTargets(false);
  const roomsQuery = useRooms(false);
  // Use React Query hook for sessions (replaces Zustand useSessions)
  const sessionsQuery = useDashboardSessions(user?.id, 100);

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

  // Track when all React Query hooks have completed their initial fetch
  useEffect(() => {
    if (!user || loading) {
      return;
    }

    // Check if all queries have completed (success or error)
    const targetsComplete = !targetsQuery.isLoading && (targetsQuery.isSuccess || targetsQuery.isError);
    const roomsComplete = !roomsQuery.isLoading && (roomsQuery.isSuccess || roomsQuery.isError);
    const sessionsComplete = !sessionsQuery.isLoading && (sessionsQuery.isSuccess || sessionsQuery.isError);

    const allComplete = targetsComplete && roomsComplete && sessionsComplete;
    const anyLoading = targetsQuery.isLoading || roomsQuery.isLoading || sessionsQuery.isLoading;

    if (anyLoading && !syncStatus.isLoading) {
      setSyncStatus(prev => ({
        ...prev,
        isLoading: true,
        startTime: Date.now(),
      }));
    }

    if (allComplete && !syncStatus.isComplete) {
      // Collect any errors
      const errors = [
        targetsQuery.error?.message,
        roomsQuery.error?.message,
        sessionsQuery.error?.message,
      ].filter(Boolean);

      setSyncStatus({
        isComplete: true,
        isLoading: false,
        error: errors.length > 0 ? errors.join('; ') : null,
        syncedData: {
          targetCount: targetsQuery.data?.targets.length ?? 0,
          roomCount: roomsQuery.data?.rooms.length ?? 0,
          sessionCount: sessionsQuery.data?.length ?? 0,
          userNotFound: undefined,
        },
      });
    }
  }, [
    user,
    loading,
    targetsQuery.isLoading,
    targetsQuery.isSuccess,
    targetsQuery.isError,
    targetsQuery.data,
    targetsQuery.error,
    roomsQuery.isLoading,
    roomsQuery.isSuccess,
    roomsQuery.isError,
    roomsQuery.data,
    roomsQuery.error,
    sessionsQuery.isLoading,
    sessionsQuery.isSuccess,
    sessionsQuery.isError,
    sessionsQuery.data,
    sessionsQuery.error,
    syncStatus.isComplete,
    syncStatus.isLoading,
  ]);

  // Manual retry for failed syncs - refetch all queries
  const retrySync = async () => {
    if (!user) return;
    setSyncStatus({
      isComplete: false,
      isLoading: true,
      error: null,
      startTime: Date.now(),
      syncedData: null,
    });
    await Promise.all([
      targetsQuery.refetch(),
      roomsQuery.refetch(),
      sessionsQuery.refetch(),
    ]);
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
