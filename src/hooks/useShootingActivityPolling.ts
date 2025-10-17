import { useEffect, useRef, useState, useCallback } from 'react';
import { useTargets } from '@/store/useTargets';
import thingsBoardService, { openTelemetryWS, batchTelemetry } from '@/services/thingsboard';

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

// Helper function to process individual target telemetry
async function processTargetTelemetry(
  target: any,
  telemetry: any,
  newActivityMap: Map<string, TargetShootingActivity>,
  currentTime: number,
  config: ShootingPollingConfig,
  activityFlags: { hasActiveShooters: boolean; hasRecentActivity: boolean }
) {
  console.log(`🔍 [ShootingActivity] Processing target: ${target.name} (${target.id})`);
  
  let lastShotTime = 0;
  let totalShots = 0;

  // If no telemetry data at all, mark as standby immediately
  if (!telemetry || Object.keys(telemetry).length === 0) {
    console.log(`📊 [ShootingActivity] ${target.name} - No telemetry data, marking as standby`);
    newActivityMap.set(target.id, {
      deviceId: target.id,
      lastShotTime: 0,
      totalShots: 0,
      isActivelyShooting: false,
      isRecentlyActive: false,
      isStandby: true
    });
    return;
  }

  // ONLY use hits data with actual shot counts for real shooting activity
  if (telemetry.hits && telemetry.hits.length > 0) {
    const hitsData = telemetry.hits[telemetry.hits.length - 1];
    totalShots = parseInt(hitsData.value) || 0;
    
    console.log(`📊 [ShootingActivity] ${target.name} - Hits data:`, {
      rawValue: hitsData.value,
      parsedTotalShots: totalShots,
      timestamp: hitsData.ts,
      readableTime: new Date(hitsData.ts).toISOString()
    });
    
    // Only consider it a real shot if there are actual hits recorded
    if (totalShots > 0) {
      lastShotTime = hitsData.ts;
    }
  } else {
    console.log(`📊 [ShootingActivity] ${target.name} - No hits data in telemetry`);
  }

  const timeSinceLastShot = lastShotTime > 0 ? currentTime - lastShotTime : Infinity;
  
  // Ignore future timestamps (clock sync issues)
  const isFutureTimestamp = timeSinceLastShot < 0;
  
  const isActivelyShooting = lastShotTime > 0 && !isFutureTimestamp && timeSinceLastShot < config.activeThreshold; // 30 seconds
  const isRecentlyActive = lastShotTime > 0 && !isFutureTimestamp && timeSinceLastShot >= config.activeThreshold && timeSinceLastShot < config.standbyThreshold; // 30s - 10 minutes
  const isStandby = lastShotTime === 0 || isFutureTimestamp || timeSinceLastShot >= config.standbyThreshold; // 10+ minutes

  console.log(`📊 [ShootingActivity] ${target.name} - Activity calculation:`, {
    lastShotTime,
    totalShots,
    timeSinceLastShot: timeSinceLastShot === Infinity ? 'Infinity' : `${Math.round(timeSinceLastShot / 1000)}s`,
    isFutureTimestamp,
    isActivelyShooting,
    isRecentlyActive,
    isStandby,
    thresholds: {
      active: `${config.activeThreshold / 1000}s`,
      standby: `${config.standbyThreshold / 1000}s`
    }
  });

  newActivityMap.set(target.id, {
    deviceId: target.id,
    lastShotTime,
    totalShots,
    isActivelyShooting,
    isRecentlyActive,
    isStandby
  });

  if (isActivelyShooting) {
    activityFlags.hasActiveShooters = true;
    console.log(`🎯 [ShootingActivity] ${target.name} - ACTIVELY SHOOTING!`);
  } else if (isRecentlyActive) {
    activityFlags.hasRecentActivity = true;
    console.log(`⏰ [ShootingActivity] ${target.name} - Recently active`);
  } else {
    console.log(`😴 [ShootingActivity] ${target.name} - Standby mode`);
  }
}

// Helper function to determine polling mode
function determinePollingMode(
  hasActiveShooters: boolean,
  hasRecentActivity: boolean,
  onlineTargetsCount: number,
  newActivityMap: Map<string, TargetShootingActivity>
): PollingMode {
  let finalMode: PollingMode;
  if (hasActiveShooters) {
    finalMode = 'active';   // Fast polling - someone is actively shooting
    console.log(`🎯 [ShootingActivity] Mode: ACTIVE (${onlineTargetsCount} targets checked, ${Array.from(newActivityMap.values()).filter(t => t.isActivelyShooting).length} actively shooting)`);
  } else if (hasRecentActivity) {
    finalMode = 'recent';   // Medium polling - recent shots detected
    console.log(`⏰ [ShootingActivity] Mode: RECENT (${onlineTargetsCount} targets checked, ${Array.from(newActivityMap.values()).filter(t => t.isRecentlyActive).length} recently active)`);
  } else {
    finalMode = 'standby';  // Slow polling - no recent shooting activity
    console.log(`😴 [ShootingActivity] Mode: STANDBY (${onlineTargetsCount} targets checked, all in standby)`);
  }

  // Log summary of all target activities
  console.log(`📊 [ShootingActivity] Activity summary:`, Array.from(newActivityMap.entries()).map(([id, activity]) => ({
    deviceId: id,
    totalShots: activity.totalShots,
    lastShotTime: activity.lastShotTime ? new Date(activity.lastShotTime).toISOString() : 'Never',
    status: activity.isActivelyShooting ? 'ACTIVE' : activity.isRecentlyActive ? 'RECENT' : 'STANDBY'
  })));

  return finalMode;
}

