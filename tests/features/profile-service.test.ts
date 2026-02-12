import { describe, it, expect, afterEach } from 'vitest';
import { apiOk } from '../../src/shared/lib/api-response';
import { profileRepository } from '../../src/features/profile/repo';
import { getProfileService, setProfileRepository } from '../../src/features/profile/service';
import type { ProfileRepository } from '../../src/domain/profile/ports';

describe('profile service repository injection', () => {
  // Reset to real repository after each test
  afterEach(() => {
    setProfileRepository(profileRepository);
  });

  it('uses the injected repository for getProfile', async () => {
    // Use a valid UUID format for the user ID
    const userId = '123e4567-e89b-12d3-a456-426614174000';
    const mockProfile = {
      userId,
      email: 'test@example.com',
      name: 'Test User',
      avatarUrl: null,
      totalHits: 100,
      totalShots: 150,
      bestScore: 95,
      totalSessions: 10,
      avgAccuracy: 66.67,
      avgReactionTime: 250,
      bestReactionTime: 180,
      totalDuration: 36000000,
      scoreImprovement: 5,
      accuracyImprovement: 2,
    };

    const mockRepo: ProfileRepository = {
      getProfile: async () => apiOk(mockProfile),
      getRecentSessions: async () => apiOk([]),
      getStatsTrend: async () => apiOk([]),
      updateProfile: async () => apiOk(true),
      getWifiCredentials: async () => apiOk(null),
      saveThingsBoardCredentials: async () => apiOk(true),
    };

    setProfileRepository(mockRepo);
    const result = await getProfileService(userId);
    
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual(mockProfile);
      expect(result.data?.name).toBe('Test User');
    }
  });

  it('returns null when profile does not exist', async () => {
    // Use a valid UUID format for the user ID
    const userId = '123e4567-e89b-12d3-a456-426614174001';
    
    const mockRepo: ProfileRepository = {
      getProfile: async () => apiOk(null),
      getRecentSessions: async () => apiOk([]),
      getStatsTrend: async () => apiOk([]),
      updateProfile: async () => apiOk(true),
      getWifiCredentials: async () => apiOk(null),
      saveThingsBoardCredentials: async () => apiOk(true),
    };

    setProfileRepository(mockRepo);
    const result = await getProfileService(userId);
    
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toBeNull();
    }
  });
});

