/**
 * Games Domain Business Rules
 * 
 * Business rules and invariants for game operations.
 * Pure functions - no React or Supabase imports.
 */

import { 
  GAME_CONSTRAINTS, 
  type GameSessionStatus,
  isActiveSessionStatus,
  isTerminalSessionStatus,
} from './validators';

/**
 * Game business rule result
 */
export type RuleResult = 
  | { valid: true }
  | { valid: false; violation: string; code: string };

/**
 * Game session summary for rule checks
 */
export type GameSessionSummary = {
  id: string;
  status: GameSessionStatus;
  startTime: number | null;
  endTime: number | null;
  deviceIds: string[];
};

/**
 * Target readiness summary
 */
export type TargetReadiness = {
  deviceId: string;
  isOnline: boolean;
  batteryLevel: number | null;
  hasErrors: boolean;
  gameStatus: string | null;
};

/**
 * Valid state transitions for game sessions
 */
export const VALID_STATE_TRANSITIONS: Record<GameSessionStatus, GameSessionStatus[]> = {
  idle: ['configuring'],
  configuring: ['launching', 'idle', 'error'],
  launching: ['running', 'stopping', 'error'],
  running: ['stopping', 'error'],
  stopping: ['finalizing', 'error'],
  finalizing: ['completed', 'error'],
  completed: ['idle'], // Can restart
  error: ['idle'], // Can restart
};

/**
 * Check if a state transition is valid
 */
export function isValidStateTransition(
  currentStatus: GameSessionStatus,
  newStatus: GameSessionStatus
): RuleResult {
  const validTransitions = VALID_STATE_TRANSITIONS[currentStatus];
  
  if (!validTransitions.includes(newStatus)) {
    return {
      valid: false,
      violation: `Cannot transition from '${currentStatus}' to '${newStatus}'`,
      code: 'INVALID_STATE_TRANSITION',
    };
  }
  
  return { valid: true };
}

/**
 * Check if targets can be used for a game session
 */
export function canUseTargetsForGame(
  targets: TargetReadiness[],
  minTargets: number = GAME_CONSTRAINTS.MIN_TARGETS
): RuleResult {
  if (targets.length < minTargets) {
    return {
      valid: false,
      violation: `At least ${minTargets} target(s) required, got ${targets.length}`,
      code: 'INSUFFICIENT_TARGETS',
    };
  }
  
  if (targets.length > GAME_CONSTRAINTS.MAX_TARGETS) {
    return {
      valid: false,
      violation: `Cannot exceed ${GAME_CONSTRAINTS.MAX_TARGETS} targets`,
      code: 'TOO_MANY_TARGETS',
    };
  }
  
  // Check for offline targets
  const offlineTargets = targets.filter((t) => !t.isOnline);
  if (offlineTargets.length > 0) {
    return {
      valid: false,
      violation: `${offlineTargets.length} target(s) are offline`,
      code: 'TARGETS_OFFLINE',
    };
  }
  
  // Check for targets with errors
  const errorTargets = targets.filter((t) => t.hasErrors);
  if (errorTargets.length > 0) {
    return {
      valid: false,
      violation: `${errorTargets.length} target(s) have errors`,
      code: 'TARGETS_HAVE_ERRORS',
    };
  }
  
  // Check for targets with low battery
  const lowBatteryTargets = targets.filter((t) => 
    t.batteryLevel !== null && t.batteryLevel < 10
  );
  if (lowBatteryTargets.length > 0) {
    return {
      valid: false,
      violation: `${lowBatteryTargets.length} target(s) have critically low battery`,
      code: 'TARGETS_LOW_BATTERY',
    };
  }
  
  // Check for targets already in a game
  const busyTargets = targets.filter((t) => 
    t.gameStatus && !['idle', 'stopped', null].includes(t.gameStatus)
  );
  if (busyTargets.length > 0) {
    return {
      valid: false,
      violation: `${busyTargets.length} target(s) are already in a game`,
      code: 'TARGETS_BUSY',
    };
  }
  
  return { valid: true };
}

/**
 * Check if user can start a new game session
 */
