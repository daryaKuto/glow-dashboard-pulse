import api from '@/lib/tbClient';
import { testHitEvents, mockThingsBoardResponse } from '@/lib/testData';

export interface HitEvent {
  deviceId: string;
  beep_ts: number;  // epoch ms
  hit_ts:  number;  // epoch ms
}

export interface HitSummary {
  avgRT: number;    // ms
  bestRT: number;   // ms
  hitCount: number;
}

export const fetchHitEvents = async (
  from: number,          // epoch ms inclusive
  to:   number           // epoch ms exclusive
): Promise<HitEvent[]> => {
  // For testing, return mock data instead of making API calls
  if (process.env.NODE_ENV === 'development') {
    // Determine which test data to use based on time range
    const now = Date.now();
    const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
    const monthAgo = now - 30 * 24 * 60 * 60 * 1000;
    
    if (from >= weekAgo) {
      return testHitEvents.week;
    } else if (from >= monthAgo) {
      return testHitEvents.month;
    } else {
      return testHitEvents.all;
    }
  }

  // Pull all hits across devices for tenant in one shot.
  // ThingsBoard CE lets us query entityType=TENANT with empty deviceId = all
  const { data } = await api.get('/plugins/telemetry/TENANT/values/timeseries', {
    params: {
      keys: 'beep_ts,hit_ts',
      startTs: from,
      endTs:   to,
      limit:   50000, // guardrail – adjust if you have >50 k hits / slice
      agg:     'NONE',
    },
  });
  
  // Flatten TB response [{key:{ts,val}, ...}, …] into HitEvent[]
  return Object.entries(data?.beep_ts ?? {}).map(([ts, beep]) => ({
    deviceId: 'unknown',             // refine if your payload contains deviceId
    beep_ts:  Number(ts),
    hit_ts:   Number((data.hit_ts ?? {})[ts] ?? 0),
  }));
};

export const summariseHits = (events: HitEvent[]): HitSummary | null => {
  const rts = events
    .filter(e => e.hit_ts >= e.beep_ts)
    .map(e => e.hit_ts - e.beep_ts);

  if (!rts.length) return null;

  return {
    avgRT: Math.round(rts.reduce((a, b) => a + b, 0) / rts.length),
    bestRT: Math.min(...rts),
    hitCount: rts.length,
  };
}; 