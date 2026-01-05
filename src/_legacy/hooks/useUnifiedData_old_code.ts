/**
 * React hook for unified data fetching
 */

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './useAuth';
import { unifiedDataService, type UnifiedData } from '@/features/profile/lib/unified-data';

export const useUnifiedData = () => {
  const { user } = useAuth();
  const [data, setData] = useState<UnifiedData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!user) {
      setData(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      console.log(`🔄 Fetching unified data for user: ${user.email}`);
      const unifiedData = await unifiedDataService.getAllData(user.email!, user.id);
      setData(unifiedData);
      console.log(`✅ Unified data loaded:`, {
        thingsBoardConnected: unifiedData.isThingsBoardConnected,
        supabaseConnected: unifiedData.isSupabaseConnected,
        targetsCount: unifiedData.thingsBoard.targets.length,
        roomsCount: unifiedData.supabase.rooms.length
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch data';
      console.error('❌ Error fetching unified data:', errorMessage);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const refresh = useCallback(() => {
    fetchData();
  }, [fetchData]);

  return {
    data,
    loading,
    error,
    refresh,
    isThingsBoardConnected: data?.isThingsBoardConnected || false,
    isSupabaseConnected: data?.isSupabaseConnected || false
  };
};