export function canStartNewSession(
  activeSessions: GameSessionSummary[]
): RuleResult {
  // Check if user already has an active session
  const activeSession = activeSessions.find((s) => isActiveSessionStatus(s.status));
  
  if (activeSession) {
    return {
      valid: false,
      violation: `Already have an active game session (${activeSession.id})`,
      code: 'ACTIVE_SESSION_EXISTS',
    };
  }
  
  return { valid: true };
}

/**
 * Check if game session can be stopped
 */
export function canStopGameSession(session: GameSessionSummary): RuleResult {
  if (isTerminalSessionStatus(session.status)) {
    return {
      valid: false,
      violation: `Session is already in terminal state: ${session.status}`,
      code: 'SESSION_ALREADY_ENDED',
    };
  }
  
  if (session.status === 'idle') {
    return {
      valid: false,
      violation: 'Cannot stop a session that has not started',
      code: 'SESSION_NOT_STARTED',
    };
  }
  
  return { valid: true };
}

/**
 * Calculate accuracy percentage
 */
export function calculateAccuracy(hits: number, totalShots: number): number {
  if (totalShots === 0) {
    return 0;
  }
  
  return Math.round((hits / totalShots) * 100);
}

/**
 * Calculate score based on hits, accuracy, and time
 * @deprecated Use calculateSessionScore() for time-based scoring
 */
export function calculateScore(
  hits: number,
  accuracy: number,
  durationMs: number,
  timeLimitMs: number | null
): number {
  // Base score from hits
  let score = hits * 100;
  
  // Accuracy bonus (up to 50% bonus for perfect accuracy)
  const accuracyBonus = Math.round(score * (accuracy / 100) * 0.5);
  score += accuracyBonus;
  
  // Time bonus (if completed within time limit)
  if (timeLimitMs && durationMs < timeLimitMs) {
    const timeRatio = 1 - (durationMs / timeLimitMs);
    const timeBonus = Math.round(score * timeRatio * 0.25);
    score += timeBonus;
  }
  
  return Math.max(0, score);
}

/**
 * Hit record for session scoring
 */
export type SessionHitRecordForScoring = {
  deviceId: string;
  timestamp: number;
};

/**
 * Result of session score calculation
 */
export type SessionScoreResult = {
  /** Score in seconds (time of last required hit relative to start). Null if run is invalid. */
  score: number | null;
  /** Whether the run is valid (all required hits occurred) */
  isValid: boolean;
  /** Diagnostic splits per target (time between consecutive hits on same target) */
  splitsByTarget: Record<string, number[]>;
  /** Between-target transition times (for multi-target sessions) */
  transitionTimes: number[];
  /** Time of each target's Nth (last required) hit relative to start */
  lastRequiredHitTimeByTarget: Record<string, number | null>;
};

/**
 * Check if a run is valid based on required hits per target.
 * A run is valid only if all required hits occur on all targets.
 */
export function isRunValid(
  hitHistory: SessionHitRecordForScoring[],
  goalShotsPerTarget: Record<string, number>
): boolean {
  // If no goals are set, the run is valid (no requirements)
  if (Object.keys(goalShotsPerTarget).length === 0) {
    return true;
  }

  // Group hits by device
  const hitsByDevice = new Map<string, number>();
  for (const hit of hitHistory) {
    const count = hitsByDevice.get(hit.deviceId) ?? 0;
    hitsByDevice.set(hit.deviceId, count + 1);
  }

  // Check if all targets have their required hits
  return Object.entries(goalShotsPerTarget).every(
    ([deviceId, requiredHits]) => (hitsByDevice.get(deviceId) ?? 0) >= requiredHits
  );
}

/**
 * Options for session score calculation
 */
export interface CalculateSessionScoreOptions {
  /**
   * Target engagement order for multi-target sessions.
   * When provided, targets must be engaged in this specific order.
   * Array of device IDs in the required engagement order (e.g., ['targetA', 'targetB']).
   * If not provided, order is not enforced.
   */
  targetOrder?: string[];
}

