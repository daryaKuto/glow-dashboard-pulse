import { useEffect, useRef, useState, useCallback } from 'react';
import { useTargets } from '@/store/useTargets';
import thingsBoardService, { openTelemetryWS } from '@/services/thingsboard';

interface ShootingPollingConfig {
  activeInterval: number;    // 10 seconds during active shooting
  recentInterval: number;    // 30 seconds if shot within last 30s but not active
  standbyInterval: number;   // 60 seconds if no shots for 10+ minutes
  activeThreshold: number;   // 30 seconds - active shooting threshold
  standbyThreshold: number;  // 10 minutes - standby mode threshold
}

export interface TargetShootingActivity {
  deviceId: string;
  lastShotTime: number;
  totalShots: number;
  isActivelyShooting: boolean;
  isRecentlyActive: boolean;
  isStandby: boolean;
}

type PollingMode = 'active' | 'recent' | 'standby';

export const useShootingActivityPolling = (
  onUpdate: () => Promise<void>,
  config: ShootingPollingConfig = {
    activeInterval: 10000,     // 10 seconds during active shooting
    recentInterval: 30000,     // 30 seconds if shot within last 30s but not active
    standbyInterval: 60000,    // 60 seconds if no shots for 10+ minutes
    activeThreshold: 30000,    // 30 seconds - active shooting threshold
    standbyThreshold: 600000   // 10 minutes - standby mode threshold
  }
) => {
  const [currentMode, setCurrentMode] = useState<PollingMode>('standby');
  const [currentInterval, setCurrentInterval] = useState(config.standbyInterval);
  const [targetActivity, setTargetActivity] = useState<Map<string, TargetShootingActivity>>(new Map());
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastShotDetected = useRef<number>(0);
  const { targets } = useTargets();

  // Check for actual shooting activity (real hits only)
  const checkShootingActivity = async (): Promise<PollingMode> => {
    try {
      if (!thingsBoardService.isAuthenticated()) {
        return 'standby';
      }

      const currentTime = Date.now();
      const newActivityMap = new Map<string, TargetShootingActivity>();
      let hasActiveShooters = false;
      let hasRecentActivity = false;

      // Only check targets that are online/active
      const onlineTargets = targets.filter(target => target.status === 'online');
      
      if (onlineTargets.length === 0) {
        setTargetActivity(new Map());
        return 'standby';
      }

      // Check each ONLINE target for real shooting activity
      for (const target of onlineTargets) {
        try {
          // Get telemetry specifically for hit detection
          const telemetry = await thingsBoardService.getLatestTelemetry(target.id, [
            'hits', 'hit_ts', 'beep_ts', 'event', 'game_name', 'gameId'
          ]);

          let lastShotTime = 0;
          let totalShots = 0;

          // If no telemetry data at all, mark as standby immediately
          if (!telemetry || Object.keys(telemetry).length === 0) {
            newActivityMap.set(target.id, {
              deviceId: target.id,
              lastShotTime: 0,
              totalShots: 0,
              isActivelyShooting: false,
              isRecentlyActive: false,
              isStandby: true
            });
            continue;
          }

          // ONLY use hits data with actual shot counts for real shooting activity
          if (telemetry.hits && telemetry.hits.length > 0) {
            const hitsData = telemetry.hits[telemetry.hits.length - 1];
            totalShots = parseInt(hitsData.value) || 0;
            
            // Only consider it a real shot if there are actual hits recorded
            if (totalShots > 0) {
              lastShotTime = hitsData.ts;
            }
          }

          const timeSinceLastShot = lastShotTime > 0 ? currentTime - lastShotTime : Infinity;
          
          // Ignore future timestamps (clock sync issues)
          const isFutureTimestamp = timeSinceLastShot < 0;
          
          const isActivelyShooting = lastShotTime > 0 && !isFutureTimestamp && timeSinceLastShot < config.activeThreshold; // 30 seconds
          const isRecentlyActive = lastShotTime > 0 && !isFutureTimestamp && timeSinceLastShot >= config.activeThreshold && timeSinceLastShot < config.standbyThreshold; // 30s - 10 minutes
          const isStandby = lastShotTime === 0 || isFutureTimestamp || timeSinceLastShot >= config.standbyThreshold; // 10+ minutes

          newActivityMap.set(target.id, {
            deviceId: target.id,
            lastShotTime,
            totalShots,
            isActivelyShooting,
            isRecentlyActive,
            isStandby
          });

          if (isActivelyShooting) {
            hasActiveShooters = true;
            lastShotDetected.current = currentTime;
          } else if (isRecentlyActive) {
            hasRecentActivity = true;
          }

        } catch (error) {
          // Mark as standby if we can't get telemetry
          newActivityMap.set(target.id, {
            deviceId: target.id,
            lastShotTime: 0,
            totalShots: 0,
            isActivelyShooting: false,
            isRecentlyActive: false,
            isStandby: true
          });
        }
      }

      // Mark all offline targets as standby without checking telemetry
      const offlineTargets = targets.filter(target => target.status === 'offline');
      for (const target of offlineTargets) {
        newActivityMap.set(target.id, {
          deviceId: target.id,
          lastShotTime: 0,
          totalShots: 0,
          isActivelyShooting: false,
          isRecentlyActive: false,
          isStandby: true
        });
      }

      setTargetActivity(newActivityMap);

      // Determine polling mode based on real shooting activity
      if (hasActiveShooters) {
        return 'active';   // Fast polling - someone is actively shooting
      } else if (hasRecentActivity) {
        return 'recent';   // Medium polling - recent shots detected
      } else {
        return 'standby';  // Slow polling - no recent shooting activity
      }

    } catch (error) {
      console.error('Error checking shooting activity:', error);
      return 'standby';
    }
  };

  // Update polling interval based on shooting activity
  const updatePollingMode = (mode: PollingMode) => {
    let newInterval: number;
    
    switch (mode) {
      case 'active':
        newInterval = config.activeInterval;   // 10 seconds
        break;
      case 'recent':
        newInterval = config.recentInterval;   // 30 seconds
        break;
      case 'standby':
        newInterval = config.standbyInterval;  // 60 seconds
        break;
      default:
        newInterval = config.standbyInterval;
    }
    
    if (newInterval !== currentInterval || mode !== currentMode) {
      setCurrentInterval(newInterval);
      setCurrentMode(mode);
      
      // Clear existing interval and set new one
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      
      // Start new interval with updated mode
      intervalRef.current = setInterval(async () => {
        await onUpdate();
        const newMode = await checkShootingActivity();
        updatePollingMode(newMode);
      }, newInterval);
    }
  };

  // Main polling effect
  useEffect(() => {
    const startShootingPolling = async () => {
      // Initial update
      await onUpdate();
      
      // Check initial shooting activity
      const initialMode = await checkShootingActivity();
      updatePollingMode(initialMode);
    };

    startShootingPolling();

    // Cleanup on unmount
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [targets.length]); // Re-run when target list changes

  // WebSocket shot detection (immediate response to shots)
  useEffect(() => {
    const token = localStorage.getItem('tb_access');
    if (!token) return;

    try {
      const ws = openTelemetryWS(token);
      if (!ws) return;

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          // Check for shot-related telemetry updates
          if (data.data && (
            data.data.hits || 
            data.data.hit_ts || 
            data.data.beep_ts ||
            (data.data.event && data.data.event.includes('hit'))
          )) {
            lastShotDetected.current = Date.now();
            
            // Immediately switch to active mode
            updatePollingMode('active');
          }
        } catch (error) {
          // Silent error handling for WebSocket messages
        }
      };

      ws.onerror = (error) => {
        // Silent error handling for WebSocket
      };

      return () => {
        ws.close();
      };
    } catch (error) {
      // Silent error handling for WebSocket setup
    }
  }, []);

  return {
    currentInterval: currentInterval / 1000, // Return in seconds for display
    currentMode,
    hasActiveShooters: currentMode === 'active',
    hasRecentActivity: currentMode === 'recent',
    isStandbyMode: currentMode === 'standby',
    targetActivity: Array.from(targetActivity.values()),
    activeShotsCount: Array.from(targetActivity.values()).filter(t => t.isActivelyShooting).length,
    recentShotsCount: Array.from(targetActivity.values()).filter(t => t.isRecentlyActive).length,
    forceUpdate: async () => {
      await onUpdate();
      const mode = await checkShootingActivity();
      updatePollingMode(mode);
    }
  };
};
