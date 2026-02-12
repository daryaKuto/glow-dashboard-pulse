import React, { useMemo } from 'react';
import { Activity } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
} from 'recharts';
import { CHART_COLORS, CHART_STYLE } from '@/shared/constants/chart-colors';

interface HitTimelineCardProps {
  trackedDevices: Array<{ deviceId: string; deviceName: string }>;
  data: Array<Record<string, number | string>>;
}

const StravaTip: React.FC<{ active?: boolean; payload?: any[]; label?: string }> = ({
  active,
  payload,
  label,
}) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white rounded-xl shadow-lg p-3 border-0 min-w-[120px]">
      <p className="text-xs text-brand-secondary font-body mb-1">{label}</p>
      {payload.map((entry: any, i: number) => (
        <div key={i} className="flex items-center gap-2">
          <span
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-xs text-brand-dark/60 font-body">{entry.name}</span>
          <span className="text-sm font-bold text-brand-dark font-body ml-auto tabular-nums">
            {entry.value}
          </span>
        </div>
      ))}
    </div>
  );
};

// Charts hits per device over time to highlight momentum spikes during a session.
export const HitTimelineCard: React.FC<HitTimelineCardProps> = ({ trackedDevices, data }) => {
  // Exclude the aggregate line from totals to avoid double-counting.
  // The aggregate value is already the sum of per-device values.
  const perDeviceOnly = useMemo(
    () => trackedDevices.filter((d) => d.deviceId !== 'aggregate'),
    [trackedDevices],
  );

  const totalHits = useMemo(() => {
    return data.reduce((sum, bucket) => {
      return (
        sum +
        perDeviceOnly.reduce((deviceSum, device) => {
          const value = bucket[device.deviceName];
          return typeof value === 'number' ? deviceSum + value : deviceSum;
        }, 0)
      );
    }, 0);
  }, [data, perDeviceOnly]);

  // Per-device hit totals for the legend (excludes aggregate)
  const deviceTotals = useMemo(() => {
    return perDeviceOnly.map((device) => {
      const hits = data.reduce((sum, bucket) => {
        const value = bucket[device.deviceName];
        return typeof value === 'number' ? sum + value : sum;
      }, 0);
      return { ...device, hits };
    });
  }, [data, perDeviceOnly]);

  return (
    <Card className="shadow-card bg-gradient-to-br from-brand-primary/[0.02] to-white">
      <CardHeader className="pb-2 md:pb-3 p-5 md:p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-brand-primary" />
            <div>
              <h3 className="text-sm font-medium text-brand-dark font-body">Hit Timeline</h3>
              <p className="text-[11px] text-brand-dark/40 font-body">
                {trackedDevices.length} device{trackedDevices.length !== 1 ? 's' : ''} tracked
              </p>
            </div>
          </div>
          <div>
            <p className="text-stat-md md:text-stat-lg font-bold text-brand-dark font-body tabular-nums text-right leading-none">
              {totalHits.toLocaleString()}
            </p>
            <span className="text-[10px] text-brand-dark/40 font-body uppercase tracking-wide">
              Total Hits
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-5 pb-5 md:px-6 md:pb-6 pt-0">
        {/* Chart — full bleed on right, padded on left for Y axis */}
        <div className="-mr-5 md:-mr-6">
          {data.length === 0 ? (
            <div className="flex h-52 items-center justify-center text-sm text-brand-dark/40 font-body px-6">
              Start streaming hits to populate the timeline.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                <defs>
                  <linearGradient id="gradientPrimary" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#CE3E0A" stopOpacity={0.2} />
                    <stop offset="100%" stopColor="#CE3E0A" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradientSecondary" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#816E94" stopOpacity={0.12} />
                    <stop offset="100%" stopColor="#816E94" stopOpacity={0} />
                  </linearGradient>
                </defs>

                <CartesianGrid
                  stroke={CHART_STYLE.gridStroke}
                  strokeDasharray={CHART_STYLE.gridDash}
                  vertical={false}
                />
                <XAxis
                  dataKey="time"
                  stroke={CHART_STYLE.axisStroke}
                  fontSize={CHART_STYLE.axisFontSize}
                  fontFamily={CHART_STYLE.axisFontFamily}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke={CHART_STYLE.axisStroke}
                  fontSize={CHART_STYLE.axisFontSize}
                  fontFamily={CHART_STYLE.axisFontFamily}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                  width={32}
                />
                <RechartsTooltip
                  content={<StravaTip />}
                  cursor={{ stroke: CHART_STYLE.tooltipCursor }}
                />

                {trackedDevices.map((device, index) => (
                  <Area
                    key={device.deviceId}
                    type="monotone"
                    dataKey={device.deviceName}
                    stroke={CHART_COLORS[index % CHART_COLORS.length]}
                    strokeWidth={index === 0 ? 2 : 1.5}
                    fill={index === 0 ? 'url(#gradientPrimary)' : 'url(#gradientSecondary)'}
                    dot={false}
                    activeDot={{
                      r: 4,
                      fill: CHART_COLORS[index % CHART_COLORS.length],
                      stroke: '#fff',
                      strokeWidth: 2,
                    }}
                    isAnimationActive={true}
                    animationDuration={CHART_STYLE.animationDuration}
                    animationEasing={CHART_STYLE.animationEasing}
                    animationBegin={index * 200}
                  />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Legend — below chart, horizontal grid of device pills */}
        {data.length > 0 && trackedDevices.length > 0 && (
          <div className="mt-4 pt-3 border-t border-[rgba(28,25,43,0.06)]">
            <div className="grid grid-cols-2 gap-2">
              {deviceTotals.map((device, i) => (
                <div
                  key={device.deviceId}
                  className="flex items-center gap-2 rounded-[var(--radius)] bg-[rgba(28,25,43,0.03)] px-3 py-2 min-w-0"
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
                  />
                  <span className="text-xs text-brand-dark/60 font-body truncate flex-1 min-w-0">
                    {device.deviceName}
                  </span>
                  <span className="text-xs font-bold text-brand-dark font-body tabular-nums shrink-0">
                    {device.hits.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// Placeholder while hit timeline data initializes.
export const HitTimelineSkeleton: React.FC = () => (
  <Card className="shadow-card bg-gradient-to-br from-brand-primary/[0.02] to-white">
    <CardHeader className="pb-2 md:pb-3 p-5 md:p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Skeleton className="w-4 h-4 rounded bg-gray-200" />
          <div>
            <Skeleton className="h-4 w-24 bg-gray-200 mb-1" />
            <Skeleton className="h-3 w-16 bg-gray-200" />
          </div>
        </div>
        <div className="text-right">
          <Skeleton className="h-7 w-12 bg-gray-200 mb-1 ml-auto" />
          <Skeleton className="h-2.5 w-14 bg-gray-200 ml-auto" />
        </div>
      </div>
    </CardHeader>
    <CardContent className="px-5 pb-5 md:px-6 md:pb-6 pt-0">
      {/* Chart skeleton */}
      <Skeleton className="h-[220px] w-full bg-gray-100 rounded-lg -mr-5 md:-mr-6" />
      {/* Legend skeleton */}
      <div className="mt-4 pt-3 border-t border-[rgba(28,25,43,0.06)]">
        <div className="grid grid-cols-2 gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-9 rounded-[var(--radius)] bg-gray-100" />
          ))}
        </div>
      </div>
    </CardContent>
  </Card>
);
