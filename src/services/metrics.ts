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
  try {
    // For now, return empty array since we don't have telemetry data set up
    // TODO: Implement proper telemetry fetching from specific devices
    return [];
  } catch (error) {
    console.error('Error fetching hit events:', error);
    // Return empty array instead of throwing to prevent breaking the UI
    return [];
  }
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