/**
 * Calculate session score based on the time-based scoring system.
 * 
 * Core principles:
 * - A run is valid only if all required hits occur (when goals are set)
 * - Score = total elapsed time (time of Nth/last required hit)
 * - No averages, no split weighting, no partial credit
 * - Splits exist for analysis only, not for scoring
 * 
 * For sessions WITHOUT goals set:
 * - Score = time from first hit to last hit (total run time)
 * - Always valid (no requirements to meet)
 * 
 * For 1-target sessions with goals:
 * - Score = time of the Nth hit (e.g., if 2 hits required, score = time of 2nd hit)
 * 
 * For 2-target sessions (order enforced, e.g., A then B):
 * - All required hits on A must occur before hits on B count
 * - Score = time of last required hit (B's Nth hit)
 * 
 * For 2-target sessions (order NOT enforced):
 * - Score = max(time of last required hit on A, time of last required hit on B)
 * - Each target must receive its required number of hits
 * 
 * @param hitHistory - Array of hit records with deviceId and timestamp
 * @param goalShotsPerTarget - Map of deviceId to required number of hits
 * @param startTime - Session start timestamp in milliseconds
 * @param options - Optional configuration including target order enforcement
 * @returns SessionScoreResult with score (in seconds), validity, and diagnostic data
 */
