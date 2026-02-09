import { describe, it, expect } from 'vitest';
import {
  DASHBOARD_CONSTRAINTS,
  validateDashboardQueryOptions,
  validateDashboardMetrics,
  validateDateRange,
  areMetricsStale,
} from '../../src/domain/dashboard/validators';

describe('dashboard validators', () => {
  describe('validateDashboardQueryOptions', () => {
    it('validates valid options', () => {
      const result = validateDashboardQueryOptions({
        force: true,
        recentSessionsLimit: 20,
      });
      expect(result.success).toBe(true);
    });

    it('validates empty options', () => {
      const result = validateDashboardQueryOptions({});
      expect(result.success).toBe(true);
    });

    it('validates with date range', () => {
      const result = validateDashboardQueryOptions({
        dateRangeStart: '2024-01-01T00:00:00Z',
        dateRangeEnd: '2024-01-31T23:59:59Z',
      });
      expect(result.success).toBe(true);
    });

    it('rejects recentSessionsLimit below minimum', () => {
      const result = validateDashboardQueryOptions({
        recentSessionsLimit: 0,
      });
      expect(result.success).toBe(false);
    });

    it('rejects recentSessionsLimit above maximum', () => {
      const result = validateDashboardQueryOptions({
        recentSessionsLimit: DASHBOARD_CONSTRAINTS.MAX_RECENT_SESSIONS + 1,
      });
      expect(result.success).toBe(false);
    });

    it('rejects invalid datetime format', () => {
      const result = validateDashboardQueryOptions({
        dateRangeStart: 'not-a-date',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('validateDashboardMetrics', () => {
    const validMetrics = {
      summary: {
        totalTargets: 5,
        onlineTargets: 3,
        offlineTargets: 2,
        assignedTargets: 4,
        unassignedTargets: 1,
        totalRooms: 2,
        lastUpdated: Date.now(),
      },
      totals: {
        totalSessions: 10,
        bestScore: 15.5,
        avgScore: 25,
      },
      recentSessions: [
        {
          id: 'session-1',
          startedAt: '2024-01-15T10:00:00Z',
          score: 20,
          hitCount: 10,
          durationMs: 60000,
          accuracyPercentage: 80,
        },
      ],
      generatedAt: Date.now(),
    };

    it('validates valid metrics', () => {
      const result = validateDashboardMetrics(validMetrics);
      expect(result.success).toBe(true);
    });

    it('validates metrics with null scores', () => {
      const metricsWithNulls = {
        ...validMetrics,
        totals: {
          totalSessions: 0,
          bestScore: null,
          avgScore: null,
        },
        recentSessions: [],
      };
      const result = validateDashboardMetrics(metricsWithNulls);
      expect(result.success).toBe(true);
    });

    it('validates session with null accuracy', () => {
      const metricsWithNullAccuracy = {
        ...validMetrics,
        recentSessions: [
          {
            ...validMetrics.recentSessions[0],
            accuracyPercentage: null,
          },
        ],
      };
      const result = validateDashboardMetrics(metricsWithNullAccuracy);
      expect(result.success).toBe(true);
    });

    it('rejects negative totalTargets', () => {
      const invalidMetrics = {
        ...validMetrics,
        summary: { ...validMetrics.summary, totalTargets: -1 },
      };
      const result = validateDashboardMetrics(invalidMetrics);
      expect(result.success).toBe(false);
    });

    it('rejects accuracy above 100', () => {
      const invalidMetrics = {
        ...validMetrics,
        recentSessions: [
          { ...validMetrics.recentSessions[0], accuracyPercentage: 150 },
        ],
      };
      const result = validateDashboardMetrics(invalidMetrics);
      expect(result.success).toBe(false);
    });
  });

  describe('validateDateRange', () => {
    it('returns null for no dates provided', () => {
      const result = validateDateRange(undefined, undefined);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBeNull();
      }
    });

    it('validates valid date range', () => {
      const result = validateDateRange('2024-01-01', '2024-01-31');
      expect(result.success).toBe(true);
      if (result.success && result.data) {
        expect(result.data.start).toBeInstanceOf(Date);
        expect(result.data.end).toBeInstanceOf(Date);
      }
    });

    it('rejects incomplete range (only start)', () => {
      const result = validateDateRange('2024-01-01', undefined);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors[0].code).toBe('incomplete_range');
      }
    });

    it('rejects incomplete range (only end)', () => {
      const result = validateDateRange(undefined, '2024-01-31');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors[0].code).toBe('incomplete_range');
      }
    });

    it('rejects invalid date format', () => {
      const result = validateDateRange('not-a-date', '2024-01-31');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors[0].code).toBe('invalid_date');
      }
    });

    it('rejects start date after end date', () => {
      const result = validateDateRange('2024-12-31', '2024-01-01');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors[0].code).toBe('invalid_range');
      }
    });

    it('rejects range exceeding maximum days', () => {
      const result = validateDateRange('2023-01-01', '2024-12-31');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors[0].code).toBe('range_too_large');
      }
    });

    it('accepts range at maximum days', () => {
      const startDate = new Date();
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + DASHBOARD_CONSTRAINTS.MAX_DATE_RANGE_DAYS);

      const result = validateDateRange(
        startDate.toISOString().split('T')[0],
        endDate.toISOString().split('T')[0]
      );
      expect(result.success).toBe(true);
    });
  });

  describe('areMetricsStale', () => {
    it('returns false for fresh metrics', () => {
      const now = Date.now();
      expect(areMetricsStale(now)).toBe(false);
    });

    it('returns true for old metrics', () => {
      const tenMinutesAgo = Date.now() - 10 * 60 * 1000;
      expect(areMetricsStale(tenMinutesAgo)).toBe(true);
    });

    it('uses default max age of 5 minutes', () => {
      const fourMinutesAgo = Date.now() - 4 * 60 * 1000;
      const sixMinutesAgo = Date.now() - 6 * 60 * 1000;

      expect(areMetricsStale(fourMinutesAgo)).toBe(false);
      expect(areMetricsStale(sixMinutesAgo)).toBe(true);
    });

    it('respects custom max age', () => {
      const twoMinutesAgo = Date.now() - 2 * 60 * 1000;

      expect(areMetricsStale(twoMinutesAgo, 1 * 60 * 1000)).toBe(true);
      expect(areMetricsStale(twoMinutesAgo, 3 * 60 * 1000)).toBe(false);
    });
  });
});
