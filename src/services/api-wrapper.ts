/**
 * API Wrapper Service
 * Intelligently switches between real and mock data based on demo mode
 */

import { mockThingsBoardService, type MockTarget } from './mock-thingsboard';
import { mockSupabaseService, type MockRoom, type MockUserProfile, type MockGameSession, type MockRecentSession } from './mock-supabase';
import API from '@/lib/api';
import { supabaseRoomsService } from './supabase-rooms';
import { fetchUserProfileData, fetchRecentSessions } from './profile';

class ApiWrapper {
  /**
   * Get targets - switches between real ThingsBoard and mock data
   */
  async getTargets(isDemoMode: boolean): Promise<any[]> {
    if (isDemoMode) {
      console.log('🎭 DEMO MODE: Using mock targets');
      return mockThingsBoardService.getTargets();
    } else {
      console.log('🔗 LIVE MODE: Fetching real targets from ThingsBoard');
      return await API.getTargets();
    }
  }

  /**
   * Get device statuses for game flow
   */
  async getDeviceStatuses(isDemoMode: boolean): Promise<any[]> {
    if (isDemoMode) {
      console.log('🎭 DEMO MODE: Using mock device statuses');
      return mockThingsBoardService.getAllDeviceStatuses();
    } else {
      console.log('🔗 LIVE MODE: Fetching real device statuses from ThingsBoard');
      const targets = await API.getTargets();
      return targets.map((target: any) => ({
        deviceId: typeof target.id === 'string' ? target.id : (target.id as { id: string })?.id || String(target.id),
        name: target.name,
        gameStatus: 'idle',
        wifiStrength: target.status === 'online' ? 85 : 0,
        ambientLight: 'good',
        hitCount: 0,
        lastSeen: target.status === 'online' ? Date.now() : 0,
        isOnline: target.status === 'online',
        hitTimes: []
      }));
    }
  }

  /**
   * Get rooms - switches between real Supabase and mock data
   */
  async getRooms(isDemoMode: boolean): Promise<any[]> {
    if (isDemoMode) {
      console.log('🎭 DEMO MODE: Using mock rooms');
      return mockSupabaseService.getUserRooms();
    } else {
      console.log('🔗 LIVE MODE: Fetching real rooms from Supabase');
      return await supabaseRoomsService.getUserRooms();
    }
  }

  /**
   * Get room targets - switches between real Supabase and mock data
   */
  async getRoomTargets(isDemoMode: boolean, roomId: string): Promise<any[]> {
    if (isDemoMode) {
      console.log(`🎭 DEMO MODE: Using mock room targets for room ${roomId}`);
      const targetIds = mockSupabaseService.getRoomTargets(roomId);
      const allTargets = mockThingsBoardService.getTargets();
      return allTargets.filter(t => targetIds.includes(t.id));
    } else {
      console.log(`🔗 LIVE MODE: Fetching real room targets from Supabase for room ${roomId}`);
      return await supabaseRoomsService.getRoomTargets(roomId);
    }
  }

  /**
   * Assign target to room
   */
  async assignTargetToRoom(isDemoMode: boolean, targetId: string, roomId: string | null): Promise<void> {
    if (isDemoMode) {
      console.log(`🎭 DEMO MODE: Assigning target ${targetId} to room ${roomId} (mock)`);
      mockSupabaseService.assignTargetToRoom(targetId, roomId);
      mockThingsBoardService.assignTargetToRoom(targetId, roomId);
    } else {
      console.log(`🔗 LIVE MODE: Assigning target ${targetId} to room ${roomId} (real)`);
      await supabaseRoomsService.assignTargetToRoom(targetId, roomId);
    }
  }

  /**
   * Create room
   */
  async createRoom(isDemoMode: boolean, roomData: any): Promise<any> {
    if (isDemoMode) {
      console.log('🎭 DEMO MODE: Creating mock room', roomData);
      const newRoom = mockSupabaseService.createRoom(roomData);
      
      // Assign targets if provided
      if (roomData.assignedTargets && roomData.assignedTargets.length > 0) {
        for (const targetId of roomData.assignedTargets) {
          mockSupabaseService.assignTargetToRoom(targetId, newRoom.id);
          mockThingsBoardService.assignTargetToRoom(targetId, newRoom.id);
        }
      }
      
      return newRoom;
    } else {
      console.log('🔗 LIVE MODE: Creating real room in Supabase', roomData);
      return await supabaseRoomsService.createRoom(roomData);
    }
  }