export function calculateSessionScore(
  hitHistory: SessionHitRecordForScoring[],
  goalShotsPerTarget: Record<string, number>,
  startTime: number,
  options: CalculateSessionScoreOptions = {}
): SessionScoreResult {
  // Sort hits by timestamp first (needed for all calculations)
  const sortedHits = [...hitHistory].sort((a, b) => a.timestamp - b.timestamp);

  // Group hits by device with timestamps
  const hitsByDevice = new Map<string, number[]>();
  for (const hit of sortedHits) {
    const times = hitsByDevice.get(hit.deviceId) ?? [];
    times.push(hit.timestamp);
    hitsByDevice.set(hit.deviceId, times);
  }

  // Calculate splits per target (time between consecutive hits on same target)
  const splitsByTarget: Record<string, number[]> = {};
  for (const [deviceId, timestamps] of hitsByDevice.entries()) {
    const splits: number[] = [];
    for (let i = 1; i < timestamps.length; i++) {
      splits.push((timestamps[i] - timestamps[i - 1]) / 1000);
    }
    splitsByTarget[deviceId] = splits;
  }

  // Calculate between-target transition times
  const transitionTimes: number[] = [];
  for (let i = 1; i < sortedHits.length; i++) {
    if (sortedHits[i].deviceId !== sortedHits[i - 1].deviceId) {
      transitionTimes.push((sortedHits[i].timestamp - sortedHits[i - 1].timestamp) / 1000);
    }
  }

  // If no goals are set, calculate simple first-to-last time
  if (Object.keys(goalShotsPerTarget).length === 0) {
    let score: number | null = null;
    
    if (sortedHits.length >= 2) {
      // Score = time from first hit to last hit
      const firstHit = sortedHits[0].timestamp;
      const lastHit = sortedHits[sortedHits.length - 1].timestamp;
      score = Number(((lastHit - firstHit) / 1000).toFixed(2));
    } else if (sortedHits.length === 1) {
      // Only one hit - score is time from start to that hit
      score = Number(((sortedHits[0].timestamp - startTime) / 1000).toFixed(2));
    }
    
    return {
      score,
      isValid: true,
      splitsByTarget,
      transitionTimes,
      lastRequiredHitTimeByTarget: {},
    };
  }

  // Check validity and find last required hit time for each target
  const lastRequiredHitTimeByTarget: Record<string, number | null> = {};
  const lastRequiredHitTimestamps: number[] = [];
  let isValid = true;

  // If order is enforced, validate hits occur in the correct sequence
  const { targetOrder } = options;
  if (targetOrder && targetOrder.length > 1) {
    // Order enforcement mode: hits must complete each target in sequence
    // For example, if order is [A, B] and each needs 2 hits:
    // Valid: A1, A2, B1, B2 (score = B2 time)
    // Invalid: A1, B1, A2, B2 (out of order)
    
    let currentTargetIndex = 0;
    let hitsOnCurrentTarget = 0;
    
    for (const hit of sortedHits) {
      const targetIndex = targetOrder.indexOf(hit.deviceId);
      
      if (targetIndex === -1) {
        // Hit on a target not in the order list - ignore
        continue;
      }
      
      if (targetIndex < currentTargetIndex) {
        // Hit on a target we've already completed - this violates order
        isValid = false;
        break;
      }
      
      if (targetIndex > currentTargetIndex) {
        // Hit on a later target - check if we've completed the current target
        const currentTargetId = targetOrder[currentTargetIndex];
        const requiredHits = goalShotsPerTarget[currentTargetId] ?? 0;
        
        if (hitsOnCurrentTarget < requiredHits) {
          // Haven't completed current target yet - order violation
          isValid = false;
          break;
        }
        
        // Move to the target that was hit
        // Skip any intermediate targets and mark them as incomplete if they have requirements
        for (let i = currentTargetIndex + 1; i < targetIndex; i++) {
          const skippedTargetId = targetOrder[i];
          const skippedRequiredHits = goalShotsPerTarget[skippedTargetId] ?? 0;
          if (skippedRequiredHits > 0) {
            isValid = false;
            lastRequiredHitTimeByTarget[skippedTargetId] = null;
          }
        }
        
        if (!isValid) break;
        
        currentTargetIndex = targetIndex;
        hitsOnCurrentTarget = 1;
      } else {
        // Hit on current target
        hitsOnCurrentTarget++;
      }
      
      // Record the last required hit time for this target
      const currentTargetId = targetOrder[currentTargetIndex];
      const requiredHits = goalShotsPerTarget[currentTargetId] ?? 0;
      
      if (hitsOnCurrentTarget === requiredHits) {
        const timeFromStart = (hit.timestamp - startTime) / 1000;
        lastRequiredHitTimeByTarget[currentTargetId] = timeFromStart;
        lastRequiredHitTimestamps.push(hit.timestamp);
      }
    }
    
    // After processing all hits, check if all ordered targets were completed
    if (isValid) {
      for (let i = 0; i < targetOrder.length; i++) {
        const targetId = targetOrder[i];
        const requiredHits = goalShotsPerTarget[targetId] ?? 0;
        const actualHits = hitsByDevice.get(targetId)?.length ?? 0;
        
        if (requiredHits > 0 && actualHits < requiredHits) {
          isValid = false;
          lastRequiredHitTimeByTarget[targetId] = null;
        }
      }
    }
  } else {
    // No order enforcement - original logic
    for (const [deviceId, requiredHits] of Object.entries(goalShotsPerTarget)) {
      const hits = hitsByDevice.get(deviceId) ?? [];
      
      if (hits.length < requiredHits) {
        // Not enough hits - invalid run
        isValid = false;
        lastRequiredHitTimeByTarget[deviceId] = null;
      } else {
        // Get the Nth hit timestamp (the last required hit)
        const nthHitTimestamp = hits[requiredHits - 1];
        const timeFromStart = (nthHitTimestamp - startTime) / 1000;
        lastRequiredHitTimeByTarget[deviceId] = timeFromStart;
        lastRequiredHitTimestamps.push(nthHitTimestamp);
      }
    }
  }

  // Score = time of last required hit (relative to start)
  // For multi-target: max of all targets' last required hit times
  let score: number | null = null;
  if (isValid && lastRequiredHitTimestamps.length > 0) {
    const lastRequiredHit = Math.max(...lastRequiredHitTimestamps);
    score = Number(((lastRequiredHit - startTime) / 1000).toFixed(2));
  }

  return {
    score,
    isValid,
    splitsByTarget,
    transitionTimes,
    lastRequiredHitTimeByTarget,
  };
}

/**
 * Determine session duration
 */
export function calculateSessionDuration(
  startTime: number | null,
  endTime: number | null
): number {
  if (!startTime) {
    return 0;
  }
  
  const end = endTime ?? Date.now();
  return Math.max(0, end - startTime);
}

/**
 * Check if game time limit has been exceeded
 */
