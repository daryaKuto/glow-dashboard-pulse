import { describe, it, expect } from 'vitest';
import {
  mapSessionRowToRecentSession,
  mapUserAnalyticsRowToMetrics,
  mapUserProfileRowToIdentity,
} from '../../src/domain/profile/mappers';

describe('profile mappers', () => {
  it('maps profile row to identity with display name fallback', () => {
    const identity = mapUserProfileRowToIdentity({
      id: 'user-1',
      email: 'person@example.com',
      display_name: '',
      name: 'Pat Doe',
      avatar_url: null,
    });

    expect(identity).toEqual({
      userId: 'user-1',
      email: 'person@example.com',
      name: 'Pat Doe',
      avatarUrl: undefined,
    });
  });

  it('maps analytics row to metrics with defaults', () => {
    const metrics = mapUserAnalyticsRowToMetrics({
      total_hits: 10,
      total_shots: 20,
      best_score: 99,
      total_sessions: 3,
      accuracy_percentage: 82.345,
      avg_reaction_time_ms: null,
      best_reaction_time_ms: 120,
      total_duration_ms: 5000,
      score_improvement: 5,
      accuracy_improvement: 2,
    });

    expect(metrics.totalHits).toBe(10);
    expect(metrics.totalShots).toBe(20);
    expect(metrics.bestScore).toBe(99);
    expect(metrics.totalSessions).toBe(3);
    expect(metrics.avgAccuracy).toBe(82.35);
    expect(metrics.avgReactionTime).toBe(null);
    expect(metrics.bestReactionTime).toBe(120);
    expect(metrics.totalDuration).toBe(5000);
  });

  it('maps session row to recent session', () => {
    const session = mapSessionRowToRecentSession({
      id: 'session-1',
      scenario_name: 'Drill',
      scenario_type: null,
      room_name: 'Main',
      room_id: 'room-1',
      score: 42,
      accuracy_percentage: 90.556,
      duration_ms: 1200,
      hit_count: 5,
      total_shots: 6,
      miss_count: 1,
      avg_reaction_time_ms: 350,
      best_reaction_time_ms: 200,
      worst_reaction_time_ms: 500,
      started_at: '2024-01-01T00:00:00Z',
      ended_at: null,
      thingsboard_data: { key: 'value' },
      raw_sensor_data: { raw: true },
    });

    expect(session.accuracy).toBe(90.56);
    expect(session.roomId).toBe('room-1');
    expect(session.thingsboardData).toEqual({ key: 'value' });
  });
});
