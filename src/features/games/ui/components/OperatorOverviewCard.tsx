import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';

interface OperatorOverviewCardProps {
  operatorName: string;
  operatorInitials: string;
  onlineTargets: number;
  totalTargets: number;
  totalHits: number;
  bestScore: number;
}

// Renders the operator overview summary with current user metadata and high level metrics.
export const OperatorOverviewCard: React.FC<OperatorOverviewCardProps> = ({
  operatorName,
  operatorInitials,
  onlineTargets,
  totalTargets,
  totalHits,
  bestScore,
}) => {
  return (
    <Card className="shadow-card rounded-[var(--radius-lg)]">
      <CardContent className="p-4 md:p-5 space-y-4">
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10 bg-brand-secondary/20 text-brand-primary">
            <AvatarFallback className="text-sm font-semibold text-brand-primary">
              {operatorInitials}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="font-body font-semibold text-base text-brand-dark">{operatorName}</p>
            <p className="text-xs text-brand-dark/60 font-body">ThingsBoard session active</p>
          </div>
        </div>
        <Separator />
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <div>
            <p className="text-label text-brand-secondary font-body uppercase tracking-wide">Targets Available</p>
            <p className="text-stat-sm font-bold text-brand-dark font-body tabular-nums">
              {onlineTargets}/{totalTargets}
            </p>
          </div>
          <div>
            <p className="text-label text-brand-secondary font-body uppercase tracking-wide">Total Hits</p>
            <p className="text-stat-sm font-bold text-brand-dark font-body tabular-nums">{totalHits}</p>
          </div>
          <div>
            <p className="text-label text-brand-secondary font-body uppercase tracking-wide">Best Score</p>
            <p className="text-stat-sm font-bold text-brand-dark font-body tabular-nums">{bestScore}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// Placeholder shown while operator metrics are loading.
export const OperatorOverviewSkeleton: React.FC = () => (
  <Card className="shadow-card rounded-[var(--radius-lg)]">
    <CardContent className="p-4 md:p-5 space-y-4">
      <div className="flex items-center gap-3">
        <Skeleton className="h-10 w-10 rounded-full bg-gray-200" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-32 bg-gray-200" />
          <Skeleton className="h-3 w-24 bg-gray-200" />
        </div>
      </div>
      <Separator />
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="space-y-2">
            <Skeleton className="h-3 w-20 bg-gray-200" />
            <Skeleton className="h-5 w-12 bg-gray-200" />
          </div>
        ))}
      </div>
    </CardContent>
  </Card>
);
