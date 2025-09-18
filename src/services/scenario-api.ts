/**
 * ThingsBoard Scenario API Service
 * Handles all scenario-related API communications with ThingsBoard
 */

import thingsBoardService from './thingsboard';
import type {
  ScenarioSession,
  ScenarioBeepEvent,
  ScenarioHitEvent,
  ScenarioResults,
  StartScenarioPayload,
  BeepCommandPayload,
  HitTelemetryPayload,
  EndScenarioPayload,
  DoubleTapSequence
} from '../types/scenario-data';
import { SCENARIO_TELEMETRY_KEYS } from '../types/scenario-data';

class ScenarioApiService {
  
  /**
   * Start a new scenario session
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

    // Send session start telemetry to all participating targets
    for (const deviceId of payload.targetDeviceIds) {
      await this.sendSessionTelemetry(deviceId, {
        [SCENARIO_TELEMETRY_KEYS.SESSION_ID]: payload.sessionId,
        [SCENARIO_TELEMETRY_KEYS.SESSION_STATUS]: 'active',
        [SCENARIO_TELEMETRY_KEYS.SESSION_START]: payload.startTime,
        [SCENARIO_TELEMETRY_KEYS.GAME_NAME]: payload.scenarioConfig.id,
        [SCENARIO_TELEMETRY_KEYS.GAME_ID]: payload.sessionId
      });
    }

    return session;
  }

  /**
   * Send beep command to target device
   */
  async sendBeepCommand(payload: BeepCommandPayload): Promise<ScenarioBeepEvent> {
    const beepEvent: ScenarioBeepEvent = {
      sessionId: payload.sessionId,
      targetDeviceId: payload.targetDeviceId,
      beepSequence: payload.beepSequence,
      beepTimestamp: payload.timestamp,
      expectedResponseWindow: payload.expectedResponseWindow,
      beepType: payload.beepType,
      targetNumber: payload.beepSequence // Simplified for now
    };

    // Send beep command via ThingsBoard RPC
    try {
      const rpcResponse = await thingsBoardService.sendRpcCommand(
        payload.targetDeviceId,
        'beep',
        {
          type: payload.beepType,
          sequence: payload.beepSequence,
          sessionId: payload.sessionId,
          responseWindow: payload.expectedResponseWindow,
          timestamp: payload.timestamp
        }
      );

      // Also send telemetry for tracking
      await this.sendSessionTelemetry(payload.targetDeviceId, {
        [SCENARIO_TELEMETRY_KEYS.BEEP_SENT]: payload.timestamp,
        [SCENARIO_TELEMETRY_KEYS.BEEP_TYPE]: payload.beepType,
        [SCENARIO_TELEMETRY_KEYS.BEEP_SEQUENCE]: payload.beepSequence,
        [SCENARIO_TELEMETRY_KEYS.BEEP_TS]: payload.timestamp // Legacy compatibility
      });

      console.log(`Beep sent to ${payload.targetDeviceId}:`, rpcResponse);
      return beepEvent;

    } catch (error) {
      console.error('Failed to send beep command:', error);
      throw error;
    }
  }

