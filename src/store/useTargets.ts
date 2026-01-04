/**
 * @deprecated This store is deprecated. Use React Query hooks from @/features/targets instead.
 * 
 * Migration guide:
 * - Replace `useTargets()` with `useTargets()` from '@/features/targets'
 * - Replace `fetchTargetsFromEdge()` with `useTargets()` hook
 * - Replace `fetchTargetDetails()` with `useTargetDetails()` hook
 * - Use `useTargetsWithDetails()` for combined targets + details
 * 
 * This file will be removed in a future version.
 */

import { throttledLogOnChange } from '@/utils/log-throttle';

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
  customName?: string | null; // User-defined custom name
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
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/833eaf25-0547-420d-a570-1d7cab6b5873',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useTargets.ts:112',message:'fetchTargetsFromEdge entry',data:{force,stackTrace:new Error().stack?.split('\n').slice(1,4).join('|')},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H1'})}).catch(()=>{});
    // #endregion
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
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/833eaf25-0547-420d-a570-1d7cab6b5873',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useTargets.ts:125',message:'fetchTargetsFromEdge returning cached',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H1'})}).catch(()=>{});
      // #endregion
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
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/833eaf25-0547-420d-a570-1d7cab6b5873',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useTargets.ts:138',message:'fetchTargetsWithTelemetry start',data:{force},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H1'})}).catch(()=>{});
      // #endregion
      const { fetchTargetsWithTelemetry } = await import('@/lib/edge');
      const { targets } = await fetchTargetsWithTelemetry(force);
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/833eaf25-0547-420d-a570-1d7cab6b5873',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useTargets.ts:140',message:'fetchTargetsWithTelemetry complete',data:{targetCount:targets.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H1'})}).catch(()=>{});
      // #endregion
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
        
        // Categorize by ThingsBoard connection status
        const onlineTargets = targets.filter(t => t.status === 'online' || t.status === 'standby');
        const offlineTargets = targets.filter(t => t.status === 'offline');
        
        // Throttle log to prevent flooding
        throttledLogOnChange('targets-payload-received', 5000, '[Targets] Edge payload received', {
          edgeFunction: 'targets-with-telemetry',
          supabaseTablesQueried: ['public.user_room_targets', 'public.user_rooms', 'public.user_profiles'],
          thingsboardTelemetryAttached: true,
          fetchedAt: new Date().toISOString(),
          totalTargets: targets.length,
          statusCounts,
          thingsboardConnection: {
            online: onlineTargets.length,
            offline: offlineTargets.length,
            onlineList: onlineTargets.slice(0, 8).map(t => `${t.name} (${t.status})`).join(', '),
            offlineList: offlineTargets.length > 0 
              ? offlineTargets.slice(0, 8).map(t => `${t.name} (offline)`).join(', ')
              : 'None',
          },
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
        
        // Group targets by actual connection state
        const connectedTargets = targets.filter(t => t.status === 'online' || t.status === 'standby');
        const disconnectedTargets = targets.filter(t => t.status === 'offline');
        
        // Throttle log to prevent flooding
        throttledLogOnChange('targets-status-summary', 5000, '[Targets] Edge payload status summary', {
          edgeFunction: 'targets-with-telemetry',
          fetchedAt: new Date().toISOString(),
          totalTargets: targets.length,
          statusCounts,
          realTimeStatus: {
            connected: `${connectedTargets.length}/${targets.length} targets connected to ThingsBoard`,
            disconnected: `${disconnectedTargets.length}/${targets.length} targets offline`,
            breakdown: {
              online: statusCounts.online || 0,
              standby: statusCounts.standby || 0,
              offline: statusCounts.offline || 0,
            },
          },
          connectedTargets: connectedTargets.map(t => ({
            name: t.name,
            status: t.status,
            lastActivity: t.lastActivityTime ? new Date(t.lastActivityTime).toISOString() : 'unknown',
          })),
          disconnectedTargets: disconnectedTargets.map(t => ({
            name: t.name,
            status: 'offline',
            lastActivity: t.lastActivityTime ? new Date(t.lastActivityTime).toISOString() : 'never connected',
          })),
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
        // Throttle log to prevent flooding
        throttledLogOnChange('targets-hydrated', 5000, '[Targets] Hydrated ThingsBoard telemetry applied', {
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
