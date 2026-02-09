/**
 * Game History Component
 *
 * Displays history of completed game sessions with statistics,
 * filtering, and sorting capabilities.
 */

import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  History,
  Clock,
  Target,
  Trophy,
  TrendingUp,
  Calendar,
} from 'lucide-react';
import { useGameHistory } from '@/features/games/hooks/use-game-history';
import type { GameHistory as GameHistoryType } from '@/features/games/lib/device-game-flow';

interface GameHistoryProps {
  onGameSelect?: (game: GameHistoryType) => void;
}

export const GameHistoryComponent: React.FC<GameHistoryProps> = ({ onGameSelect }) => {
  const { data: gameHistory = [], isLoading, error } = useGameHistory();
  const [selectedGame, setSelectedGame] = useState<GameHistoryType | null>(null);
  const [sortBy, setSortBy] = useState<'date' | 'hits' | 'duration'>('date');
  const [filterBy, setFilterBy] = useState<'all' | 'recent' | 'high-score'>('all');

  // Sort and filter games
  const sortedGames = gameHistory
    .filter(game => {
      switch (filterBy) {
        case 'recent':
          return Date.now() - game.startTime < 24 * 60 * 60 * 1000; // Last 24 hours
        case 'high-score':
          return game.deviceResults.some(result => result.hitCount > 20);
        default:
          return true;
      }
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'hits':
          const aTotalHits = a.deviceResults.reduce((sum, r) => sum + r.hitCount, 0);
          const bTotalHits = b.deviceResults.reduce((sum, r) => sum + r.hitCount, 0);
          return bTotalHits - aTotalHits;
        case 'duration':
          return b.duration - a.duration;
        case 'date':
        default:
          return b.startTime - a.startTime;
      }
    });

  // Calculate statistics
  const totalGames = gameHistory.length;
  const totalHits = gameHistory.reduce((sum, game) =>
    sum + game.deviceResults.reduce((gameSum, result) => gameSum + result.hitCount, 0), 0
  );
  const averageHits = totalGames > 0 ? Math.round(totalHits / totalGames) : 0;
  const bestGame = gameHistory.reduce((best, game) => {
    if (!best) return game;
    const gameHits = game.deviceResults.reduce((sum, result) => sum + result.hitCount, 0);
    const bestHits = best.deviceResults.reduce((sum, result) => sum + result.hitCount, 0);
    return gameHits > bestHits ? game : best;
  }, gameHistory[0] as GameHistoryType | undefined);

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  const getTotalHits = (game: GameHistoryType) => {
    return game.deviceResults.reduce((sum, result) => sum + result.hitCount, 0);
  };

  const getBestDevice = (game: GameHistoryType) => {
    return game.deviceResults.reduce((best, result) =>
      result.hitCount > best.hitCount ? result : best
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        {/* Statistics Overview Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <Skeleton className="h-12 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
        {/* Game List Skeleton */}
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <Skeleton className="h-24 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <History className="h-12 w-12 text-red-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Error Loading History
          </h3>
          <p className="text-gray-600">
            {error instanceof Error ? error.message : 'Failed to load game history'}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Statistics Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <History className="h-5 w-5 text-brand-primary" />
              <div>
                <div className="text-2xl font-bold">{totalGames}</div>
                <div className="text-sm text-gray-600">Total Games</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Target className="h-5 w-5 text-brand-primary" />
              <div>
                <div className="text-2xl font-bold">{totalHits}</div>
                <div className="text-sm text-gray-600">Total Hits</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-brand-primary" />
              <div>
                <div className="text-2xl font-bold">{averageHits}</div>
                <div className="text-sm text-gray-600">Avg Hits</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-brand-primary" />
              <div>
                <div className="text-2xl font-bold">
                  {bestGame ? getTotalHits(bestGame) : 0}
                </div>
                <div className="text-sm text-gray-600">Best Score</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap gap-4 items-center justify-between">
        <div className="flex gap-2">
          <Button
            variant={filterBy === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilterBy('all')}
          >
            All Games
          </Button>
          <Button
            variant={filterBy === 'recent' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilterBy('recent')}
          >
            Recent
          </Button>
          <Button
            variant={filterBy === 'high-score' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilterBy('high-score')}
          >
            High Scores
          </Button>
        </div>

        <div className="flex gap-2">
          <Button
            variant={sortBy === 'date' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSortBy('date')}
          >
            <Calendar className="h-4 w-4 mr-1" />
            Date
          </Button>
          <Button
            variant={sortBy === 'hits' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSortBy('hits')}
          >
            <Target className="h-4 w-4 mr-1" />
            Hits
          </Button>
          <Button
            variant={sortBy === 'duration' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSortBy('duration')}
          >
            <Clock className="h-4 w-4 mr-1" />
            Duration
          </Button>
        </div>
      </div>

      {/* Game History List */}
      <div className="space-y-4">
        {sortedGames.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <History className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No Games Yet
              </h3>
              <p className="text-gray-600">
                Start playing to see your game history here
              </p>
            </CardContent>
          </Card>
        ) : (
          sortedGames.map((game) => {
            const totalHits = getTotalHits(game);
            const bestDevice = getBestDevice(game);
            const isSelected = selectedGame?.gameId === game.gameId;

            return (
              <Card
                key={game.gameId}
                className={`cursor-pointer transition-all hover:shadow-md ${
                  isSelected ? 'ring-2 ring-brand-primary' : ''
                }`}
                onClick={() => {
                  setSelectedGame(isSelected ? null : game);
                  if (onGameSelect) {
                    onGameSelect(game);
                  }
                }}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-lg">{game.gameName}</h3>
                      <p className="text-sm text-gray-600">
                        {formatDate(game.startTime)} • {formatDuration(game.duration)}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-brand-primary">
                        {totalHits}
                      </div>
                      <div className="text-sm text-gray-600">Total Hits</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <div className="text-gray-600">Devices</div>
                      <div className="font-medium">{game.deviceResults.length}</div>
                    </div>
                    <div>
                      <div className="text-gray-600">Best Device</div>
                      <div className="font-medium">{bestDevice.deviceName}</div>
                    </div>
                    <div>
                      <div className="text-gray-600">Best Score</div>
                      <div className="font-medium">{bestDevice.hitCount} hits</div>
                    </div>
                    <div>
                      <div className="text-gray-600">Avg per Device</div>
                      <div className="font-medium">
                        {Math.round(totalHits / game.deviceResults.length)}
                      </div>
                    </div>
                  </div>

                  {/* Device Results */}
                  {isSelected && (
                    <div className="mt-4 pt-4 border-t">
                      <h4 className="font-medium mb-2">Device Results</h4>
                      <div className="space-y-2">
                        {game.deviceResults.map((result, index) => (
                          <div
                            key={result.deviceId}
                            className="flex items-center justify-between p-2 bg-gray-50 rounded"
                          >
                            <span className="font-medium">{result.deviceName}</span>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline">
                                {result.hitCount} hits
                              </Badge>
                              {index === 0 && (
                                <Trophy className="h-4 w-4 text-yellow-500" />
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
};

export default GameHistoryComponent;
