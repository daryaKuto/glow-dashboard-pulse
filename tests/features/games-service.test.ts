import { describe, it, expect, afterEach } from 'vitest';
import { apiOk } from '../../src/shared/lib/api-response';
import { gamesRepository } from '../../src/features/games/repo';
import { getGameTemplatesService, setGameRepository } from '../../src/features/games/service';
import type { GameRepository } from '../../src/domain/games/ports';

describe('games service repository injection', () => {
  // Reset to real repository after each test
  afterEach(() => {
    setGameRepository(gamesRepository);
  });

  it('uses the injected repository for getGameTemplates', async () => {
    const mockTemplates = [
      {
        id: 'game-1',
        slug: 'test-game',
        name: 'Test Game',
        description: 'A test game',
        category: 'practice',
        difficulty: 'easy',
        targetCount: 3,
        shotsPerTarget: 1,
        timeLimitMs: 60000,
        isActive: true,
        isPublic: true,
        thingsboardConfig: null,
        rules: null,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      },
    ];

    const mockRepo: GameRepository = {
      getGameTemplates: async () => apiOk(mockTemplates),
      persistGameStart: async () => apiOk(undefined),
      persistGameStop: async () => apiOk(undefined),
    };

    setGameRepository(mockRepo);
    const result = await getGameTemplatesService();
    
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual(mockTemplates);
      expect(result.data[0].name).toBe('Test Game');
    }
  });

  it('returns empty array when no templates exist', async () => {
    const mockRepo: GameRepository = {
      getGameTemplates: async () => apiOk([]),
      persistGameStart: async () => apiOk(undefined),
      persistGameStop: async () => apiOk(undefined),
    };

    setGameRepository(mockRepo);
    const result = await getGameTemplatesService();
    
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual([]);
    }
  });
});

