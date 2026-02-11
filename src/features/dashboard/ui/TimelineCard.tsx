import React from 'react';
import { HitTimelineCard, HitTimelineSkeleton } from '@/features/games/ui/components';

type TimelineCardProps = {
  trackedDevices: Array<{ deviceId: string; deviceName: string }>;
  data: Array<Record<string, number | string>>;
  isLoading: boolean;
};

const TimelineCard: React.FC<TimelineCardProps> = ({ isLoading, ...timelineProps }) => (
  <div className="h-full">
    {isLoading ? <HitTimelineSkeleton /> : <HitTimelineCard {...timelineProps} />}
  </div>
);

export default TimelineCard;
