import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Cell,
} from 'recharts';
import { DEVICE_COLOR_PALETTE } from './constants';

interface TransitionEntry {
  id: string;
  label: string;
  time: number;
}

interface TargetTransitionsCardProps {
  transitions: TransitionEntry[];
}

// Visualizes cross-target transitions to surface latency between hits on different devices.
export const TargetTransitionsCard: React.FC<TargetTransitionsCardProps> = ({ transitions }) => {
  return (
    <Card className="bg-white border-gray-200 shadow-sm rounded-md md:rounded-lg">
      <CardContent className="p-4 md:p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-lg text-brand-dark">Target Transitions</h2>
          <Badge variant="outline" className="text-xs">
            {transitions.length}
          </Badge>
        </div>
        <div className="h-48">
          {transitions.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-brand-dark/60 text-center">
              Target transitions will display once multiple devices register hits.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={transitions} layout="vertical" margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis type="number" stroke="#64748B" fontSize={10} unit="s" />
                <YAxis dataKey="label" type="category" stroke="#64748B" fontSize={10} width={150} />
                <RechartsTooltip formatter={(value) => [`${value} s`, 'Transition']} />
                <Bar dataKey="time" radius={[4, 4, 4, 4]}>
                  {transitions.map((entry, index) => (
                    <Cell key={entry.id} fill={DEVICE_COLOR_PALETTE[index % DEVICE_COLOR_PALETTE.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

// Placeholder while transition data loads.
export const TargetTransitionsSkeleton: React.FC = () => (
  <Card className="bg-white border-gray-200 shadow-sm rounded-md md:rounded-lg">
    <CardContent className="p-4 md:p-5 space-y-3">
      <div className="flex items-center justify-between">
        <Skeleton className="h-5 w-32 bg-gray-200" />
        <Skeleton className="h-4 w-12 bg-gray-200" />
      </div>
      <Skeleton className="h-48 w-full bg-gray-100 rounded-lg" />
    </CardContent>
  </Card>
);
