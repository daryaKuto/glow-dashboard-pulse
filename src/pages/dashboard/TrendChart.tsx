
import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';

interface TrendChartProps {
  data: { date: string; hits: number }[];
  isLoading?: boolean;
}

const TrendChart: React.FC<TrendChartProps> = ({ data, isLoading = false }) => {
  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-6 w-32 bg-brand-secondary/20" />
        <Skeleton className="h-48 w-full bg-brand-secondary/20" />
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-brand-dark/60 font-body">
        No data available
      </div>
    );
  }

  const maxHits = Math.max(...data.map(d => d.hits));
  const minHits = Math.min(...data.map(d => d.hits));
  const range = maxHits - minHits;

  return (
    <div className="flex items-end justify-between h-48 space-x-2">
      {data.map((item, index) => {
        const height = range > 0 ? ((item.hits - minHits) / range) * 100 : 50;
        return (
          <div key={index} className="flex flex-col items-center flex-1">
            <div 
              className="w-full bg-brand-brown rounded-t transition-all duration-300 hover:bg-brand-secondary/90"
              style={{ height: `${Math.max(height, 10)}%` }}
            />
            <div className="text-xs text-brand-dark/70 mt-2 text-center font-body">
              {item.date}
            </div>
            <div className="text-xs text-brand-primary mt-1 font-medium font-body">
              {item.hits}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default TrendChart;
