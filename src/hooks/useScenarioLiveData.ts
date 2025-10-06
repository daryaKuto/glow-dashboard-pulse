/**
 * Custom hook for live data fetching during scenario execution
 * Provides real-time updates with high-frequency polling and WebSocket fallback
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import thingsBoardService from '@/services/thingsboard';
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
    isConnected: false
  });

  const wsConnections = useRef<WebSocket[]>([]);
  const pollingInterval = useRef<NodeJS.Timeout | null>(null);
  const lastUpdateTime = useRef<number>(Date.now());
  const isActive = useRef<boolean>(true);

  // High-frequency polling for critical data
  const pollTelemetryData = useCallback(async () => {
    if (!isActive.current) return;

    try {
      const currentTime = Date.now();
      const timeElapsed = currentTime - config.scenarioStartTime;
      const timeRemaining = Math.max(0, config.scenarioTimeLimit - timeElapsed);
      
      // If time is up, stop polling and notify completion
      if (timeRemaining === 0 && isActive.current) {
        isActive.current = false;
        
        // Stop polling immediately
        if (pollingInterval.current) {
          clearInterval(pollingInterval.current);
          pollingInterval.current = null;
        }
        
        // Call completion callback after stopping polling
        setTimeout(() => {
          config.onScenarioComplete?.();
        }, 100);
        return;
      }

      let totalHits = 0;
      let allReactionTimes: number[] = [];
      const recentHits: any[] = [];

      // Poll each target device for latest telemetry
      for (const deviceId of config.targetDeviceIds) {
        try {
          const telemetry = await thingsBoardService.getLatestTelemetry(deviceId, [
            SCENARIO_TELEMETRY_KEYS.HIT_REGISTERED,
            SCENARIO_TELEMETRY_KEYS.HIT_SEQUENCE,
            SCENARIO_TELEMETRY_KEYS.REACTION_TIME,
            SCENARIO_TELEMETRY_KEYS.SHOT_NUMBER,
            SCENARIO_TELEMETRY_KEYS.SESSION_ID,
            // Legacy keys for compatibility
            SCENARIO_TELEMETRY_KEYS.HITS,
            SCENARIO_TELEMETRY_KEYS.HIT_TS
          ]);

          // Process scenario-specific hits
          if (telemetry[SCENARIO_TELEMETRY_KEYS.SESSION_ID]) {
            const sessionData = telemetry[SCENARIO_TELEMETRY_KEYS.SESSION_ID];
            if (sessionData.length > 0 && sessionData[0].value === config.sessionId) {
              // This device has data for our current session
              
              if (telemetry[SCENARIO_TELEMETRY_KEYS.HIT_SEQUENCE]) {
                const hitSequence = telemetry[SCENARIO_TELEMETRY_KEYS.HIT_SEQUENCE];
                if (hitSequence.length > 0) {
                  totalHits = Math.max(totalHits, parseInt(hitSequence[0].value) || 0);
                }
              }

              if (telemetry[SCENARIO_TELEMETRY_KEYS.REACTION_TIME]) {
                const reactionTime = telemetry[SCENARIO_TELEMETRY_KEYS.REACTION_TIME];
                if (reactionTime.length > 0) {
                  const rt = parseInt(reactionTime[0].value) || 0;
                  allReactionTimes.push(rt);
                }
              }

              if (telemetry[SCENARIO_TELEMETRY_KEYS.HIT_REGISTERED]) {
                const hitTime = telemetry[SCENARIO_TELEMETRY_KEYS.HIT_REGISTERED];
                if (hitTime.length > 0) {
                  const timestamp = hitTime[0].ts;
                  
                  // Only include hits from this scenario session
                  if (timestamp >= config.scenarioStartTime) {
                    recentHits.push({
                      timestamp,
                      targetId: deviceId,
                      reactionTime: allReactionTimes[allReactionTimes.length - 1] || 0,
                      sequence: totalHits
                    });

                    // Trigger hit detection callback
                    config.onHitDetected?.({
                      deviceId,
                      timestamp,
                      sessionId: config.sessionId,
                      hitSequence: totalHits
                    });
                  }
                }
              }
            }
          }

        } catch (error) {
          console.error(`Failed to poll telemetry for device ${deviceId}:`, error);
        }
      }

      // Calculate metrics
      const progress = (totalHits / config.expectedHits) * 100;
      const averageReactionTime = allReactionTimes.length > 0 
        ? allReactionTimes.reduce((sum, rt) => sum + rt, 0) / allReactionTimes.length
        : 0;

      // Update live data state
      setLiveData(prev => ({
        ...prev,
        hitCount: totalHits,
        progress: Math.min(100, progress),
        timeRemaining,
        averageReactionTime,
        recentHits: recentHits.sort((a, b) => b.timestamp - a.timestamp).slice(0, 10),
        lastHitTime: recentHits.length > 0 ? Math.max(...recentHits.map(h => h.timestamp)) : prev.lastHitTime,
        isConnected: true,
        error: undefined
      }));

      lastUpdateTime.current = currentTime;

    } catch (error) {
      console.error('Failed to poll scenario telemetry:', error);
      setLiveData(prev => ({
        ...prev,
        error: 'Failed to fetch live data',
        isConnected: false
      }));
      config.onError?.('Failed to fetch live data');
    }
  }, [config.sessionId, config.targetDeviceIds, config.scenarioStartTime, config.scenarioTimeLimit, config.expectedHits, config.onHitDetected, config.onScenarioComplete, config.onError]);

  // Setup WebSocket connections for real-time updates
  const setupWebSocketConnections = useCallback(() => {
    // Close existing connections
    wsConnections.current.forEach(ws => ws.close());
    wsConnections.current = [];

    config.targetDeviceIds.forEach(deviceId => {
      try {
        const ws = thingsBoardService.subscribeToTelemetry(
          deviceId,
          [
            SCENARIO_TELEMETRY_KEYS.HIT_REGISTERED,
            SCENARIO_TELEMETRY_KEYS.REACTION_TIME,
            SCENARIO_TELEMETRY_KEYS.HIT_SEQUENCE,
            SCENARIO_TELEMETRY_KEYS.SESSION_ID
          ],
          (data) => {
            // Handle real-time telemetry updates
            if (isActive.current && data && data.data) {
              // Trigger immediate polling update to get latest data
              pollTelemetryData();
            }
          }
        );

        if (ws) {
          wsConnections.current.push(ws);
        }
      } catch (error) {
        console.error(`Failed to setup WebSocket for device ${deviceId}:`, error);
      }
    });
  }, [config.targetDeviceIds, pollTelemetryData]);

  // Start live data fetching
  useEffect(() => {
    // Don't start polling if no valid session ID
    if (!config.sessionId) {
      isActive.current = false;
      return;
    }

    isActive.current = true;
    
    // Initial data fetch
    pollTelemetryData();
    
    // Setup high-frequency polling (every 500ms during active scenario)
    pollingInterval.current = setInterval(pollTelemetryData, 500);
    
    // Setup WebSocket connections for instant updates
    setupWebSocketConnections();

    return () => {
      isActive.current = false;
      
      // Cleanup polling
      if (pollingInterval.current) {
        clearInterval(pollingInterval.current);
        pollingInterval.current = null;
      }
      
      // Cleanup WebSocket connections
      wsConnections.current.forEach(ws => ws.close());
      wsConnections.current = [];
    };
  }, [config.sessionId, pollTelemetryData, setupWebSocketConnections]);

  // Cleanup on unmount or when scenario ends
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
    forceRefresh: pollTelemetryData
  };
};
