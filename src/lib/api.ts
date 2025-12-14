import dualAuthService, { type DualAuthResult } from '@/services/dual-auth';
import { supabase } from '@/integrations/supabase/client';
import type { GameTemplate } from '@/types/game';
import type { Target } from '@/store/useTargets';
import {
  fetchDashboardMetrics,
  fetchRoomsData,
  fetchTargetsSummary,
  fetchTargetsWithTelemetry,
  type DashboardMetricsData,
  type EdgeRoom,
  type TargetsSummary,
} from '@/lib/edge';
import { supabaseRoomsService, type CreateRoomData, type UserRoom } from '@/services/supabase-rooms';
import { supabaseRoomLayoutsService } from '@/services/supabase-room-layouts';
import type { RoomLayoutResponse, RoomLayoutData } from '@/lib/types';

const TARGETS_KEY = 'targets';
const ROOMS_KEY = 'rooms';

const pendingRequests = new Map<string, Promise<unknown>>();
let latestTargetsSummary: TargetsSummary | null = null;
let latestRoomsSnapshot: EdgeRoom[] | null = null;
let latestUnassigned: Target[] | null = null;
let latestDashboardMetrics: DashboardMetricsData | null = null;
let latestDashboardMetricsCached = false;

function deduplicateRequest<T>(key: string, requestFn: () => Promise<T>): Promise<T> {
  if (pendingRequests.has(key)) {
    return pendingRequests.get(key) as Promise<T>;
  }

  const promise = requestFn().finally(() => {
    pendingRequests.delete(key);
  });

  pendingRequests.set(key, promise);
  return promise;
}

function loadTargets(force: boolean): Promise<{ targets: Target[]; summary: TargetsSummary | null; cached: boolean }> {
  if (force) {
    pendingRequests.delete(TARGETS_KEY);
    return fetchTargetsWithTelemetry(true);
  }
  return deduplicateRequest(TARGETS_KEY, () => fetchTargetsWithTelemetry(false));
}

function loadRooms(force: boolean): Promise<{ rooms: EdgeRoom[]; unassignedTargets: Target[]; cached: boolean }> {
  if (force) {
    pendingRequests.delete(ROOMS_KEY);
    return fetchRoomsData(true);
  }
  return deduplicateRequest(ROOMS_KEY, () => fetchRoomsData(false));
}

export function clearCache(pattern?: string): void {
  if (!pattern) {
    pendingRequests.clear();
    return;
  }

  for (const key of Array.from(pendingRequests.keys())) {
    if (key.includes(pattern)) {
      pendingRequests.delete(key);
    }
  }
}

export function clearTargetsCache(): void {
  latestTargetsSummary = null;
  clearCache(TARGETS_KEY);
}

supabaseRoomsService.setTargetsInvalidationHandler(clearTargetsCache);

async function invalidateRoomsCache(): Promise<void> {
  latestRoomsSnapshot = null;
  latestUnassigned = null;
  clearCache(ROOMS_KEY);
  await loadRooms(true).catch((error) => {
    console.warn('[API] Room cache refresh failed', error);
  });
}

