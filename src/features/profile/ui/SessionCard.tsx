import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Trophy, ChevronDown, ChevronUp } from 'lucide-react';
import { formatScoreValue } from '@/utils/dashboard';
import type { GameHistory } from '@/features/games/lib/device-game-flow';

/** Dot color based on goal achievement status */
const DOT_COLORS = {
  achieved: '#CE3E0A',  // Red — goals met
  missed: '#1C192B',    // Black — goals not met
  noHits: '#9CA3AF',    // Gray — no shots registered
} as const;

function getGameDotColor(game: GameHistory): string {
  const totalHits = game.totalHits > 0
    ? game.totalHits
    : game.deviceResults.reduce((sum, r) => sum + r.hitCount, 0);

  // No shots registered at all
  if (totalHits === 0) return DOT_COLORS.noHits;

  // If goals were set, check if all targets met their goals
  if (game.goalShotsPerTarget && Object.keys(game.goalShotsPerTarget).length > 0) {
    const allGoalsMet = Object.entries(game.goalShotsPerTarget).every(
      ([deviceId, goal]) => {
        const deviceResult = game.deviceResults.find((r) => r.deviceId === deviceId);
        return deviceResult ? deviceResult.hitCount >= goal : false;
      }
    );
    return allGoalsMet ? DOT_COLORS.achieved : DOT_COLORS.missed;
  }

  // No goals set — if score > 0 consider it achieved, otherwise missed
  if (game.score && game.score > 0) return DOT_COLORS.achieved;
  return DOT_COLORS.missed;
}

