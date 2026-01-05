/**
 * Mock version of useScenarioLiveData hook
 * Uses simulated data instead of real ThingsBoard API calls
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { mockScenarioService } from '@/_legacy/services/scenario-mock_old_code';

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

interface UseScenarioLiveDataMockConfig {
  sessionId: string;
  targetDeviceIds: string[];
  scenarioStartTime: number;
  scenarioTimeLimit: number;
  expectedHits: number;
  onHitDetected?: (hitData: any) => void;
  onScenarioComplete?: () => void;
  onError?: (error: string) => void;
}

export const useScenarioLiveDataMock = (config: UseScenarioLiveDataMockConfig) => {
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

  const pollingInterval = useRef<NodeJS.Timeout | null>(null);
  const isActive = useRef<boolean>(true);
  const lastHitCount = useRef<number>(0);

  // Poll mock data at high frequency
  const pollMockData = useCallback(() => {
    if (!isActive.current) return;

    try {
      const mockData = mockScenarioService.getMockLiveData(config.sessionId);
      
      // Check for new hits
      if (mockData.hitCount > lastHitCount.current) {
        const newHits = mockData.hitCount - lastHitCount.current;
        console.log(`🎯 ${newHits} new hit(s) detected in mock data`);
        
        // Trigger hit detection callback for each new hit
        const newHitEvents = mockData.recentHits.slice(0, newHits);
        newHitEvents.forEach(hit => {
          config.onHitDetected?.({
            deviceId: hit.targetId,
            timestamp: hit.timestamp,
            sessionId: config.sessionId,
            hitSequence: hit.sequence,
            reactionTime: hit.reactionTime
          });
        });
        
        lastHitCount.current = mockData.hitCount;
      }

      // Check for completion - only call callback once
      if ((mockData.progress >= 100 && mockData.timeRemaining > 0) || mockData.timeRemaining === 0) {
        if (isActive.current) { // Only call if we haven't already stopped
          console.log('🎯 Mock scenario completed');
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
        }
      }

      setLiveData(prev => ({
        ...prev,
        ...mockData,
        error: undefined
      }));

    } catch (error) {
      console.error('Failed to poll mock scenario data:', error);
      setLiveData(prev => ({
        ...prev,
        error: 'Failed to fetch mock data',
        isConnected: false
      }));
      config.onError?.('Failed to fetch mock data');
    }
  }, [config.sessionId, config.onHitDetected, config.onScenarioComplete, config.onError]);

  // Start polling when hook is initialized
  useEffect(() => {
    // Don't start polling if no valid session ID
    if (!config.sessionId) {
      isActive.current = false;
      return;
    }

    isActive.current = true;
    lastHitCount.current = 0;
    
    // Initial data fetch
    pollMockData();
    
    // Setup high-frequency polling (every 200ms for smooth demo)
    pollingInterval.current = setInterval(pollMockData, 200);

    return () => {
      isActive.current = false;
      
      if (pollingInterval.current) {
        clearInterval(pollingInterval.current);
        pollingInterval.current = null;
      }
    };
  }, [config.sessionId, pollMockData]);

  // Stop polling when scenario is complete
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
    forceRefresh: pollMockData
  };
};
