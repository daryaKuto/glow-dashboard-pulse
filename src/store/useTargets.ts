import { create } from 'zustand';
import { clearTargetsCache } from '@/lib/api';
import { fetchTargetDetails, type TargetDetail, type TargetDetailsOptions } from '@/lib/edge';

const FETCH_DEBUG_DEFAULT = false;

const isFetchDebugEnabled = () => {
  if (typeof window === 'undefined') {
    return FETCH_DEBUG_DEFAULT;
  }

  const flag = window.localStorage?.getItem('DEBUG_TARGET_FETCH');
  if (flag === 'true') {
    return true;
  }
  if (flag === 'false') {
    return false;
  }

  return FETCH_DEBUG_DEFAULT;
};

export interface Target {
  id: string;
  name: string;
  status: 'online' | 'offline' | 'standby';
  battery?: number | null;          // Real battery or null
  wifiStrength?: number | null;     // Real WiFi or null
  roomId?: string | number | null;
  // New telemetry data from ThingsBoard
  telemetry?: Record<string, any>;
  telemetryHistory?: Record<string, any>;
  lastEvent?: string | null;
  lastGameId?: string | null;
  lastGameName?: string | null;
  lastHits?: number | null;
  lastActivity?: string | null;
  lastActivityTime?: number | null;
  lastShotTime?: number | null;
  totalShots?: number | null;
  recentShotsCount?: number;
  activityStatus?: 'active' | 'recent' | 'standby';
  gameStatus?: string | null;
  errors?: string[];
  deviceName?: string;
  deviceType?: string;
  createdTime?: number;
  additionalInfo?: Record<string, any>;
  // Properties for no data/error messages
  type?: string;
  isNoDataMessage?: boolean;
  isErrorMessage?: boolean;
  message?: string;
}

interface TargetsState {
  targets:    Target[];
  isLoading:  boolean;
  error:      Error | null;
  lastFetched: number | null;
  detailsById: Record<string, TargetDetail>;
  detailsLoading: boolean;
  detailsError: Error | null;
  refresh:    () => Promise<void>;
  fetchTargetsFromEdge: (force?: boolean) => Promise<Target[]>;
  fetchTargetDetails: (deviceIds: string[], options?: TargetDetailsOptions) => Promise<boolean>;
  setTargets: (targets: Target[]) => void;
  clearCache: () => void;
}

