
import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';

interface StatCardProps {
  title: string;
  value: number;
  icon: React.ReactNode;
  isLoading?: boolean;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, icon, isLoading = false }) => {
  if (isLoading) {
    return (
      <div className="bg-white p-3 md:p-4 lg:p-6 rounded-lg shadow-sm border border-gray-200">
        <div className="flex items-center justify-between">
          <div className="space-y-1 md:space-y-2">
            <Skeleton className="h-3 md:h-4 w-20 md:w-24 bg-gray-200" />
            <Skeleton className="h-5 md:h-6 lg:h-8 w-12 md:w-14 lg:w-16 bg-gray-200" />
          </div>
          <Skeleton className="h-6 w-6 md:h-8 md:w-8 rounded bg-gray-200" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white p-3 md:p-4 lg:p-6 rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow duration-200">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-brand-dark text-xs md:text-sm font-medium">{title}</p>
          <p className="text-lg md:text-xl lg:text-2xl xl:text-3xl font-bold text-brand-dark">{typeof value === 'number' ? value.toLocaleString() : '—'}</p>
        </div>
        <div className="text-brand-primary text-lg md:text-xl lg:text-2xl">
          {icon}
        </div>
      </div>
    </div>
  );
};

export default StatCard;
