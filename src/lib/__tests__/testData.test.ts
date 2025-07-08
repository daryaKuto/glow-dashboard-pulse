import { testHitEvents, testSummaries, testTimeSeries } from '../testData';
import { summariseHits as metricsSummariseHits } from '@/services/metrics';

describe('Test Data Generation', () => {
  test('should generate hit events for all time ranges', () => {
    expect(testHitEvents.latest).toBeDefined();
    expect(testHitEvents.week).toBeDefined();
    expect(testHitEvents.month).toBeDefined();
    expect(testHitEvents.all).toBeDefined();
  });

  test('should have realistic hit counts', () => {
    expect(testHitEvents.latest.length).toBeGreaterThan(0);
    expect(testHitEvents.week.length).toBeGreaterThan(testHitEvents.latest.length);
    expect(testHitEvents.month.length).toBeGreaterThan(testHitEvents.week.length);
    expect(testHitEvents.all.length).toBeGreaterThan(testHitEvents.month.length);
  });

  test('should have valid hit event structure', () => {
    const event = testHitEvents.latest[0];
    expect(event).toHaveProperty('deviceId');
    expect(event).toHaveProperty('beep_ts');
    expect(event).toHaveProperty('hit_ts');
    expect(typeof event.deviceId).toBe('string');
    expect(typeof event.beep_ts).toBe('number');
    expect(typeof event.hit_ts).toBe('number');
  });

  test('should have valid reaction times', () => {
    testHitEvents.latest.forEach(event => {
      const rt = event.hit_ts - event.beep_ts;
      expect(rt).toBeGreaterThan(0);
      expect(rt).toBeLessThan(2000); // Should be reasonable reaction times
    });
  });

  test('should generate time series data', () => {
    expect(testTimeSeries.latest).toBeDefined();
    expect(testTimeSeries.week).toBeDefined();
    expect(testTimeSeries.month).toBeDefined();
    expect(testTimeSeries.all).toBeDefined();
  });

  test('should have valid time series structure', () => {
    const series = testTimeSeries.latest[0];
    expect(series).toHaveProperty('ts');
    expect(series).toHaveProperty('rt');
    expect(typeof series.ts).toBe('number');
    expect(typeof series.rt).toBe('number');
  });

  test('should have pre-computed summaries', () => {
    expect(testSummaries.latest).toBeDefined();
    expect(testSummaries.week).toBeDefined();
    expect(testSummaries.month).toBeDefined();
    expect(testSummaries.all).toBeDefined();
  });

  test('should have valid summary structure', () => {
    const summary = testSummaries.latest;
    expect(summary).toHaveProperty('avgRT');
    expect(summary).toHaveProperty('bestRT');
    expect(summary).toHaveProperty('hitCount');
    expect(typeof summary.avgRT).toBe('number');
    expect(typeof summary.bestRT).toBe('number');
    expect(typeof summary.hitCount).toBe('number');
  });

  test('should match computed summaries', () => {
    const computed = metricsSummariseHits(testHitEvents.latest);
    expect(computed).toBeDefined();
    expect(computed?.hitCount).toBe(testHitEvents.latest.length);
  });
}); 