import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';

const TargetPreferencesSkeleton: React.FC = () => {
  return (
    <div className="space-y-6">
      {/* House WiFi Settings Skeleton */}
      <div className="p-4 border border-gray-200 rounded-lg bg-brand-secondary/5">
        <Skeleton className="h-6 w-48 mb-4 bg-gray-200" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Skeleton className="h-4 w-20 bg-gray-200" />
            <Skeleton className="h-10 w-full bg-gray-200" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-24 bg-gray-200" />
            <Skeleton className="h-10 w-full bg-gray-200" />
          </div>
        </div>
      </div>

      {/* Room Targets Skeleton */}
      {[1, 2, 3].map((roomIndex) => (
        <div key={roomIndex} className="space-y-4">
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-5 bg-gray-200" />
            <Skeleton className="h-6 w-32 bg-gray-200" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2].map((targetIndex) => (
              <div key={targetIndex} className="p-4 border border-gray-200 rounded-lg bg-brand-secondary/5">
                <Skeleton className="h-5 w-24 mb-3 bg-gray-200" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-20 bg-gray-200" />
                  <Skeleton className="h-10 w-full bg-gray-200" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

export default TargetPreferencesSkeleton; 