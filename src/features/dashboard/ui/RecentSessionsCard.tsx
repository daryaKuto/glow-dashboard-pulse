import React from 'react';
import dayjs from 'dayjs';
import { Gamepad2, ChevronRight, Clock, Crosshair, Target } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { DashboardSession as Session } from '@/features/dashboard';
import { formatScoreValue, formatDurationValue } from '@/utils/dashboard';

type RecentSessionsCardProps = {
  sessions: Session[];
  isLoading: boolean;
  onViewAll: () => void;
};

const ACCENT_COLORS = ['#CE3E0A', '#816E94', '#1C192B', '#6B4A38'] as const;

/** A single session rendered as a mini "Progress Statistics" card */
const SessionStatCard: React.FC<{ session: Session; index: number }> = ({ session, index }) => {
  const date = dayjs(session.startedAt);
  const accentColor = ACCENT_COLORS[index % ACCENT_COLORS.length];
  const hitCount = Number.isFinite(session.hitCount) ? session.hitCount : 0;
  const totalShots = Number.isFinite(session.totalShots) ? session.totalShots : 0;
  const hasAccuracy = Number.isFinite(session.accuracy) && session.accuracy > 0;
  const accuracy = hasAccuracy ? session.accuracy : 0;

  // Progress bar: use accuracy % if available, otherwise show hits / totalShots ratio
  const barPercent = hasAccuracy
    ? accuracy
    : totalShots > 0
      ? (hitCount / totalShots) * 100
      : 0;
  const barLabel = hasAccuracy ? 'Accuracy' : 'Hit Rate';
  const barValue = hasAccuracy
    ? `${accuracy.toFixed(0)}%`
    : totalShots > 0
      ? `${hitCount}/${totalShots}`
      : `${hitCount} hits`;

  return (
    <div className="rounded-[var(--radius)] bg-[rgba(28,25,43,0.02)] p-3.5 md:p-4 space-y-3">
      {/* Top row: game name + date */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="w-2 h-2 rounded-full shrink-0"
            style={{ backgroundColor: accentColor }}
          />
          <span className="text-xs font-medium text-brand-dark font-body truncate">
            {session.gameName || session.scenarioName || 'Custom Game'}
          </span>
        </div>
        <span className="text-[10px] text-brand-dark/30 font-body shrink-0">
          {date.format('ddd, h:mm a')}
        </span>
      </div>

      {/* Hero score with label */}
      <div className="flex items-baseline gap-2">
        <p className="text-stat-md font-bold text-brand-dark font-body tabular-nums leading-none">
          {Number.isFinite(session.score) ? formatScoreValue(session.score) : 'N/A'}
        </p>
        <span className="text-[11px] text-brand-dark/40 font-body">Score</span>
      </div>

      {/* Progress bar: accuracy or hit rate */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] text-brand-dark/40 font-body uppercase tracking-wide">
            {barLabel}
          </span>
          <span className="text-[11px] font-semibold text-brand-dark font-body tabular-nums">
            {barValue}
          </span>
        </div>
        <div className="h-1.5 w-full bg-[rgba(28,25,43,0.06)] rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${Math.min(100, Math.max(0, barPercent))}%`,
              backgroundColor: accentColor,
            }}
          />
        </div>
      </div>

      {/* Bottom stat row: 3 metrics with dividers */}
      <div className="flex items-center rounded-[calc(var(--radius)-4px)] bg-white shadow-subtle overflow-hidden">
        <div className="flex-1 flex flex-col items-center py-2 gap-0.5">
          <Target className="w-3 h-3 text-brand-primary" />
          <span className="text-sm font-bold text-brand-dark font-body tabular-nums">
            {hitCount}
          </span>
          <span className="text-[9px] text-brand-dark/40 font-body">Hits</span>
        </div>
        <div className="w-px h-8 bg-[rgba(28,25,43,0.06)]" />
        <div className="flex-1 flex flex-col items-center py-2 gap-0.5">
          <Crosshair className="w-3 h-3 text-brand-secondary" />
          <span className="text-sm font-bold text-brand-dark font-body tabular-nums">
            {hasAccuracy ? `${accuracy.toFixed(0)}%` : totalShots > 0 ? totalShots : '—'}
          </span>
          <span className="text-[9px] text-brand-dark/40 font-body">
            {hasAccuracy ? 'Accuracy' : 'Shots'}
          </span>
        </div>
        <div className="w-px h-8 bg-[rgba(28,25,43,0.06)]" />
        <div className="flex-1 flex flex-col items-center py-2 gap-0.5">
          <Clock className="w-3 h-3 text-brand-dark/40" />
          <span className="text-sm font-bold text-brand-dark font-body tabular-nums">
            {formatDurationValue(session.duration)}
          </span>
          <span className="text-[9px] text-brand-dark/40 font-body">Duration</span>
        </div>
      </div>
    </div>
  );
};

