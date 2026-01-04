import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { toast } from '@/components/ui/sonner';
import {
  getTargetsWithTelemetry,
  getTargetDetailsService,
  getTargetsSummaryService,
  mergeTargetDetails,
  sendDeviceCommandService,
  setDeviceAttributesService,
  getTargetCustomNamesService,
  setTargetCustomNameService,
  removeTargetCustomNameService,
} from './service';
import type {
  Target,
  TargetDetail,
  TargetDetailsOptions,
  TargetsSummary,
} from './schema';
import type { TargetsWithSummary } from './repo';

/**
 * React Query hooks for Targets feature
 * 
 * Replaces Zustand store usage with React Query for server state management.
 */

// Query keys
export const targetsKeys = {
  all: ['targets'] as const,
  lists: () => [...targetsKeys.all, 'list'] as const,
  list: (force?: boolean) => [...targetsKeys.lists(), force] as const,
  summary: (force?: boolean) => [...targetsKeys.all, 'summary', force] as const,
  details: (deviceIds: string[], options?: TargetDetailsOptions) =>
    [...targetsKeys.all, 'details', deviceIds.sort().join(','), options] as const,
  detail: (deviceId: string) => [...targetsKeys.all, 'detail', deviceId] as const,
  customNames: () => [...targetsKeys.all, 'custom-names'] as const,
};

/**
 * Get all targets with telemetry
 */
export function useTargets(force = false) {
  return useQuery({
    queryKey: targetsKeys.list(force),
    queryFn: async () => {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/833eaf25-0547-420d-a570-1d7cab6b5873',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'targets/hooks.ts:46',message:'useTargets queryFn start',data:{force},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H4'})}).catch(()=>{});
      // #endregion
      const result = await getTargetsWithTelemetry(force);
      if (!result.ok) {
        throw new Error(result.error.message);
      }
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/833eaf25-0547-420d-a570-1d7cab6b5873',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'targets/hooks.ts:51',message:'useTargets queryFn complete',data:{force,hasData:!!result.data,targetCount:result.data?.targets?.length??0},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H4'})}).catch(()=>{});
      // #endregion
      return result.data;
    },
    staleTime: 60 * 1000, // 60 seconds - increased to reduce refetches
    refetchOnMount: false, // Don't refetch if data exists and is fresh
  });
}

/**
 * Get targets summary
 */
export function useTargetsSummary(force = false) {
  return useQuery({
    queryKey: targetsKeys.summary(force),
    queryFn: async () => {
      const result = await getTargetsSummaryService(force);
      if (!result.ok) {
        throw new Error(result.error.message);
      }
      return result.data;
    },
    staleTime: 60 * 1000, // 60 seconds - increased to reduce refetches
    refetchOnMount: false, // Don't refetch if data exists and is fresh
  });
}

/**
 * Get target details for specific devices
 */
export function useTargetDetails(
  deviceIds: string[],
  options?: TargetDetailsOptions,
  enabled = true
) {
  return useQuery({
    queryKey: targetsKeys.details(deviceIds, options),
    queryFn: async () => {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/833eaf25-0547-420d-a570-1d7cab6b5873',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'targets/hooks.ts:86',message:'useTargetDetails queryFn start',data:{deviceIdsCount:deviceIds.length,enabled},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H4,H5'})}).catch(()=>{});
      // #endregion
      const result = await getTargetDetailsService(deviceIds, options);
      if (!result.ok) {
        throw new Error(result.error.message);
      }
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/833eaf25-0547-420d-a570-1d7cab6b5873',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'targets/hooks.ts:91',message:'useTargetDetails queryFn complete',data:{deviceIdsCount:deviceIds.length,detailsCount:result.data?.length??0},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H4,H5'})}).catch(()=>{});
      // #endregion
      return result.data;
    },
    enabled: enabled && deviceIds.length > 0,
    staleTime: 30 * 1000, // 30 seconds for telemetry data - increased to reduce refetches
    refetchOnMount: false, // Don't refetch if data exists and is fresh
  });
}

