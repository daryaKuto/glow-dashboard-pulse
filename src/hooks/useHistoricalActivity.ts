import { useState, useEffect, useCallback } from 'react';
import { thingsBoardService } from '@/services/thingsboard';
import type { Target } from '@/store/useTargets';

export type TimeRange = 'day' | 'week' | '3m' | '6m' | 'all';

export interface HistoricalDataPoint {
  date: string;
  hits: number;
  timestamp: number;
}

interface UseHistoricalActivityReturn {
  historicalData: HistoricalDataPoint[];
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

const TIME_RANGES = {
  day: 24 * 60 * 60 * 1000,      // 24 hours
  week: 7 * 24 * 60 * 60 * 1000,  // 7 days
  '3m': 90 * 24 * 60 * 60 * 1000, // 90 days
  '6m': 180 * 24 * 60 * 60 * 1000, // 180 days
  all: 0 // All time - will use 0 as startTs
};

const TELEMETRY_KEYS = ['hits', 'hit_ts', 'beep_ts'];

export const useHistoricalActivity = (
  targets: Target[],
  timeRange: TimeRange
): UseHistoricalActivityReturn => {
  const [historicalData, setHistoricalData] = useState<HistoricalDataPoint[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const aggregateData = useCallback((rawData: any[], timeRange: TimeRange): HistoricalDataPoint[] => {
    const now = Date.now();
    const timeRangeMs = TIME_RANGES[timeRange];
    const startTime = timeRangeMs === 0 ? 0 : now - timeRangeMs;

    // Filter data within time range
    const filteredData = rawData.filter(item => {
      const timestamp = item.timestamp || item.ts;
      return timestamp >= startTime && timestamp <= now;
    });

    // Determine bucket size based on time range
    let bucketSize: number;
    let bucketCount: number;
    
    switch (timeRange) {
      case 'day':
        bucketSize = 60 * 60 * 1000; // 1 hour
        bucketCount = 24;
        break;
      case 'week':
        bucketSize = 24 * 60 * 60 * 1000; // 1 day
        bucketCount = 7;
        break;
      case '3m':
        bucketSize = 7 * 24 * 60 * 60 * 1000; // 1 week
        bucketCount = 12;
        break;
      case '6m':
        bucketSize = 7 * 24 * 60 * 60 * 1000; // 1 week
        bucketCount = 24;
        break;
      case 'all':
        bucketSize = 30 * 24 * 60 * 60 * 1000; // 1 month
        bucketCount = 12;
        break;
      default:
        bucketSize = 24 * 60 * 60 * 1000;
        bucketCount = 7;
    }

    // Create time buckets
    const buckets: { [key: number]: number } = {};
    const bucketStart = timeRangeMs === 0 ? Math.min(...filteredData.map(d => d.timestamp || d.ts)) : now - timeRangeMs;
    
    for (let i = 0; i < bucketCount; i++) {
      const bucketTime = bucketStart + (i * bucketSize);
      buckets[bucketTime] = 0;
    }

    // Aggregate hits into buckets
    filteredData.forEach(item => {
      const timestamp = item.timestamp || item.ts;
      const bucketTime = bucketStart + Math.floor((timestamp - bucketStart) / bucketSize) * bucketSize;
      
      if (buckets.hasOwnProperty(bucketTime)) {
        buckets[bucketTime] += item.hits || 0;
      }
    });

    // Convert to array and format
    return Object.entries(buckets)
      .map(([timestamp, hits]) => ({
        date: new Date(parseInt(timestamp)).toISOString().split('T')[0],
        hits,
        timestamp: parseInt(timestamp)
      }))
      .sort((a, b) => a.timestamp - b.timestamp);
  }, []);

  const fetchHistoricalData = useCallback(async () => {
    if (!targets.length) {
      setHistoricalData([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      console.log(`🔍 [HistoricalActivity] Fetching data for ${timeRange} range with ${targets.length} targets`);
      
      // Get online targets only
      const onlineTargets = targets.filter(target => target.status === 'online');
      
      if (onlineTargets.length === 0) {
        console.log('🔍 [HistoricalActivity] No online targets, returning empty data');
        setHistoricalData([]);
        return;
      }

      const now = Date.now();
      const timeRangeMs = TIME_RANGES[timeRange];
      const startTime = timeRangeMs === 0 ? 0 : now - timeRangeMs;
      const endTime = now;

      console.log(`🔍 [HistoricalActivity] Time range: ${new Date(startTime).toISOString()} to ${new Date(endTime).toISOString()}`);

      // Fetch historical data for all online targets
      const deviceIds = onlineTargets.map(target => target.id?.id || target.id);
      const allHistoricalData: any[] = [];

      // Fetch data for each device (ThingsBoard doesn't support batch historical queries)
      const fetchPromises = deviceIds.map(async (deviceId) => {
        try {
          const telemetryData = await thingsBoardService.getHistoricalTelemetry(
            deviceId,
            TELEMETRY_KEYS,
            startTime,
            endTime,
            1000 // limit
          );

          // Process hits data
          if (telemetryData.hits && Array.isArray(telemetryData.hits)) {
            telemetryData.hits.forEach((hit: any) => {
              allHistoricalData.push({
                timestamp: hit.ts,
                hits: parseInt(hit.value) || 0
              });
            });
          }

          // Process hit_ts data (alternative hit tracking)
          if (telemetryData.hit_ts && Array.isArray(telemetryData.hit_ts)) {
            telemetryData.hit_ts.forEach((hitTs: any) => {
              allHistoricalData.push({
                timestamp: hitTs.ts,
                hits: 1 // Each hit_ts represents 1 hit
              });
            });
          }

          // Process beep_ts data (shot detection)
          if (telemetryData.beep_ts && Array.isArray(telemetryData.beep_ts)) {
            telemetryData.beep_ts.forEach((beepTs: any) => {
              allHistoricalData.push({
                timestamp: beepTs.ts,
                hits: 1 // Each beep_ts represents 1 shot
              });
            });
          }
        } catch (error) {
          console.warn(`⚠️ [HistoricalActivity] Failed to fetch data for device ${deviceId}:`, error);
        }
      });

      await Promise.allSettled(fetchPromises);

      console.log(`📊 [HistoricalActivity] Fetched ${allHistoricalData.length} data points`);

      // Aggregate the data
      const aggregatedData = aggregateData(allHistoricalData, timeRange);
      setHistoricalData(aggregatedData);

      console.log(`✅ [HistoricalActivity] Aggregated into ${aggregatedData.length} time buckets`);
    } catch (error) {
      console.error('❌ [HistoricalActivity] Error fetching historical data:', error);
      setError(error instanceof Error ? error.message : 'Failed to fetch historical data');
      setHistoricalData([]);
    } finally {
      setIsLoading(false);
    }
  }, [targets, timeRange, aggregateData]);

  useEffect(() => {
    fetchHistoricalData();
  }, [fetchHistoricalData]);

  return {
    historicalData,
    isLoading,
    error,
    refetch: fetchHistoricalData
  };
};

