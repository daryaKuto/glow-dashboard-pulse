/**
 * Scenario API abstraction that proxies all device interactions through
 * Supabase edge functions so ThingsBoard credentials stay server-side.
 */

/**
 * @deprecated Legacy implementation.
 * Replaced by: src/pages/Scenarios.tsx (legacy scenario flow), no active feature module.
 */

import { supabase } from '@/integrations/supabase/client';
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
} from '@/shared/types';
import { SCENARIO_TELEMETRY_KEYS } from '@/shared/types';

class ScenarioApiService {
  private sessions: Map<string, ScenarioSession> = new Map();
  private sessionHits: Map<string, ScenarioHitEvent[]> = new Map();

  private async invokeScenarioControl(payload: Record<string, unknown>): Promise<any> {
    try {
      const { data, error } = await supabase.functions.invoke('scenario-control', {
        body: payload,
      });

      if (error) {
        throw new Error(error.message ?? 'Scenario control invocation failed');
      }

      return data;
    } catch (error) {
      console.error('[ScenarioApi] scenario-control invocation failed', { payload, error });
      throw error;
    }
  }

  private recordHitEvent(sessionId: string, event: ScenarioHitEvent): void {
    const existing = this.sessionHits.get(sessionId) ?? [];
    existing.push(event);
    this.sessionHits.set(sessionId, existing);
  }

  private getSessionHits(sessionId: string): ScenarioHitEvent[] {
    return [...(this.sessionHits.get(sessionId) ?? [])];
  }

  
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

    await this.invokeScenarioControl({
      action: 'start-session',
      session: {
        sessionId: session.sessionId,
        scenarioId: session.scenarioId,
        startTime: session.startTime,
        targetDeviceIds: session.targetDeviceIds,
      },
    });

    this.sessions.set(session.sessionId, session);
    this.sessionHits.set(session.sessionId, []);

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

    await this.invokeScenarioControl({
      action: 'send-beep',
      command: {
        sessionId: payload.sessionId,
        targetDeviceId: payload.targetDeviceId,
        beepType: payload.beepType,
        beepSequence: payload.beepSequence,
        timestamp: payload.timestamp,
        expectedResponseWindow: payload.expectedResponseWindow,
      },
    });

    return beepEvent;
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
      [SCENARIO_TELEMETRY_KEYS.EVENT]: 'hit',
      [SCENARIO_TELEMETRY_KEYS.SESSION_ID]: payload.sessionId,
    });

    this.recordHitEvent(payload.sessionId, hitEvent);

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
    await this.invokeScenarioControl({
      action: 'end-session',
      session: {
        sessionId: payload.sessionId,
        endTime: payload.endTime,
        reason: payload.reason,
        targetDeviceIds: session.targetDeviceIds,
        results: {
          score: results.score,
          accuracy: results.accuracy,
          totalHits: results.totalHits,
          averageReactionTime: results.averageReactionTime,
        },
      },
    });

    this.sessions.set(payload.sessionId, {
      ...session,
      status: payload.reason === 'completed' ? 'completed' : payload.reason === 'user_stopped' ? 'stopped' : 'failed',
      completedAt: payload.endTime,
      endTime: payload.endTime,
    });

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
      await this.invokeScenarioControl({
        action: 'send-telemetry',
        telemetryPayload: {
          deviceId,
          telemetry: data,
        },
      });
    } catch (error) {
      console.warn('[ScenarioApi] Failed to send session telemetry', { deviceId, error });
    }
  }

  private async getBeepTelemetry(deviceId: string, beepSequence: number) {
    // TODO: Implement retrieval of specific beep telemetry
    return { timestamp: Date.now() - 1000 }; // Placeholder
  }

  private getSessionStartTime(sessionId: string): number {
    return this.sessions.get(sessionId)?.startTime ?? Date.now();
  }

  private async getSessionHitEvents(sessionId: string): Promise<ScenarioHitEvent[]> {
    return this.getSessionHits(sessionId);
  }

  private async getSessionData(sessionId: string): Promise<ScenarioSession | null> {
    return this.sessions.get(sessionId) ?? null;
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
    if (hitEvents.length === 0) {
      return [];
    }

    const byTarget = new Map<string, ScenarioHitEvent[]>();
    hitEvents.forEach((event) => {
      const events = byTarget.get(event.targetDeviceId) ?? [];
      events.push(event);
      byTarget.set(event.targetDeviceId, events);
    });

    let targetNumber = 1;
    return Array.from(byTarget.entries()).map(([deviceId, events]) => {
      const reactionTimes = events.map((event) => event.reactionTime);
      const averageReactionTime = reactionTimes.length > 0
        ? reactionTimes.reduce((sum, value) => sum + value, 0) / reactionTimes.length
        : 0;

      return {
        targetDeviceId: deviceId,
        targetNumber: targetNumber++,
        hitsReceived: events.length,
        expectedHits: events.length,
        accuracy: 100,
        reactionTimes,
        averageReactionTime,
        hitSequence: events.map((event) => event.hitSequence),
        correctSequence: true,
      };
    });
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
