import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useTargets } from '@/store/useTargets';
import { fetchShootingActivity } from '@/lib/edge';
import { TELEMETRY_POLLING_DEFAULTS, resolveIntervalWithBackoff } from '@/config/telemetry';

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
  overrides: ShootingPollingConfig = DEFAULT_POLLING_CONFIG,
  enabled = true,
) => {
  const config = useMemo(() => ({ ...DEFAULT_POLLING_CONFIG, ...overrides }), [overrides]);
  const { targets } = useTargets();

  const [currentMode, setCurrentMode] = useState<PollingMode>('standby');
  const [currentInterval, setCurrentInterval] = useState(config.standbyInterval);
  const [targetActivity, setTargetActivity] = useState<Map<string, TargetShootingActivity>>(new Map());
  const [isPageVisible, setIsPageVisible] = useState(!document.hidden);

  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const intervalStateRef = useRef<{ mode: PollingMode; interval: number }>({
    mode: 'standby',
    interval: config.standbyInterval,
  });
  const runRef = useRef<() => Promise<void>>();
  const consecutiveErrorRef = useRef(0);

  const clearScheduled = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const intervalForMode = useCallback((mode: PollingMode) => {
    switch (mode) {
      case 'active':
        return config.activeInterval;
      case 'recent':
        return config.recentInterval;
      case 'standby':
      default:
        return config.standbyInterval;
    }
  }, [config.activeInterval, config.recentInterval, config.standbyInterval]);

  const scheduleNext = useCallback((mode: PollingMode, overrideInterval?: number) => {
    const baseInterval = overrideInterval ?? intervalForMode(mode);
    const interval = resolveIntervalWithBackoff(baseInterval, consecutiveErrorRef.current);
    const bounded = Math.min(
      Math.max(interval, TELEMETRY_POLLING_DEFAULTS.minIntervalMs),
      TELEMETRY_POLLING_DEFAULTS.maxIntervalMs,
    );

    clearScheduled();
    timeoutRef.current = setTimeout(() => {
      runRef.current?.().catch((error) => {
        console.error('[ShootingActivity] polling cycle failed', error);
      });
    }, bounded);

    intervalStateRef.current = { mode, interval: bounded };
    setCurrentMode(mode);
    setCurrentInterval(bounded);
  }, [clearScheduled, intervalForMode]);

  const checkShootingActivity = useCallback(async (): Promise<PollingMode> => {
    if (!enabled) {
      setTargetActivity(new Map());
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

    try {
      const deviceIds = onlineTargets.map((target) => target.id?.id || target.id);
      const { activity } = await fetchShootingActivity(deviceIds, TELEMETRY_KEYS);

      for (const record of activity ?? []) {
        const target = onlineTargets.find((t) => (t.id?.id || t.id) === record.deviceId);
        if (!target) {
          continue;
        }
        if (record.error) {
          console.warn(`⚠️ [ShootingActivity] edge function error for ${record.deviceId}:`, record.error);
          continue;
        }

        processTargetTelemetry(
          target,
          record.telemetry,
          newActivityMap,
          currentTime,
          { activeThreshold: config.activeThreshold, standbyThreshold: config.standbyThreshold },
          activityFlags,
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
      console.error('❌ [ShootingActivity] Unable to fetch telemetry activity', error);
      setTargetActivity(new Map());
      throw error;
    }
  }, [config.activeThreshold, config.standbyThreshold, enabled, targets]);

  const runCycle = useCallback(async () => {
    if (!enabled || !isPageVisible) {
      clearScheduled();
      return;
    }

    const start = performance.now();

    if (intervalStateRef.current.mode !== 'standby') {
      try {
        await onUpdate();
      } catch (error) {
        consecutiveErrorRef.current += 1;
        console.warn('⚠️ [ShootingActivity] onUpdate failed', error);
      }
    }

    let nextMode: PollingMode = 'standby';
    try {
      nextMode = await checkShootingActivity();
      consecutiveErrorRef.current = 0;
    } catch (error) {
      consecutiveErrorRef.current = Math.min(
        TELEMETRY_POLLING_DEFAULTS.maxRetry,
        consecutiveErrorRef.current + 1,
      );
      nextMode = 'standby';
    }

    const duration = performance.now() - start;
    if (duration > TELEMETRY_POLLING_DEFAULTS.slowResponseWarningMs) {
      console.warn('[ShootingActivity] polling cycle exceeded SLA', {
        durationMs: Math.round(duration),
        slowdownThresholdMs: TELEMETRY_POLLING_DEFAULTS.slowResponseWarningMs,
      });
    }

    scheduleNext(nextMode);
  }, [checkShootingActivity, clearScheduled, enabled, isPageVisible, onUpdate, scheduleNext]);

  useEffect(() => {
    runRef.current = runCycle;
  }, [runCycle]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      const visible = !document.hidden;
      setIsPageVisible(visible);

      if (!visible) {
        clearScheduled();
      } else {
        runCycle().catch((error) => {
          console.error('❌ [ShootingActivity] resume cycle failed', error);
        });
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [clearScheduled, runCycle]);

  useEffect(() => {
    if (!enabled) {
      clearScheduled();
      setTargetActivity(new Map());
      setCurrentMode('standby');
      setCurrentInterval(config.standbyInterval);
      return;
    }

    if (!targets.length || !isPageVisible) {
      clearScheduled();
      setTargetActivity(new Map());
      return;
    }

    runCycle().catch((error) => {
      console.error('❌ [ShootingActivity] initial cycle failed', error);
    });
  }, [clearScheduled, config.standbyInterval, enabled, isPageVisible, runCycle, targets.length]);

  useEffect(() => () => {
    clearScheduled();
  }, [clearScheduled]);

  useEffect(() => {
    if (!enabled) {
      return;
    }
    scheduleNext(intervalStateRef.current.mode, intervalForMode(intervalStateRef.current.mode));
  }, [enabled, config.activeInterval, config.recentInterval, config.standbyInterval, intervalForMode, scheduleNext]);

  const forceUpdate = useCallback(async () => {
    await runCycle();
  }, [runCycle]);

  return {
    currentInterval: currentInterval / 1000,
    currentMode,
    hasActiveShooters: currentMode === 'active',
    hasRecentActivity: currentMode === 'recent',
    isStandbyMode: currentMode === 'standby',
    targetActivity: Array.from(targetActivity.values()),
    activeShotsCount: Array.from(targetActivity.values()).filter((t) => t.isActivelyShooting).length,
    recentShotsCount: Array.from(targetActivity.values()).filter((t) => t.isRecentlyActive).length,
    forceUpdate,
  };
};
