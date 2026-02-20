import React, { useMemo } from 'react';
import { TrendingUp } from 'lucide-react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatScoreValue } from '@/utils/dashboard';
import type { UserProfileData } from '@/features/profile/schema';
import type { GameHistory } from '@/features/games/lib/device-game-flow';

interface PerformanceSummaryCardProps {
  profileData: UserProfileData | null | undefined;
  gameHistory: GameHistory[];
}

function formatTotalDuration(ms: number): string {
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

/** Compute average split time across all game history (seconds) */
function computeAvgSplit(games: GameHistory[]): number | null {
  const allSplits: number[] = [];
  for (const game of games) {
    if (game.splits && game.splits.length > 0) {
      for (const split of game.splits) {
        if (split.time > 0) allSplits.push(split.time);
      }
    }
  }
  if (allSplits.length === 0) return null;
  return allSplits.reduce((sum, t) => sum + t, 0) / allSplits.length;
}

/** Compute average transition time across all game history (seconds) */
function computeAvgTransition(games: GameHistory[]): number | null {
  const allTransitions: number[] = [];
  for (const game of games) {
    if (game.transitions && game.transitions.length > 0) {
      for (const tr of game.transitions) {
        if (tr.time > 0) allTransitions.push(tr.time);
      }
    }
  }
  if (allTransitions.length === 0) return null;
  return allTransitions.reduce((sum, t) => sum + t, 0) / allTransitions.length;
}

/** Compute goal achievement rate: % of games where all goals were met */
function computeGoalRate(games: GameHistory[]): { achieved: number; total: number } | null {
  const gamesWithGoals = games.filter(
    (g) => g.goalShotsPerTarget && Object.keys(g.goalShotsPerTarget).length > 0
  );
  if (gamesWithGoals.length === 0) return null;

  let achieved = 0;
  for (const game of gamesWithGoals) {
    const allMet = Object.entries(game.goalShotsPerTarget!).every(
      ([deviceId, goal]) => {
        const result = game.deviceResults.find((r) => r.deviceId === deviceId);
        return result ? result.hitCount >= goal : false;
      }
    );
    if (allMet) achieved++;
  }
  return { achieved, total: gamesWithGoals.length };
}

/** Compute the most-used target device across all games */
function computeTopDevice(games: GameHistory[]): { name: string; hits: number } | null {
  const deviceHits = new Map<string, { name: string; hits: number }>();
  for (const game of games) {
    for (const result of game.deviceResults) {
      const existing = deviceHits.get(result.deviceId);
      if (existing) {
        existing.hits += result.hitCount;
      } else {
        deviceHits.set(result.deviceId, { name: result.deviceName, hits: result.hitCount });
      }
    }
  }
  if (deviceHits.size === 0) return null;
  let top: { name: string; hits: number } | null = null;
  for (const entry of deviceHits.values()) {
    if (!top || entry.hits > top.hits) top = entry;
  }
  return top;
}

interface StatCellProps {
  label: string;
  value: string;
  subtitle?: string;
}

const StatCell: React.FC<StatCellProps> = ({ label, value, subtitle }) => (
  <div className="rounded-[var(--radius)] bg-brand-primary/5 px-3 py-2.5 shadow-subtle">
    <span className="text-label text-brand-secondary font-body uppercase tracking-wide block mb-0.5">
      {label}
    </span>
    <span className="text-stat-sm font-bold text-brand-dark font-body tabular-nums">
      {value}
    </span>
    {subtitle && (
      <span className="text-[9px] text-brand-dark/50 font-body block mt-0.5">
        {subtitle}
      </span>
    )}
  </div>
);

const PerformanceSummaryCard: React.FC<PerformanceSummaryCardProps> = ({
  profileData,
  gameHistory,
}) => {
  const avgSplit = useMemo(() => computeAvgSplit(gameHistory), [gameHistory]);
  const avgTransition = useMemo(() => computeAvgTransition(gameHistory), [gameHistory]);
  const goalRate = useMemo(() => computeGoalRate(gameHistory), [gameHistory]);
  const topDevice = useMemo(() => computeTopDevice(gameHistory), [gameHistory]);

  if (!profileData) return null;

  // Check if we have ANY meaningful data to show
  const hasData =
    profileData.totalSessions > 0 ||
    profileData.totalHits > 0 ||
    gameHistory.length > 0;

  if (!hasData) return null;

  const validScoreExists = profileData.bestScore > 0;
  const goalRatePercent = goalRate
    ? Math.round((goalRate.achieved / goalRate.total) * 100)
    : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut', delay: 0.1 }}
    >
      <Card className="shadow-card bg-gradient-to-br from-white to-brand-secondary/[0.04]">
        <CardHeader className="pb-2 md:pb-3 p-5 md:p-6">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-brand-primary" />
            <CardTitle className="text-base font-heading text-brand-dark">
              Performance Summary
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-5 md:p-6 pt-0 space-y-3">
          {/* Primary metrics row */}
          <div className="grid grid-cols-3 gap-3">
            <StatCell
              label="Best Score"
              value={validScoreExists ? formatScoreValue(profileData.bestScore) + 's' : 'N/A'}
              subtitle={validScoreExists ? 'Fastest completion' : undefined}
            />
            <StatCell
              label="Avg Split"
              value={avgSplit != null ? `${avgSplit.toFixed(2)}s` : 'N/A'}
              subtitle={avgSplit != null ? 'Between consecutive hits' : undefined}
            />
            <StatCell
              label="Avg Transition"
              value={avgTransition != null ? `${avgTransition.toFixed(2)}s` : 'N/A'}
              subtitle={avgTransition != null ? 'Cross-device switch' : undefined}
            />
          </div>

          {/* Divider */}
          <div className="border-t border-[rgba(28,25,43,0.06)]" />

          {/* Secondary metrics row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCell
              label="Practice Time"
              value={
                profileData.totalDuration > 0
                  ? formatTotalDuration(profileData.totalDuration)
                  : '0m'
              }
              subtitle={`${profileData.totalSessions} session${profileData.totalSessions !== 1 ? 's' : ''}`}
            />
            <StatCell
              label="Avg Reaction"
              value={
                profileData.avgReactionTime
                  ? `${profileData.avgReactionTime.toFixed(0)}ms`
                  : 'N/A'
              }
            />
            <StatCell
              label="Best Reaction"
              value={
                profileData.bestReactionTime
                  ? `${profileData.bestReactionTime.toFixed(0)}ms`
                  : 'N/A'
              }
            />
            {goalRate && goalRatePercent != null ? (
              <StatCell
                label="Goal Rate"
                value={`${goalRatePercent}%`}
                subtitle={`${goalRate.achieved}/${goalRate.total} completed`}
              />
            ) : topDevice ? (
              <StatCell
                label="Top Target"
                value={topDevice.name}
                subtitle={`${topDevice.hits.toLocaleString()} hits`}
              />
            ) : (
              <StatCell
                label="Hit Rate"
                value={
                  profileData.totalShots > 0
                    ? `${Math.round((profileData.totalHits / profileData.totalShots) * 100)}%`
                    : 'N/A'
                }
                subtitle={
                  profileData.totalShots > 0
                    ? `${profileData.totalHits.toLocaleString()} of ${profileData.totalShots.toLocaleString()}`
                    : undefined
                }
              />
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default PerformanceSummaryCard;
