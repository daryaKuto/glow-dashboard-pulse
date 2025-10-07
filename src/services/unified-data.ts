/**
 * Unified Data Service
 * Handles data fetching from both Supabase and ThingsBoard for all users
 */

import thingsBoardService from './thingsboard';
import { supabaseRoomsService } from './supabase-rooms';
import { fetchUserProfileData, fetchRecentSessions } from './profile';
import { supabase } from '@/integrations/supabase/client';

export interface ThingsBoardData {
  targets: any[];
  devices: any[];
  sessions: any[];
  stats: any;
  isConnected: boolean;
  userNotFound?: boolean; // Flag to indicate user doesn't exist in ThingsBoard (401 error)
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
  // Map of user emails to their ThingsBoard passwords
  private userPasswords: Record<string, string> = {
    'andrew.tam@gmail.com': 'dryfire2025',
    'd777914w@gmail.com': 'test12345'
  };

  /**
   * Get ThingsBoard data for a user
   */
  async getThingsBoardData(userEmail: string): Promise<ThingsBoardData | null> {
    try {
      console.log(`🔗 Attempting ThingsBoard connection for: ${userEmail}`);
      
      // Get the correct password for this user
      const password = this.userPasswords[userEmail];
      if (!password) {
        console.log(`ℹ️ No ThingsBoard password configured for user: ${userEmail} - returning empty data`);
        return {
          targets: [],
          devices: [],
          sessions: [],
          stats: {},
          isConnected: false
        };
      }
      
      // Clear any existing ThingsBoard authentication to ensure clean state
      console.log(`🧹 Clearing existing ThingsBoard authentication for: ${userEmail}`);
      await thingsBoardService.logout();
      
      // Try to authenticate with ThingsBoard using user's email and password
      const auth = await thingsBoardService.login(userEmail, password);
      console.log(`✅ ThingsBoard connected for: ${userEmail}`);
      
      // Fetch all ThingsBoard data
      const [targets, devices, sessions, stats] = await Promise.all([
        this.fetchTargets(),
        this.fetchDevices(),
        this.fetchSessions(),
        this.fetchStats()
      ]);

      return {
        targets,
        devices,
        sessions,
        stats,
        isConnected: true
      };
    } catch (error: any) {
      console.log(`ℹ️ ThingsBoard connection failed for: ${userEmail} - returning empty data`, error);
      
      // Check if it's a 401 error (user not found)
      const isUserNotFound = error?.response?.status === 401 || 
                            error?.message?.includes('401') ||
                            error?.message?.includes('Unauthorized') ||
                            error?.message?.includes('user not found') ||
                            error?.message?.includes('Invalid username or password');
      
      return {
        targets: [],
        devices: [],
        sessions: [],
        stats: {},
        isConnected: false,
        userNotFound: isUserNotFound
      };
    }
  }

  /**
   * Get Supabase data for a user
   */
  async getSupabaseData(userId: string): Promise<SupabaseData> {
    try {
      console.log(`📊 Fetching Supabase data for user: ${userId}`);
      
      const [rooms, profile, recentSessions] = await Promise.all([
        this.fetchRooms(userId),
        this.fetchProfile(userId),
        this.fetchRecentSessions(userId)
      ]);

      console.log(`✅ Supabase data loaded: ${rooms.length} rooms, ${recentSessions.length} sessions`);
      
      return {
        rooms,
        profile,
        recentSessions,
        isConnected: true
      };
    } catch (error) {
      console.log(`❌ Supabase data fetch failed for user: ${userId}`, error);
      return {
        rooms: [],
        profile: null,
        recentSessions: [],
        isConnected: false
      };
    }
  }

  /**
   * Get all data for a user (both Supabase and ThingsBoard)
   */
  async getAllData(userEmail: string, userId: string): Promise<UnifiedData> {
    console.log(`🔄 Fetching unified data for user: ${userEmail} (${userId})`);
    
    const [thingsBoardData, supabaseData] = await Promise.all([
      this.getThingsBoardData(userEmail),
      this.getSupabaseData(userId)
    ]);

    return {
      supabase: supabaseData,
      thingsBoard: thingsBoardData || {
        targets: [],
        devices: [],
        sessions: [],
        stats: {},
        isConnected: false
      },
      isThingsBoardConnected: !!thingsBoardData,
      isSupabaseConnected: supabaseData.isConnected
    };
  }

  /**
   * Fetch targets from ThingsBoard
   */
  private async fetchTargets(): Promise<any[]> {
    try {
      const { thingsBoardService } = await import('@/services/thingsboard');
      const devices = await thingsBoardService.getDevices();
      
      // Filter to show legitimate target devices
      return devices.filter((device: any) => {
        const deviceName = device.name?.toLowerCase() || '';
        const deviceType = device.type?.toLowerCase() || '';
        
        // Exclude test devices and system devices
        return !deviceName.includes('test') && 
               !deviceName.includes('system') &&
               !deviceType.includes('test') &&
               device.status === 'online';
      });
    } catch (error) {
      console.error('Error fetching targets:', error);
      return [];
    }
  }

  /**
   * Fetch devices from ThingsBoard
   */
  private async fetchDevices(): Promise<any[]> {
    try {
      const { thingsBoardService } = await import('@/services/thingsboard');
      return await thingsBoardService.getDevices();
    } catch (error) {
      console.error('Error fetching devices:', error);
      return [];
    }
  }

  /**
   * Fetch sessions from ThingsBoard
   */
  private async fetchSessions(): Promise<any[]> {
    try {
      // This would need to be implemented based on your ThingsBoard session API
      return [];
    } catch (error) {
      console.error('Error fetching sessions:', error);
      return [];
    }
  }

  /**
   * Fetch stats from ThingsBoard
   */
  private async fetchStats(): Promise<any> {
    try {
      // This would need to be implemented based on your ThingsBoard stats API
      return {};
    } catch (error) {
      console.error('Error fetching stats:', error);
      return {};
    }
  }

  /**
   * Fetch rooms from Supabase
   */
  private async fetchRooms(userId: string): Promise<any[]> {
    try {
      return await supabaseRoomsService.getUserRooms();
    } catch (error) {
      console.error('Error fetching rooms:', error);
      return [];
    }
  }

  /**
   * Fetch profile from Supabase
   */
  private async fetchProfile(userId: string): Promise<any> {
    try {
      return await fetchUserProfileData(userId);
    } catch (error) {
      console.error('Error fetching profile:', error);
      return null;
    }
  }

  /**
   * Fetch recent sessions from Supabase
   */
  private async fetchRecentSessions(userId: string): Promise<any[]> {
    try {
      return await fetchRecentSessions(userId, 10);
    } catch (error) {
      console.error('Error fetching recent sessions:', error);
      return [];
    }
  }
}

// Export singleton instance
export const unifiedDataService = new UnifiedDataService();
