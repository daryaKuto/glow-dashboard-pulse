import { describe, it, expect } from 'vitest';
import { mapGameRowToDomain } from '../../src/domain/games/mappers';

describe('games mappers', () => {
  it('maps game row to template domain model', () => {
    const template = mapGameRowToDomain({
      id: 'game-1',
      slug: 'quick-draw',
      name: 'Quick Draw',
      description: null,
      category: 'speed',
      difficulty: 'easy',
      target_count: 3,
      shots_per_target: 2,
      time_limit_ms: null,
      is_active: true,
      is_public: true,
      thingsboard_config: { mode: 'fast' },
      rules: null,
      created_at: '2024-01-01',
      updated_at: '2024-01-02',
    });

    expect(template.targetCount).toBe(3);
    expect(template.timeLimitMs).toBe(0);
    expect(template.thingsboardConfig).toEqual({ mode: 'fast' });
    expect(template.rules).toBeNull();
  });
});
