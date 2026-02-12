import { describe, it, expect } from 'vitest';
import { mapDashboardMetricsPayload } from '../../src/domain/dashboard/mappers';

describe('dashboard mappers', () => {
  it('maps payload to dashboard metrics', () => {
    const metrics = mapDashboardMetricsPayload({
      summary: {
        totalTargets: 2,
        onlineTargets: 1,
        standbyTargets: 0,
        offlineTargets: 1,
        assignedTargets: 1,
        unassignedTargets: 1,
        totalRooms: 1,
        lastUpdated: 1700000000000,
      },
      totals: {
        totalSessions: 5,
        bestScore: 120,
        avgScore: 95,
      },
      recentSessions: [
        {
          id: 'session-1',
          started_at: '2024-01-01T00:00:00Z',
          score: 88,
          hit_count: 10,
          duration_ms: 5000,
          accuracy_percentage: 92.5,
        },
      ],
      generatedAt: 1700000000100,
    });

    expect(metrics?.summary.totalTargets).toBe(2);
    expect(metrics?.totals.bestScore).toBe(120);
    expect(metrics?.recentSessions[0].id).toBe('session-1');
  });
});
