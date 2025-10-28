import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTargets } from '@/store/useTargets';
import { fetchTargetDetails } from '@/lib/edge';
import { TELEMETRY_POLLING_DEFAULTS, resolveIntervalWithBackoff } from '@/config/telemetry';

interface SmartPollingConfig {
  defaultIntervalMs?: number;
  activeIntervalMs?: number;
  heartbeatThresholdMs?: number;
  slowResponseWarningMs?: number;
}

interface DeviceActivity {
  deviceId: string;
  lastActivity: number;
  isActive: boolean;
}

const mapConfig = (overrides?: SmartPollingConfig) => ({
  ...TELEMETRY_POLLING_DEFAULTS,
  ...overrides,
});

export const useSmartPolling = (
  onUpdate: () => Promise<void>,
  overrides?: SmartPollingConfig,
) => {
  const config = useMemo(() => mapConfig(overrides), [overrides]);
  const { targets } = useTargets();

  const [currentInterval, setCurrentInterval] = useState(config.defaultIntervalMs);
  const [hasActiveTargets, setHasActiveTargets] = useState(false);
  const [deviceActivity, setDeviceActivity] = useState<Map<string, DeviceActivity>>(new Map());

  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const runRef = useRef<() => Promise<void>>();
  const executingRef = useRef(false);
  const consecutiveErrorRef = useRef(0);

  const scheduleNext = useCallback((delay: number) => {
    const boundedDelay = Math.max(delay, config.minIntervalMs);
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      runRef.current?.().catch((error) => {
        console.error('[SmartPolling] cycle execution failed', error);
      });
    }, boundedDelay);
    setCurrentInterval(boundedDelay);
  }, [config.minIntervalMs]);

  const checkDeviceActivity = useCallback(async (): Promise<boolean> => {
    if (targets.length === 0) {
      setDeviceActivity(new Map());
      return false;
    }

    try {
      const deviceIds = targets.map((target) => (typeof target.id === 'string' ? target.id : String(target.id?.id ?? target.id)));
      const { details } = await fetchTargetDetails(deviceIds, {
        includeHistory: false,
        telemetryKeys: ['hit_ts', 'event'],
        recentWindowMs: config.heartbeatThresholdMs,
      });

      const detailMap = new Map(details.map((detail) => [detail.deviceId, detail]));
      let hasRecentActivity = false;
      const activityMap = new Map<string, DeviceActivity>();

      targets.forEach((target) => {
        const deviceId = typeof target.id === 'string' ? target.id : String(target.id?.id ?? target.id);
        const detail = detailMap.get(deviceId);

        const lastActivity = detail?.lastShotTime ?? 0;
        const isActive = detail?.activityStatus === 'active';

        if (isActive) {
          hasRecentActivity = true;
        }

        activityMap.set(deviceId, {
          deviceId,
          lastActivity,
          isActive,
        });
      });

      setDeviceActivity(activityMap);
      return hasRecentActivity;
    } catch (error) {
      consecutiveErrorRef.current += 1;
      console.error('[SmartPolling] Unable to inspect device activity', error);
      setDeviceActivity(new Map());
      return false;
    }
  }, [targets, config.heartbeatThresholdMs]);

  const runCycle = useCallback(async () => {
    if (executingRef.current) {
      return;
    }
    executingRef.current = true;
    const cycleStart = performance.now();

    try {
      await onUpdate();
      consecutiveErrorRef.current = 0;
    } catch (error) {
      consecutiveErrorRef.current += 1;
      console.error('[SmartPolling] onUpdate failed', error);
    }

    const hasActivity = await checkDeviceActivity();

    const cycleDuration = performance.now() - cycleStart;
    if (cycleDuration > config.slowResponseWarningMs) {
      console.warn('[SmartPolling] polling cycle exceeded SLA', {
        durationMs: Math.round(cycleDuration),
        slowdownThresholdMs: config.slowResponseWarningMs,
      });
    }

    setHasActiveTargets(hasActivity);

    const baseInterval = hasActivity ? config.activeIntervalMs : config.defaultIntervalMs;
    const nextInterval = resolveIntervalWithBackoff(baseInterval, consecutiveErrorRef.current);

    executingRef.current = false;
    scheduleNext(nextInterval);
  }, [checkDeviceActivity, config.activeIntervalMs, config.defaultIntervalMs, config.slowResponseWarningMs, scheduleNext, onUpdate]);

  useEffect(() => {
    runRef.current = runCycle;
  }, [runCycle]);

  useEffect(() => {
    runCycle().catch((error) => {
      console.error('[SmartPolling] initial cycle failed', error);
    });

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [runCycle]);

  const forceUpdate = useCallback(async () => {
    await runCycle();
  }, [runCycle]);

  return {
    currentInterval: currentInterval / 1000,
    hasActiveTargets,
    deviceActivity: Array.from(deviceActivity.values()),
    forceUpdate,
  };
};
