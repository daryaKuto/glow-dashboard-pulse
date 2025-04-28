
import React from 'react';
import { Button } from '@/components/ui/button';
import { CheckCircle, Circle } from 'lucide-react';
import type { Session } from '@/store/useSessions';
import SessionScoreboard from '@/components/SessionScoreboard';
import InviteModal from '@/components/InviteModal';

interface ActiveSessionProps {
  session: Session;
  onEndSession: () => void;
  onCreateInvite: (sessionId: number) => Promise<string | null>;
  connected: boolean;
}

const ActiveSession: React.FC<ActiveSessionProps> = ({ 
  session, 
  onEndSession, 
  onCreateInvite,
  connected
}) => {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-display text-white">
          Active Session: {session.name}
        </h3>
        <div className="flex items-center gap-2">
          <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs ${
            connected ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400'
          }`}>
            {connected ? (
              <>
                <CheckCircle size={12} />
                <span>Connected</span>
              </>
            ) : (
              <>
                <Circle size={12} />
                <span>Disconnected</span>
              </>
            )}
          </div>
        </div>
      </div>
      
      <div className="flex flex-wrap gap-4 justify-between">
        <div className="flex gap-2">
          <InviteModal 
            sessionId={session.id}
            onCreateInvite={onCreateInvite}
          />
          <Button 
            variant="destructive"
            onClick={onEndSession}
          >
            End Session
          </Button>
        </div>
      </div>
      
      <SessionScoreboard players={[]} />
    </div>
  );
};

export default ActiveSession;
