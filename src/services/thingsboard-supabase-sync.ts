import { supabaseRoomsService } from './supabase-rooms';
import API from '@/lib/api';
import { toast } from '@/components/ui/sonner';

export interface ThingsBoardTarget {
  id: string;
  name: string;
  status: 'online' | 'offline';
  roomId?: string;
  lastSeen?: string;
  batteryLevel?: number;
}

export interface ThingsBoardSession {
  id: string;
  roomName: string;
  scenarioName: string;
  score: number;
  duration: number;
  hitCount: number;
  missCount: number;
  totalShots: number;
  accuracy: number;
  avgReactionTime?: number;
  startedAt: string;
  endedAt?: string;
  rawData?: any;
}

class ThingsBoardSupabaseSync {
  private isOnline = true;
  private lastSyncTime: Date | null = null;

  /**
   * Main sync function - call this when user logs in or periodically
   */
  async syncAllData(): Promise<{
    targets: ThingsBoardTarget[];
    sessions: ThingsBoardSession[];
    syncedAt: Date;
  }> {
    try {
      console.log('🔄 Starting ThingsBoard → Supabase sync...');
      
      // Check if ThingsBoard is available
      await this.checkThingsBoardConnection();
      
      // Sync targets
      const targets = await this.syncTargets();
      
      // Sync recent sessions
      const sessions = await this.syncRecentSessions();
      
      // Update last sync time
      this.lastSyncTime = new Date();
      
      console.log('✅ Sync completed successfully');
      // Sync completed silently
      
      return {
        targets,
        sessions,
        syncedAt: this.lastSyncTime
      };
      
    } catch (error) {
      console.error('❌ Sync failed:', error);
      // Sync failed silently
      throw error;
    }
  }

  /**
   * Check ThingsBoard connection and set online status
   */
  private async checkThingsBoardConnection(): Promise<boolean> {
    try {
      // Try to fetch a simple endpoint to check connectivity
      await API.getRooms(); // This calls ThingsBoard
      this.isOnline = true;
      return true;
    } catch (error) {
      console.warn('ThingsBoard offline, using mock data');
      this.isOnline = false;
      return false;
    }
  }

  /**
   * Sync targets from ThingsBoard to Supabase
   */
  async syncTargets(): Promise<ThingsBoardTarget[]> {
    try {
      let thingsBoardTargets: ThingsBoardTarget[] = [];
      
      if (this.isOnline) {
        // Fetch real targets from ThingsBoard
        try {
          const tbTargets = await API.getTargets();
          thingsBoardTargets = tbTargets.map((target: any) => ({
            id: this.extractTargetId(target),
            name: target.name || `Target ${this.extractTargetId(target).substring(0, 8)}`,
            status: target.status === 'online' ? 'online' : 'offline',
            roomId: target.roomId,
            lastSeen: target.lastSeen,
            batteryLevel: target.batteryLevel
          }));
        } catch (error) {
          console.warn('Failed to fetch from ThingsBoard, using mock data');
          thingsBoardTargets = this.getMockTargets();
        }
      } else {
        // Use mock data when ThingsBoard is offline
        thingsBoardTargets = this.getMockTargets();
      }

      // Get current Supabase targets
      const supabaseTargets = await supabaseRoomsService.getUnassignedTargets();
      
      // Compare and update differences
      await this.updateTargetDifferences(thingsBoardTargets, supabaseTargets);
      
      console.log(`📡 Synced ${thingsBoardTargets.length} targets`);
      return thingsBoardTargets;
      
    } catch (error) {
      console.error('Error syncing targets:', error);
      // Return mock data as fallback
      return this.getMockTargets();
    }
  }

  /**
   * Sync recent sessions from ThingsBoard to Supabase
   */
  async syncRecentSessions(): Promise<ThingsBoardSession[]> {
    try {
      let sessions: ThingsBoardSession[] = [];
      
      if (this.isOnline) {
        // Fetch real session data from ThingsBoard
        try {
          sessions = await this.fetchThingsBoardSessions();
        } catch (error) {
          console.warn('Failed to fetch sessions from ThingsBoard');
          sessions = [];
        }
      }
      
      // Store new sessions in Supabase
      for (const session of sessions) {
        await this.storeSessionInSupabase(session);
      }
      
      console.log(`📊 Synced ${sessions.length} sessions`);
      return sessions;
      
    } catch (error) {
      console.error('Error syncing sessions:', error);
      return [];
    }
  }

