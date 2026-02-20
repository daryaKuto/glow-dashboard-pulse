import React, { useMemo } from 'react';
import { Crosshair, Trophy, CheckCircle, Repeat } from 'lucide-react';
import StatCard from '@/components/shared/StatCard';
import { formatScoreValue } from '@/utils/dashboard';
import type { UserProfileData } from '@/features/profile/schema';
import type { GameHistory } from '@/features/games/lib/device-game-flow';

interface ProfileStatsGridProps {
  profileData: UserProfileData | null | undefined;
  gameHistory: GameHistory[];
  isLoading: boolean;
}

const ProfileStatsGrid: React.FC<ProfileStatsGridProps> = ({
  profileData,
  gameHistory,
  isLoading,
}) => {
  // Compute total transitions from game history
  const totalTransitions = useMemo(() => {
    return gameHistory.reduce((sum, game) => {
      return sum + (game.transitions?.length ?? 0);
    }, 0);
  }, [gameHistory]);

  if (!isLoading && !profileData) {
    return (
      <div className="text-center py-8">
        <p className="text-sm text-brand-dark/40 font-body">
          No sessions recorded yet. Start practicing to see your stats!
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 md:gap-4">
      <StatCard
        title="Total Hits"
        value={profileData ? profileData.totalHits.toLocaleString() : '—'}
        icon={<Crosshair className="w-full h-full" />}
        subtitle="Across all sessions"
        isLoading={isLoading}
      />
      <StatCard
        title="Best Score"
        value={profileData ? formatScoreValue(profileData.bestScore > 0 ? profileData.bestScore : null) : '—'}
        icon={<Trophy className="w-full h-full" />}
        subtitle="Fastest completion"
        isLoading={isLoading}
        infoTitle="Time-Based Scoring"
        infoContent="Score = time to complete. Lower is better. DNF sessions (score 0) are excluded."
      />
      <StatCard
        title="Sessions"
        value={profileData ? profileData.totalSessions.toLocaleString() : '—'}
        icon={<CheckCircle className="w-full h-full" />}
        subtitle="Completed games"
        isLoading={isLoading}
      />
      <StatCard
        title="Transitions"
        value={totalTransitions > 0 ? totalTransitions.toLocaleString() : 'N/A'}
        icon={<Repeat className="w-full h-full" />}
        subtitle="Cross-device switches"
        isLoading={isLoading}
      />
    </div>
  );
};

export default ProfileStatsGrid;
