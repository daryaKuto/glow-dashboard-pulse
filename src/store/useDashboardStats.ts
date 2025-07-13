import { create } from 'zustand';
import dayjs from 'dayjs';
import { fetchHitEvents, summariseHits, HitSummary } from '@/services/metrics';

type SliceKey = 'latest' | 'week' | 'month' | 'all';

interface SliceState {
  loading: boolean;
  data: HitSummary | null;
  series: { ts: number; rt: number }[];
}

interface DashState {
  slices: Record<SliceKey, SliceState>;
  refresh: () => Promise<void>;
}

const emptySlice = (): SliceState => ({ loading: false, data: null, series: [] });

export const useDashboardStats = create<DashState>((set) => ({
  slices: { 
    latest: emptySlice(), 
    week: emptySlice(), 
    month: emptySlice(), 
    all: emptySlice() 
  },

  refresh: async () => {
    try {
      const now = Date.now();
      const week = dayjs(now).subtract(7, 'day').valueOf();
      const month = dayjs(now).subtract(30, 'day').valueOf();

      const ranges: Record<SliceKey, [number, number]> = {
        latest: [week, now],   // refined after fetch
        week: [week, now],
        month: [month, now],
        all: [0, now],
      };

      // flip all slices to loading=true
      set(state => ({
        slices: Object.fromEntries(
          (Object.keys(ranges) as SliceKey[])
            .map(k => [k, { ...state.slices[k], loading: true }])
        ) as Record<SliceKey, SliceState>,
      }));

      // Only use real API and real data
      const results = await Promise.all(
        (Object.keys(ranges) as SliceKey[]).map(async (k) => {
          try {
            const [from, to] = ranges[k];
            const events = await fetchHitEvents(from, to);
            const stats = summariseHits(events);
            const series = events.map(e => ({ ts: e.hit_ts, rt: e.hit_ts - e.beep_ts }));
            return [k, { loading: false, data: stats, series }] as [SliceKey, SliceState];
          } catch (error) {
            console.error(`Error fetching data for ${k}:`, error);
            return [k, { loading: false, data: null, series: [] }] as [SliceKey, SliceState];
          }
        })
      );

      // refine "latest" slice = hits of the most-recent scenario (max hit_ts)
      const weekSeries = results.find(([k]) => k === 'week')?.[1].series ?? [];
      const lastStartTs = Math.max(...weekSeries.map(h => h.ts), 0);
      const latestScenarioHits = weekSeries.filter(h => h.ts >= lastStartTs - 60 * 60 * 1000); // 1 h window
      results.push([
        'latest',
        {
          loading: false,
          data: summariseHits(
            latestScenarioHits.map(h => ({ beep_ts: h.ts - h.rt, hit_ts: h.ts, deviceId: 'x' }))
          ),
          series: latestScenarioHits,
        },
      ]);

      set({ slices: Object.fromEntries(results) as Record<SliceKey, SliceState> });
    } catch (error) {
      console.error('Error in refresh:', error);
      // Set all slices to error state
      set(state => ({
        slices: Object.fromEntries(
          (Object.keys(state.slices) as SliceKey[])
            .map(k => [k, { loading: false, data: null, series: [] }])
        ) as Record<SliceKey, SliceState>,
      }));
    }
  },
})); 