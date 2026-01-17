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



