import { describe, it, expect, afterEach } from 'vitest';
import { apiOk } from '../../src/shared/lib/api-response';
import { gamesRepository } from '../../src/features/games/repo';
import { getGameTemplatesService, setGameRepository } from '../../src/features/games/service';
import type { GameRepository } from '../../src/domain/games/ports';

describe('games adapter conformance', () => {
  afterEach(() => {
    // Restore the real repository after each test
    setGameRepository(gamesRepository);
  });

  it('mock repository satisfies GameRepository interface', async () => {
    // Create a mock that satisfies the full interface
    const mockRepo: GameRepository = {
      getGameTemplates: async () => apiOk([]),
      persistGameStart: async () => apiOk(undefined),
      persistGameStop: async () => apiOk(undefined),
    };

    // Inject the mock
    setGameRepository(mockRepo);

    // Verify the service uses the injected repository
    const result = await getGameTemplatesService();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual([]);
    }
  });

  it('mock repository with sample data works correctly', async () => {
    const sampleTemplate = {
      id: 'template-1',
      slug: 'quick-draw',
      name: 'Quick Draw',
      description: 'Fast-paced shooting game',
      category: 'speed',
      difficulty: 'medium',
      targetCount: 5,
      shotsPerTarget: 1,
      timeLimitMs: 60000,
      isActive: true,
      isPublic: true,
      thingsboardConfig: null,
      rules: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const mockRepo: GameRepository = {
      getGameTemplates: async () => apiOk([sampleTemplate]),
      persistGameStart: async () => apiOk(undefined),
      persistGameStop: async () => apiOk(undefined),
    };

    setGameRepository(mockRepo);

    const result = await getGameTemplatesService();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toHaveLength(1);
      expect(result.data[0].slug).toBe('quick-draw');
      expect(result.data[0].targetCount).toBe(5);
    }
  });

  it('real repository exports match interface', () => {
    // Verify the real repository has all required methods
    expect(typeof gamesRepository.getGameTemplates).toBe('function');
    expect(typeof gamesRepository.persistGameStart).toBe('function');
    expect(typeof gamesRepository.persistGameStop).toBe('function');
  });
});

