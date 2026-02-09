import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  VALID_STATE_TRANSITIONS,
  isValidStateTransition,
  canUseTargetsForGame,
  canStartNewSession,
  canStopGameSession,
  calculateAccuracy,
  calculateScore,
  isRunValid,
  calculateSessionScore,
  calculateSessionDuration,
  isTimeLimitExceeded,
  getRemainingTime,
  getPerformanceRating,
  sortSessionsByRecency,
  filterActiveSessions,
  filterCompletedSessions,
  validateGameConfiguration,
  type TargetReadiness,
  type GameSessionSummary,
} from '../../src/domain/games/rules';
import { GAME_CONSTRAINTS } from '../../src/domain/games/validators';

describe('games rules', () => {
  describe('isValidStateTransition', () => {
    it('allows valid transitions from idle', () => {
      const result = isValidStateTransition('idle', 'configuring');
      expect(result.valid).toBe(true);
    });

    it('allows transition from configuring to launching', () => {
      const result = isValidStateTransition('configuring', 'launching');
      expect(result.valid).toBe(true);
    });

    it('allows transition from running to stopping', () => {
      const result = isValidStateTransition('running', 'stopping');
      expect(result.valid).toBe(true);
    });

    it('allows transition to error from most states', () => {
      const result = isValidStateTransition('running', 'error');
      expect(result.valid).toBe(true);
    });

    it('allows restart from completed', () => {
      const result = isValidStateTransition('completed', 'idle');
      expect(result.valid).toBe(true);
    });

    it('allows restart from error', () => {
      const result = isValidStateTransition('error', 'idle');
      expect(result.valid).toBe(true);
    });

    it('rejects invalid transition from idle to running', () => {
      const result = isValidStateTransition('idle', 'running');
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.code).toBe('INVALID_STATE_TRANSITION');
        expect(result.violation).toContain('idle');
        expect(result.violation).toContain('running');
      }
    });

    it('rejects transition from completed to running', () => {
      const result = isValidStateTransition('completed', 'running');
      expect(result.valid).toBe(false);
    });
  });

  describe('canUseTargetsForGame', () => {
    const createTarget = (overrides: Partial<TargetReadiness> = {}): TargetReadiness => ({
      deviceId: 'device-1',
      isOnline: true,
      batteryLevel: 80,
      hasErrors: false,
      gameStatus: null,
      ...overrides,
    });

    it('allows valid targets', () => {
      const targets = [createTarget(), createTarget({ deviceId: 'device-2' })];
      const result = canUseTargetsForGame(targets);
      expect(result.valid).toBe(true);
    });

    it('rejects insufficient targets', () => {
      const result = canUseTargetsForGame([], 1);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.code).toBe('INSUFFICIENT_TARGETS');
      }
    });

    it('rejects too many targets', () => {
      const targets = Array.from({ length: GAME_CONSTRAINTS.MAX_TARGETS + 1 }, (_, i) =>
        createTarget({ deviceId: `device-${i}` })
      );
      const result = canUseTargetsForGame(targets);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.code).toBe('TOO_MANY_TARGETS');
      }
    });

    it('rejects offline targets', () => {
      const targets = [createTarget({ isOnline: false })];
      const result = canUseTargetsForGame(targets);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.code).toBe('TARGETS_OFFLINE');
      }
    });

    it('rejects targets with errors', () => {
      const targets = [createTarget({ hasErrors: true })];
      const result = canUseTargetsForGame(targets);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.code).toBe('TARGETS_HAVE_ERRORS');
      }
    });

    it('rejects targets with low battery', () => {
      const targets = [createTarget({ batteryLevel: 5 })];
      const result = canUseTargetsForGame(targets);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.code).toBe('TARGETS_LOW_BATTERY');
      }
    });

    it('allows targets with null battery level', () => {
      const targets = [createTarget({ batteryLevel: null })];
      const result = canUseTargetsForGame(targets);
      expect(result.valid).toBe(true);
    });

    it('rejects busy targets', () => {
      const targets = [createTarget({ gameStatus: 'running' })];
      const result = canUseTargetsForGame(targets);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.code).toBe('TARGETS_BUSY');
      }
    });

    it('allows targets with idle game status', () => {
      const targets = [createTarget({ gameStatus: 'idle' })];
      const result = canUseTargetsForGame(targets);
      expect(result.valid).toBe(true);
    });

    it('allows targets with stopped game status', () => {
      const targets = [createTarget({ gameStatus: 'stopped' })];
      const result = canUseTargetsForGame(targets);
      expect(result.valid).toBe(true);
    });
  });

  describe('canStartNewSession', () => {
    const createSession = (overrides: Partial<GameSessionSummary> = {}): GameSessionSummary => ({
      id: 'session-1',
      status: 'completed',
      startTime: 1000,
      endTime: 2000,
      deviceIds: ['device-1'],
      ...overrides,
    });

    it('allows starting when no active sessions', () => {
      const sessions = [createSession({ status: 'completed' })];
      const result = canStartNewSession(sessions);
      expect(result.valid).toBe(true);
    });

    it('rejects when active session exists', () => {
      const sessions = [createSession({ status: 'running' })];
      const result = canStartNewSession(sessions);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.code).toBe('ACTIVE_SESSION_EXISTS');
      }
    });

    it('allows starting with empty session list', () => {
      const result = canStartNewSession([]);
      expect(result.valid).toBe(true);
    });
  });

  describe('canStopGameSession', () => {
    it('allows stopping running session', () => {
      const session: GameSessionSummary = {
        id: 'session-1',
        status: 'running',
        startTime: 1000,
        endTime: null,
        deviceIds: ['device-1'],
      };
      const result = canStopGameSession(session);
      expect(result.valid).toBe(true);
    });

    it('rejects stopping completed session', () => {
      const session: GameSessionSummary = {
        id: 'session-1',
        status: 'completed',
        startTime: 1000,
        endTime: 2000,
        deviceIds: ['device-1'],
      };
      const result = canStopGameSession(session);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.code).toBe('SESSION_ALREADY_ENDED');
      }
    });

    it('rejects stopping idle session', () => {
      const session: GameSessionSummary = {
        id: 'session-1',
        status: 'idle',
        startTime: null,
        endTime: null,
        deviceIds: ['device-1'],
      };
      const result = canStopGameSession(session);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.code).toBe('SESSION_NOT_STARTED');
      }
    });
  });

  describe('calculateAccuracy', () => {
    it('calculates 100% accuracy', () => {
      expect(calculateAccuracy(10, 10)).toBe(100);
    });

    it('calculates 50% accuracy', () => {
      expect(calculateAccuracy(5, 10)).toBe(50);
    });

    it('returns 0 for zero total shots', () => {
      expect(calculateAccuracy(0, 0)).toBe(0);
    });

    it('rounds to nearest integer', () => {
      expect(calculateAccuracy(1, 3)).toBe(33);
    });
  });

  describe('calculateScore (deprecated)', () => {
    it('calculates base score from hits', () => {
      const score = calculateScore(10, 100, 30000, 60000);
      expect(score).toBeGreaterThan(1000);
    });

    it('includes accuracy bonus', () => {
      const highAccuracy = calculateScore(10, 100, 30000, 60000);
      const lowAccuracy = calculateScore(10, 50, 30000, 60000);
      expect(highAccuracy).toBeGreaterThan(lowAccuracy);
    });

    it('includes time bonus when under limit', () => {
      const fastGame = calculateScore(10, 100, 30000, 60000);
      const slowGame = calculateScore(10, 100, 55000, 60000);
      expect(fastGame).toBeGreaterThan(slowGame);
    });

    it('returns 0 for zero hits', () => {
      expect(calculateScore(0, 0, 30000, 60000)).toBe(0);
    });

    it('handles null time limit', () => {
      const score = calculateScore(10, 100, 30000, null);
      expect(score).toBeGreaterThan(0);
    });
  });

  describe('isRunValid', () => {
    it('returns true when no goals set', () => {
      const result = isRunValid([{ deviceId: 'a', timestamp: 1000 }], {});
      expect(result).toBe(true);
    });

    it('returns true when all goals met', () => {
      const hits = [
        { deviceId: 'a', timestamp: 1000 },
        { deviceId: 'a', timestamp: 2000 },
        { deviceId: 'b', timestamp: 3000 },
      ];
      const goals = { a: 2, b: 1 };
      expect(isRunValid(hits, goals)).toBe(true);
    });

    it('returns false when goals not met', () => {
      const hits = [{ deviceId: 'a', timestamp: 1000 }];
      const goals = { a: 2 };
      expect(isRunValid(hits, goals)).toBe(false);
    });

    it('returns false when missing target', () => {
      const hits = [{ deviceId: 'a', timestamp: 1000 }];
      const goals = { a: 1, b: 1 };
      expect(isRunValid(hits, goals)).toBe(false);
    });
  });

  describe('calculateSessionScore', () => {
    const startTime = 1000000;

    it('calculates score for single target with goals', () => {
      const hits = [
        { deviceId: 'a', timestamp: startTime + 1000 },
        { deviceId: 'a', timestamp: startTime + 2000 },
      ];
      const result = calculateSessionScore(hits, { a: 2 }, startTime);

      expect(result.isValid).toBe(true);
      expect(result.score).toBe(2); // 2 seconds
    });

    it('returns invalid for incomplete goals', () => {
      const hits = [{ deviceId: 'a', timestamp: startTime + 1000 }];
      const result = calculateSessionScore(hits, { a: 2 }, startTime);

      expect(result.isValid).toBe(false);
      expect(result.score).toBeNull();
    });

    it('calculates splits correctly', () => {
      const hits = [
        { deviceId: 'a', timestamp: startTime + 1000 },
        { deviceId: 'a', timestamp: startTime + 3000 },
        { deviceId: 'a', timestamp: startTime + 4000 },
      ];
      const result = calculateSessionScore(hits, { a: 3 }, startTime);

      expect(result.splitsByTarget.a).toEqual([2, 1]); // 2s and 1s between hits
    });

    it('calculates transition times between targets', () => {
      const hits = [
        { deviceId: 'a', timestamp: startTime + 1000 },
        { deviceId: 'b', timestamp: startTime + 2500 },
      ];
      const result = calculateSessionScore(hits, { a: 1, b: 1 }, startTime);

      expect(result.transitionTimes).toEqual([1.5]); // 1.5s transition
    });

    it('handles no goals with first-to-last scoring', () => {
      const hits = [
        { deviceId: 'a', timestamp: startTime + 1000 },
        { deviceId: 'b', timestamp: startTime + 5000 },
      ];
      const result = calculateSessionScore(hits, {}, startTime);

      expect(result.isValid).toBe(true);
      expect(result.score).toBe(4); // 4 seconds from first to last
    });

    it('handles single hit with no goals', () => {
      const hits = [{ deviceId: 'a', timestamp: startTime + 2000 }];
      const result = calculateSessionScore(hits, {}, startTime);

      expect(result.isValid).toBe(true);
      expect(result.score).toBe(2); // 2 seconds from start
    });

    describe('with target order enforcement', () => {
      it('validates correct order', () => {
        const hits = [
          { deviceId: 'a', timestamp: startTime + 1000 },
          { deviceId: 'a', timestamp: startTime + 2000 },
          { deviceId: 'b', timestamp: startTime + 3000 },
        ];
        const result = calculateSessionScore(
          hits,
          { a: 2, b: 1 },
          startTime,
          { targetOrder: ['a', 'b'] }
        );

        expect(result.isValid).toBe(true);
        expect(result.score).toBe(3);
      });

      it('rejects out of order hits', () => {
        const hits = [
          { deviceId: 'a', timestamp: startTime + 1000 },
          { deviceId: 'b', timestamp: startTime + 2000 }, // Too early!
          { deviceId: 'a', timestamp: startTime + 3000 },
        ];
        const result = calculateSessionScore(
          hits,
          { a: 2, b: 1 },
          startTime,
          { targetOrder: ['a', 'b'] }
        );

        expect(result.isValid).toBe(false);
      });
    });
  });

  describe('calculateSessionDuration', () => {
    it('calculates duration from start to end', () => {
      expect(calculateSessionDuration(1000, 5000)).toBe(4000);
    });

    it('returns 0 for null start time', () => {
      expect(calculateSessionDuration(null, 5000)).toBe(0);
    });

    it('returns non-negative for null end time', () => {
      const result = calculateSessionDuration(Date.now() - 1000, null);
      expect(result).toBeGreaterThanOrEqual(0);
    });
  });

  describe('isTimeLimitExceeded', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-15T12:00:00Z'));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('returns false when timeLimitMs is null (no limit)', () => {
      const startTime = Date.now() - 60000;
      expect(isTimeLimitExceeded(startTime, null)).toBe(false);
    });

    it('returns false when elapsed time is less than limit', () => {
      const now = Date.now();
      const startTime = now - 30000; // 30 seconds ago
      expect(isTimeLimitExceeded(startTime, 60000)).toBe(false); // 60 second limit
    });

    it('returns true when elapsed time equals limit', () => {
      const now = Date.now();
      const startTime = now - 60000; // 60 seconds ago
      expect(isTimeLimitExceeded(startTime, 60000)).toBe(true); // 60 second limit
    });

    it('returns true when elapsed time exceeds limit', () => {
      const now = Date.now();
      const startTime = now - 90000; // 90 seconds ago
      expect(isTimeLimitExceeded(startTime, 60000)).toBe(true); // 60 second limit
    });
  });

  describe('getRemainingTime', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-15T12:00:00Z'));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('returns null when timeLimitMs is null (no limit)', () => {
      const startTime = Date.now() - 60000;
      expect(getRemainingTime(startTime, null)).toBe(null);
    });

    it('returns positive remaining time when under limit', () => {
      const now = Date.now();
      const startTime = now - 30000; // 30 seconds ago
      const remaining = getRemainingTime(startTime, 60000); // 60 second limit
      expect(remaining).toBe(30000); // 30 seconds remaining
    });

    it('returns 0 when elapsed equals limit (clamped)', () => {
      const now = Date.now();
      const startTime = now - 60000; // 60 seconds ago
      const remaining = getRemainingTime(startTime, 60000); // 60 second limit
      expect(remaining).toBe(0);
    });

    it('returns 0 when elapsed exceeds limit (clamped, never negative)', () => {
      const now = Date.now();
      const startTime = now - 90000; // 90 seconds ago
      const remaining = getRemainingTime(startTime, 60000); // 60 second limit
      expect(remaining).toBe(0);
    });
  });

  describe('getPerformanceRating', () => {
    it('returns excellent for high accuracy and score', () => {
      expect(getPerformanceRating(95, 950, 1000)).toBe('excellent');
    });

    it('returns good for moderate performance', () => {
      expect(getPerformanceRating(80, 750, 1000)).toBe('good');
    });

    it('returns average for mid performance', () => {
      expect(getPerformanceRating(60, 550, 1000)).toBe('average');
    });

    it('returns needs_improvement for poor performance', () => {
      expect(getPerformanceRating(30, 200, 1000)).toBe('needs_improvement');
    });

    it('handles zero expected score', () => {
      expect(getPerformanceRating(50, 100, 0)).toBe('needs_improvement');
    });
  });

  describe('sortSessionsByRecency', () => {
    it('sorts sessions by start time descending', () => {
      const sessions: GameSessionSummary[] = [
        { id: 'old', status: 'completed', startTime: 1000, endTime: 2000, deviceIds: [] },
        { id: 'new', status: 'completed', startTime: 3000, endTime: 4000, deviceIds: [] },
        { id: 'mid', status: 'completed', startTime: 2000, endTime: 3000, deviceIds: [] },
      ];
      const sorted = sortSessionsByRecency(sessions);
      expect(sorted.map(s => s.id)).toEqual(['new', 'mid', 'old']);
    });

    it('handles null start times', () => {
      const sessions: GameSessionSummary[] = [
        { id: 'null', status: 'idle', startTime: null, endTime: null, deviceIds: [] },
        { id: 'has-time', status: 'completed', startTime: 1000, endTime: 2000, deviceIds: [] },
      ];
      const sorted = sortSessionsByRecency(sessions);
      expect(sorted[0].id).toBe('has-time');
    });
  });

  describe('filterActiveSessions', () => {
    it('filters only active sessions', () => {
      const sessions: GameSessionSummary[] = [
        { id: '1', status: 'running', startTime: 1000, endTime: null, deviceIds: [] },
        { id: '2', status: 'completed', startTime: 1000, endTime: 2000, deviceIds: [] },
        { id: '3', status: 'configuring', startTime: 1000, endTime: null, deviceIds: [] },
      ];
      const active = filterActiveSessions(sessions);
      expect(active.map(s => s.id)).toEqual(['1', '3']);
    });
  });

  describe('filterCompletedSessions', () => {
    it('filters only completed sessions', () => {
      const sessions: GameSessionSummary[] = [
        { id: '1', status: 'running', startTime: 1000, endTime: null, deviceIds: [] },
        { id: '2', status: 'completed', startTime: 1000, endTime: 2000, deviceIds: [] },
        { id: '3', status: 'error', startTime: 1000, endTime: 2000, deviceIds: [] },
      ];
      const completed = filterCompletedSessions(sessions);
      expect(completed.map(s => s.id)).toEqual(['2']);
    });
  });

  describe('validateGameConfiguration (rules version)', () => {
    it('returns RuleResult with code', () => {
      const result = validateGameConfiguration(0, 5, 60000);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.code).toBe('INVALID_TARGET_COUNT');
      }
    });

    it('validates time limit bounds with human-readable messages', () => {
      const result = validateGameConfiguration(5, 5, 1000);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.code).toBe('INVALID_TIME_LIMIT');
        expect(result.violation).toContain('seconds');
      }
    });
  });
});
