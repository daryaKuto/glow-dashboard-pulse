import { describe, it, expect, afterEach } from 'vitest';
import { apiOk } from '../../src/shared/lib/api-response';
import { dashboardRepository } from '../../src/features/dashboard/repo';
import { getDashboardMetricsService, setDashboardRepository } from '../../src/features/dashboard/service';
import type { DashboardRepository } from '../../src/domain/dashboard/ports';

describe('dashboard adapter conformance', () => {
  afterEach(() => {
    // Restore the real repository after each test
    setDashboardRepository(dashboardRepository);
  });

  it('mock repository satisfies DashboardRepository interface', async () => {
    // Create a mock that satisfies the full interface
    const mockRepo: DashboardRepository = {
      getMetrics: async () => apiOk({
        metrics: null,
        cached: false,
      }),
    };

    // Inject the mock
    setDashboardRepository(mockRepo);

    // Verify the service uses the injected repository
    const result = await getDashboardMetricsService();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.metrics).toBeNull();
      expect(result.data.cached).toBe(false);
    }
  });

  it('mock repository with sample data works correctly', async () => {
    const sampleMetrics = {
      summary: {
        totalTargets: 10,
        onlineTargets: 8,
        offlineTargets: 2,
        assignedTargets: 7,
        unassignedTargets: 3,
        totalRooms: 3,
        lastUpdated: Date.now(),
      },
      totals: {
        totalSessions: 50,
        bestScore: 98,
        avgScore: 82.5,
      },
      recentSessions: [
        {
          id: 'session-1',
          started_at: new Date().toISOString(),
          score: 85,
          hit_count: 42,
          duration_ms: 60000,
          accuracy_percentage: 90,
        },
      ],
      generatedAt: Date.now(),
    };

    const mockRepo: DashboardRepository = {
      getMetrics: async () => apiOk({
        metrics: sampleMetrics,
        cached: true,
        source: 'test',
      }),
    };

    setDashboardRepository(mockRepo);

    const result = await getDashboardMetricsService();
    expect(result.ok).toBe(true);
    if (result.ok && result.data.metrics) {
      expect(result.data.metrics.summary.totalTargets).toBe(10);
      expect(result.data.metrics.totals.totalSessions).toBe(50);
      expect(result.data.metrics.recentSessions).toHaveLength(1);
      expect(result.data.cached).toBe(true);
    }
  });

  it('real repository exports match interface', () => {
    // Verify the real repository has all required methods
    expect(typeof dashboardRepository.getMetrics).toBe('function');
  });
});



