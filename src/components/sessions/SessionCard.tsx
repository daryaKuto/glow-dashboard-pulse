
import React from 'react';
import { format } from 'date-fns';
import { CalendarIcon } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { Session } from '@/store/useSessions';

interface SessionCardProps {
  session: Session;
}

const SessionCard: React.FC<SessionCardProps> = ({ session }) => {
  const formattedDate = format(new Date(session.date), 'MMM d, yyyy • h:mm a');
  
  return (
    <Card className="w-full bg-brand-surface border-brand-lavender/30 shadow-md">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-semibold text-white">
          {session.name}
        </CardTitle>
        <div className="flex items-center gap-1 text-sm text-brand-fg-secondary">
          <CalendarIcon size={14} className="text-brand-lavender" />
          <span>{formattedDate}</span>
        </div>
      </CardHeader>
      <CardContent className="pb-2">
        <div className="grid grid-cols-3 gap-2">
          <div className="text-center">
            <div className="text-sm text-brand-fg-secondary">Duration</div>
            <div className="text-lg text-white">{session.duration} min</div>
          </div>
          <div className="text-center">
            <div className="text-sm text-brand-fg-secondary">Score</div>
            <div className="text-lg text-white">{session.score}</div>
          </div>
          <div className="text-center">
            <div className="text-sm text-brand-fg-secondary">Accuracy</div>
            <div className="text-lg text-white">{session.accuracy}%</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default SessionCard;
