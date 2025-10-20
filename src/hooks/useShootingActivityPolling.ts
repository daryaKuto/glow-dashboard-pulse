import { useEffect, useRef, useState, useCallback } from 'react';
import { useTargets } from '@/store/useTargets';
import thingsBoardService, { openTelemetryWS } from '@/services/thingsboard';
import { fetchShootingActivity } from '@/lib/edge';

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

const DEFAULT_POLLING_CONFIG: ShootingPollingConfig = {
  activeInterval: 5000,
  recentInterval: 15000,
  standbyInterval: 30000,
  activeThreshold: 30000,
  standbyThreshold: 600000,
};

type ActivityFlags = {
  hasActiveShooters: boolean;
  hasRecentActivity: boolean;
};

const TELEMETRY_KEYS = ['hits', 'hit_ts', 'beep_ts', 'event', 'game_name', 'gameId'];

function processTargetTelemetry(
  target: any,
  telemetry: any,
  newActivityMap: Map<string, TargetShootingActivity>,
  currentTime: number,
  thresholds: Pick<ShootingPollingConfig, 'activeThreshold' | 'standbyThreshold'>,
  activityFlags: ActivityFlags
) {
  if (!telemetry || Object.keys(telemetry).length === 0) {
    return;
  }

  let lastShotTime = 0;
  let totalShots = 0;

  if (Array.isArray(telemetry.hits) && telemetry.hits.length > 0) {
    const hitsData = telemetry.hits[telemetry.hits.length - 1];
    totalShots = parseInt(hitsData.value, 10) || 0;
    if (totalShots > 0) {
      lastShotTime = hitsData.ts;
    }
  }

  const timeSinceLastShot = lastShotTime > 0 ? currentTime - lastShotTime : Number.POSITIVE_INFINITY;
  const isFutureTimestamp = timeSinceLastShot < 0;

  const isActivelyShooting =
    lastShotTime > 0 && !isFutureTimestamp && timeSinceLastShot < thresholds.activeThreshold;
  const isRecentlyActive =
    lastShotTime > 0 &&
    !isFutureTimestamp &&
    timeSinceLastShot >= thresholds.activeThreshold &&
    timeSinceLastShot < thresholds.standbyThreshold;
  const isStandby =
    lastShotTime === 0 || isFutureTimestamp || timeSinceLastShot >= thresholds.standbyThreshold;

  const deviceId = target.id?.id || target.id;

  newActivityMap.set(deviceId, {
    deviceId,
    lastShotTime,
    totalShots,
    isActivelyShooting,
    isRecentlyActive,
    isStandby,
  });

  if (isActivelyShooting) {
    activityFlags.hasActiveShooters = true;
  } else if (isRecentlyActive) {
    activityFlags.hasRecentActivity = true;
  }
}

function determinePollingMode(hasActiveShooters: boolean, hasRecentActivity: boolean): PollingMode {
  if (hasActiveShooters) {
    return 'active';
  }
  if (hasRecentActivity) {
    return 'recent';
  }
  return 'standby';
}

