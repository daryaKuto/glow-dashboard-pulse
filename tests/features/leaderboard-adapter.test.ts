import { describe, it, expect, afterEach } from 'vitest';
import { apiOk } from '../../src/shared/lib/api-response';
import { leaderboardRepository } from '../../src/features/leaderboard/repo';
import { getLeaderboardService, setLeaderboardRepository } from '../../src/features/leaderboard/service';
import type { LeaderboardRepository } from '../../src/domain/leaderboard/ports';

describe('leaderboard adapter conformance', () => {
  afterEach(() => {
    setLeaderboardRepository(leaderboardRepository);
  });

  it('mock repository satisfies LeaderboardRepository interface', async () => {
    const mockRepo: LeaderboardRepository = {
      getLeaderboard: async () =>
        apiOk([
          {
            id: 'player-1',
            name: 'Demo Player',
            score: 95,
            hits: 40,
            accuracy: 92,
          },
        ]),
    };

    setLeaderboardRepository(mockRepo);

    const result = await getLeaderboardService({
      timeframe: 'week',
      sortBy: 'score',
      limit: 10,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toHaveLength(1);
      expect(result.data[0].rank).toBe(1);
    }
  });

  it('real repository exports match interface', () => {
    expect(typeof leaderboardRepository.getLeaderboard).toBe('function');
  });
});
