import React from 'react';
import { HitDistributionCard, HitDistributionSkeleton } from '@/components/games';

type HitDistributionCardWrapperProps = {
  isLoading: boolean;
  totalHits: number;
  deviceHitSummary: Array<{ deviceId: string; deviceName: string; hits: number }>;
  pieChartData: Array<{ name: string; value: number }>;
};

const HitDistributionCardWrapper: React.FC<HitDistributionCardWrapperProps> = ({
  isLoading,
  totalHits,
  deviceHitSummary,
  pieChartData,
}) => (
  <div className="h-full">
    {isLoading ? (
      <HitDistributionSkeleton />
    ) : (
      <HitDistributionCard
        totalHits={totalHits}
        deviceHitSummary={deviceHitSummary}
        pieChartData={pieChartData}
      />
    )}
  </div>
);

export default HitDistributionCardWrapper;
