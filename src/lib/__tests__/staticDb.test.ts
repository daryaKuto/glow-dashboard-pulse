
import { describe, it, expect, beforeEach } from 'vitest';
import { staticDb } from '../staticDb';

describe('StaticDb', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('getHits7d', () => {
    it('returns 7 days of hit data', () => {
      const trend = staticDb.getHits7d();
      expect(trend).toHaveLength(7);
      expect(trend[0]).toHaveProperty('day');
      expect(trend[0]).toHaveProperty('hits');
    });

    it('returns days in ascending order', () => {
      const trend = staticDb.getHits7d();
      const days = trend.map(t => t.day);
      const sortedDays = [...days].sort();
      expect(days).toEqual(sortedDays);
    });
  });

  describe('hit recording', () => {
    it('records hits and persists them', () => {
      const initialTrend = staticDb.getHits7d();
      const today = new Date().toISOString().slice(0, 10);
      const initialHits = initialTrend.find(t => t.day === today)?.hits || 0;

      // Simulate a hit
      const target = staticDb.db.targets[0];
      (staticDb as any).recordHit(target.id);

      const newTrend = staticDb.getHits7d();
      const newHits = newTrend.find(t => t.day === today)?.hits || 0;
      
      expect(newHits).toBe(initialHits + 1);
    });
  });
});
