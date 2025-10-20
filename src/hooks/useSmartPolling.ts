import { useEffect, useRef, useState } from 'react';
import { useTargets } from '@/store/useTargets';
import thingsBoardService, { openTelemetryWS } from '@/services/thingsboard';

interface SmartPollingConfig {
  defaultInterval: number; // 60 seconds
  activeInterval: number;  // 30 seconds  
  heartbeatThreshold: number; // 5 minutes - consider device inactive if no activity
}

interface DeviceActivity {
  deviceId: string;
  lastActivity: number;
  isActive: boolean;
}

export const useSmartPolling = (
  onUpdate: () => Promise<void>,
  config: SmartPollingConfig = {
    defaultInterval: 60000,  // 60 seconds
    activeInterval: 30000,   // 30 seconds
    heartbeatThreshold: 300000 // 5 minutes
  }
) => {
  const [currentInterval, setCurrentInterval] = useState(config.defaultInterval);
  const [hasActiveTargets, setHasActiveTargets] = useState(false);
  const [deviceActivity, setDeviceActivity] = useState<Map<string, DeviceActivity>>(new Map());
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const { targets } = useTargets();

  // Check for recent device activity through telemetry
  const checkDeviceActivity = async (): Promise<boolean> => {
    try {
      if (!thingsBoardService.isAuthenticated()) {
        return false;
      }

      let hasRecentActivity = false;
      const currentTime = Date.now();
      const newActivityMap = new Map<string, DeviceActivity>();

      // Check each target for recent activity
      for (const target of targets) {
        try {
          // Get latest telemetry for activity indicators
          const telemetry = await thingsBoardService.getLatestTelemetry(target.id?.id || target.id, [
            'lastActivityTime', 'created_at', 'event', 'hits', 'battery'
          ]);

          // Determine last activity time from various telemetry sources
          let lastActivityTime = 0;
          
          // Check for explicit lastActivityTime
          if (telemetry.lastActivityTime && telemetry.lastActivityTime.length > 0) {
            lastActivityTime = telemetry.lastActivityTime[0].ts;
          }
          // Fallback to created_at timestamp
          else if (telemetry.created_at && telemetry.created_at.length > 0) {
            lastActivityTime = telemetry.created_at[0].ts;
          }
          // Fallback to any recent event
          else if (telemetry.event && telemetry.event.length > 0) {
            lastActivityTime = telemetry.event[0].ts;
          }
          // Fallback to hits activity
          else if (telemetry.hits && telemetry.hits.length > 0) {
            lastActivityTime = telemetry.hits[0].ts;
          }

          const timeSinceActivity = currentTime - lastActivityTime;
          const isActive = timeSinceActivity < config.heartbeatThreshold;

          newActivityMap.set(target.id, {
            deviceId: target.id,
            lastActivity: lastActivityTime,
            isActive
          });

          if (isActive) {
            hasRecentActivity = true;
            console.log(`Device ${target.name} is active - last activity: ${new Date(lastActivityTime).toISOString()}`);
          }

        } catch (error) {
          console.log(`Could not check activity for device ${target.id}:`, error);
          // Mark as inactive if we can't get telemetry
          newActivityMap.set(target.id, {
            deviceId: target.id,
            lastActivity: 0,
            isActive: false
          });
        }
      }

      setDeviceActivity(newActivityMap);
      return hasRecentActivity;

    } catch (error) {
      console.error('Error checking device activity:', error);
      return false;
    }
  };

  // Update polling interval based on activity
  const updatePollingInterval = (hasActivity: boolean) => {
    const newInterval = hasActivity ? config.activeInterval : config.defaultInterval;
    
    if (newInterval !== currentInterval) {
      setCurrentInterval(newInterval);
      setHasActiveTargets(hasActivity);
      
      console.log(`📡 Polling interval updated: ${newInterval/1000}s (${hasActivity ? 'active targets detected' : 'no recent activity'})`);
      
      // Clear existing interval and set new one
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      
      // Start new interval
      intervalRef.current = setInterval(async () => {
        await onUpdate();
        const activity = await checkDeviceActivity();
        updatePollingInterval(activity);
      }, newInterval);
    }
  };

  // Main polling effect
  useEffect(() => {
    const startPolling = async () => {
      // Initial update
      await onUpdate();
      
      // Check initial activity
      const hasActivity = await checkDeviceActivity();
      updatePollingInterval(hasActivity);
    };

    startPolling();

    // Cleanup on unmount
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [targets.length]); // Re-run when target list changes

  // WebSocket heartbeat detection (if available)
  useEffect(() => {
    const token = localStorage.getItem('tb_access');
    if (!token) return;

    try {
      const ws = openTelemetryWS(token);
      if (!ws) return;

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          // Check for any telemetry updates as heartbeat indicators
          if (data.data && Object.keys(data.data).length > 0) {
            console.log('📡 WebSocket heartbeat detected:', data);
            
            // Immediately switch to active polling
            setHasActiveTargets(true);
            updatePollingInterval(true);
          }
        } catch (error) {
          console.log('WebSocket message parsing error:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };

      return () => {
        ws.close();
      };
    } catch (error) {
      console.error('Error setting up WebSocket heartbeat detection:', error);
    }
  }, []);

  return {
    currentInterval: currentInterval / 1000, // Return in seconds for display
    hasActiveTargets,
    deviceActivity: Array.from(deviceActivity.values()),
    forceUpdate: async () => {
      await onUpdate();
      const activity = await checkDeviceActivity();
      updatePollingInterval(activity);
    }
  };
};