  /**
   * Update room
   */
  async updateRoom(isDemoMode: boolean, roomId: string, updates: any): Promise<any> {
    if (isDemoMode) {
      console.log(`🎭 DEMO MODE: Updating mock room ${roomId}`, updates);
      return mockSupabaseService.updateRoom(roomId, updates);
    } else {
      console.log(`🔗 LIVE MODE: Updating real room ${roomId} in Supabase`, updates);
      return await supabaseRoomsService.updateRoom(roomId, updates);
    }
  }

  /**
   * Delete room
   */
  async deleteRoom(isDemoMode: boolean, roomId: string): Promise<void> {
    if (isDemoMode) {
      console.log(`🎭 DEMO MODE: Deleting mock room ${roomId}`);
      mockSupabaseService.deleteRoom(roomId);
    } else {
      console.log(`🔗 LIVE MODE: Deleting real room ${roomId} from Supabase`);
      await supabaseRoomsService.deleteRoom(roomId);
    }
  }

  /**
   * Get user profile
   */
  async getUserProfile(isDemoMode: boolean, userId: string): Promise<any> {
    if (isDemoMode) {
      console.log('🎭 DEMO MODE: Using mock user profile');
      return mockSupabaseService.getUserProfile(userId);
    } else {
      console.log('🔗 LIVE MODE: Fetching real user profile from Supabase');
      return await fetchUserProfileData(userId);
    }
  }

  /**
   * Get recent sessions for profile
   */
  async getRecentSessions(isDemoMode: boolean, userId: string, limit: number = 10): Promise<any[]> {
    if (isDemoMode) {
      console.log(`🎭 DEMO MODE: Using mock recent sessions (limit: ${limit})`);
      return mockSupabaseService.getRecentSessions(userId, limit);
    } else {
      console.log(`🔗 LIVE MODE: Fetching real recent sessions from Supabase (limit: ${limit})`);
      return await fetchRecentSessions(userId, limit);
    }
  }

  /**
   * Get dashboard stats
   */
  async getDashboardStats(isDemoMode: boolean): Promise<any> {
    if (isDemoMode) {
      console.log('🎭 DEMO MODE: Using mock dashboard stats');
      return mockSupabaseService.getDashboardStats();
    } else {
      console.log('🔗 LIVE MODE: Dashboard stats will be calculated from real data');
      // Real stats are calculated by the Dashboard component from actual data
      return null;
    }
  }

  /**
   * Get hit trend data
   */
  getHitTrend(isDemoMode: boolean): Array<{ date: string; hits: number }> {
    if (isDemoMode) {
      console.log('🎭 DEMO MODE: Using mock hit trend data');
      return mockSupabaseService.getHitTrend();
    } else {
      console.log('🔗 LIVE MODE: Hit trend will be calculated from real telemetry');
      // Real hit trend is calculated by the Dashboard from telemetry
      return [];
    }
  }

  /**
   * Store game summary
   */
  async storeGameSummary(isDemoMode: boolean, sessionData: any): Promise<string> {
    if (isDemoMode) {
      console.log('🎭 DEMO MODE: Storing mock game summary', sessionData);
      return mockSupabaseService.storeGameSummary(sessionData);
    } else {
      console.log('🔗 LIVE MODE: Storing real game summary in Supabase', sessionData);
      return await supabaseRoomsService.storeGameSummary(sessionData);
    }
  }

  /**
   * Get all targets with room assignments
   */
  async getTargetsWithAssignments(isDemoMode: boolean): Promise<any[]> {
    if (isDemoMode) {
      console.log('🎭 DEMO MODE: Getting mock targets with room assignments');
      const targets = mockThingsBoardService.getTargets();
      
      // Add room assignments to targets
      return targets.map(target => ({
        ...target,
        // roomId is already set in the mock service when assignments are made
      }));
    } else {
      console.log('🔗 LIVE MODE: Fetching real targets with room assignments');
      // This is handled by the useRooms store in live mode
      return [];
    }
  }
}

// Export singleton instance
export const apiWrapper = new ApiWrapper();

