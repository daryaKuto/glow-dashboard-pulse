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

      // Progressive loading: start with most recent data first
      const loadOrder: SliceKey[] = ['latest', 'week', 'month', 'all'];

      // Set all slices to loading initially
      set(state => ({
        slices: Object.fromEntries(
          (Object.keys(ranges) as SliceKey[])
            .map(k => [k, { ...state.slices[k], loading: true }])
        ) as Record<SliceKey, SliceState>,
      }));

      // Load slices progressively
      for (const sliceKey of loadOrder) {
        try {
          console.log(`🔄 [DashboardStats] Loading ${sliceKey} data...`);
          const [from, to] = ranges[sliceKey];
          const events = await fetchHitEvents(from, to);
          const stats = summariseHits(events);
          const series = events.map(e => ({ ts: e.hit_ts, rt: e.hit_ts - e.beep_ts }));
          
          // Update this slice immediately
          set(state => ({
            slices: {
              ...state.slices,
              [sliceKey]: { loading: false, data: stats, series }
            }
          }));
          
          console.log(`✅ [DashboardStats] ${sliceKey} data loaded`);
          
          // Small delay between loads to show progressive loading
          if (sliceKey !== 'all') {
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        } catch (error) {
          console.error(`❌ [DashboardStats] Error fetching ${sliceKey} data:`, error);
          // Update this slice with error state
          set(state => ({
            slices: {
              ...state.slices,
              [sliceKey]: { loading: false, data: null, series: [] }
            }
          }));
        }
      }

      // Refine "latest" slice = hits of the most-recent scenario (max hit_ts)
      const weekSlice = useDashboardStats.getState().slices.week;
      if (weekSlice.series.length > 0) {
        const lastStartTs = Math.max(...weekSlice.series.map(h => h.ts), 0);
        const latestScenarioHits = weekSlice.series.filter(h => h.ts >= lastStartTs - 60 * 60 * 1000); // 1 h window
        
        set(state => ({
          slices: {
            ...state.slices,
            latest: {
              loading: false,
              data: summariseHits(
                latestScenarioHits.map(h => ({ beep_ts: h.ts - h.rt, hit_ts: h.ts, deviceId: 'x' }))
              ),
              series: latestScenarioHits,
            }
          }
        }));
      }

    } catch (error) {
      console.error('❌ [DashboardStats] Error in refresh:', error);
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