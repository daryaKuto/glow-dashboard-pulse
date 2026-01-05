import { describe, it, expect, afterEach } from 'vitest';
import { apiOk } from '../../src/shared/lib/api-response';
import { profileRepository } from '../../src/features/profile/repo';
import { getProfileService, setProfileRepository } from '../../src/features/profile/service';
import type { ProfileRepository } from '../../src/domain/profile/ports';

// Valid UUID for testing
const TEST_USER_ID = '550e8400-e29b-41d4-a716-446655440000';

describe('profile adapter conformance', () => {
  afterEach(() => {
    // Restore the real repository after each test
    setProfileRepository(profileRepository);
  });

  it('mock repository satisfies ProfileRepository interface', async () => {
    // Create a mock that satisfies the full interface
    const mockRepo: ProfileRepository = {
      getProfile: async () => apiOk(null),
      getRecentSessions: async () => apiOk([]),
      getStatsTrend: async () => apiOk([]),
      updateProfile: async () => apiOk(true),
      getWifiCredentials: async () => apiOk(null),
      saveThingsBoardCredentials: async () => apiOk(true),
    };

    // Inject the mock
    setProfileRepository(mockRepo);

    // Verify the service uses the injected repository (use valid UUID)
    const result = await getProfileService(TEST_USER_ID);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toBeNull();
    }
  });

  it('mock repository with sample data works correctly', async () => {
    const sampleProfile = {
      userId: TEST_USER_ID,
      email: 'test@example.com',
      name: 'Test User',
      avatarUrl: null,
      totalHits: 500,
      totalShots: 600,
      bestScore: 95,
      totalSessions: 20,
      avgAccuracy: 83.3,
      avgReactionTime: 450,
      bestReactionTime: 320,
      totalDuration: 3600000,
      scoreImprovement: 15,
      accuracyImprovement: 10,
    };

    const sampleSession = {
      id: 'session-1',
      scenarioName: 'Quick Draw',
      scenarioType: 'speed',
      roomName: 'Living Room',
      roomId: 'room-1',
      score: 85,
      accuracyPercentage: 90,
      durationMs: 60000,
      hitCount: 45,
      totalShots: 50,
      missCount: 5,
      avgReactionTimeMs: 400,
      bestReactionTimeMs: 300,
      worstReactionTimeMs: 600,
      startedAt: new Date().toISOString(),
      endedAt: new Date().toISOString(),
      thingsboardData: null,
      rawSensorData: null,
    };

    const mockRepo: ProfileRepository = {
      getProfile: async () => apiOk(sampleProfile),
      getRecentSessions: async () => apiOk([sampleSession]),
      getStatsTrend: async () => apiOk([]),
      updateProfile: async () => apiOk(true),
      getWifiCredentials: async () => apiOk({ ssid: 'TestNetwork', password: 'secret123' }),
      saveThingsBoardCredentials: async () => apiOk(true),
    };

    setProfileRepository(mockRepo);

    const result = await getProfileService(TEST_USER_ID);
    expect(result.ok).toBe(true);
    if (result.ok && result.data) {
      expect(result.data.userId).toBe(TEST_USER_ID);
      expect(result.data.totalHits).toBe(500);
      expect(result.data.avgAccuracy).toBe(83.3);
    }
  });

  it('real repository exports match interface', () => {
    // Verify the real repository has all required methods
    expect(typeof profileRepository.getProfile).toBe('function');
    expect(typeof profileRepository.getRecentSessions).toBe('function');
    expect(typeof profileRepository.getStatsTrend).toBe('function');
    expect(typeof profileRepository.updateProfile).toBe('function');
    expect(typeof profileRepository.getWifiCredentials).toBe('function');
    expect(typeof profileRepository.saveThingsBoardCredentials).toBe('function');
  });
});