  /**
   * Process hit telemetry received from target
   */
  async processHitTelemetry(payload: HitTelemetryPayload): Promise<ScenarioHitEvent> {
    // Calculate reaction time (hit timestamp - beep reference timestamp)
    const beepTelemetry = await this.getBeepTelemetry(payload.targetDeviceId, payload.beepReference);
    const reactionTime = payload.hitTimestamp - (beepTelemetry?.timestamp || 0);
    
    const hitEvent: ScenarioHitEvent = {
      sessionId: payload.sessionId,
      targetDeviceId: payload.targetDeviceId,
      hitSequence: payload.hitSequence,
      hitTimestamp: payload.hitTimestamp,
      reactionTime: Math.max(0, reactionTime), // Ensure non-negative
      relativeTime: payload.hitTimestamp - this.getSessionStartTime(payload.sessionId),
      expectedTarget: true, // TODO: Implement target sequence validation
      shotNumber: payload.shotNumber,
      beepTimestamp: beepTelemetry?.timestamp || 0,
      accuracy: 'hit' // TODO: Implement miss detection
    };

    // Send hit telemetry back to ThingsBoard for storage
    await this.sendSessionTelemetry(payload.targetDeviceId, {
      [SCENARIO_TELEMETRY_KEYS.HIT_REGISTERED]: payload.hitTimestamp,
      [SCENARIO_TELEMETRY_KEYS.HIT_SEQUENCE]: payload.hitSequence,
      [SCENARIO_TELEMETRY_KEYS.REACTION_TIME]: reactionTime,
      [SCENARIO_TELEMETRY_KEYS.SHOT_NUMBER]: payload.shotNumber,
      [SCENARIO_TELEMETRY_KEYS.HIT_TS]: payload.hitTimestamp, // Legacy compatibility
      [SCENARIO_TELEMETRY_KEYS.HITS]: payload.hitSequence, // Legacy compatibility
      [SCENARIO_TELEMETRY_KEYS.EVENT]: 'hit' // Legacy compatibility
    });

    return hitEvent;
  }

  /**
   * End scenario session and calculate results
   */
  async endScenarioSession(payload: EndScenarioPayload): Promise<ScenarioResults> {
    // Collect all hit events for this session
    const hitEvents = await this.getSessionHitEvents(payload.sessionId);
    const session = await this.getSessionData(payload.sessionId);
    
    if (!session) {
      throw new Error(`Session ${payload.sessionId} not found`);
    }

    // Calculate results
    const results: ScenarioResults = {
      sessionId: payload.sessionId,
      scenarioId: session.scenarioId,
      totalHits: hitEvents.length,
      expectedHits: session.expectedShots,
      accuracy: hitEvents.length / session.expectedShots * 100,
      averageReactionTime: this.calculateAverageReactionTime(hitEvents),
      fastestReactionTime: this.getFastestReactionTime(hitEvents),
      slowestReactionTime: this.getSlowestReactionTime(hitEvents),
      totalDuration: payload.endTime - session.startTime,
      targetResults: await this.calculateTargetResults(payload.sessionId, hitEvents),
      passed: hitEvents.length >= session.expectedShots,
      score: this.calculateScore(hitEvents, session),
      completedAt: payload.endTime
    };

    // Send final results telemetry to all targets
    for (const deviceId of session.targetDeviceIds) {
      await this.sendSessionTelemetry(deviceId, {
        [SCENARIO_TELEMETRY_KEYS.SESSION_STATUS]: payload.reason,
        [SCENARIO_TELEMETRY_KEYS.SESSION_END]: payload.endTime,
        [SCENARIO_TELEMETRY_KEYS.SCENARIO_SCORE]: results.score,
        [SCENARIO_TELEMETRY_KEYS.SCENARIO_ACCURACY]: results.accuracy,
        [SCENARIO_TELEMETRY_KEYS.TOTAL_HITS]: results.totalHits,
        [SCENARIO_TELEMETRY_KEYS.AVERAGE_REACTION]: results.averageReactionTime
      });
    }

    return results;
  }

  /**
   * Execute Double Tap scenario with proper timing sequence
   */
  async executeDoubleTapScenario(
    sessionId: string, 
    targetDeviceIds: string[], 
    sequence: DoubleTapSequence
  ): Promise<void> {
    console.log(`Starting Double Tap scenario ${sessionId} with targets:`, targetDeviceIds);
    
    // Execute the predefined sequence
    for (let i = 0; i < sequence.sequence.length; i++) {
      const step = sequence.sequence[i];
      const targetIndex = step.targetNumber - 1; // Convert to 0-based index
      const targetDeviceId = targetDeviceIds[targetIndex];
      
      if (!targetDeviceId) {
        console.error(`Target ${step.targetNumber} not found in device list`);
        continue;
      }

      // Wait for the expected timing
      await this.delay(step.expectedTiming - (i > 0 ? sequence.sequence[i-1].expectedTiming : 0));
      
      // Send beep command
      await this.sendBeepCommand({
        sessionId,
        targetDeviceId,
        beepType: 'go',
        beepSequence: i + 1,
        timestamp: Date.now(),
        expectedResponseWindow: sequence.responseWindow
      });

      console.log(`Beep sent to Target ${step.targetNumber} for Shot ${step.shotNumber}`);
    }
  }

