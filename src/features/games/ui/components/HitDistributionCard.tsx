import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip as RechartsTooltip } from 'recharts';
import { DEVICE_COLOR_PALETTE } from './constants';

interface HitDistributionCardProps {
  totalHits: number;
  deviceHitSummary: Array<{ deviceId: string; deviceName: string; hits: number }>;
  pieChartData: Array<{ name: string; value: number }>;
}

// Visualizes hit distribution across devices via pie chart plus progress rows.
export const HitDistributionCard: React.FC<HitDistributionCardProps> = ({
  totalHits,
  deviceHitSummary,
  pieChartData,
}) => {
  const hasHits = deviceHitSummary.length > 0;
  return (
    <Card className="bg-white border-gray-200 shadow-sm rounded-md md:rounded-lg">
      <CardContent className="p-4 md:p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-lg text-brand-dark">Hit Distribution</h2>
          <Badge variant="outline" className="text-xs">
            {totalHits} hits
          </Badge>
        </div>
        <div className="h-56">
          {!hasHits ? (
            <div className="flex h-full items-center justify-center text-sm text-brand-dark/60 text-center">
              Start a game to see live hit distribution.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieChartData} dataKey="value" nameKey="name" innerRadius="45%" outerRadius="75%" paddingAngle={2}>
                  {pieChartData.map((entry, index) => (
                    <Cell key={entry.name} fill={DEVICE_COLOR_PALETTE[index % DEVICE_COLOR_PALETTE.length]} />
                  ))}
                </Pie>
                <RechartsTooltip />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
        <div className="space-y-3">
          {!hasHits ? (
            <p className="text-xs text-brand-dark/60 text-center">No hits recorded yet.</p>
          ) : (
            deviceHitSummary.slice(0, 4).map((entry, index) => {
              const color = DEVICE_COLOR_PALETTE[index % DEVICE_COLOR_PALETTE.length];
              return (
                <div key={entry.deviceId} className="space-y-1">
                  <div className="flex items-center justify-between text-xs text-brand-dark/60">
                    <span className="flex items-center gap-2 font-medium text-brand-dark">
                      <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
                      {entry.deviceName}
                    </span>
                    <span className="font-heading text-sm text-brand-dark">{entry.hits}</span>
                  </div>
                  <Progress
                    value={totalHits > 0 ? Math.min(100, (entry.hits / totalHits) * 100) : 0}
                    className="h-2 bg-brand-secondary/10"
                  />
                </div>
              );
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
};

// Placeholder while hit distribution data is loading.
export const HitDistributionSkeleton: React.FC = () => (
  <Card className="bg-white border-gray-200 shadow-sm rounded-md md:rounded-lg">
    <CardContent className="p-4 md:p-5 space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-5 w-28 bg-gray-200" />
        <Skeleton className="h-4 w-12 bg-gray-200" />
      </div>
      <div className="flex items-center justify-center py-4">
        <div className="relative h-48 w-48">
          <div className="absolute inset-0 rounded-full bg-[conic-gradient(#e2e8f0_0deg,#d1d5db_120deg,#e5e7eb_240deg,#cfd8e3_360deg)] animate-pulse" />
          <div className="absolute inset-6 rounded-full bg-white" />
        </div>
      </div>
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="space-y-2">
            <div className="flex items-center justify-between">
              <Skeleton className="h-3 w-32 bg-gray-200" />
              <Skeleton className="h-3 w-8 bg-gray-200" />
            </div>
            <Skeleton className="h-2 w-full bg-gray-200 rounded" />
          </div>
        ))}
      </div>
    </CardContent>
  </Card>
);
