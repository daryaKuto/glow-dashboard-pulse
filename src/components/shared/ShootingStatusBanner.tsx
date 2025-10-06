import React from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';

interface ShootingStatusBannerProps {
  hasActiveShooters: boolean;
  hasRecentActivity: boolean;
  currentMode: string;
  currentInterval: number;
  activeShotsCount: number;
  recentShotsCount: number;
  targetsCount?: number;
  onRefresh: () => void;
}

const ShootingStatusBanner: React.FC<ShootingStatusBannerProps> = ({
  hasActiveShooters,
  hasRecentActivity,
  currentMode,
  currentInterval,
  activeShotsCount,
  recentShotsCount,
  targetsCount,
  onRefresh
}) => {
  const getStatusInfo = () => {
    if (hasActiveShooters) {
      return {
        color: 'bg-red-500',
        text: '🎯 Active',
        fullText: '🎯 Active Shooting'
      };
    } else if (hasRecentActivity) {
      return {
        color: 'bg-yellow-500',
        text: '⏱️ Recent',
        fullText: '⏱️ Recent Activity'
      };
    } else {
      return {
        color: 'bg-gray-400',
        text: '😴 Standby',
        fullText: '😴 Standby Mode'
      };
    }
  };

  const status = getStatusInfo();

  return (
    <div className="bg-brand-surface rounded-lg border border-gray-200 shadow-sm">
      {/* Mobile Layout */}
      <div className="block md:hidden">
        <div className="p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${status.color} ${hasActiveShooters ? 'animate-pulse' : ''}`}></div>
              <span className="text-xs font-medium text-brand-text font-body">
                {status.text}
              </span>
            </div>
            <Button 
              size="sm" 
              variant="outline" 
              onClick={onRefresh}
              className="h-6 w-6 p-0 border-brand-secondary/30 text-brand-secondary hover:bg-brand-primary hover:text-white"
            >
              <RefreshCw className="h-3 w-3" />
            </Button>
          </div>
          <div className="flex items-center justify-between text-xs text-brand-text/60 font-body">
            <span>{currentMode}</span>
            <span>{currentInterval}s</span>
            <span>Active: {activeShotsCount}</span>
            <span>Recent: {recentShotsCount}</span>
            {targetsCount !== undefined && <span>Targets: {targetsCount}</span>}
          </div>
        </div>
      </div>

      {/* Desktop Layout */}
      <div className="hidden md:block">
        <div className="flex items-center justify-between p-2">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${status.color} ${hasActiveShooters ? 'animate-pulse' : ''}`}></div>
            <span className="text-xs font-medium text-brand-text font-body">
              Shooting Status: {status.fullText}
            </span>
          </div>
          <div className="flex items-center gap-3 text-xs text-brand-text/70 font-body">
            <span>Mode: {currentMode}</span>
            <span>Interval: {currentInterval}s</span>
            <span>Active Shots: {activeShotsCount}</span>
            <span>Recent: {recentShotsCount}</span>
            {targetsCount !== undefined && <span>Targets: {targetsCount}</span>}
            <Button 
              size="sm" 
              variant="outline" 
              onClick={onRefresh}
              className="h-7 px-2 text-xs border-brand-secondary/30 text-brand-secondary hover:bg-brand-primary hover:text-white font-body"
            >
              <RefreshCw className="h-3 w-3 mr-1" />
              Refresh Now
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ShootingStatusBanner;


