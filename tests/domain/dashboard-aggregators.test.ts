import { describe, it, expect } from 'vitest';
import {
  calculateSessionTotals,
  calculateTargetSummary,
  getRecentSessions,
  calculateAverageAccuracy,
  calculateTotalHits,
  calculateTotalPracticeTime,
  formatPracticeTime,
  calculateSessionsPerDay,
  calculateScoreTrend,
  calculateImprovementPercentage,
  buildDashboardMetrics,
  calculateStreak,
  getPerformanceRating,
  type SessionData,
  type TargetData,
} from '../../src/domain/dashboard/aggregators';

describe('dashboard aggregators', () => {
  const createSession = (overrides: Partial<SessionData> = {}): SessionData => ({
    id: 'session-1',
    startedAt: new Date().toISOString(),
    score: 20,
    hitCount: 10,
    durationMs: 60000,
    accuracyPercentage: 80,
    ...overrides,
  });

  const createTarget = (overrides: Partial<TargetData> = {}): TargetData => ({
    id: 'target-1',
    status: 'online',
    roomId: 'room-1',
    ...overrides,
  });

  describe('calculateSessionTotals', () => {
    it('returns empty totals for no sessions', () => {
      const result = calculateSessionTotals([]);
      expect(result.totalSessions).toBe(0);
      expect(result.bestScore).toBeNull();
      expect(result.avgScore).toBeNull();
    });

    it('calculates totals from sessions', () => {
      const sessions = [
        createSession({ score: 10 }),
        createSession({ score: 20 }),
        createSession({ score: 30 }),
      ];
      const result = calculateSessionTotals(sessions);

      expect(result.totalSessions).toBe(3);
      expect(result.bestScore).toBe(10); // lowest is best for time-based
      expect(result.avgScore).toBe(20);
    });

    it('rounds average score', () => {
      const sessions = [
        createSession({ score: 10 }),
        createSession({ score: 15 }),
      ];
      const result = calculateSessionTotals(sessions);
      expect(result.avgScore).toBe(13); // 12.5 rounded
    });
  });

  describe('calculateTargetSummary', () => {
    it('calculates summary from targets', () => {
      const targets = [
        createTarget({ status: 'online', roomId: 'room-1' }),
        createTarget({ id: 't2', status: 'online', roomId: null }),
        createTarget({ id: 't3', status: 'offline', roomId: 'room-1' }),
        createTarget({ id: 't4', status: 'standby', roomId: null }),
      ];

      const result = calculateTargetSummary(targets, 2);

      expect(result.totalTargets).toBe(4);
      expect(result.onlineTargets).toBe(2);
      expect(result.offlineTargets).toBe(2); // offline + standby
      expect(result.assignedTargets).toBe(2);
      expect(result.unassignedTargets).toBe(2);
      expect(result.totalRooms).toBe(2);
      expect(result.lastUpdated).toBeDefined();
    });

    it('handles empty targets array', () => {
      const result = calculateTargetSummary([], 0);

      expect(result.totalTargets).toBe(0);
      expect(result.onlineTargets).toBe(0);
      expect(result.offlineTargets).toBe(0);
    });
  });

  describe('getRecentSessions', () => {
    it('returns sessions sorted by date descending', () => {
      const sessions = [
        createSession({ id: 'old', startedAt: '2024-01-01T10:00:00Z' }),
        createSession({ id: 'new', startedAt: '2024-03-01T10:00:00Z' }),
        createSession({ id: 'mid', startedAt: '2024-02-01T10:00:00Z' }),
      ];

      const result = getRecentSessions(sessions);
      expect(result.map(s => s.id)).toEqual(['new', 'mid', 'old']);
    });

    it('limits results to specified count', () => {
      const sessions = Array.from({ length: 20 }, (_, i) =>
        createSession({ id: `session-${i}` })
      );

      const result = getRecentSessions(sessions, 5);
      expect(result).toHaveLength(5);
    });

    it('uses default limit of 10', () => {
      const sessions = Array.from({ length: 20 }, (_, i) =>
        createSession({ id: `session-${i}` })
      );

      const result = getRecentSessions(sessions);
      expect(result).toHaveLength(10);
    });
  });

  describe('calculateAverageAccuracy', () => {
    it('returns null for empty sessions', () => {
      expect(calculateAverageAccuracy([])).toBeNull();
    });

    it('returns null when all accuracies are null', () => {
      const sessions = [
        createSession({ accuracyPercentage: null }),
        createSession({ accuracyPercentage: null }),
      ];
      expect(calculateAverageAccuracy(sessions)).toBeNull();
    });

    it('calculates average ignoring null values', () => {
      const sessions = [
        createSession({ accuracyPercentage: 80 }),
        createSession({ accuracyPercentage: null }),
        createSession({ accuracyPercentage: 90 }),
      ];
      expect(calculateAverageAccuracy(sessions)).toBe(85);
    });
  });

  describe('calculateTotalHits', () => {
    it('returns 0 for empty sessions', () => {
      expect(calculateTotalHits([])).toBe(0);
    });

    it('sums hits from all sessions', () => {
      const sessions = [
        createSession({ hitCount: 10 }),
        createSession({ hitCount: 20 }),
        createSession({ hitCount: 15 }),
      ];
      expect(calculateTotalHits(sessions)).toBe(45);
    });
  });

  describe('calculateTotalPracticeTime', () => {
    it('returns 0 for empty sessions', () => {
      expect(calculateTotalPracticeTime([])).toBe(0);
    });

    it('sums duration from all sessions', () => {
      const sessions = [
        createSession({ durationMs: 30000 }),
        createSession({ durationMs: 45000 }),
        createSession({ durationMs: 60000 }),
      ];
      expect(calculateTotalPracticeTime(sessions)).toBe(135000);
    });
  });

  describe('formatPracticeTime', () => {
    it('formats minutes only', () => {
      expect(formatPracticeTime(5 * 60 * 1000)).toBe('5m');
    });

    it('formats hours and minutes', () => {
      expect(formatPracticeTime(90 * 60 * 1000)).toBe('1h 30m');
    });

    it('formats zero time', () => {
      expect(formatPracticeTime(0)).toBe('0m');
    });
  });

  describe('calculateSessionsPerDay', () => {
    it('returns 0 for empty sessions', () => {
      expect(calculateSessionsPerDay([])).toBe(0);
    });

    it('returns 0 for zero days', () => {
      const sessions = [createSession()];
      expect(calculateSessionsPerDay(sessions, 0)).toBe(0);
    });

    it('calculates sessions per day for recent sessions', () => {
      const now = new Date();
      const sessions = [
        createSession({ startedAt: now.toISOString() }),
        createSession({ startedAt: now.toISOString() }),
        createSession({ startedAt: now.toISOString() }),
      ];
      const result = calculateSessionsPerDay(sessions, 30);
      expect(result).toBe(0.1); // 3 sessions / 30 days = 0.1
    });
  });

  describe('calculateScoreTrend', () => {
    it('returns empty array for no sessions', () => {
      expect(calculateScoreTrend([])).toEqual([]);
    });

    it('groups scores by date for recent sessions', () => {
      // Use recent dates to ensure they fall within the period
      const today = new Date();
      const todayStr = today.toISOString().split('T')[0];
      const sessions = [
        createSession({ score: 10, startedAt: `${todayStr}T10:00:00Z` }),
        createSession({ score: 20, startedAt: `${todayStr}T15:00:00Z` }),
      ];

      // Use 'week' period to include recent sessions
      const result = calculateScoreTrend(sessions, 'week');

      expect(result).toHaveLength(1);
      expect(result[0].date).toBe(todayStr);
      expect(result[0].value).toBe(15); // average of 10 and 20
    });

    it('sorts by date ascending', () => {
      const sessions = [
        createSession({ startedAt: '2024-01-20T10:00:00Z' }),
        createSession({ startedAt: '2024-01-10T10:00:00Z' }),
        createSession({ startedAt: '2024-01-15T10:00:00Z' }),
      ];

      const result = calculateScoreTrend(sessions, 'all');
      const dates = result.map(r => r.date);
      expect(dates).toEqual([...dates].sort());
    });
  });

  describe('calculateImprovementPercentage', () => {
    it('calculates positive improvement', () => {
      expect(calculateImprovementPercentage(90, 80)).toBe(13);
    });

    it('calculates negative improvement (decline)', () => {
      expect(calculateImprovementPercentage(70, 80)).toBe(-12); // -12.5 rounds to -12
    });

    it('returns null when recent is null', () => {
      expect(calculateImprovementPercentage(null, 80)).toBeNull();
    });

    it('returns null when previous is null', () => {
      expect(calculateImprovementPercentage(90, null)).toBeNull();
    });

    it('returns null when previous is zero', () => {
      expect(calculateImprovementPercentage(90, 0)).toBeNull();
    });
  });

  describe('buildDashboardMetrics', () => {
    it('builds complete metrics object', () => {
      const targets = [createTarget()];
      const sessions = [createSession()];

      const result = buildDashboardMetrics(targets, sessions, 1);

      expect(result.summary).toBeDefined();
      expect(result.totals).toBeDefined();
      expect(result.recentSessions).toBeDefined();
      expect(result.generatedAt).toBeDefined();
    });

    it('respects recent sessions limit', () => {
      const targets: TargetData[] = [];
      const sessions = Array.from({ length: 20 }, (_, i) =>
        createSession({ id: `session-${i}` })
      );

      const result = buildDashboardMetrics(targets, sessions, 0, 5);
      expect(result.recentSessions).toHaveLength(5);
    });
  });

  describe('calculateStreak', () => {
    it('returns 0 for empty sessions', () => {
      expect(calculateStreak([])).toBe(0);
    });

    it('counts consecutive days', () => {
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const twoDaysAgo = new Date(today);
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

      const sessions = [
        createSession({ startedAt: today.toISOString() }),
        createSession({ startedAt: yesterday.toISOString() }),
        createSession({ startedAt: twoDaysAgo.toISOString() }),
      ];

      expect(calculateStreak(sessions)).toBe(3);
    });

    it('returns 0 when no session today or yesterday', () => {
      const threeDaysAgo = new Date();
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

      const sessions = [createSession({ startedAt: threeDaysAgo.toISOString() })];
      expect(calculateStreak(sessions)).toBe(0);
    });
  });

  describe('getPerformanceRating', () => {
    it('returns excellent for 90+', () => {
      expect(getPerformanceRating(90)).toBe('excellent');
      expect(getPerformanceRating(100)).toBe('excellent');
    });

    it('returns good for 75-89', () => {
      expect(getPerformanceRating(75)).toBe('good');
      expect(getPerformanceRating(89)).toBe('good');
    });

    it('returns average for 50-74', () => {
      expect(getPerformanceRating(50)).toBe('average');
      expect(getPerformanceRating(74)).toBe('average');
    });

    it('returns needs_improvement for below 50', () => {
      expect(getPerformanceRating(49)).toBe('needs_improvement');
      expect(getPerformanceRating(0)).toBe('needs_improvement');
    });

    it('returns unknown for null', () => {
      expect(getPerformanceRating(null)).toBe('unknown');
    });
  });
});
