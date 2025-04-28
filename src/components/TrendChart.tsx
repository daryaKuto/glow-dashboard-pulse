
import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Skeleton } from '@/components/ui/skeleton';

interface TrendData {
  date: string;
  hits: number;
}

interface TrendChartProps {
  data: TrendData[];
  isLoading?: boolean;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-brand-indigo p-3 rounded-md shadow-lg border border-brand-lavender/30">
        <p className="text-xs text-brand-fg-secondary">{`Date: ${label}`}</p>
        <p className="text-sm font-display font-bold text-white">{`Hits: ${payload[0].value}`}</p>
      </div>
    );
  }
  return null;
};

const TrendChart: React.FC<TrendChartProps> = ({ data, isLoading = false }) => {
  if (isLoading) {
    return (
      <div className="h-full min-h-[200px] w-full bg-brand-surface rounded-xl p-5 shadow-card">
        <div className="flex justify-between items-start mb-4">
          <h3 className="text-sm text-brand-fg-secondary font-medium">7-Day Hit Trend</h3>
        </div>
        <div className="h-[80%] flex items-center justify-center">
          <Skeleton className="h-full w-full bg-brand-lavender/10" />
        </div>
      </div>
    );
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  return (
    <div className="h-full min-h-[200px] w-full bg-brand-surface rounded-xl p-5 shadow-card">
      <div className="flex justify-between items-start mb-4">
        <h3 className="text-sm text-brand-fg-secondary font-medium">7-Day Hit Trend</h3>
      </div>
      <div className="h-[80%] mt-2">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={data}
            margin={{ top: 5, right: 5, left: -20, bottom: 5 }}
          >
            <defs>
              <linearGradient id="colorGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#A884FF" stopOpacity={0.8} />
                <stop offset="95%" stopColor="#A884FF" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#222044" />
            <XAxis 
              dataKey="date" 
              tickFormatter={formatDate} 
              tick={{ fontSize: 10, fill: '#B7B9D6' }}
              axisLine={{ stroke: '#222044' }}
              tickLine={false}
            />
            <YAxis 
              tick={{ fontSize: 10, fill: '#B7B9D6' }}
              axisLine={{ stroke: '#222044' }}
              tickLine={false}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area 
              type="monotone" 
              dataKey="hits" 
              stroke="#A884FF" 
              strokeWidth={2}
              fillOpacity={1} 
              fill="url(#colorGradient)" 
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default TrendChart;
