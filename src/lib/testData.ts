import dayjs from 'dayjs';
import type { HitEvent } from '@/services/metrics';

// Generate realistic hit events with varying reaction times
const generateHitEvents = (
  startTime: number,
  endTime: number,
  eventCount: number,
  deviceIds: string[] = ['target-001', 'target-002', 'target-003']
): HitEvent[] => {
  const events: HitEvent[] = [];
  const timeSpan = endTime - startTime;
  
  for (let i = 0; i < eventCount; i++) {
    const beepTime = startTime + Math.random() * timeSpan;
    // Generate realistic reaction times: 200-800ms with some outliers
    const reactionTime = Math.random() < 0.8 
      ? 200 + Math.random() * 600  // 80% normal: 200-800ms
      : 50 + Math.random() * 150;  // 20% fast: 50-200ms
    
    const hitTime = beepTime + reactionTime;
    const deviceId = deviceIds[Math.floor(Math.random() * deviceIds.length)];
    
    events.push({
      deviceId,
      beep_ts: Math.floor(beepTime),
      hit_ts: Math.floor(hitTime),
    });
  }
  
  return events.sort((a, b) => a.beep_ts - b.beep_ts);
};

// Current time for reference
const now = Date.now();

// Generate test data for different time ranges
export const testHitEvents: Record<string, HitEvent[]> = {
  // Latest scenario (last hour)
  latest: generateHitEvents(
    now - 60 * 60 * 1000, // 1 hour ago
    now,
    25, // 25 hits in the latest scenario
    ['target-001', 'target-002']
  ),
  
  // Past week
  week: generateHitEvents(
    now - 7 * 24 * 60 * 60 * 1000, // 7 days ago
    now,
    150, // 150 hits over the week
    ['target-001', 'target-002', 'target-003']
  ),
  
  // Past month
  month: generateHitEvents(
    now - 30 * 24 * 60 * 60 * 1000, // 30 days ago
    now,
    600, // 600 hits over the month
    ['target-001', 'target-002', 'target-003', 'target-004']
  ),
  
  // All time (last 3 months)
  all: generateHitEvents(
    now - 90 * 24 * 60 * 60 * 1000, // 90 days ago
    now,
    1800, // 1800 hits total
    ['target-001', 'target-002', 'target-003', 'target-004', 'target-005']
  ),
};

// Mock API response format that matches ThingsBoard structure
export const mockThingsBoardResponse = (events: HitEvent[]) => {
  const beep_ts: Record<string, number> = {};
  const hit_ts: Record<string, number> = {};
  
  events.forEach(event => {
    const ts = event.beep_ts.toString();
    beep_ts[ts] = event.beep_ts;
    hit_ts[ts] = event.hit_ts;
  });
  
  return {
    beep_ts,
    hit_ts,
  };
};

// Pre-computed summaries for testing
export const testSummaries = {
  latest: {
    avgRT: 450,
    bestRT: 89,
    hitCount: 25,
  },
  week: {
    avgRT: 412,
    bestRT: 67,
    hitCount: 150,
  },
  month: {
    avgRT: 398,
    bestRT: 45,
    hitCount: 600,
  },
  all: {
    avgRT: 385,
    bestRT: 32,
    hitCount: 1800,
  },
};

// Time series data for charts
export const generateTimeSeries = (events: HitEvent[]) => {
  return events.map(event => ({
    ts: event.hit_ts,
    rt: event.hit_ts - event.beep_ts,
  }));
};

export const testTimeSeries = {
  latest: generateTimeSeries(testHitEvents.latest),
  week: generateTimeSeries(testHitEvents.week),
  month: generateTimeSeries(testHitEvents.month),
  all: generateTimeSeries(testHitEvents.all),
}; 