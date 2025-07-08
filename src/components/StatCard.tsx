
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
      <div className="bg-white p-6 rounded-lg shadow-sm border border-brand-brown/20">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-4 w-24 bg-gray-200" />
            <Skeleton className="h-8 w-16 bg-gray-200" />
          </div>
          <Skeleton className="h-8 w-8 rounded bg-gray-200" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border border-brand-brown/20 hover:shadow-md transition-shadow duration-200">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-brand-dark text-sm font-medium">{title}</p>
          <p className="text-3xl font-bold text-brand-dark">{typeof value === 'number' ? value.toLocaleString() : '—'}</p>
        </div>
        <div className="text-brand-brown">
          {icon}
        </div>
      </div>
    </div>
  );
};

export default StatCard;
