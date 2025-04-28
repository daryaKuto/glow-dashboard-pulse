
import React from 'react';
import { 
  Card, 
  CardContent, 
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Player } from '@/store/useSessions';

interface SessionScoreboardProps {
  players: Player[];
  isLoading?: boolean;
}

const SessionScoreboard: React.FC<SessionScoreboardProps> = ({
  players,
  isLoading = false
}) => {
  // Sort players by hits (highest first)
  const sortedPlayers = [...players].sort((a, b) => b.hits - a.hits);

  return (
    <Card className="w-full bg-brand-surface border-brand-lavender/30 shadow-md">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-semibold text-white flex justify-between">
          <span>Live Scoreboard</span>
          {isLoading && <span className="text-sm text-brand-fg-secondary">Loading...</span>}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {players.length === 0 ? (
          <div className="text-center py-8 text-brand-fg-secondary">
            Waiting for players to join...
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px] text-brand-lavender">Rank</TableHead>
                <TableHead className="text-brand-lavender">Player</TableHead>
                <TableHead className="text-right text-brand-lavender">Hits</TableHead>
                <TableHead className="text-right text-brand-lavender">Accuracy</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedPlayers.map((player, index) => (
                <TableRow key={player.userId}>
                  <TableCell className="font-medium">{index + 1}</TableCell>
                  <TableCell className={player.userId === 'current-user' ? 'font-bold text-brand-lavender' : ''}>
                    {player.name}
                  </TableCell>
                  <TableCell className="text-right">{player.hits}</TableCell>
                  <TableCell className="text-right">{player.accuracy}%</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
};

export default SessionScoreboard;