export const useTargets = create<TargetsState>((set, get) => ({
  targets:   [],
  isLoading: false,
  error:     null,
  lastFetched: null,
  detailsById: {},
  detailsLoading: false,
  detailsError: null,

  refresh: async () => {
    const targets = await get().fetchTargetsFromEdge(true);
    if (targets.length > 0) {
      const deviceIds = targets.map((target) => target.id);
      try {
        await get().fetchTargetDetails(deviceIds, {
          includeHistory: false,
          telemetryKeys: ['hit_ts', 'hits', 'event'],
          recentWindowMs: 5 * 60 * 1000,
        });
      } catch (error) {
        console.warn('[useTargets] Failed to hydrate targets during refresh', error);
      }
    }
    return targets;
  },

  fetchTargetsFromEdge: async (force = false) => {
    const state = get();

    const debug = isFetchDebugEnabled();
    if (debug) {
      console.info('[useTargets] fetchTargetsFromEdge invoked', {
        force,
        existingTargets: state.targets.length,
        lastFetched: state.lastFetched,
        cacheAgeMs: state.lastFetched ? Date.now() - state.lastFetched : null,
      });
    }

    if (!force && state.targets.length > 0 && state.lastFetched && Date.now() - state.lastFetched < 60_000) {
      if (debug) {
        console.info('[useTargets] fetchTargetsFromEdge returning cached targets');
      }
      return state.targets;
    }

    set({ isLoading: true, error: null });
    if (debug) {
      console.info('[useTargets] fetchTargetsFromEdge fetching fresh targets');
    }

    try {
      const { fetchTargetsWithTelemetry } = await import('@/lib/edge');
      const { targets } = await fetchTargetsWithTelemetry(force);
      set({
        targets,
        isLoading: false,
        error: null,
        lastFetched: Date.now(),
      });
      if (typeof window !== 'undefined') {
        const statusCounts = targets.reduce<Record<string, number>>((acc, target) => {
          const key = target.status ?? 'unknown';
          acc[key] = (acc[key] ?? 0) + 1;
          return acc;
        }, {});
        console.info('[Targets] Edge payload received', {
          edgeFunction: 'targets-with-telemetry',
          supabaseTablesQueried: ['public.user_room_targets', 'public.user_rooms', 'public.user_profiles'],
          thingsboardTelemetryAttached: true,
          fetchedAt: new Date().toISOString(),
          totalTargets: targets.length,
          statusCounts,
          sample: targets.slice(0, 5).map(({ id, name, status, roomName }) => ({ id, name, status, roomName })),
        });
      }
      if (debug) {
        console.info('[useTargets] fetchTargetsFromEdge fetched targets', {
          count: targets.length,
        });
      }
      if (typeof window !== 'undefined') {
        const statusCounts = targets.reduce<Record<string, number>>((acc, target) => {
          const key = target.status ?? 'unknown';
          acc[key] = (acc[key] ?? 0) + 1;
          return acc;
        }, {});
        console.info('[Targets] Edge payload status summary', {
          edgeFunction: 'targets-with-telemetry',
          fetchedAt: new Date().toISOString(),
          totalTargets: targets.length,
          statusCounts,
          sample: targets.slice(0, 5).map(({ id, name, status, roomName }) => ({ id, name, status, roomName })),
        });
      }
      return targets;
    } catch (err) {
      console.error('[useTargets] Failed to fetch targets from edge', err);
      set({ error: err as Error, isLoading: false });
      throw err;
    }
  },

  fetchTargetDetails: async (deviceIds: string[], options?: TargetDetailsOptions) => {
    if (deviceIds.length === 0) {
      // Nothing to hydrate; ensure we are not stuck in a loading state.
      set({ detailsLoading: false, detailsError: null });
      if (isFetchDebugEnabled()) {
        console.info('[useTargets] fetchTargetDetails skipped - no device IDs provided');
      }
      return false;
    }

    set({ detailsLoading: true, detailsError: null });
    if (isFetchDebugEnabled()) {
      console.info('[useTargets] fetchTargetDetails fetching details', {
        deviceIds,
        options,
      });
    }

    try {
      const { details } = await fetchTargetDetails(deviceIds, options);

      set((state) => {
        if (details.length === 0) {
          return { detailsLoading: false, detailsError: null };
        }

        const detailMap = new Map(details.map((detail) => [detail.deviceId, detail]));
        const detailsById: Record<string, TargetDetail> = { ...state.detailsById };

        const updatedTargets = state.targets.map((target) => {
          const detail = detailMap.get(target.id);
          if (!detail) {
            return target;
          }

          detailsById[target.id] = detail;

          const mergedStatus = detail.status ?? target.status;
          const mergedTelemetry = detail.telemetry && Object.keys(detail.telemetry).length > 0
            ? detail.telemetry
            : target.telemetry;

          const mergedTarget: Target = {
            ...target,
            status: mergedStatus,
            activityStatus: detail.activityStatus ?? target.activityStatus,
            lastShotTime: detail.lastShotTime ?? target.lastShotTime ?? null,
            lastActivityTime: detail.lastShotTime ?? target.lastActivityTime ?? null,
            totalShots: detail.totalShots ?? target.totalShots ?? null,
            recentShotsCount: detail.recentShotsCount ?? target.recentShotsCount ?? 0,
            telemetry: mergedTelemetry,
            telemetryHistory: detail.history ?? target.telemetryHistory,
            battery: detail.battery ?? target.battery ?? null,
            wifiStrength: detail.wifiStrength ?? target.wifiStrength ?? null,
            lastEvent: detail.lastEvent ?? target.lastEvent ?? null,
            gameStatus: detail.gameStatus ?? target.gameStatus ?? null,
            errors: detail.errors ?? target.errors,
          };

          return mergedTarget;
        });

        return {
          targets: updatedTargets,
          detailsById,
          detailsLoading: false,
          detailsError: null,
        };
      });

      if (typeof window !== 'undefined') {
        const targets = get().targets;
        const statusCounts = targets.reduce<Record<string, number>>((acc, target) => {
          const key = target.status ?? 'unknown';
          acc[key] = (acc[key] ?? 0) + 1;
          return acc;
        }, {});
        console.info('[Targets] Hydrated ThingsBoard telemetry applied', {
          edgeFunction: 'target-details',
          supabaseTablesQueried: ['public.user_room_targets', 'public.user_profiles'],
          thingsboardTelemetryApplied: true,
          hydratedAt: new Date().toISOString(),
          totalTargets: targets.length,
          statusCounts,
          sample: targets.slice(0, 5).map((target) => ({
            id: target.id,
            name: target.name,
            status: target.status,
            lastShotTime: target.lastShotTime,
            recentShots: target.recentShotsCount,
          })),
        });
      }

      if (isFetchDebugEnabled()) {
        console.info('[useTargets] fetchTargetDetails updated state', {
          devicesHydrated: deviceIds.length,
          receivedDetails: details.length,
        });
      }

      return true;
    } catch (error) {
      console.error('[useTargets] Failed to fetch target details', error);
      set((state) => ({
        detailsError: error as Error,
        detailsLoading: false,
        detailsById: state.detailsById,
      }));
      return false;
    }
  },

  setTargets: (targets: Target[]) => {
    set({ targets, isLoading: false, error: null, lastFetched: Date.now() });
  },

  clearCache: () => {
    clearTargetsCache();
    set({ lastFetched: null });
  },
}));
