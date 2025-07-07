
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Users, Target, Clock, Trophy } from 'lucide-react';

interface ActiveSessionProps {
  session: {
    id: number;
    name: string;
    players: number;
    targets: number;
    duration: string;
    status: 'active' | 'paused' | 'finished';
  };
  onJoin?: () => void;
  onLeave?: () => void;
}

const ActiveSession: React.FC<ActiveSessionProps> = ({ 
  session, 
  onJoin, 
  onLeave 
}) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-500';
      case 'paused':
        return 'bg-yellow-500';
      case 'finished':
        return 'bg-gray-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'active':
        return 'Active';
      case 'paused':
        return 'Paused';
      case 'finished':
        return 'Finished';
      default:
        return 'Unknown';
    }
  };

  return (
    <Card className="bg-white border-brand-brown/20 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${getStatusColor(session.status)}`}></div>
            <CardTitle className="text-xl font-heading text-brand-dark">
              {session.name}
            </CardTitle>
          </div>
          <span className="text-sm text-brand-dark/70 font-body capitalize">
            {getStatusText(session.status)}
          </span>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Session Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center p-3 bg-brand-brown/5 rounded-lg">
            <Users className="h-5 w-5 text-brand-brown mx-auto mb-1" />
            <div className="text-lg font-heading text-brand-dark">{session.players}</div>
            <div className="text-xs text-brand-dark/70 font-body">Players</div>
          </div>
          
          <div className="text-center p-3 bg-brand-brown/5 rounded-lg">
            <Target className="h-5 w-5 text-brand-brown mx-auto mb-1" />
            <div className="text-lg font-heading text-brand-dark">{session.targets}</div>
            <div className="text-xs text-brand-dark/70 font-body">Targets</div>
          </div>
          
          <div className="text-center p-3 bg-brand-brown/5 rounded-lg">
            <Clock className="h-5 w-5 text-brand-brown mx-auto mb-1" />
            <div className="text-lg font-heading text-brand-dark">{session.duration}</div>
            <div className="text-xs text-brand-dark/70 font-body">Duration</div>
          </div>
        </div>
        
        {/* Actions */}
        <div className="flex gap-2">
          {session.status === 'active' && onJoin && (
            <Button
              onClick={onJoin}
              className="flex-1 bg-brand-brown hover:bg-brand-dark text-white"
            >
              <Trophy className="h-4 w-4 mr-2" />
              Join Session
            </Button>
          )}
          
          {session.status === 'active' && onLeave && (
            <Button
              onClick={onLeave}
              variant="outline"
              className="flex-1 border-brand-brown text-brand-brown hover:bg-brand-brown hover:text-white"
            >
              Leave Session
            </Button>
          )}
          
          {session.status === 'finished' && (
            <Button
              variant="outline"
              className="flex-1 border-brand-brown text-brand-brown hover:bg-brand-brown hover:text-white"
            >
              View Results
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default ActiveSession;