/**
 * Hook that combines targets with their details
 * This replaces the Zustand pattern of fetching targets then hydrating with details
 */
export function useTargetsWithDetails(
  force = false,
  detailsOptions?: TargetDetailsOptions
) {
  const targetsQuery = useTargets(force);
  const deviceIds = targetsQuery.data?.targets.map((t) => t.id) || [];
  const detailsQuery = useTargetDetails(
    deviceIds,
    detailsOptions,
    targetsQuery.isSuccess && deviceIds.length > 0
  );

  return {
    targets: targetsQuery.data?.targets
      ? mergeTargetDetails(
          targetsQuery.data.targets,
          detailsQuery.data || []
        )
      : undefined,
    summary: targetsQuery.data?.summary,
    cached: targetsQuery.data?.cached,
    isLoading: targetsQuery.isLoading || detailsQuery.isLoading,
    isFetching: targetsQuery.isFetching || detailsQuery.isFetching,
    error: targetsQuery.error || detailsQuery.error,
    refetch: async () => {
      await Promise.all([targetsQuery.refetch(), detailsQuery.refetch()]);
    },
  };
}

/**
 * Invalidate targets queries
 */
export function useInvalidateTargets() {
  const queryClient = useQueryClient();
  
  return {
    invalidateAll: () => {
      queryClient.invalidateQueries({ queryKey: targetsKeys.all });
    },
    invalidateList: () => {
      queryClient.invalidateQueries({ queryKey: targetsKeys.lists() });
    },
    invalidateDetails: (deviceIds?: string[]) => {
      if (deviceIds) {
        deviceIds.forEach((id) => {
          queryClient.invalidateQueries({ queryKey: targetsKeys.detail(id) });
        });
      } else {
        queryClient.invalidateQueries({ queryKey: targetsKeys.all });
      }
    },
  };
}

/**
 * Send RPC command to devices
 */
export function useDeviceCommand() {
  return useMutation({
    mutationFn: async ({
      deviceIds,
      method,
      params,
    }: {
      deviceIds: string[];
      method: string;
      params?: Record<string, unknown>;
    }) => {
      const result = await sendDeviceCommandService(deviceIds, method, params);
      if (!result.ok) {
        throw new Error(result.error.message);
      }
      return result.data;
    },
    onError: (error: Error) => {
      toast.error(`Failed to send command: ${error.message}`);
    },
  });
}

/**
 * Set device attributes (for customization like sound, light color)
 */
export function useSetDeviceAttributes() {
  return useMutation({
    mutationFn: async ({
      deviceIds,
      attributes,
    }: {
      deviceIds: string[];
      attributes: Record<string, unknown>;
    }) => {
      const result = await setDeviceAttributesService(deviceIds, attributes);
      if (!result.ok) {
        throw new Error(result.error.message);
      }
      return result.data;
    },
    onSuccess: () => {
      toast.success('Device settings updated');
    },
    onError: (error: Error) => {
      toast.error(`Failed to update device: ${error.message}`);
    },
  });
}

/**
 * Get custom names for targets
 */
export function useTargetCustomNames() {
  return useQuery({
    queryKey: targetsKeys.customNames(),
    queryFn: async () => {
      const result = await getTargetCustomNamesService();
      if (!result.ok) {
        throw new Error(result.error.message);
      }
      return result.data;
    },
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Set a custom name for a target
 */
export function useSetTargetCustomName() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      targetId,
      originalName,
      customName,
    }: {
      targetId: string;
      originalName: string;
      customName: string;
    }) => {
      const result = await setTargetCustomNameService(targetId, originalName, customName);
      if (!result.ok) {
        throw new Error(result.error.message);
      }
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: targetsKeys.customNames() });
    },
  });
}

/**
 * Remove a custom name for a target
 */
export function useRemoveTargetCustomName() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ targetId }: { targetId: string }) => {
      const result = await removeTargetCustomNameService(targetId);
      if (!result.ok) {
        throw new Error(result.error.message);
      }
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: targetsKeys.customNames() });
    },
  });
}
