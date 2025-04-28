import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { staticDb } from '../staticDb';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value.toString();
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
})();

// Setup mock
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

describe('StaticDb', () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should initialize with test user', async () => {
    await staticDb.ensureInitialized();
    const db = staticDb._getDbForTesting();
    expect(db.users[0].email).toBe('test_user@example.com');
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