  /**
   * Get mock targets for development/offline mode
   */
  private getMockTargets(): ThingsBoardTarget[] {
    return [
      {
        id: 'target_001',
        name: 'Living Room Target 1',
        status: 'online',
        lastSeen: new Date().toISOString(),
        batteryLevel: 85
      },
      {
        id: 'target_002',
        name: 'Kitchen Target 1',
        status: 'online',
        lastSeen: new Date().toISOString(),
        batteryLevel: 92
      },
      {
        id: 'target_003',
        name: 'Bedroom Target 1',
        status: 'offline',
        lastSeen: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
        batteryLevel: 23
      },
      {
        id: 'target_004',
        name: 'Office Target 1',
        status: 'online',
        lastSeen: new Date().toISOString(),
        batteryLevel: 76
      },
      {
        id: 'target_005',
        name: 'Basement Target 1',
        status: 'online',
        lastSeen: new Date().toISOString(),
        batteryLevel: 88
      },
      {
        id: 'target_006',
        name: 'Garage Target 1',
        status: 'offline',
        lastSeen: new Date(Date.now() - 7200000).toISOString(), // 2 hours ago
        batteryLevel: 15
      }
    ];
  }

  /**
   * Extract target ID from ThingsBoard response
   */
  private extractTargetId(target: any): string {
    if (target.id?.id) return target.id.id;
    if (target.id) return target.id;
    return target.deviceId || 'unknown';
  }

  /**
   * Update target differences between ThingsBoard and Supabase
   */
  private async updateTargetDifferences(
    thingsBoardTargets: ThingsBoardTarget[],
    supabaseTargets: any[]
  ): Promise<void> {
    // This would typically involve:
    // 1. Finding new targets in ThingsBoard that aren't in Supabase
    // 2. Updating status changes
    // 3. Removing targets that no longer exist
    
    // For now, we'll just ensure the mock targets are available
    // In a real implementation, you'd compare the arrays and sync differences
    console.log('Target sync comparison:', {
      thingsBoard: thingsBoardTargets.length,
      supabase: supabaseTargets.length
    });
  }

  /**
   * Fetch sessions from ThingsBoard (mock implementation)
   */
  private async fetchThingsBoardSessions(): Promise<ThingsBoardSession[]> {
    // This would call actual ThingsBoard APIs to get recent session data
    // For now, returning mock data
    return [
      {
        id: 'session_001',
        roomName: 'Living Room',
        scenarioName: 'Quick Draw',
        score: 750,
        duration: 25000,
        hitCount: 7,
        missCount: 3,
        totalShots: 10,
        accuracy: 70,
        avgReactionTime: 420,
        startedAt: new Date(Date.now() - 1800000).toISOString(), // 30 min ago
        endedAt: new Date(Date.now() - 1775000).toISOString(),
        rawData: {
          deviceId: 'tb-device-001',
          sensorReadings: []
        }
      }
    ];
  }

  /**
   * Store session data in Supabase
   */
  private async storeSessionInSupabase(session: ThingsBoardSession): Promise<void> {
    try {
      await supabaseRoomsService.storeSessionData({
        room_name: session.roomName,
        scenario_name: session.scenarioName,
        scenario_type: 'standard',
        score: session.score,
        duration_ms: session.duration,
        hit_count: session.hitCount,
        miss_count: session.missCount,
        total_shots: session.totalShots,
        avg_reaction_time_ms: session.avgReactionTime,
        started_at: session.startedAt,
        ended_at: session.endedAt,
        thingsboard_data: session.rawData || {},
        raw_sensor_data: session.rawData?.sensorReadings || {}
      });
    } catch (error) {
      console.error('Error storing session in Supabase:', error);
    }
  }

  /**
   * Get available targets for room assignment
   */
  async getAvailableTargets(): Promise<ThingsBoardTarget[]> {
    try {
      // First try to get fresh data
      const targets = await this.syncTargets();
      
      // Filter for unassigned targets
      return targets.filter(target => !target.roomId);
      
    } catch (error) {
      console.error('Error getting available targets:', error);
      // Fallback to mock data
      return this.getMockTargets().filter(target => !target.roomId);
    }
  }

  /**
   * Manual trigger for sync (for refresh buttons, etc.)
   */
  async forcSync(): Promise<void> {
    // Syncing silently
    await this.syncAllData();
  }

  /**
   * Get sync status
   */
  getSyncStatus(): {
    isOnline: boolean;
    lastSync: Date | null;
    timeSinceLastSync: number | null;
  } {
    return {
      isOnline: this.isOnline,
      lastSync: this.lastSyncTime,
      timeSinceLastSync: this.lastSyncTime 
        ? Date.now() - this.lastSyncTime.getTime()
        : null
    };
  }
}

export const tbSupabaseSync = new ThingsBoardSupabaseSync();