  /**
   * Get real-time scenario status
   */
  async getScenarioStatus(sessionId: string): Promise<{
    session: ScenarioSession | null;
    hitEvents: ScenarioHitEvent[];
    currentProgress: number;
    timeRemaining: number;
  }> {
    const session = await this.getSessionData(sessionId);
    const hitEvents = await this.getSessionHitEvents(sessionId);
    
    if (!session) {
      return {
        session: null,
        hitEvents: [],
        currentProgress: 0,
        timeRemaining: 0
      };
    }

    const currentTime = Date.now();
    const timeElapsed = currentTime - session.startTime;
    const timeRemaining = Math.max(0, session.timeLimitMs - timeElapsed);
    const currentProgress = (hitEvents.length / session.expectedShots) * 100;

    return {
      session,
      hitEvents,
      currentProgress,
      timeRemaining
    };
  }

  // Private helper methods
  private async sendSessionTelemetry(deviceId: string, data: Record<string, any>): Promise<void> {
    try {
      await thingsBoardService.sendTelemetry(deviceId, data);
    } catch (error) {
      console.error(`Failed to send telemetry to ${deviceId}:`, error);
    }
  }

  private async getBeepTelemetry(deviceId: string, beepSequence: number) {
    // TODO: Implement retrieval of specific beep telemetry
    return { timestamp: Date.now() - 1000 }; // Placeholder
  }

  private getSessionStartTime(sessionId: string): number {
    // TODO: Implement session start time lookup
    return Date.now() - 10000; // Placeholder
  }

  private async getSessionHitEvents(sessionId: string): Promise<ScenarioHitEvent[]> {
    // TODO: Implement hit events retrieval from ThingsBoard
    return []; // Placeholder
  }

  private async getSessionData(sessionId: string): Promise<ScenarioSession | null> {
    // TODO: Implement session data retrieval
    return null; // Placeholder
  }

  private calculateAverageReactionTime(hitEvents: ScenarioHitEvent[]): number {
    if (hitEvents.length === 0) return 0;
    const total = hitEvents.reduce((sum, event) => sum + event.reactionTime, 0);
    return total / hitEvents.length;
  }

  private getFastestReactionTime(hitEvents: ScenarioHitEvent[]): number {
    if (hitEvents.length === 0) return 0;
    return Math.min(...hitEvents.map(e => e.reactionTime));
  }

  private getSlowestReactionTime(hitEvents: ScenarioHitEvent[]): number {
    if (hitEvents.length === 0) return 0;
    return Math.max(...hitEvents.map(e => e.reactionTime));
  }

  private async calculateTargetResults(sessionId: string, hitEvents: ScenarioHitEvent[]) {
    // TODO: Implement per-target result calculation
    return [];
  }

  private calculateScore(hitEvents: ScenarioHitEvent[], session: ScenarioSession): number {
    // Simple scoring: 70% accuracy + 30% speed
    const accuracyScore = (hitEvents.length / session.expectedShots) * 70;
    const avgReactionTime = this.calculateAverageReactionTime(hitEvents);
    const speedScore = Math.max(0, 30 - (avgReactionTime / 100)); // Faster = higher score
    return Math.min(100, accuracyScore + speedScore);
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export const scenarioApiService = new ScenarioApiService();
