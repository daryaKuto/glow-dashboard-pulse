/**
 * API Wrapper Service
 * API Wrapper - Demo mode removed, all methods use live ThingsBoard/Supabase data
 */

import API from '@/lib/api';
import { supabaseRoomsService } from './supabase-rooms';
import { fetchUserProfileData, fetchRecentSessions } from './profile';

class ApiWrapper {
  /**
   * Get targets - uses live ThingsBoard data
   */
  async getTargets(): Promise<any[]> {
    console.log('🔗 LIVE MODE: Fetching real targets from ThingsBoard');
    return await API.getTargets();
  }

  /**
   * Get device statuses for game flow
   */
  async getDeviceStatuses(): Promise<any[]> {
    console.log('🔗 LIVE MODE: Fetching real device statuses from ThingsBoard');
    const targets = await API.getTargets();
    return targets.map((target: any) => ({
      deviceId: typeof target.id === 'string' ? target.id : (target.id as { id: string })?.id || String(target.id),
      name: target.name,
      gameStatus: 'idle',
      wifiStrength: (target.status === 'online' || target.status === 'standby') ? 85 : 0,
      ambientLight: 'good',
      hitCount: 0,
      lastSeen: (target.status === 'online' || target.status === 'standby') ? Date.now() : 0,
      isOnline: target.status === 'online' || target.status === 'standby',
      hitTimes: []
    }));
  }

  /**
   * Get rooms - uses live Supabase data
   */
  async getRooms(): Promise<any[]> {
    console.log('🔗 LIVE MODE: Fetching real rooms from Supabase');
    return await supabaseRoomsService.getUserRooms();
  }

  /**
   * Get room targets - uses live Supabase data
   */
  async getRoomTargets(roomId: string): Promise<any[]> {
    console.log(`🔗 LIVE MODE: Fetching real room targets from Supabase for room ${roomId}`);
    return await supabaseRoomsService.getRoomTargets(roomId);
  }

  /**
   * Assign target to room
   */
  async assignTargetToRoom(targetId: string, roomId: string | null): Promise<void> {
    console.log(`🔗 LIVE MODE: Assigning target ${targetId} to room ${roomId} (real)`);
    await supabaseRoomsService.assignTargetToRoom(targetId, roomId);
  }

  /**
   * Create room
   */
  async createRoom(roomData: any): Promise<any> {
    console.log('🔗 LIVE MODE: Creating real room in Supabase', roomData);
    return await supabaseRoomsService.createRoom(roomData);
  }

  /**
   * Update room
   */
  async updateRoom(roomId: string, updates: any): Promise<any> {
    console.log(`🔗 LIVE MODE: Updating real room ${roomId} in Supabase`, updates);
    return await supabaseRoomsService.updateRoom(roomId, updates);
  }

  /**
   * Delete room
   */
  async deleteRoom(roomId: string): Promise<void> {
    console.log(`🔗 LIVE MODE: Deleting real room ${roomId} from Supabase`);
    await supabaseRoomsService.deleteRoom(roomId);
  }

  /**
   * Get user profile
   */
  async getUserProfile(userId: string): Promise<any> {
    console.log('🔗 LIVE MODE: Fetching real user profile from Supabase');
    return await fetchUserProfileData(userId);
  }

  /**
   * Get recent sessions for profile
   */
  async getRecentSessions(userId: string, limit: number = 10): Promise<any[]> {
    console.log(`🔗 LIVE MODE: Fetching real recent sessions from Supabase (limit: ${limit})`);
    return await fetchRecentSessions(userId, limit);
  }

  /**
   * Get dashboard stats
   */
  async getDashboardStats(): Promise<any> {
    console.log('🔗 LIVE MODE: Dashboard stats will be calculated from real data');
    // Real stats are calculated by the Dashboard component from actual data
    return null;
  }

  /**
   * Get hit trend data
   */
  getHitTrend(): Array<{ date: string; hits: number }> {
    console.log('🔗 LIVE MODE: Hit trend will be calculated from real telemetry');
    // Real hit trend is calculated by the Dashboard from telemetry
    return [];
  }

  /**
   * Store game summary
   */
  async storeGameSummary(sessionData: any): Promise<string> {
    console.log('🔗 LIVE MODE: Storing real game summary in Supabase', sessionData);
    return await supabaseRoomsService.storeGameSummary(sessionData);
  }

  /**
   * Get all targets with room assignments
   */
  async getTargetsWithAssignments(): Promise<any[]> {
    console.log('🔗 LIVE MODE: Fetching real targets with room assignments');
    // This is handled by the useRooms store in live mode
    return [];
  }
}

// Export singleton instance
export const apiWrapper = new ApiWrapper();
