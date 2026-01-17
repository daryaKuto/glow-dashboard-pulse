/**
 * Unified Data Service
 * Handles data fetching from Supabase edge-powered endpoints.
 */

import { fetchDashboardMetrics, fetchTargetsWithTelemetry } from '@/lib/edge';
import { supabaseRoomsService } from './supabase-rooms';
import { fetchUserProfileData, fetchRecentSessions } from './profile';

export interface ThingsBoardData {
  targets: any[];
  devices: any[];
  sessions: any[];
  stats: any;
  isConnected: boolean;
  userNotFound?: boolean;
}

export interface SupabaseData {
  rooms: any[];
  profile: any;
  recentSessions: any[];
  isConnected: boolean;
}

export interface UnifiedData {
  supabase: SupabaseData;
  thingsBoard: ThingsBoardData;
  isThingsBoardConnected: boolean;
  isSupabaseConnected: boolean;
}

class UnifiedDataService {
  /**
   * Get ThingsBoard-derived data via edge functions.
   */
  async getThingsBoardData(_userId: string, _userEmail: string): Promise<ThingsBoardData> {
    try {
      const [targetsResult, metricsResult] = await Promise.all([
        fetchTargetsWithTelemetry(true),
        fetchDashboardMetrics(true),
      ]);

      return {
        targets: targetsResult.targets,
        devices: targetsResult.targets,
        sessions: metricsResult.metrics?.recentSessions ?? [],
        stats: metricsResult.metrics,
        isConnected: true,
      };
    } catch (error) {
      console.error('Error fetching ThingsBoard data via edge functions:', error);
      return {
        targets: [],
        devices: [],
        sessions: [],
        stats: {},
        isConnected: false,
      };
    }
  }

  /**
   * Get Supabase data for a user.
   */
  async getSupabaseData(userId: string): Promise<SupabaseData> {
    try {
      const [rooms, profile, recentSessions] = await Promise.all([
        this.fetchRooms(userId),
        this.fetchProfile(userId),
        this.fetchRecentSessions(userId),
      ]);

      return {
        rooms,
        profile,
        recentSessions,
        isConnected: true,
      };
    } catch (error) {
      console.error('Error fetching Supabase data:', error);
      return {
        rooms: [],
        profile: null,
        recentSessions: [],
        isConnected: false,
      };
    }
  }

  /**
   * Get all data for a user (both Supabase and ThingsBoard-derived).
   */
  async getAllData(userEmail: string, userId: string): Promise<UnifiedData> {
    const [thingsBoardData, supabaseData] = await Promise.all([
      this.getThingsBoardData(userId, userEmail),
      this.getSupabaseData(userId),
    ]);

    return {
      supabase: supabaseData,
      thingsBoard: thingsBoardData,
      isThingsBoardConnected: thingsBoardData.isConnected,
      isSupabaseConnected: supabaseData.isConnected,
    };
  }

  private async fetchRooms(_userId: string): Promise<any[]> {
    try {
      return await supabaseRoomsService.getUserRooms();
    } catch (error) {
      console.error('Error fetching rooms:', error);
      return [];
    }
  }

  private async fetchProfile(userId: string): Promise<any> {
    try {
      return await fetchUserProfileData(userId);
    } catch (error) {
      console.error('Error fetching profile:', error);
      return null;
    }
  }

  private async fetchRecentSessions(userId: string): Promise<any[]> {
    try {
      return await fetchRecentSessions(userId, 10);
    } catch (error) {
      console.error('Error fetching recent sessions:', error);
      return [];
    }
  }
}

export const unifiedDataService = new UnifiedDataService();
