import { fetchHitEvents, summariseHits } from '../metrics';
import { testHitEvents } from '@/lib/testData';

describe('Metrics Service', () => {
  test('should fetch hit events in development mode', async () => {
    const events = await fetchHitEvents(Date.now() - 7 * 24 * 60 * 60 * 1000, Date.now());
    expect(events).toBeDefined();
    expect(Array.isArray(events)).toBe(true);
    expect(events.length).toBeGreaterThan(0);
  });

  test('should calculate hit summaries correctly', () => {
    const events = testHitEvents.latest;
    const summary = summariseHits(events);
    
    expect(summary).toBeDefined();
    expect(summary?.hitCount).toBe(events.length);
    expect(summary?.avgRT).toBeGreaterThan(0);
    expect(summary?.bestRT).toBeGreaterThan(0);
    expect(summary?.avgRT).toBeGreaterThanOrEqual(summary?.bestRT);
  });

  test('should handle empty events array', () => {
    const summary = summariseHits([]);
    expect(summary).toBeNull();
  });

  test('should filter out invalid events', () => {
    const invalidEvents = [
      { deviceId: 'test', beep_ts: 1000, hit_ts: 500 }, // hit before beep
      { deviceId: 'test', beep_ts: 1000, hit_ts: 1500 }, // valid
      { deviceId: 'test', beep_ts: 2000, hit_ts: 1800 }, // hit before beep
    ];
    
    const summary = summariseHits(invalidEvents);
    expect(summary?.hitCount).toBe(1);
  });
}); 