export const useShootingActivityPolling = (
  onUpdate: () => Promise<void>,
  config: ShootingPollingConfig = DEFAULT_POLLING_CONFIG,
  enabled = true
) => {
  const { targets } = useTargets();

  const {
    activeInterval,
    recentInterval,
    standbyInterval,
    activeThreshold,
    standbyThreshold,
  } = config;

  const [currentMode, setCurrentMode] = useState<PollingMode>('standby');
  const [currentInterval, setCurrentInterval] = useState(standbyInterval);
  const [targetActivity, setTargetActivity] = useState<Map<string, TargetShootingActivity>>(new Map());
  const [isPageVisible, setIsPageVisible] = useState(!document.hidden);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const modeRef = useRef<PollingMode>('standby');
  const intervalStateRef = useRef<{ mode: PollingMode; interval: number }>({
    mode: 'standby',
    interval: standbyInterval,
  });

  const clearPollingInterval = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const getIntervalForMode = useCallback(
    (mode: PollingMode): number => {
      switch (mode) {
        case 'active':
          return activeInterval;
        case 'recent':
          return recentInterval;
        case 'standby':
        default:
          return standbyInterval;
      }
    },
    [activeInterval, recentInterval, standbyInterval]
  );

  const checkShootingActivity = useCallback(async (): Promise<PollingMode> => {
    if (!enabled) {
      return 'standby';
    }

    try {
      if (!thingsBoardService.isAuthenticated()) {
        return 'standby';
      }

      if (targets.length === 0) {
        setTargetActivity(new Map());
        return 'standby';
      }

      const onlineTargets = targets.filter((target) => target.status === 'online' || target.status === 'standby');
      if (onlineTargets.length === 0) {
        setTargetActivity(new Map());
        return 'standby';
      }

      const currentTime = Date.now();
      const newActivityMap = new Map<string, TargetShootingActivity>();
      const activityFlags: ActivityFlags = { hasActiveShooters: false, hasRecentActivity: false };

      const deviceIds = onlineTargets.map((target) => target.id?.id || target.id);
      const { activity } = await fetchShootingActivity(deviceIds, TELEMETRY_KEYS);

      for (const record of activity ?? []) {
        const target = onlineTargets.find((t) => (t.id?.id || t.id) === record.deviceId);
        if (!target) {
          continue;
        }

        if (record.error) {
          console.error(`❌ [ShootingActivity] Edge error for ${record.deviceId}:`, record.error);
          continue;
        }

        processTargetTelemetry(
          target,
          record.telemetry,
          newActivityMap,
          currentTime,
          { activeThreshold, standbyThreshold },
          activityFlags
        );
      }

      targets
        .filter((target) => target.status === 'offline')
        .forEach((target) => {
          const deviceId = target.id?.id || target.id;
          newActivityMap.set(deviceId, {
            deviceId,
            lastShotTime: 0,
            totalShots: 0,
            isActivelyShooting: false,
            isRecentlyActive: false,
            isStandby: true,
          });
        });

      setTargetActivity(newActivityMap);
      return determinePollingMode(activityFlags.hasActiveShooters, activityFlags.hasRecentActivity);
    } catch (error) {
      console.error('❌ [ShootingActivity] Error checking shooting activity:', error);
      return 'standby';
    }
  }, [activeThreshold, enabled, standbyThreshold, targets]);

  const updatePollingMode = useCallback(
    (mode: PollingMode) => {
      if (!enabled) {
        clearPollingInterval();
        modeRef.current = 'standby';
        intervalStateRef.current = { mode: 'standby', interval: standbyInterval };
        setCurrentMode('standby');
        setCurrentInterval(standbyInterval);
        setTargetActivity(new Map());
        return;
      }

      const nextInterval = getIntervalForMode(mode);
      const { mode: prevMode, interval: prevInterval } = intervalStateRef.current;
      const shouldReschedule = !intervalRef.current || prevMode !== mode || prevInterval !== nextInterval;

      modeRef.current = mode;
      intervalStateRef.current = { mode, interval: nextInterval };
      setCurrentMode(mode);
      setCurrentInterval(nextInterval);

      if (!shouldReschedule) {
        return;
      }

      clearPollingInterval();

      intervalRef.current = setInterval(async () => {
        if (!enabled) {
          return;
        }

        if (modeRef.current !== 'standby') {
          try {
            await onUpdate();
          } catch (error) {
            console.warn('⚠️ [ShootingActivity] onUpdate failed during polling interval:', error);
          }
        }

        const recalculatedMode = await checkShootingActivity();
        if (recalculatedMode !== modeRef.current) {
          updatePollingMode(recalculatedMode);
        }
      }, nextInterval);
    },
    [
      clearPollingInterval,
      enabled,
      getIntervalForMode,
      onUpdate,
      checkShootingActivity,
      standbyInterval,
    ]
  );

  useEffect(() => {
    if (!enabled) {
      setIsPageVisible(true);
      return;
    }

    const handleVisibilityChange = () => {
      const isVisible = !document.hidden;
      setIsPageVisible(isVisible);

      if (isVisible) {
        (async () => {
          try {
            await onUpdate();
            const mode = await checkShootingActivity();
            updatePollingMode(mode);
          } catch (error) {
            console.error('❌ [ShootingActivity] Visibility resume failed:', error);
          }
        })();
      } else {
        clearPollingInterval();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [
    checkShootingActivity,
    clearPollingInterval,
    enabled,
    onUpdate,
    updatePollingMode,
  ]);

  useEffect(() => {
    if (!enabled) {
      clearPollingInterval();
      setCurrentMode('standby');
      setCurrentInterval(standbyInterval);
      setTargetActivity(new Map());
      return;
    }

    if (!targets.length || !isPageVisible) {
      return;
    }

    let cancelled = false;

    const bootstrap = async () => {
      try {
        await onUpdate();
        if (cancelled) {
          return;
        }

        const initialMode = await checkShootingActivity();
        if (cancelled) {
          return;
        }

        updatePollingMode(initialMode);
      } catch (error) {
        console.error('❌ [ShootingActivity] Failed to start polling:', error);
        updatePollingMode('standby');
      }
    };

    bootstrap();

    return () => {
      cancelled = true;
    };
  }, [
    checkShootingActivity,
    clearPollingInterval,
    enabled,
    isPageVisible,
    onUpdate,
    standbyInterval,
    targets.length,
    updatePollingMode,
  ]);

  useEffect(
    () => () => {
      clearPollingInterval();
    },
    [clearPollingInterval]
  );

  const checkShootingActivityRef = useRef(checkShootingActivity);
  const onUpdateRef = useRef(onUpdate);
  const updatePollingModeRef = useRef(updatePollingMode);

  useEffect(() => {
    checkShootingActivityRef.current = checkShootingActivity;
  }, [checkShootingActivity]);

  useEffect(() => {
    onUpdateRef.current = onUpdate;
  }, [onUpdate]);

  useEffect(() => {
    updatePollingModeRef.current = updatePollingMode;
  }, [updatePollingMode]);

  useEffect(() => {
    if (!enabled) {
      if (wsRef.current && wsRef.current.readyState !== WebSocket.CLOSED) {
        wsRef.current.close();
      }
      wsRef.current = null;
      return;
    }

    const token = localStorage.getItem('tb_access');
    if (!token) {
      return;
    }

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
        const handleShotUpdate = async () => {
          try {
            await onUpdateRef.current().catch((error) => {
              console.warn('⚠️ [ShootingActivity] onUpdate failed after WS message:', error);
            });
            const mode = await checkShootingActivityRef.current();
            const nextMode = mode === 'standby' ? 'active' : mode;
            updatePollingModeRef.current(nextMode);
          } catch (error) {
            console.warn('⚠️ [ShootingActivity] WebSocket handling failed:', error);
          }
        };

        try {
          const data = JSON.parse(event.data);
          if (
            data?.data &&
            (data.data.hits ||
              data.data.hit_ts ||
              data.data.beep_ts ||
              (data.data.event && typeof data.data.event === 'string' && data.data.event.includes('hit')))
          ) {
            void handleShotUpdate();
          }
        } catch (error) {
          console.warn('⚠️ [ShootingActivity] WebSocket message parse error:', error);
        }
      };

      ws.onerror = (error) => {
        console.warn('WebSocket error in shooting activity polling, falling back to polling only', error);
      };

      ws.onclose = () => {
        // Continue with interval-based polling when socket closes
      };

      return () => {
        if (wsRef.current && wsRef.current.readyState !== WebSocket.CLOSED) {
          wsRef.current.close();
        }
        wsRef.current = null;
      };
    } catch (error) {
      console.warn('WebSocket setup failed in shooting activity polling, using polling only:', error);
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    updatePollingMode(modeRef.current);
  }, [activeInterval, recentInterval, standbyInterval, enabled, updatePollingMode]);

  return {
    currentInterval: currentInterval / 1000,
    currentMode,
    hasActiveShooters: currentMode === 'active',
    hasRecentActivity: currentMode === 'recent',
    isStandbyMode: currentMode === 'standby',
    targetActivity: Array.from(targetActivity.values()),
    activeShotsCount: Array.from(targetActivity.values()).filter((t) => t.isActivelyShooting).length,
    recentShotsCount: Array.from(targetActivity.values()).filter((t) => t.isRecentlyActive).length,
    forceUpdate: async () => {
      await onUpdate();
      const mode = await checkShootingActivity();
      updatePollingMode(mode);
    },
  };
};
