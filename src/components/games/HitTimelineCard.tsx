import React, { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
} from 'recharts';
import { DEVICE_COLOR_PALETTE } from './constants';

interface HitTimelineCardProps {
  trackedDevices: Array<{ deviceId: string; deviceName: string }>;
  data: Array<Record<string, number | string>>;
}

const TimelineTooltip: React.FC<{ active?: boolean; payload?: any[]; label?: string }> = ({ active, payload, label }) => {
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  const hits = payload
    .filter((entry) => typeof entry.value === 'number' && entry.value > 0)
    .sort((a, b) => (b.value as number) - (a.value as number));

  if (hits.length === 0) {
    return null;
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white/95 px-3 py-2 text-xs shadow-md">
      <p className="font-semibold text-brand-dark">{label}</p>
      <div className="mt-2 space-y-1.5">
        {hits.map((entry) => (
          <div key={entry.dataKey} className="flex items-center justify-between gap-6">
            <span className="flex items-center gap-1 text-brand-dark/80">
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: entry.color || '#111' }}
              />
              {entry.dataKey}
            </span>
            <span className="font-heading text-brand-dark">{entry.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// Charts hits per device over time to highlight momentum spikes during a session.
export const HitTimelineCard: React.FC<HitTimelineCardProps> = ({ trackedDevices, data }) => {
  const totalHits = useMemo(() => {
    return data.reduce((sum, bucket) => {
      return (
        sum +
        trackedDevices.reduce((deviceSum, device) => {
          const value = bucket[device.deviceName];
          return typeof value === 'number' ? deviceSum + value : deviceSum;
        }, 0)
      );
    }, 0);
  }, [data, trackedDevices]);

  return (
    <Card className="bg-gradient-to-br from-white via-brand-primary/5 to-brand-secondary/10 border border-brand-primary/20 shadow-sm rounded-md md:rounded-lg">
      <CardContent className="p-4 md:p-5 space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.3em] text-brand-primary font-semibold">Timeline</p>
            <h2 className="font-heading text-lg text-brand-dark">Hit Distribution Over Time</h2>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="text-xs">
              {trackedDevices.length} devices
            </Badge>
            <Badge className="text-xs bg-white/70 text-brand-dark border-brand-primary/20">
              {totalHits} hits
            </Badge>
          </div>
        </div>
        <div className="h-60 sm:h-64">
          {data.length === 0 ? (
            <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-brand-secondary/40 bg-white/60 text-center text-sm text-brand-dark/60 px-6">
              Start streaming hits to populate the timeline with device activity.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 8, right: 16, left: -12, bottom: 36 }}>
                <defs>
                  <linearGradient id="timelineGrid" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#cbd5f5" stopOpacity="0.4" />
                    <stop offset="100%" stopColor="#e2e8f0" stopOpacity="0.1" />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="url(#timelineGrid)" strokeDasharray="3 3" />
                <XAxis dataKey="time" stroke="#475569" fontSize={10} tickMargin={8} />
                <YAxis stroke="#475569" fontSize={10} allowDecimals={false} tickMargin={8} />
                <RechartsTooltip content={<TimelineTooltip />} />
                <Legend
                  verticalAlign="bottom"
                  iconType="circle"
                  iconSize={10}
                  height={48}
                  wrapperStyle={{ paddingTop: 12, width: '100%', maxHeight: 56, overflowY: 'auto' }}
                />
                {trackedDevices.map((device, index) => (
                  <Line
                    key={device.deviceId}
                    type="linear"
                    dataKey={device.deviceName}
                    stroke={DEVICE_COLOR_PALETTE[index % DEVICE_COLOR_PALETTE.length]}
                    strokeWidth={2}
                    dot={{ r: 2 }}
                    activeDot={{ r: 5, strokeWidth: 0 }}
                    isAnimationActive={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

// Placeholder while hit timeline data initializes.
export const HitTimelineSkeleton: React.FC = () => (
  <Card className="bg-white border-gray-200 shadow-sm rounded-md md:rounded-lg">
    <CardContent className="p-4 md:p-5 space-y-3">
      <div className="flex items-center justify-between">
        <Skeleton className="h-5 w-28 bg-gray-200" />
        <Skeleton className="h-4 w-20 bg-gray-200" />
      </div>
      <Skeleton className="h-56 w-full bg-gray-100 rounded-lg" />
    </CardContent>
  </Card>
);
