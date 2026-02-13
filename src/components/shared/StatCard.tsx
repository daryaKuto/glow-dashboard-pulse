import React from 'react';
import { TrendingUp, Info } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: React.ReactNode;
  icon: React.ReactNode;
  trend?: { value: number; isPositive: boolean };
  isLoading?: boolean;
  infoTitle?: string;
  infoContent?: string;
}

const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  icon,
  trend,
  isLoading = false,
  infoTitle,
  infoContent,
}) => (
  <Card className="shadow-card hover:shadow-card-hover transition-all duration-200 bg-gradient-to-br from-white via-white to-brand-primary/[0.04]">
    <CardContent className="p-3 md:p-5 lg:p-6">
      {/* Label row with bare icon */}
      <div className="flex items-center justify-center gap-1.5 md:gap-2 mb-0.5 md:mb-1">
        <div className="text-brand-primary w-3.5 h-3.5 md:w-4 md:h-4">{icon}</div>
        <span className="text-[10px] md:text-label text-brand-secondary font-body uppercase tracking-wide">
          {title}
        </span>
        {infoContent && (
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="inline-flex items-center justify-center rounded-full hover:bg-brand-dark/10 p-0.5 -m-0.5 transition-colors"
                aria-label={`Info about ${title}`}
              >
                <Info className="h-3 w-3 text-brand-dark/40" />
              </button>
            </PopoverTrigger>
            <PopoverContent
              side="bottom"
              align="start"
              className="w-64 bg-white shadow-lg p-3 border-0 z-30"
            >
              {infoTitle && (
                <p className="text-xs font-medium text-brand-dark mb-1">{infoTitle}</p>
              )}
              <p className="text-xs text-brand-dark/70">{infoContent}</p>
            </PopoverContent>
          </Popover>
        )}
      </div>

      {/* Hero number */}
      {isLoading ? (
        <div className="h-8 md:h-10 w-16 md:w-24 bg-gray-200 rounded animate-pulse mx-auto" />
      ) : (
        <p className="text-stat-md md:text-stat-lg font-bold text-brand-dark font-body tabular-nums text-center">
          {value}
        </p>
      )}

      {/* Optional subtitle */}
      {subtitle && (
        <div className="text-[10px] md:text-xs text-brand-dark/40 font-body mt-0.5 md:mt-1 flex justify-center text-center">{subtitle}</div>
      )}

      {/* Optional trend */}
      {trend && !isLoading && (
        <div className="mt-2 flex items-center gap-1">
          <div
            className={`flex items-center gap-0.5 text-xs ${
              trend.isPositive ? 'text-green-600' : 'text-red-600'
            }`}
          >
            <TrendingUp
              className={`w-3 h-3 ${!trend.isPositive && 'rotate-180'}`}
            />
            <span className="font-medium">{trend.value}%</span>
          </div>
          <span className="text-xs text-brand-dark/40 font-body">vs last week</span>
        </div>
      )}
    </CardContent>
  </Card>
);

export default StatCard;
