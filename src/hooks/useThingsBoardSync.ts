import { useState, useEffect, useCallback } from 'react';
import { tbSupabaseSync } from '@/services/thingsboard-supabase-sync';
import { useAuth } from '@/store/useAuth';

export interface SyncStatus {
  isLoading: boolean;
  isOnline: boolean;
  lastSync: Date | null;
  error: string | null;
  targetCount: number;
  sessionCount: number;
}

export const useThingsBoardSync = () => {
  const { user } = useAuth();
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    isLoading: false,
    isOnline: false,
    lastSync: null,
    error: null,
    targetCount: 0,
    sessionCount: 0
  });

  // Auto-sync when user logs in
  useEffect(() => {
    if (user && !syncStatus.lastSync) {
      performInitialSync();
    }
  }, [user?.id]); // Only depend on user ID to prevent infinite loops

  // Perform initial sync on login
  const performInitialSync = useCallback(async () => {
    if (!user) return;

    setSyncStatus(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      console.log('🔄 Performing initial ThingsBoard sync for user:', user.email);
      
      const result = await tbSupabaseSync.syncAllData();
      
      setSyncStatus({
        isLoading: false,
        isOnline: true,
        lastSync: result.syncedAt,
        error: null,
        targetCount: result.targets.length,
        sessionCount: result.sessions.length
      });

      console.log('✅ Initial sync completed:', result);
      
    } catch (error) {
      console.error('❌ Initial sync failed:', error);
      
      setSyncStatus(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Sync failed'
      }));
    }
  }, [user]);

  // Manual sync trigger (for refresh buttons)
  const forceSync = useCallback(async () => {
    if (!user) return;

    setSyncStatus(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const result = await tbSupabaseSync.syncAllData();
      
      setSyncStatus({
        isLoading: false,
        isOnline: true,
        lastSync: result.syncedAt,
        error: null,
        targetCount: result.targets.length,
        sessionCount: result.sessions.length
      });

      return result;
      
    } catch (error) {
      setSyncStatus(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Sync failed'
      }));
      throw error;
    }
  }, [user]);

  // Get current sync status
  const getCurrentStatus = useCallback(() => {
    const status = tbSupabaseSync.getSyncStatus();
    return {
      ...syncStatus,
      isOnline: status.isOnline,
      lastSync: status.lastSync,
      timeSinceLastSync: status.timeSinceLastSync
    };
  }, [syncStatus]);

  // Periodic sync (every 5 minutes when online)
  useEffect(() => {
    if (!user || !syncStatus.isOnline) return;

    const interval = setInterval(async () => {
      try {
        console.log('🔄 Performing periodic sync...');
        await tbSupabaseSync.syncAllData();
        
        setSyncStatus(prev => ({
          ...prev,
          lastSync: new Date(),
          error: null
        }));
        
      } catch (error) {
        console.warn('⚠️ Periodic sync failed:', error);
        // Don't update error state for periodic sync failures
      }
    }, 5 * 60 * 1000); // 5 minutes

    return () => clearInterval(interval);
  }, [user, syncStatus.isOnline]);

  return {
    syncStatus: getCurrentStatus(),
    forceSync,
    performInitialSync,
    isLoading: syncStatus.isLoading
  };
};