export const useShootingActivityPolling = (
  onUpdate: () => Promise<void>,
  config: ShootingPollingConfig = {
    activeInterval: 5000,      // 5 seconds during active shooting (faster for dev without WebSocket)
    recentInterval: 15000,     // 15 seconds if shot within last 30s but not active
    standbyInterval: 30000,    // 30 seconds if no shots for 10+ minutes
    activeThreshold: 30000,    // 30 seconds - active shooting threshold
    standbyThreshold: 600000   // 10 minutes - standby mode threshold
  }
) => {
  const [currentMode, setCurrentMode] = useState<PollingMode>('standby');
  const [currentInterval, setCurrentInterval] = useState(config.standbyInterval);
  const [targetActivity, setTargetActivity] = useState<Map<string, TargetShootingActivity>>(new Map());
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastShotDetected = useRef<number>(0);
  const wsRef = useRef<WebSocket | null>(null);
  const { targets } = useTargets();
  
  // Page Visibility API - pause polling when tab is not visible
  const [isPageVisible, setIsPageVisible] = useState(!document.hidden);
  const telemetryCache = useRef<Map<string, { data: any; timestamp: number }>>(new Map());

  // Check for actual shooting activity (real hits only)
  const checkShootingActivity = async (): Promise<PollingMode> => {
    try {
      if (!thingsBoardService.isAuthenticated()) {
        console.log('🔍 [ShootingActivity] Not authenticated with ThingsBoard, returning standby mode');
        return 'standby';
      }

      // Wait for targets to be loaded before checking activity
      if (targets.length === 0) {
        console.log('🔍 [ShootingActivity] No targets loaded yet, waiting... (targets.length =', targets.length, ')');
        return 'standby';
      }

      const currentTime = Date.now();
      console.log(`🔍 [ShootingActivity] Checking activity at ${new Date(currentTime).toISOString()}`);
      const newActivityMap = new Map<string, TargetShootingActivity>();
      let hasActiveShooters = false;
      let hasRecentActivity = false;

      // Only check targets that are online/active
      const onlineTargets = targets.filter(target => target.status === 'online');
      console.log(`🔍 [ShootingActivity] Checking ${onlineTargets.length} online targets out of ${targets.length} total`);
      console.log(`🔍 [ShootingActivity] Available targets:`, targets.map(t => ({ id: t.id, name: t.name, status: t.status })));
      
      if (onlineTargets.length === 0) {
        console.log('🔍 [ShootingActivity] No online targets, setting all to standby');
        setTargetActivity(new Map());
        return 'standby';
      }

      // Fetch telemetry for all ONLINE targets using batch API
      console.log(`🔍 [ShootingActivity] Fetching batch telemetry for ${onlineTargets.length} targets`);
      
      const deviceIds = onlineTargets.map(target => target.id);
      const telemetryKeys = ['hits', 'hit_ts', 'beep_ts', 'event', 'game_name', 'gameId'];
      
      let telemetryMap: Map<string, any>;
      try {
        telemetryMap = await batchTelemetry(deviceIds, telemetryKeys);
        console.log(`📊 [ShootingActivity] Batch telemetry received for ${telemetryMap.size} devices`);
      } catch (error) {
        console.error('❌ [ShootingActivity] Batch telemetry failed:', error);
        // Fallback to individual requests
        console.log('🔄 [ShootingActivity] Falling back to individual telemetry requests');
        const telemetryPromises = onlineTargets.map(target => 
          thingsBoardService.getLatestTelemetry(target.id, telemetryKeys)
            .then(telemetry => ({ target, telemetry, error: null }))
            .catch(error => ({ target, telemetry: null, error }))
        );
        const results = await Promise.allSettled(telemetryPromises);
        
        // Process individual results
        for (const result of results) {
          if (result.status === 'rejected') {
            console.error(`❌ [ShootingActivity] Promise rejected:`, result.reason);
            continue;
          }
          
          const { target, telemetry, error } = result.value;
          if (error) {
            console.error(`❌ [ShootingActivity] Error checking ${target.name}:`, error);
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
          
          // Process individual telemetry result
          await processTargetTelemetry(target, telemetry, newActivityMap, currentTime, config, { hasActiveShooters, hasRecentActivity });
        }
        
        setTargetActivity(newActivityMap);
        return determinePollingMode(hasActiveShooters, hasRecentActivity, onlineTargets.length, newActivityMap);
      }
      
      // Process batch telemetry results
      for (const target of onlineTargets) {
        const telemetry = telemetryMap.get(target.id) || {};
        await processTargetTelemetry(target, telemetry, newActivityMap, currentTime, config, { hasActiveShooters, hasRecentActivity });
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
      return determinePollingMode(hasActiveShooters, hasRecentActivity, onlineTargets.length, newActivityMap);

    } catch (error) {
      console.error('❌ [ShootingActivity] Error checking shooting activity:', error);
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
      console.log(`🔄 [ShootingActivity] Polling mode change: ${currentMode} → ${mode} (${currentInterval}ms → ${newInterval}ms)`);
      setCurrentInterval(newInterval);
      setCurrentMode(mode);
      
      // Clear existing interval and set new one
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        console.log(`🔄 [ShootingActivity] Cleared previous interval`);
      }
      
      // Start new interval with updated mode
      intervalRef.current = setInterval(async () => {
        console.log(`🔄 [ShootingActivity] Polling cycle (${mode} mode, ${newInterval}ms interval)`);
        await onUpdate();
        const newMode = await checkShootingActivity();
        updatePollingMode(newMode);
      }, newInterval);
      
      console.log(`🔄 [ShootingActivity] Started new polling interval: ${newInterval}ms`);
    } else {
      console.log(`🔄 [ShootingActivity] No polling change needed (${mode} mode, ${newInterval}ms)`);
    }
  };

  // Page Visibility API effect
  useEffect(() => {
    const handleVisibilityChange = () => {
      const isVisible = !document.hidden;
      setIsPageVisible(isVisible);
      console.log(`🔍 [ShootingActivity] Page visibility changed: ${isVisible ? 'visible' : 'hidden'}`);
      
      if (isVisible) {
        // Resume polling when page becomes visible
        console.log('🔄 [ShootingActivity] Resuming polling - page is now visible');
        const resumePolling = async () => {
          await onUpdate();
          const mode = await checkShootingActivity();
          updatePollingMode(mode);
        };
        resumePolling();
      } else {
        // Pause polling when page is hidden
        console.log('⏸️ [ShootingActivity] Pausing polling - page is now hidden');
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [onUpdate, checkShootingActivity, updatePollingMode]);

  // Main polling effect - wait for targets to be loaded
  useEffect(() => {
    console.log('🔍 [ShootingActivity] useEffect triggered, targets.length =', targets.length);
    const startShootingPolling = async () => {
      // Wait for targets to be loaded before starting polling
      if (targets.length === 0) {
        console.log('🔍 [ShootingActivity] Waiting for targets to be loaded...');
        return;
      }

      // Don't start polling if page is not visible
      if (!isPageVisible) {
        console.log('🔍 [ShootingActivity] Page not visible, skipping polling start');
        return;
      }

      console.log(`🔍 [ShootingActivity] Starting polling with ${targets.length} targets available`);
      
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
  }, [targets.length, isPageVisible]); // Re-run when target list changes or page visibility changes

  // WebSocket shot detection (immediate response to shots)
  useEffect(() => {
    const token = localStorage.getItem('tb_access');
    if (!token) {
      console.log('No ThingsBoard token available for WebSocket, relying on polling only');
      return;
    }

    // Close existing connection if any
    if (wsRef.current && wsRef.current.readyState !== WebSocket.CLOSED) {
      console.log('Closing existing WebSocket before creating new one');
      wsRef.current.close();
    }

    try {
      const ws = openTelemetryWS(token);
      wsRef.current = ws;
      
      if (!ws) {
        console.log('WebSocket creation failed, relying on polling only');
        return;
      }

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log(`🔌 [ShootingActivity] WebSocket message received:`, data);
          
          // Check for shot-related telemetry updates
          if (data.data && (
            data.data.hits || 
            data.data.hit_ts || 
            data.data.beep_ts ||
            (data.data.event && data.data.event.includes('hit'))
          )) {
            console.log(`🎯 [ShootingActivity] WebSocket detected shot activity:`, {
              hits: data.data.hits,
              hit_ts: data.data.hit_ts,
              beep_ts: data.data.beep_ts,
              event: data.data.event,
              timestamp: new Date().toISOString()
            });
            
            lastShotDetected.current = Date.now();
            
            // Immediately switch to active mode
            console.log(`🔄 [ShootingActivity] WebSocket triggering immediate switch to ACTIVE mode`);
            updatePollingMode('active');
          }
        } catch (error) {
          console.warn(`⚠️ [ShootingActivity] WebSocket message parse error:`, error);
        }
      };

      ws.onerror = (error) => {
        console.warn('WebSocket error in shooting activity polling, falling back to polling only');
      };

      ws.onclose = (event) => {
        console.log('WebSocket closed in shooting activity polling, continuing with polling only');
      };

      return () => {
        if (wsRef.current && wsRef.current.readyState !== WebSocket.CLOSED) {
          wsRef.current.close();
          wsRef.current = null;
        }
      };
    } catch (error) {
      console.warn('WebSocket setup failed in shooting activity polling, using polling only:', error);
    }
  }, []); // Keep empty dependency array to only create once

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