interface SessionCardProps {
  game: GameHistory;
  accentIndex: number;
  expanded: boolean;
  onToggleExpand: () => void;
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}h ${mins}m`;
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getTotalHits(game: GameHistory): number {
  return game.totalHits > 0
    ? game.totalHits
    : game.deviceResults.reduce((sum, r) => sum + r.hitCount, 0);
}

function getBestDevice(game: GameHistory) {
  if (game.deviceResults.length === 0) return null;
  return game.deviceResults.reduce((best, result) =>
    result.hitCount > best.hitCount ? result : best
  );
}

const SessionCard: React.FC<SessionCardProps> = ({ game, accentIndex, expanded, onToggleExpand }) => {
  const totalHits = getTotalHits(game);
  const bestDevice = getBestDevice(game);
  const avgPerDevice =
    game.deviceResults.length > 0
      ? Math.round(totalHits / game.deviceResults.length)
      : 0;
  const dotColor = getGameDotColor(game);

  // Sort device results by hitCount descending for expanded view
  const sortedDeviceResults = [...game.deviceResults].sort(
    (a, b) => b.hitCount - a.hitCount
  );

  return (
    <Card className="shadow-elevated hover:shadow-card-hover transition-all duration-200 h-full flex flex-col">
      <CardContent className="p-4 md:p-5 flex flex-col flex-1">
        {/* Row 1: Game name + hero total hits */}
        <div className="flex items-start justify-between mb-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-0.5">
              <div
                className="w-2 h-2 rounded-full shrink-0"
                style={{
                  backgroundColor: dotColor,
                }}
              />
              <p className="text-sm font-semibold text-brand-dark font-body truncate">
                {game.gameName || game.scenarioName || 'Custom Game'}
              </p>
            </div>
            {game.scenarioType && (
              <span className="text-[10px] text-brand-primary font-body font-medium px-1.5 py-0.5 bg-brand-primary/[0.08] rounded-full inline-block mb-1">
                {game.scenarioType}
              </span>
            )}
            <p className="text-[11px] text-brand-dark/70 font-body truncate">
              {formatDate(game.startTime)}
            </p>
            {game.roomName && (
              <p className="text-[11px] text-brand-dark/70 font-body truncate">
                {game.roomName}
              </p>
            )}
          </div>
          {/* Hero total hits */}
          <div className="text-right ml-3 shrink-0">
            <p className="text-stat-md font-bold text-brand-dark font-body tabular-nums leading-none">
              {totalHits}
            </p>
            <p className="text-[10px] text-brand-dark/60 font-body uppercase tracking-wide mt-0.5">
              Total Hits
            </p>
          </div>
        </div>

        {/* Row 2: Stats grid — 2x2 matching Games page */}
        <div className="grid grid-cols-2 gap-px bg-[rgba(28,25,43,0.06)] rounded-[var(--radius)] overflow-hidden mt-auto">
          <div className="bg-brand-primary/[0.06] px-2.5 py-1.5 text-center">
            <p className="text-sm font-bold text-brand-dark font-body tabular-nums">
              {game.deviceResults.length}
            </p>
            <p className="text-[9px] text-brand-dark/70 font-body uppercase tracking-wide">
              Devices
            </p>
          </div>
          <div className="bg-brand-primary/[0.06] px-2.5 py-1.5 text-center">
            <p className="text-sm font-bold text-brand-dark font-body tabular-nums truncate">
              {bestDevice ? bestDevice.deviceName : 'N/A'}
            </p>
            <p className="text-[9px] text-brand-dark/70 font-body uppercase tracking-wide">
              Best Device
            </p>
          </div>
          <div className="bg-brand-primary/[0.06] px-2.5 py-1.5 text-center">
            <p className="text-sm font-bold text-brand-dark font-body tabular-nums">
              {formatScoreValue(
                game.score && game.score > 0 ? game.score : null
              )}
            </p>
            <p className="text-[9px] text-brand-dark/70 font-body uppercase tracking-wide">
              Score
            </p>
          </div>
          <div className="bg-brand-primary/[0.06] px-2.5 py-1.5 text-center">
            <p className="text-sm font-bold text-brand-dark font-body tabular-nums">
              {avgPerDevice}
            </p>
            <p className="text-[9px] text-brand-dark/70 font-body uppercase tracking-wide">
              Avg/Device
            </p>
          </div>
        </div>

        {/* Row 3: Duration + expand toggle */}
        <div className="flex items-center justify-between mt-2">
          <span className="text-[11px] text-brand-dark/70 font-body">
            {formatDuration(game.duration)}
            {game.averageHitInterval != null &&
              ` · ${game.averageHitInterval.toFixed(1)}s avg interval`}
          </span>
          {game.deviceResults.length > 0 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleExpand();
              }}
              className="text-brand-primary hover:text-brand-primary/80 transition-colors p-0.5"
            >
              {expanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </button>
          )}
        </div>

        {/* Expanded: Device Results */}
        {expanded && (
          <div className="mt-3 pt-3 border-t border-[rgba(28,25,43,0.06)]">
            <p className="text-[10px] text-brand-dark/70 font-body font-medium uppercase tracking-wide mb-2">
              Device Results
            </p>
            <div className="space-y-1.5">
              {sortedDeviceResults.map((result, index) => (
                <div
                  key={result.deviceId}
                  className="flex items-center justify-between rounded-[var(--radius)] bg-brand-primary/5 px-2.5 py-1.5"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {index === 0 && (
                      <Trophy className="h-3.5 w-3.5 text-yellow-500 shrink-0" />
                    )}
                    <span className="text-xs font-medium text-brand-dark font-body truncate">
                      {result.deviceName}
                    </span>
                  </div>
                  <span className="text-sm font-bold text-brand-dark font-body tabular-nums shrink-0 ml-2">
                    {result.hitCount}
                  </span>
                </div>
              ))}
            </div>

            {/* Splits & Transitions */}
            <div className="grid grid-cols-2 gap-2 mt-2">
              {game.splits && game.splits.length > 0 && (
                <div className="rounded-[var(--radius)] bg-brand-primary/5 px-2.5 py-1.5">
                  <span className="text-label text-brand-dark/70 font-body uppercase tracking-wide block mb-0.5">
                    Avg Split
                  </span>
                  <span className="text-sm font-bold text-brand-dark font-body tabular-nums">
                    {(
                      game.splits.reduce((s, sp) => s + sp.time, 0) /
                      game.splits.length
                    ).toFixed(2)}
                    s
                  </span>
                  <span className="text-[9px] text-brand-dark/60 font-body block">
                    {game.splits.length} split
                    {game.splits.length !== 1 ? 's' : ''}
                  </span>
                </div>
              )}
              {game.transitions && game.transitions.length > 0 && (
                <div className="rounded-[var(--radius)] bg-brand-primary/5 px-2.5 py-1.5">
                  <span className="text-label text-brand-dark/70 font-body uppercase tracking-wide block mb-0.5">
                    Avg Transition
                  </span>
                  <span className="text-sm font-bold text-brand-dark font-body tabular-nums">
                    {(
                      game.transitions.reduce((s, tr) => s + tr.time, 0) /
                      game.transitions.length
                    ).toFixed(2)}
                    s
                  </span>
                  <span className="text-[9px] text-brand-dark/60 font-body block">
                    {game.transitions.length} transition
                    {game.transitions.length !== 1 ? 's' : ''}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default SessionCard;
