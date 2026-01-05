/**
 * @deprecated Legacy implementation.
 * Replaced by: src/pages/Scenarios.tsx (legacy scenario flow), no active feature module.
 */

import type {
  ScenarioSession,
  ScenarioResults,
  StartScenarioPayload
} from '@/shared/types';

interface MockHitEvent {
  timestamp: number;
  targetId: string;
  reactionTime: number;
  sequence: number;
  targetNumber: 1 | 2;
  shotNumber: 1 | 2;
}

class MockScenarioService {
  private activeSessions = new Map<string, {
    session: ScenarioSession;
    startTime: number;
    hits: MockHitEvent[];
    currentStep: number;
    isComplete: boolean;
  }>();

  private hitGenerationIntervals = new Map<string, NodeJS.Timeout>();

  /**
   * Start a mock scenario session
   */
  async startScenarioSession(payload: StartScenarioPayload): Promise<ScenarioSession> {
    const session: ScenarioSession = {
      sessionId: payload.sessionId,
      scenarioId: payload.scenarioConfig.id,
      roomId: payload.roomId,
      userId: payload.userId,
      startTime: payload.startTime,
      targetDeviceIds: payload.targetDeviceIds,
      expectedShots: payload.scenarioConfig.targetCount * payload.scenarioConfig.shotsPerTarget,
      timeLimitMs: payload.scenarioConfig.timeLimitMs,
      status: 'active'
    };

    // Store session data
    this.activeSessions.set(payload.sessionId, {
      session,
      startTime: Date.now(),
      hits: [],
      currentStep: 0,
      isComplete: false
    });

    // Start simulating the Double Tap scenario
    if (payload.scenarioConfig.id === 'double-tap') {
      this.simulateDoubleTapScenario(payload.sessionId, payload.targetDeviceIds);
    }

    console.log(`🎯 Mock scenario started: ${payload.sessionId}`);
    return session;
  }

  /**
   * Simulate Double Tap scenario execution
   */
  private simulateDoubleTapScenario(sessionId: string, targetDeviceIds: string[]) {
    const sessionData = this.activeSessions.get(sessionId);
    if (!sessionData) return;

    // Double Tap sequence: Target1→Target2→Target1→Target2
    const sequence = [
      { targetIndex: 0, targetNumber: 1 as const, shotNumber: 1 as const, delay: 1500 }, // 1.5s
      { targetIndex: 1, targetNumber: 2 as const, shotNumber: 1 as const, delay: 3000 }, // 3s  
      { targetIndex: 0, targetNumber: 1 as const, shotNumber: 2 as const, delay: 4500 }, // 4.5s
      { targetIndex: 1, targetNumber: 2 as const, shotNumber: 2 as const, delay: 6000 }, // 6s
    ];

    sequence.forEach((step, index) => {
      setTimeout(() => {
        const sessionData = this.activeSessions.get(sessionId);
        if (!sessionData || sessionData.isComplete) return;

        // Generate realistic reaction time (200-800ms)
        const baseReactionTime = 250 + Math.random() * 300; // 250-550ms base
        const skillVariation = Math.random() * 250; // 0-250ms variation
        const reactionTime = Math.round(baseReactionTime + skillVariation);

        const hit: MockHitEvent = {
          timestamp: Date.now(),
          targetId: targetDeviceIds[step.targetIndex],
          reactionTime,
          sequence: index + 1,
          targetNumber: step.targetNumber,
          shotNumber: step.shotNumber
        };

        sessionData.hits.push(hit);
        sessionData.currentStep = index + 1;

        console.log(`🎯 Mock hit registered: Target ${step.targetNumber}, Shot ${step.shotNumber}, RT: ${reactionTime}ms`);

        // Mark complete if all shots done
        if (index === sequence.length - 1) {
          sessionData.isComplete = true;
          sessionData.session.status = 'completed';
          sessionData.session.completedAt = Date.now();
          console.log(`✅ Mock scenario completed: ${sessionId}`);
        }
      }, step.delay);
    });

    // Auto-timeout after scenario time limit
    setTimeout(() => {
      const sessionData = this.activeSessions.get(sessionId);
      if (sessionData && !sessionData.isComplete) {
        sessionData.isComplete = true;
        sessionData.session.status = 'timeout';
        console.log(`⏰ Mock scenario timed out: ${sessionId}`);
      }
    }, sessionData.session.timeLimitMs);
  }

  /**
   * Get current scenario status
   */
  async getScenarioStatus(sessionId: string): Promise<{
    session: ScenarioSession | null;
    hitEvents: MockHitEvent[];
    currentProgress: number;
    timeRemaining: number;
  }> {
    const sessionData = this.activeSessions.get(sessionId);
    
    if (!sessionData) {
      return {
        session: null,
        hitEvents: [],
        currentProgress: 0,
        timeRemaining: 0
      };
    }

    const currentTime = Date.now();
    const timeElapsed = currentTime - sessionData.startTime;
    const timeRemaining = Math.max(0, sessionData.session.timeLimitMs - timeElapsed);
    const currentProgress = (sessionData.hits.length / sessionData.session.expectedShots) * 100;

    return {
      session: sessionData.session,
      hitEvents: sessionData.hits,
      currentProgress,
      timeRemaining
    };
  }