export function isTimeLimitExceeded(
  startTime: number,
  timeLimitMs: number | null
): boolean {
  if (!timeLimitMs) {
    return false;
  }
  
  const elapsed = Date.now() - startTime;
  return elapsed >= timeLimitMs;
}

/**
 * Get remaining time in game
 */
export function getRemainingTime(
  startTime: number,
  timeLimitMs: number | null
): number | null {
  if (!timeLimitMs) {
    return null;
  }
  
  const elapsed = Date.now() - startTime;
  return Math.max(0, timeLimitMs - elapsed);
}

/**
 * Get game performance rating
 */
export function getPerformanceRating(
  accuracy: number,
  score: number,
  expectedScore: number
): 'excellent' | 'good' | 'average' | 'needs_improvement' {
  const scoreRatio = expectedScore > 0 ? score / expectedScore : 0;
  
  if (accuracy >= 90 && scoreRatio >= 0.9) {
    return 'excellent';
  }
  
  if (accuracy >= 75 && scoreRatio >= 0.7) {
    return 'good';
  }
  
  if (accuracy >= 50 && scoreRatio >= 0.5) {
    return 'average';
  }
  
  return 'needs_improvement';
}

/**
 * Sort game sessions by recency
 */
export function sortSessionsByRecency(sessions: GameSessionSummary[]): GameSessionSummary[] {
  return [...sessions].sort((a, b) => {
    const timeA = a.startTime ?? 0;
    const timeB = b.startTime ?? 0;
    return timeB - timeA;
  });
}

/**
 * Filter active game sessions
 */
export function filterActiveSessions(sessions: GameSessionSummary[]): GameSessionSummary[] {
  return sessions.filter((s) => isActiveSessionStatus(s.status));
}

/**
 * Filter completed game sessions
 */
export function filterCompletedSessions(sessions: GameSessionSummary[]): GameSessionSummary[] {
  return sessions.filter((s) => s.status === 'completed');
}

/**
 * Validate game configuration
 */
export function validateGameConfiguration(
  targetCount: number,
  shotsPerTarget: number,
  timeLimitMs: number | null
): RuleResult {
  if (targetCount < GAME_CONSTRAINTS.MIN_TARGETS) {
    return {
      valid: false,
      violation: `Target count must be at least ${GAME_CONSTRAINTS.MIN_TARGETS}`,
      code: 'INVALID_TARGET_COUNT',
    };
  }
  
  if (targetCount > GAME_CONSTRAINTS.MAX_TARGETS) {
    return {
      valid: false,
      violation: `Target count cannot exceed ${GAME_CONSTRAINTS.MAX_TARGETS}`,
      code: 'INVALID_TARGET_COUNT',
    };
  }
  
  if (shotsPerTarget < GAME_CONSTRAINTS.MIN_SHOTS_PER_TARGET) {
    return {
      valid: false,
      violation: `Shots per target must be at least ${GAME_CONSTRAINTS.MIN_SHOTS_PER_TARGET}`,
      code: 'INVALID_SHOTS_PER_TARGET',
    };
  }
  
  if (shotsPerTarget > GAME_CONSTRAINTS.MAX_SHOTS_PER_TARGET) {
    return {
      valid: false,
      violation: `Shots per target cannot exceed ${GAME_CONSTRAINTS.MAX_SHOTS_PER_TARGET}`,
      code: 'INVALID_SHOTS_PER_TARGET',
    };
  }
  
  if (timeLimitMs !== null) {
    if (timeLimitMs < GAME_CONSTRAINTS.MIN_TIME_LIMIT_MS) {
      return {
        valid: false,
        violation: `Time limit must be at least ${GAME_CONSTRAINTS.MIN_TIME_LIMIT_MS / 1000} seconds`,
        code: 'INVALID_TIME_LIMIT',
      };
    }
    
    if (timeLimitMs > GAME_CONSTRAINTS.MAX_TIME_LIMIT_MS) {
      return {
        valid: false,
        violation: `Time limit cannot exceed ${GAME_CONSTRAINTS.MAX_TIME_LIMIT_MS / 60000} minutes`,
        code: 'INVALID_TIME_LIMIT',
      };
    }
  }
  
  return { valid: true };
}