const RecentSessionsCard: React.FC<RecentSessionsCardProps> = ({ sessions, isLoading, onViewAll }) => {
  const recentSessions = sessions.slice(0, 4);

  return (
    <Card className="shadow-card h-full bg-gradient-to-br from-white to-brand-secondary/[0.06]">
      <CardHeader className="pb-2 md:pb-3 p-5 md:p-6">
        {isLoading ? (
          <div className="animate-pulse flex items-center gap-2">
            <div className="h-4 w-4 bg-gray-200 rounded" />
            <div className="space-y-1">
              <div className="h-4 w-28 bg-gray-200 rounded" />
              <div className="h-3 w-20 bg-gray-200 rounded" />
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Gamepad2 className="h-4 w-4 text-brand-primary" />
              <div>
                <CardTitle className="text-base font-heading text-brand-dark">
                  Recent Sessions
                </CardTitle>
                <p className="text-[11px] text-brand-dark/40 font-body">Latest games</p>
              </div>
            </div>
            <button
              onClick={onViewAll}
              className="flex items-center gap-0.5 text-xs text-brand-primary font-body font-medium hover:underline"
            >
              See all
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </CardHeader>
      <CardContent className="px-5 pb-5 md:px-6 md:pb-6 pt-0">
        {isLoading ? (
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="rounded-[var(--radius)] bg-[rgba(28,25,43,0.02)] p-3.5 md:p-4 space-y-3 animate-pulse"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-gray-200 rounded-full" />
                    <div className="h-3 w-20 bg-gray-200 rounded" />
                  </div>
                  <div className="h-2.5 w-14 bg-gray-200 rounded" />
                </div>
                <div className="h-7 w-14 bg-gray-200 rounded" />
                <div>
                  <div className="flex justify-between mb-1.5">
                    <div className="h-2.5 w-12 bg-gray-200 rounded" />
                    <div className="h-3 w-8 bg-gray-200 rounded" />
                  </div>
                  <div className="h-1.5 w-full bg-gray-200 rounded-full" />
                </div>
                <div className="flex rounded-[calc(var(--radius)-4px)] bg-white shadow-subtle overflow-hidden">
                  {Array.from({ length: 3 }).map((_, j) => (
                    <React.Fragment key={j}>
                      {j > 0 && <div className="w-px h-8 bg-[rgba(28,25,43,0.06)]" />}
                      <div className="flex-1 flex flex-col items-center py-2 gap-1">
                        <div className="w-3 h-3 bg-gray-200 rounded" />
                        <div className="h-3.5 w-6 bg-gray-200 rounded" />
                        <div className="h-2 w-8 bg-gray-200 rounded" />
                      </div>
                    </React.Fragment>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : recentSessions.length > 0 ? (
          <div className="grid grid-cols-2 gap-3">
            {recentSessions.map((session, i) => (
              <SessionStatCard key={session.id} session={session} index={i} />
            ))}
          </div>
        ) : (
          <div className="text-center py-6">
            <p className="text-xs text-brand-dark/40 font-body mb-4">No sessions yet</p>
            <Button
              className="bg-brand-primary hover:bg-brand-primary/90 text-white rounded-full font-body"
              onClick={onViewAll}
            >
              Start Training
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default RecentSessionsCard;