  /**
   * End scenario session and calculate results
   */
  async endScenarioSession(sessionId: string, reason: string = 'user_stopped'): Promise<ScenarioResults> {
    const sessionData = this.activeSessions.get(sessionId);
    
    if (!sessionData) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const endTime = Date.now();
    const totalDuration = endTime - sessionData.startTime;
    const hits = sessionData.hits;

    // Calculate performance metrics
    const totalHits = hits.length;
    const expectedHits = sessionData.session.expectedShots;
    const accuracy = (totalHits / expectedHits) * 100;

    const reactionTimes = hits.map(h => h.reactionTime);
    const averageReactionTime = reactionTimes.length > 0 
      ? reactionTimes.reduce((sum, rt) => sum + rt, 0) / reactionTimes.length 
      : 0;
    const fastestReactionTime = reactionTimes.length > 0 ? Math.min(...reactionTimes) : 0;
    const slowestReactionTime = reactionTimes.length > 0 ? Math.max(...reactionTimes) : 0;

    // Calculate score (70% accuracy + 30% speed)
    const accuracyScore = accuracy * 0.7;
    const speedScore = averageReactionTime > 0 
      ? Math.max(0, (600 - averageReactionTime) / 600 * 30) // 600ms = 0 points, 0ms = 30 points
      : 0;
    const score = Math.min(100, Math.round(accuracyScore + speedScore));

    // Calculate per-target results
    const targetResults = sessionData.session.targetDeviceIds.map((deviceId, index) => {
      const targetHits = hits.filter(h => h.targetId === deviceId);
      const targetReactionTimes = targetHits.map(h => h.reactionTime);
      
      return {
        targetDeviceId: deviceId,
        targetNumber: index + 1,
        hitsReceived: targetHits.length,
        expectedHits: sessionData.session.expectedShots / sessionData.session.targetDeviceIds.length,
        accuracy: targetHits.length > 0 ? (targetHits.length / (expectedHits / sessionData.session.targetDeviceIds.length)) * 100 : 0,
        reactionTimes: targetReactionTimes,
        averageReactionTime: targetReactionTimes.length > 0 
          ? targetReactionTimes.reduce((sum, rt) => sum + rt, 0) / targetReactionTimes.length 
          : 0,
        hitSequence: targetHits.map(h => h.sequence),
        correctSequence: true // Simplified for mock
      };
    });

    const results: ScenarioResults = {
      sessionId,
      scenarioId: sessionData.session.scenarioId,
      totalHits,
      expectedHits,
      accuracy,
      averageReactionTime,
      fastestReactionTime,
      slowestReactionTime,
      totalDuration,
      targetResults,
      passed: totalHits >= expectedHits,
      score,
      completedAt: endTime
    };

    // Clean up session
    this.activeSessions.delete(sessionId);
    
    console.log(`📊 Mock scenario results calculated:`, {
      sessionId,
      totalHits,
      accuracy: `${accuracy.toFixed(1)}%`,
      avgReactionTime: `${averageReactionTime.toFixed(0)}ms`,
      score
    });

    return results;
  }

  /**
   * Get mock live data for scenario
   */
  getMockLiveData(sessionId: string): {
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
  } {
    const sessionData = this.activeSessions.get(sessionId);
    
    if (!sessionData) {
      return {
        hitCount: 0,
        expectedHits: 4,
        progress: 0,
        timeRemaining: 0,
        averageReactionTime: 0,
        recentHits: [],
        isConnected: false
      };
    }

    const currentTime = Date.now();
    const timeElapsed = currentTime - sessionData.startTime;
    const timeRemaining = Math.max(0, sessionData.session.timeLimitMs - timeElapsed);
    const progress = (sessionData.hits.length / sessionData.session.expectedShots) * 100;

    const reactionTimes = sessionData.hits.map(h => h.reactionTime);
    const averageReactionTime = reactionTimes.length > 0 
      ? reactionTimes.reduce((sum, rt) => sum + rt, 0) / reactionTimes.length 
      : 0;

    return {
      hitCount: sessionData.hits.length,
      expectedHits: sessionData.session.expectedShots,
      progress: Math.min(100, progress),
      timeRemaining,
      lastHitTime: sessionData.hits.length > 0 ? Math.max(...sessionData.hits.map(h => h.timestamp)) : undefined,
      averageReactionTime,
      recentHits: sessionData.hits.map(h => ({
        timestamp: h.timestamp,
        targetId: h.targetId,
        reactionTime: h.reactionTime,
        sequence: h.sequence
      })).slice(-10).reverse(),
      isConnected: true
    };
  }

  /**
   * Check if session is active
   */
  isSessionActive(sessionId: string): boolean {
    const sessionData = this.activeSessions.get(sessionId);
    return sessionData ? !sessionData.isComplete : false;
  }

  /**
   * Get all active sessions (for debugging)
   */
  getActiveSessions(): string[] {
    return Array.from(this.activeSessions.keys());
  }

  /**
   * Cleanup - stop all active sessions
   */
  cleanup() {
    this.hitGenerationIntervals.forEach(interval => clearInterval(interval));
    this.hitGenerationIntervals.clear();
    this.activeSessions.clear();
    console.log('🧹 Mock scenario service cleaned up');
  }
}

// Create singleton instance
export const mockScenarioService = new MockScenarioService();

// Cleanup on page unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    mockScenarioService.cleanup();
  });
}
