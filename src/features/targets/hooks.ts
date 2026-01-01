import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getTargetsWithTelemetry,
  getTargetDetailsService,
  getTargetsSummaryService,
  mergeTargetDetails,
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
};

/**
 * Get all targets with telemetry
 */
export function useTargets(force = false) {
  return useQuery({
    queryKey: targetsKeys.list(force),
    queryFn: async () => {
      const result = await getTargetsWithTelemetry(force);
      if (!result.ok) {
        throw new Error(result.error.message);
      }
      return result.data;
    },
    staleTime: 30 * 1000, // 30 seconds
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
    staleTime: 30 * 1000,
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
      const result = await getTargetDetailsService(deviceIds, options);
      if (!result.ok) {
        throw new Error(result.error.message);
      }
      return result.data;
    },
    enabled: enabled && deviceIds.length > 0,
    staleTime: 10 * 1000, // 10 seconds for telemetry data
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