export const API = {
  async signIn(email: string, password: string): Promise<DualAuthResult> {
    return dualAuthService.signIn(email, password);
  },

  async signOut(): Promise<void> {
    await dualAuthService.signOut();
  },

  async getTargets(options?: { force?: boolean }): Promise<Target[]> {
    const { targets, summary } = await loadTargets(options?.force ?? false);
    latestTargetsSummary = summary;
    return targets;
  },

  async getTargetsWithTelemetry(options?: { force?: boolean }): Promise<{ targets: Target[]; summary: TargetsSummary | null; cached: boolean }> {
    const result = await loadTargets(options?.force ?? false);
    latestTargetsSummary = result.summary;
    return result;
  },

  async getTargetsSummary(options?: { force?: boolean }): Promise<TargetsSummary | null> {
    if (!options?.force && latestTargetsSummary) {
      return latestTargetsSummary;
    }

    const { summary } = await fetchTargetsSummary(options?.force ?? false);
    latestTargetsSummary = summary;
    return summary;
  },

  async getRooms(options?: { force?: boolean }): Promise<EdgeRoom[]> {
    const { rooms, unassignedTargets } = await loadRooms(options?.force ?? false);
    latestRoomsSnapshot = rooms;
    latestUnassigned = unassignedTargets;
    return rooms;
  },

  async getRoomsWithTargets(options?: { force?: boolean }): Promise<{ rooms: EdgeRoom[]; unassignedTargets: Target[]; cached: boolean }> {
    const result = await loadRooms(options?.force ?? false);
    latestRoomsSnapshot = result.rooms;
    latestUnassigned = result.unassignedTargets;
    return result;
  },

  async getRoomTargets(roomId: string): Promise<Target[]> {
    const rooms = latestRoomsSnapshot ?? (await this.getRooms());
    const room = rooms.find((entry) => entry.id === roomId);
    if (room?.targets) {
      return room.targets;
    }

    return supabaseRoomsService.getRoomTargets(roomId);
  },

  async createRoom(roomData: CreateRoomData): Promise<UserRoom> {
    const room = await supabaseRoomsService.createRoom(roomData);
    await invalidateRoomsCache();
    return room;
  },

  async updateRoom(roomId: string, updates: Partial<CreateRoomData>): Promise<UserRoom> {
    const updated = await supabaseRoomsService.updateRoom(roomId, updates);
    await invalidateRoomsCache();
    return updated;
  },

  async deleteRoom(roomId: string): Promise<void> {
    await supabaseRoomsService.deleteRoom(roomId);
    await invalidateRoomsCache();
  },

  async updateRoomOrder(roomOrders: { id: string; order_index: number }[]): Promise<void> {
    await supabaseRoomsService.updateRoomOrder(roomOrders);
    await invalidateRoomsCache();
  },

  async assignTargetToRoom(targetId: string, roomId: string | null, targetName?: string): Promise<void> {
    await supabaseRoomsService.assignTargetToRoom(targetId, roomId, targetName);
    clearTargetsCache();
    await invalidateRoomsCache();
  },

  async unassignTargets(targetIds: string[]): Promise<void> {
    await supabaseRoomsService.unassignTargets(targetIds);
    clearTargetsCache();
    await invalidateRoomsCache();
  },

  async getUnassignedTargets(options?: { force?: boolean }): Promise<Target[]> {
    if (!options?.force && latestUnassigned) {
      return latestUnassigned;
    }

    const { unassignedTargets } = await loadRooms(options?.force ?? false);
    latestUnassigned = unassignedTargets;
    return unassignedTargets;
  },

  async getDashboardMetrics(options?: { force?: boolean }): Promise<{ metrics: DashboardMetricsData | null; cached: boolean; source?: string }> {
    if (!options?.force && latestDashboardMetrics) {
      return { metrics: latestDashboardMetrics, cached: latestDashboardMetricsCached };
    }

    const { metrics, cached, source } = await fetchDashboardMetrics(options?.force ?? false);
    latestDashboardMetrics = metrics;
    latestDashboardMetricsCached = cached;
    return { metrics, cached, source };
  },

  /**
   * Get room layout including target positions and floor plan
   */
  async getRoomLayout(roomId: string): Promise<RoomLayoutResponse> {
    try {
      return await supabaseRoomLayoutsService.loadRoomLayout(roomId);
    } catch (error) {
      console.error('Error loading room layout:', error);
      throw error;
    }
  },

  /**
   * Save room layout including target positions and floor plan
   */
  async saveRoomLayout(
    roomId: string,
    targets: Array<{ id: string; x: number; y: number }>,
    groups: Array<{ id: string; name: string; targetIds: string[] }>,
    floorPlan?: RoomLayoutData
  ): Promise<void> {
    try {
      await supabaseRoomLayoutsService.saveRoomLayout(roomId, targets, groups, floorPlan);
    } catch (error) {
      console.error('Error saving room layout:', error);
      throw error;
    }
  },

  async createGroup(_roomId: string, _groupData: any) {
    throw new Error('Group creation not implemented yet');
  },

  async updateGroup(_roomId: number, _groupData: any) {
    throw new Error('Group updates not implemented yet');
  },

  async deleteGroup(_roomId: string, _groupData: any) {
    throw new Error('Group deletion not implemented yet');
  },

  async listScenarios(): Promise<GameTemplate[]> {
    const { data, error } = await supabase
      .from('games')
      .select(
        `
          id,
          slug,
          name,
          description,
          category,
          difficulty,
          target_count,
          shots_per_target,
          time_limit_ms,
          is_active,
          is_public,
          thingsboard_config,
          rules,
          created_at,
          updated_at
        `
      )
      .eq('is_active', true)
      .eq('is_public', true)
      .order('created_at', { ascending: true });

    if (error) {
      throw new Error(error.message ?? 'Failed to load game templates');
    }

    return (data ?? []).map((game) => {
      const thingsboardConfig =
        game.thingsboard_config && typeof game.thingsboard_config === 'object' && !Array.isArray(game.thingsboard_config)
          ? (game.thingsboard_config as Record<string, unknown>)
          : null;
      const rules =
        game.rules && typeof game.rules === 'object' && !Array.isArray(game.rules)
          ? (game.rules as Record<string, unknown>)
          : null;

      return {
        id: game.id,
        slug: game.slug,
        name: game.name,
        description: game.description,
        category: game.category,
        difficulty: game.difficulty,
        targetCount: game.target_count ?? 0,
        shotsPerTarget: game.shots_per_target ?? 0,
        timeLimitMs: game.time_limit_ms ?? 0,
        isActive: game.is_active ?? false,
        isPublic: game.is_public ?? false,
        thingsboardConfig,
        rules,
        createdAt: game.created_at ?? null,
        updatedAt: game.updated_at ?? null,
      } satisfies GameTemplate;
    });
  },
};

export default API;
