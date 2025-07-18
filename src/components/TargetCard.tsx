
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Target, Battery, Wifi, Settings, Gamepad2, Clock } from 'lucide-react';
import TargetIcon from './TargetIcon';
import { Target as TargetType } from '@/store/useTargets';

interface TargetCardProps {
  target: TargetType;
  onRename?: (id: number, name: string) => void;
  onLocate?: (id: number) => void;
  onFirmwareUpdate?: (id: number) => void;
  onDelete?: (targetId: number) => void;
  className?: string;
  roomName?: string;
}

const TargetCard: React.FC<TargetCardProps> = ({ 
  target, 
  onRename,
  onLocate,
  onFirmwareUpdate,
  onDelete,
  roomName,
  className = "" 
}) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online':
        return 'bg-green-500';
      case 'offline':
        return 'bg-gray-500';
      case 'error':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getBatteryColor = (battery: number) => {
    if (battery > 50) return 'text-green-600';
    if (battery > 20) return 'text-yellow-600';
    return 'text-red-600';
  };

  const formatLastSeen = (dateString: string) => {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
    return `${Math.floor(diffInMinutes / 1440)}d ago`;
  };



  const getEventBadgeColor = (event: string) => {
    switch (event?.toLowerCase()) {
      case 'start':
      case 'startgame':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'stop':
      case 'stopgame':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'hit':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  // Use the target's background color or fallback to white
  const cardBackgroundClass = target.backgroundColor || 'bg-white';

  return (
    <Card className={`w-full ${cardBackgroundClass} border-brand-brown/20 shadow-sm hover:shadow-md transition-shadow ${className}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <TargetIcon type={target.type || 'standard'} size="lg" />
            <div>
              <CardTitle className="text-lg font-heading text-brand-dark">{target.name}</CardTitle>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline" className="border-brand-brown/30 text-brand-dark font-body">
                  {target.deviceType || target.type || 'standard'}
                </Badge>
                <div className={`w-2 h-2 rounded-full ${getStatusColor(target.status)}`}></div>
                <span className="text-sm text-brand-dark/70 font-body capitalize">{target.status}</span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onRename?.(target.id, target.name)}
              className="text-brand-brown hover:text-brand-dark hover:bg-brand-brown/10"
            >
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Game Information */}
        {target.lastGameName && (
          <div className="p-3 bg-brand-brown/5 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Gamepad2 className="h-4 w-4 text-brand-brown" />
              <span className="text-sm font-medium text-brand-dark">Last Game</span>
            </div>
            <div className="text-sm text-brand-dark font-body">{target.lastGameName}</div>
            {target.lastEvent && (
              <Badge className={`text-xs mt-2 ${getEventBadgeColor(target.lastEvent)}`}>
                {target.lastEvent}
              </Badge>
            )}
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center p-3 bg-brand-brown/5 rounded-lg">
            <div className="text-2xl font-heading text-brand-dark">{target.lastHits || target.hits || 0}</div>
            <div className="text-sm text-brand-dark/70 font-body">Last Hits</div>
          </div>
          <div className="text-center p-3 bg-brand-brown/5 rounded-lg">
            <div className="text-2xl font-heading text-brand-dark">{target.accuracy || 0}%</div>
            <div className="text-sm text-brand-dark/70 font-body">Accuracy</div>
          </div>
        </div>
        
        {/* Details */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <div className="text-brand-dark/70 font-body">Room:</div>
            <div className="text-brand-dark font-body">{roomName || 'Unassigned'}</div>
          </div>
          
          <div className="flex items-center justify-between text-sm">
            <div className="text-brand-dark/70 font-body">Battery:</div>
            <div className={`flex items-center gap-1 font-body ${getBatteryColor(target.battery || 100)}`}>
              <Battery className="h-4 w-4" />
              <span>{target.battery || 100}%</span>
            </div>
          </div>
          
          <div className="flex items-center justify-between text-sm">
            <div className="text-brand-dark/70 font-body">Last Seen:</div>
            <div className="text-brand-dark font-body">{formatLastSeen(target.lastSeen || new Date().toISOString())}</div>
          </div>
        </div>


        
        {/* Actions */}
        <div className="flex gap-2 pt-2">
          <Button
            size="sm"
            onClick={() => onLocate?.(target.id)}
            className="flex-1 border border-brand-brown bg-white text-brand-brown hover:bg-brand-brown hover:text-white transition-colors"
          >
            <Wifi className="h-4 w-4 mr-2" />
            Locate
          </Button>
          
          {onDelete && (
            <Button
              size="sm"
              onClick={() => onDelete(target.id)}
              className="border border-red-300 bg-white text-red-600 hover:bg-red-600 hover:text-white transition-colors"
            >
              Delete
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default TargetCard;
