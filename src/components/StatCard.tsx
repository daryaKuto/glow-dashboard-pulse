
import React from 'react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

interface StatCardProps {
  title: string;
  value: number | string;
  icon?: React.ReactNode;
  className?: string;
  isLoading?: boolean;
}

const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  icon,
  className,
  isLoading = false
}) => {
  return (
    <div className={cn(
      "bg-brand-surface rounded-xl p-5 shadow-card flex flex-col",
      className
    )}>
      <div className="flex justify-between items-start">
        <h3 className="text-sm text-brand-fg-secondary font-medium">
          {title}
        </h3>
        {icon && (
          <div className="text-brand-lavender">
            {icon}
          </div>
        )}
      </div>
      
      <div className="mt-2">
        {isLoading ? (
          <Skeleton className="h-10 w-16 bg-brand-lavender/20" />
        ) : (
          <p className="text-3xl font-display font-bold text-white">
            {value}
          </p>
        )}
      </div>
    </div>
  );
};

export default StatCard;
