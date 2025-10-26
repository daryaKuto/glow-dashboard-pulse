import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/providers/AuthProvider';
import { fetchRoomsData, fetchTargetsWithTelemetry } from '@/lib/edge';
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
      const [targetsResult, roomsResult] = await Promise.all([
        fetchTargetsWithTelemetry(true),
        fetchRoomsData(true),
      ]);

      const targetStore = useTargets.getState();
      targetStore.setTargets(targetsResult.targets);
      if (targetsResult.targets.length > 0) {
        const deviceIds = targetsResult.targets.map((target) => target.id);
        try {
          await targetStore.fetchTargetDetails(deviceIds, {
            includeHistory: false,
            telemetryKeys: ['hit_ts', 'hits', 'event'],
            recentWindowMs: 5 * 60 * 1000,
          });
        } catch (detailError) {
          console.warn('[InitialSync] Unable to hydrate target details', detailError);
        }
      }

      const mappedRooms = roomsResult.rooms.map((room) => ({
        id: room.id,
        name: room.name,
        order: room.order,
        targetCount: room.targetCount,
        icon: room.icon ?? undefined,
        room_type: room.room_type ?? undefined,
      }));
      useRooms.getState().setRooms(mappedRooms, roomsResult.unassignedTargets ?? []);

      await useSessions.getState().fetchSessions(user.id, { includeFullHistory: true, limit: 500 });
      const sessionCount = useSessions.getState().sessions.length;

      setSyncStatus({
        isComplete: true,
        isLoading: false,
        error: null,
        syncedData: {
        targetCount: targetsResult.targets.length,
        roomCount: mappedRooms.length,
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
