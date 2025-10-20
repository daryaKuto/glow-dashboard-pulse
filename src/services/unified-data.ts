/**
 * Unified Data Service
 * Handles data fetching from both Supabase and ThingsBoard for all users
 */

import thingsBoardService from './thingsboard';
import { supabaseRoomsService } from './supabase-rooms';
import { fetchUserProfileData, fetchRecentSessions } from './profile';
import { supabase } from '@/integrations/supabase/client';
import { decryptPassword, hasThingsBoardCredentials } from './credentials';

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
  /**
   * Get ThingsBoard data for a user using stored credentials
   */
  async getThingsBoardData(userId: string, userEmail: string): Promise<ThingsBoardData | null> {
    try {
      console.log(`🔗 Attempting ThingsBoard connection for: ${userEmail} (${userId})`);
      
      // Fetch ThingsBoard credentials from Supabase
      const credentials = await this.getThingsBoardCredentials(userId);
      
      if (!credentials) {
        console.log(`ℹ️ No ThingsBoard credentials configured for user: ${userEmail} - returning empty data`);
        return {
          targets: [],
          devices: [],
          sessions: [],
          stats: {},
          isConnected: false
        };
      }
      
      // Check if we already have a valid ThingsBoard token
      const existingToken = localStorage.getItem('tb_access');
      if (!existingToken) {
        console.log(`🧹 No existing ThingsBoard token, will authenticate fresh for: ${userEmail}`);
        // Try to authenticate with ThingsBoard using stored credentials
        const auth = await thingsBoardService.login(credentials.email, credentials.password);
        console.log(`✅ ThingsBoard connected for: ${userEmail} using stored credentials`);
      } else {
        console.log(`🔑 Existing ThingsBoard token found, will try to use it for: ${userEmail}`);
        // Try to verify token is still valid by making a test call
        try {
          await thingsBoardService.getDevices(1, 0); // Fetch 1 device as validation
          console.log(`✅ Existing token is valid, skipping re-authentication`);
        } catch (error) {
          console.log(`🔄 Token invalid, will re-authenticate`);
          thingsBoardService.clearInvalidTokens(); // Clear invalid tokens silently
          // Try to authenticate with ThingsBoard using stored credentials
          const auth = await thingsBoardService.login(credentials.email, credentials.password);
          console.log(`✅ ThingsBoard re-authentication successful`);
        }
      }
      
      // Update last sync timestamp
      await this.updateLastSyncTime(userId);
      
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
   * Get ThingsBoard credentials from user profile
   */
  private async getThingsBoardCredentials(userId: string): Promise<{ email: string, password: string } | null> {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('thingsboard_email, thingsboard_password_encrypted')
        .eq('id', userId)
        .single();
        
      if (error) {
        console.error('Error fetching ThingsBoard credentials:', error);
        return null;
      }
      
      if (!hasThingsBoardCredentials(data.thingsboard_email, data.thingsboard_password_encrypted)) {
        console.log('No ThingsBoard credentials found for user');
        return null;
      }
      
      // Decrypt password
      const password = decryptPassword(data.thingsboard_password_encrypted);
      
      return {
        email: data.thingsboard_email,
        password: password
      };
    } catch (error) {
      console.error('Error getting ThingsBoard credentials:', error);
      return null;
    }
  }

  /**
   * Update last sync timestamp for ThingsBoard
   */
  private async updateLastSyncTime(userId: string): Promise<void> {
    try {
      await supabase
        .from('user_profiles')
        .update({ 
          thingsboard_last_sync: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);
    } catch (error) {
      console.error('Error updating last sync time:', error);
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
      this.getThingsBoardData(userId, userEmail),
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
      const devicesResponse = await thingsBoardService.getDevices(100, 0, undefined, undefined, undefined, undefined, false);
      const devices = devicesResponse.data || [];
      
      console.log('🔍 FETCH TARGETS - Raw devices from ThingsBoard:', {
        totalDevices: devices.length,
        devices: devices.map(d => ({
          name: d.name,
          type: d.type,
          status: d.status,
          id: d.id?.id || d.id
        }))
      });
      
      // Show all devices from ThingsBoard (no filtering)
      console.log('🔍 FETCH TARGETS - All devices (no filtering):', {
        totalDevices: devices.length,
        devices: devices.map(d => ({
          name: d.name,
          type: d.type,
          status: d.status,
          id: d.id?.id || d.id
        }))
      });
      
      return devices;
    } catch (error) {
      console.error('Error fetching targets:', error);
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        response: error.response?.data
      });
      return [];
    }
  }

  /**
   * Fetch devices from ThingsBoard
   */
  private async fetchDevices(): Promise<any[]> {
    try {
      const { thingsBoardService } = await import('@/services/thingsboard');
      const devicesResponse = await thingsBoardService.getDevices(100, 0, undefined, undefined, undefined, undefined, false);
      return devicesResponse.data || [];
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
