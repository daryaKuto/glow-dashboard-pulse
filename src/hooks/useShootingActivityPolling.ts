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
  let lastShotTime = 0;
  let totalShots = 0;

  // If no telemetry data at all, skip this target - only process real data
  if (!telemetry || Object.keys(telemetry).length === 0) {
    return;
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
    activityFlags.hasActiveShooters = true;
  } else if (isRecentlyActive) {
    activityFlags.hasRecentActivity = true;
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
  } else if (hasRecentActivity) {
    finalMode = 'recent';   // Medium polling - recent shots detected
  } else {
    finalMode = 'standby';  // Slow polling - no recent shooting activity
  }

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
        console.log('🔍 [ShootingActivity] Not authenticated, returning standby');
        return 'standby';
      }

      // Wait for targets to be loaded before checking activity
      if (targets.length === 0) {
        console.log('🔍 [ShootingActivity] No targets loaded, returning standby');
        return 'standby';
      }

      const currentTime = Date.now();
      const newActivityMap = new Map<string, TargetShootingActivity>();
      let hasActiveShooters = false;
      let hasRecentActivity = false;

      // Only check targets that are online/active
      const onlineTargets = targets.filter(target => target.status === 'online');
      
      if (onlineTargets.length === 0) {
        console.log('🔍 [ShootingActivity] No online targets, setting standby');
        setTargetActivity(new Map());
        return 'standby';
      }

      console.log(`🔍 [ShootingActivity] Checking ${onlineTargets.length} online targets for activity`);

      // Fetch telemetry for all ONLINE targets using batch API
      const deviceIds = onlineTargets.map(target => target.id?.id || target.id);
      const telemetryKeys = ['hits', 'hit_ts', 'beep_ts', 'event', 'game_name', 'gameId'];
      
      let telemetryMap: Map<string, any>;
      try {
        // Add timeout to prevent hanging
        telemetryMap = await Promise.race([
          batchTelemetry(deviceIds, telemetryKeys),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Batch telemetry timeout')), 10000)
          )
        ]) as Map<string, any>;
      } catch (error) {
        console.error('❌ [ShootingActivity] Batch telemetry failed:', error);
        // Fallback to individual requests with timeout
        const telemetryPromises = onlineTargets.map(target => 
          Promise.race([
            thingsBoardService.getLatestTelemetry(target.id?.id || target.id, telemetryKeys)
              .then(telemetry => ({ target, telemetry, error: null })),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Individual telemetry timeout')), 5000)
            )
          ]).catch(error => ({ target, telemetry: null, error }))
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
            // Skip targets with errors - only process real data from ThingsBoard
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
      console.log(`🔄 [ShootingActivity] Mode: ${currentMode} → ${mode} (${currentInterval}ms → ${newInterval}ms)`);
      setCurrentInterval(newInterval);
      setCurrentMode(mode);
      
      // Clear existing interval and set new one
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      
      // Start new interval with updated mode
      intervalRef.current = setInterval(async () => {
        // Only call onUpdate if not in standby mode or if we need to check for changes
        if (mode !== 'standby') {
          await onUpdate();
        }
        
        const newMode = await checkShootingActivity();
        updatePollingMode(newMode);
      }, newInterval);
    }
  };

  // Page Visibility API effect
  useEffect(() => {
    const handleVisibilityChange = () => {
      const isVisible = !document.hidden;
      setIsPageVisible(isVisible);
      
      if (isVisible) {
        // Resume polling when page becomes visible
        const resumePolling = async () => {
          await onUpdate();
          const mode = await checkShootingActivity();
          updatePollingMode(mode);
        };
        resumePolling();
      } else {
        // Pause polling when page is hidden
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
    const startShootingPolling = async () => {
      try {
        // Wait for targets to be loaded before starting polling
        if (targets.length === 0) {
          console.log('🔍 [ShootingActivity] No targets, skipping polling start');
          return;
        }

        // Don't start polling if page is not visible
        if (!isPageVisible) {
          console.log('🔍 [ShootingActivity] Page not visible, skipping polling start');
          return;
        }
        
        console.log('🔄 [ShootingActivity] Starting polling with timeout...');
        
        // Add timeout to prevent hanging
        await Promise.race([
          (async () => {
            // Initial update
            await onUpdate();
            
            // Check initial shooting activity
            const initialMode = await checkShootingActivity();
            updatePollingMode(initialMode);
          })(),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Shooting activity polling timeout')), 15000)
          )
        ]);
        
        console.log('✅ [ShootingActivity] Polling started successfully');
      } catch (error) {
        console.error('❌ [ShootingActivity] Failed to start polling:', error);
        // Set to standby mode on error
        updatePollingMode('standby');
      }
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
      return;
    }

    // Close existing connection if any
    if (wsRef.current && wsRef.current.readyState !== WebSocket.CLOSED) {
      wsRef.current.close();
    }

    try {
      const ws = openTelemetryWS(token);
      wsRef.current = ws;
      
      if (!ws) {
        return;
      }

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
          console.warn(`⚠️ [ShootingActivity] WebSocket message parse error:`, error);
        }
      };

      ws.onerror = (error) => {
        console.warn('WebSocket error in shooting activity polling, falling back to polling only');
      };

      ws.onclose = (event) => {
        // WebSocket closed, continuing with polling only
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
