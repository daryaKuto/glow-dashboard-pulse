import { describe, it, expect } from 'vitest';
import {
  isValidProfileName,
  isValidAvatarUrl,
  calculateTotalPracticeTime,
  calculateAverageAccuracy,
  calculateBestScore,
  calculateTotalHits,
  calculateCurrentStreak,
  buildProfileStats,
  formatPracticeTime,
  getPerformanceRating,
  isValidRecentSessionsLimit,
  calculateImprovementPercentage,
  filterSessionsByDateRange,
  sortSessionsByDate,
  type SessionSummary,
} from '../../src/domain/profile/rules';
import { PROFILE_CONSTRAINTS } from '../../src/domain/profile/validators';

describe('profile rules', () => {
  const createSession = (overrides: Partial<SessionSummary> = {}): SessionSummary => ({
    id: 'session-1',
    score: 100,
    hitCount: 10,
    durationMs: 60000,
    accuracyPercentage: 80,
    startedAt: new Date().toISOString(),
    ...overrides,
  });

  describe('isValidProfileName', () => {
    it('validates valid name', () => {
      const result = isValidProfileName('John Doe');
      expect(result.valid).toBe(true);
    });

    it('rejects empty name', () => {
      const result = isValidProfileName('');
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.code).toBe('NAME_TOO_SHORT');
      }
    });

    it('rejects whitespace-only name', () => {
      const result = isValidProfileName('   ');
      expect(result.valid).toBe(false);
    });

    it('rejects name that is too long', () => {
      const longName = 'a'.repeat(PROFILE_CONSTRAINTS.NAME_MAX_LENGTH + 1);
      const result = isValidProfileName(longName);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.code).toBe('NAME_TOO_LONG');
      }
    });

    it('accepts name at maximum length', () => {
      const maxName = 'a'.repeat(PROFILE_CONSTRAINTS.NAME_MAX_LENGTH);
      const result = isValidProfileName(maxName);
      expect(result.valid).toBe(true);
    });
  });

  describe('isValidAvatarUrl', () => {
    it('accepts null (avatar is optional)', () => {
      const result = isValidAvatarUrl(null);
      expect(result.valid).toBe(true);
    });

    it('accepts undefined', () => {
      const result = isValidAvatarUrl(undefined);
      expect(result.valid).toBe(true);
    });

    it('accepts empty string', () => {
      const result = isValidAvatarUrl('');
      expect(result.valid).toBe(true);
    });

    it('validates valid URL', () => {
      const result = isValidAvatarUrl('https://example.com/avatar.png');
      expect(result.valid).toBe(true);
    });

    it('rejects URL that is too long', () => {
      const longUrl = 'https://example.com/' + 'a'.repeat(PROFILE_CONSTRAINTS.AVATAR_URL_MAX_LENGTH);
      const result = isValidAvatarUrl(longUrl);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.code).toBe('URL_TOO_LONG');
      }
    });

    it('rejects invalid URL format', () => {
      const result = isValidAvatarUrl('not-a-url');
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.code).toBe('INVALID_URL');
      }
    });
  });

  describe('calculateTotalPracticeTime', () => {
    it('returns 0 for empty array', () => {
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

  describe('calculateAverageAccuracy', () => {
    it('returns null for empty array', () => {
      expect(calculateAverageAccuracy([])).toBeNull();
    });

    it('returns null when all sessions have null accuracy', () => {
      const sessions = [
        createSession({ accuracyPercentage: null }),
        createSession({ accuracyPercentage: null }),
      ];
      expect(calculateAverageAccuracy(sessions)).toBeNull();
    });

    it('calculates average accuracy', () => {
      const sessions = [
        createSession({ accuracyPercentage: 80 }),
        createSession({ accuracyPercentage: 90 }),
        createSession({ accuracyPercentage: 70 }),
      ];
      expect(calculateAverageAccuracy(sessions)).toBe(80);
    });

    it('ignores sessions with null accuracy', () => {
      const sessions = [
        createSession({ accuracyPercentage: 80 }),
        createSession({ accuracyPercentage: null }),
        createSession({ accuracyPercentage: 100 }),
      ];
      expect(calculateAverageAccuracy(sessions)).toBe(90);
    });

    it('rounds to nearest integer', () => {
      const sessions = [
        createSession({ accuracyPercentage: 33 }),
        createSession({ accuracyPercentage: 34 }),
      ];
      expect(calculateAverageAccuracy(sessions)).toBe(34); // 33.5 rounded
    });
  });

  describe('calculateBestScore', () => {
    it('returns null for empty array', () => {
      expect(calculateBestScore([])).toBeNull();
    });

    it('returns lowest score (best for time-based)', () => {
      const sessions = [
        createSession({ score: 15.5 }),
        createSession({ score: 10.2 }),
        createSession({ score: 20.0 }),
      ];
      expect(calculateBestScore(sessions)).toBe(10.2);
    });
  });

  describe('calculateTotalHits', () => {
    it('returns 0 for empty array', () => {
      expect(calculateTotalHits([])).toBe(0);
    });

    it('sums hits from all sessions', () => {
      const sessions = [
        createSession({ hitCount: 10 }),
        createSession({ hitCount: 15 }),
        createSession({ hitCount: 25 }),
      ];
      expect(calculateTotalHits(sessions)).toBe(50);
    });
  });

  describe('calculateCurrentStreak', () => {
    it('returns 0 for empty array', () => {
      expect(calculateCurrentStreak([])).toBe(0);
    });

    it('returns streak count for consecutive days', () => {
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
      expect(calculateCurrentStreak(sessions)).toBe(3);
    });

    it('returns 0 when no session today or yesterday', () => {
      const threeDaysAgo = new Date();
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

      const sessions = [createSession({ startedAt: threeDaysAgo.toISOString() })];
      expect(calculateCurrentStreak(sessions)).toBe(0);
    });

    it('counts multiple sessions on same day as one', () => {
      const today = new Date();
      const sessions = [
        createSession({ startedAt: today.toISOString() }),
        createSession({ startedAt: today.toISOString() }),
        createSession({ startedAt: today.toISOString() }),
      ];
      expect(calculateCurrentStreak(sessions)).toBe(1);
    });
  });

  describe('buildProfileStats', () => {
    it('builds complete stats object', () => {
      const today = new Date();
      const sessions = [
        createSession({ score: 10, hitCount: 5, durationMs: 30000, accuracyPercentage: 80, startedAt: today.toISOString() }),
        createSession({ score: 15, hitCount: 10, durationMs: 45000, accuracyPercentage: 90, startedAt: today.toISOString() }),
      ];

      const stats = buildProfileStats(sessions);

      expect(stats.totalSessions).toBe(2);
      expect(stats.totalHits).toBe(15);
      expect(stats.totalPracticeTimeMs).toBe(75000);
      expect(stats.averageAccuracy).toBe(85);
      expect(stats.bestScore).toBe(10);
      expect(stats.currentStreak).toBe(1);
    });

    it('handles empty sessions', () => {
      const stats = buildProfileStats([]);

      expect(stats.totalSessions).toBe(0);
      expect(stats.totalHits).toBe(0);
      expect(stats.totalPracticeTimeMs).toBe(0);
      expect(stats.averageAccuracy).toBeNull();
      expect(stats.bestScore).toBeNull();
      expect(stats.currentStreak).toBe(0);
    });
  });

  describe('formatPracticeTime', () => {
    it('formats minutes only', () => {
      expect(formatPracticeTime(5 * 60 * 1000)).toBe('5m');
    });

    it('formats hours and minutes', () => {
      expect(formatPracticeTime(2 * 60 * 60 * 1000 + 30 * 60 * 1000)).toBe('2h 30m');
    });

    it('formats zero time', () => {
      expect(formatPracticeTime(0)).toBe('0m');
    });

    it('formats exactly one hour', () => {
      expect(formatPracticeTime(60 * 60 * 1000)).toBe('1h 0m');
    });
  });

  describe('getPerformanceRating', () => {
    it('returns excellent for 90% or higher', () => {
      expect(getPerformanceRating(90)).toBe('excellent');
      expect(getPerformanceRating(100)).toBe('excellent');
    });

    it('returns good for 75-89%', () => {
      expect(getPerformanceRating(75)).toBe('good');
      expect(getPerformanceRating(89)).toBe('good');
    });

    it('returns average for 50-74%', () => {
      expect(getPerformanceRating(50)).toBe('average');
      expect(getPerformanceRating(74)).toBe('average');
    });

    it('returns needs_improvement for below 50%', () => {
      expect(getPerformanceRating(49)).toBe('needs_improvement');
      expect(getPerformanceRating(0)).toBe('needs_improvement');
    });

    it('returns unknown for null', () => {
      expect(getPerformanceRating(null)).toBe('unknown');
    });
  });

  describe('isValidRecentSessionsLimit', () => {
    it('validates valid limit', () => {
      const result = isValidRecentSessionsLimit(10);
      expect(result.valid).toBe(true);
    });

    it('rejects limit below minimum', () => {
      const result = isValidRecentSessionsLimit(0);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.code).toBe('LIMIT_TOO_SMALL');
      }
    });

    it('rejects limit above maximum', () => {
      const result = isValidRecentSessionsLimit(PROFILE_CONSTRAINTS.MAX_RECENT_SESSIONS + 1);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.code).toBe('LIMIT_TOO_LARGE');
      }
    });

    it('accepts boundary values', () => {
      expect(isValidRecentSessionsLimit(1).valid).toBe(true);
      expect(isValidRecentSessionsLimit(PROFILE_CONSTRAINTS.MAX_RECENT_SESSIONS).valid).toBe(true);
    });
  });

  describe('calculateImprovementPercentage', () => {
    it('calculates positive improvement', () => {
      expect(calculateImprovementPercentage(90, 80)).toBe(13); // 12.5 rounded
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

  describe('filterSessionsByDateRange', () => {
    it('filters sessions within range', () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      const sessions = [
        createSession({ startedAt: '2024-01-15T10:00:00Z' }),
        createSession({ startedAt: '2024-02-15T10:00:00Z' }), // outside
        createSession({ startedAt: '2024-01-01T00:00:00Z' }), // boundary
      ];

      const filtered = filterSessionsByDateRange(sessions, startDate, endDate);
      expect(filtered).toHaveLength(2);
    });

    it('returns empty array when no sessions match', () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      const sessions = [createSession({ startedAt: '2023-12-15T10:00:00Z' })];

      const filtered = filterSessionsByDateRange(sessions, startDate, endDate);
      expect(filtered).toHaveLength(0);
    });
  });

  describe('sortSessionsByDate', () => {
    it('sorts sessions by date descending (most recent first)', () => {
      const sessions = [
        createSession({ id: 'old', startedAt: '2024-01-01T10:00:00Z' }),
        createSession({ id: 'new', startedAt: '2024-03-01T10:00:00Z' }),
        createSession({ id: 'mid', startedAt: '2024-02-01T10:00:00Z' }),
      ];

      const sorted = sortSessionsByDate(sessions);
      expect(sorted.map(s => s.id)).toEqual(['new', 'mid', 'old']);
    });

    it('does not mutate original array', () => {
      const sessions = [
        createSession({ id: '1', startedAt: '2024-01-01T10:00:00Z' }),
        createSession({ id: '2', startedAt: '2024-02-01T10:00:00Z' }),
      ];
      const original = [...sessions];

      sortSessionsByDate(sessions);

      expect(sessions.map(s => s.id)).toEqual(original.map(s => s.id));
    });
  });
});
