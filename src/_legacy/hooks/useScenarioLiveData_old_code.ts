/**
 * Custom hook for live data fetching during scenario execution
 * Provides high-frequency polling leveraging Supabase edge functions.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { fetchTargetDetails } from '@/lib/edge';
import { SCENARIO_TELEMETRY_KEYS } from '@/types/scenario-data';

interface ScenarioLiveData {
  sessionId: string;
  hitCount: number;
  expectedHits: number;
  progress: number;
  timeRemaining: number;
  lastHitTime?: number;
  averageReactionTime: number;
  recentHits: Array<{
    timestamp: number;
    targetId: string;
    reactionTime: number;
    sequence: number;
  }>;
  isConnected: boolean;
  error?: string;
}

interface UseScenarioLiveDataConfig {
  sessionId: string;
  targetDeviceIds: string[];
  scenarioStartTime: number;
  scenarioTimeLimit: number;
  expectedHits: number;
  onHitDetected?: (hitData: any) => void;
  onScenarioComplete?: () => void;
  onError?: (error: string) => void;
}

export const useScenarioLiveData = (config: UseScenarioLiveDataConfig) => {
  const [liveData, setLiveData] = useState<ScenarioLiveData>({
    sessionId: config.sessionId,
    hitCount: 0,
    expectedHits: config.expectedHits,
    progress: 0,
    timeRemaining: config.scenarioTimeLimit,
    averageReactionTime: 0,
    recentHits: [],
    isConnected: false,
  });

  const pollingInterval = useRef<NodeJS.Timeout | null>(null);
  const isActive = useRef<boolean>(true);

  const pollTelemetryData = useCallback(async () => {
    if (!isActive.current || config.targetDeviceIds.length === 0) {
      return;
    }

    try {
      const currentTime = Date.now();
      const timeElapsed = currentTime - config.scenarioStartTime;
      const timeRemaining = Math.max(0, config.scenarioTimeLimit - timeElapsed);

      if (timeRemaining === 0) {
        isActive.current = false;
        pollingInterval.current && clearInterval(pollingInterval.current);
        pollingInterval.current = null;
        setTimeout(() => config.onScenarioComplete?.(), 100);
        return;
      }

      const { details } = await fetchTargetDetails(config.targetDeviceIds, {
        includeHistory: false,
        telemetryKeys: [
          SCENARIO_TELEMETRY_KEYS.HIT_REGISTERED,
          SCENARIO_TELEMETRY_KEYS.HIT_SEQUENCE,
          SCENARIO_TELEMETRY_KEYS.REACTION_TIME,
          SCENARIO_TELEMETRY_KEYS.SESSION_ID,
          SCENARIO_TELEMETRY_KEYS.HITS,
          SCENARIO_TELEMETRY_KEYS.HIT_TS,
        ],
      });

      let totalHits = 0;
      const reactionTimes: number[] = [];
      const recentHits: ScenarioLiveData['recentHits'] = [];

      details.forEach((detail) => {
        const telemetry = detail.telemetry ?? {};
        const sessionEntries = telemetry[SCENARIO_TELEMETRY_KEYS.SESSION_ID];
        const isSessionMatch = Array.isArray(sessionEntries) && sessionEntries.length > 0
          ? sessionEntries[0]?.value === config.sessionId
          : false;

        if (!isSessionMatch) {
          return;
        }

        const sequenceEntries = telemetry[SCENARIO_TELEMETRY_KEYS.HIT_SEQUENCE];
        if (Array.isArray(sequenceEntries) && sequenceEntries.length > 0) {
          const value = Number(sequenceEntries[0]?.value);
          if (Number.isFinite(value)) {
            totalHits = Math.max(totalHits, value);
          }
        }

        const reactionEntries = telemetry[SCENARIO_TELEMETRY_KEYS.REACTION_TIME];
        if (Array.isArray(reactionEntries) && reactionEntries.length > 0) {
          const rt = Number(reactionEntries[0]?.value);
          if (Number.isFinite(rt)) {
            reactionTimes.push(rt);
          }
        }

        const hitEntries = telemetry[SCENARIO_TELEMETRY_KEYS.HIT_REGISTERED];
        if (Array.isArray(hitEntries) && hitEntries.length > 0) {
          const timestamp = hitEntries[0]?.ts ?? 0;
          if (timestamp >= config.scenarioStartTime) {
            const reactionTime = reactionTimes.length > 0 ? reactionTimes[reactionTimes.length - 1] : 0;
            recentHits.push({
              timestamp,
              targetId: detail.deviceId,
              reactionTime,
              sequence: totalHits,
            });

            config.onHitDetected?.({
              deviceId: detail.deviceId,
              timestamp,
              sessionId: config.sessionId,
              hitSequence: totalHits,
            });
          }
        }
      });

      const progress = (totalHits / config.expectedHits) * 100;
      const averageReactionTime = reactionTimes.length > 0
        ? reactionTimes.reduce((sum, rt) => sum + rt, 0) / reactionTimes.length
        : 0;

      setLiveData((prev) => ({
        ...prev,
        hitCount: totalHits,
        progress: Math.min(100, progress),
        timeRemaining,
        averageReactionTime,
        recentHits: recentHits.sort((a, b) => b.timestamp - a.timestamp).slice(0, 10),
        lastHitTime: recentHits.length > 0 ? Math.max(...recentHits.map((hit) => hit.timestamp)) : prev.lastHitTime,
        isConnected: true,
        error: undefined,
      }));
    } catch (error) {
      console.error('Failed to poll scenario telemetry:', error);
      setLiveData((prev) => ({
        ...prev,
        error: 'Failed to fetch live data',
        isConnected: false,
      }));
      config.onError?.('Failed to fetch live data');
    }
  }, [
    config.expectedHits,
    config.onError,
    config.onHitDetected,
    config.onScenarioComplete,
    config.scenarioStartTime,
    config.scenarioTimeLimit,
    config.sessionId,
    config.targetDeviceIds,
  ]);

  useEffect(() => {
    if (!config.sessionId || config.targetDeviceIds.length === 0) {
      isActive.current = false;
      return;
    }

    isActive.current = true;
    pollTelemetryData();
    pollingInterval.current = setInterval(pollTelemetryData, 500);

    return () => {
      isActive.current = false;
      if (pollingInterval.current) {
        clearInterval(pollingInterval.current);
        pollingInterval.current = null;
      }
    };
  }, [config.sessionId, config.targetDeviceIds.length, pollTelemetryData]);

  useEffect(() => {
    if (liveData.progress >= 100 || liveData.timeRemaining === 0) {
      isActive.current = false;
      if (pollingInterval.current) {
        clearInterval(pollingInterval.current);
        pollingInterval.current = null;
      }
    }
  }, [liveData.progress, liveData.timeRemaining]);

  return {
    liveData,
    isPolling: isActive.current && pollingInterval.current !== null,
    forceRefresh: pollTelemetryData,
  };
};
