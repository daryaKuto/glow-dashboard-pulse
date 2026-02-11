import React from 'react';
import dayjs from 'dayjs';
import { Gamepad2, Trophy, Clock, Info } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { DashboardSession as Session } from '@/features/dashboard';
import { formatDurationValue, formatScoreValue } from '@/utils/dashboard';

type RecentSessionsCardProps = {
  sessions: Session[];
  isLoading: boolean;
  onViewAll: () => void;
};

const RecentSessionsCard: React.FC<RecentSessionsCardProps> = ({ sessions, isLoading, onViewAll }) => {
  const recentSessions = sessions.slice(0, 3);

  return (
    <Card className="bg-white border-gray-200 shadow-sm rounded-md md:rounded-lg h-full">
      <CardHeader className="pb-1 md:pb-3 p-2 md:p-4">
        {isLoading ? (
          <div className="animate-pulse flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-gray-200" />
              <div className="space-y-2">
                <div className="h-4 w-24 bg-gray-200 rounded" />
                <div className="h-3 w-32 bg-gray-200 rounded" />
              </div>
            </div>
            <div className="h-6 w-16 bg-gray-200 rounded" />
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-primary/10 text-brand-primary">
                <Gamepad2 className="h-4 w-4" />
              </div>
              <div>
                <CardTitle className="text-xs md:text-base lg:text-lg font-heading text-brand-dark">
                  Recent Sessions
                </CardTitle>
                <p className="text-[11px] text-brand-dark/60">Latest games synced from Supabase</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="text-brand-secondary hover:text-brand-primary text-xs h-6 px-2 rounded-sm md:rounded"
              onClick={onViewAll}
            >
              View All
            </Button>
          </div>
        )}
      </CardHeader>
      <CardContent className="p-2 md:p-4">
        {isLoading ? (
          <div className="space-y-2 md:space-y-3 animate-pulse">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="border border-gray-200 rounded-sm md:rounded-lg bg-gradient-to-r from-gray-50 to-gray-100 p-3 md:p-4 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-gray-200" />
                    <div className="space-y-1">
                      <div className="h-3 w-24 bg-gray-200 rounded" />
                      <div className="h-4 w-32 bg-gray-200 rounded" />
                    </div>
                  </div>
                  <div className="h-5 w-16 bg-gray-200 rounded-full" />
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  {Array.from({ length: 3 }).map((__, statIndex) => (
                    <div key={statIndex} className="rounded-md bg-white/70 px-2 py-2 border border-white/60 space-y-2">
                      <div className="h-2 w-12 bg-gray-200 rounded" />
                      <div className="h-4 w-10 bg-gray-200 rounded" />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : recentSessions.length > 0 ? (
          <div className="space-y-2 md:space-y-3">
            {recentSessions.map((session) => {
              // A session is completed if:
              // 1. It has a valid ended_at timestamp that's different from started_at (not just a fallback)
              // 2. It has a score (even if 0)
              const hasValidEndTime = session.endedAt && session.endedAt !== session.startedAt;
              const isCompleted = hasValidEndTime && Number.isFinite(session.score);
              const accent = isCompleted ? 'from-emerald-500/15 to-teal-500/10' : 'from-brand-secondary/20 to-brand-primary/10';
              const iconBg = isCompleted ? 'bg-emerald-500/20 text-emerald-600' : 'bg-brand-secondary/20 text-brand-secondary';
              const icon = isCompleted ? <Trophy className="h-4 w-4" /> : <Clock className="h-4 w-4" />;

              return (
                <Card
                  key={session.id}
                  className={`border border-transparent bg-gradient-to-r ${accent} rounded-sm md:rounded-lg shadow-sm`}
                >
                  <CardContent className="p-3 md:p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`flex h-8 w-8 items-center justify-center rounded-full ${iconBg}`}>
                          {icon}
                        </div>
                        <div>
                          <p className="text-[11px] font-medium text-brand-dark/60">
                            {dayjs(session.startedAt).format('MMM D, HH:mm')}
                          </p>
                          <h4 className="font-heading text-sm text-brand-dark">
                            {session.gameName || session.scenarioName || 'Custom Game'}
                          </h4>
                        </div>
                      </div>
                      <Badge
                        className={`text-[10px] md:text-xs border-none ${
                          isCompleted ? 'bg-emerald-500 text-white' : 'bg-amber-500 text-white'
                        }`}
                      >
                        {isCompleted ? 'Completed' : 'In Progress'}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-[11px] md:text-xs text-brand-dark/70">
                      <div className="rounded-md bg-white/50 px-2 py-1 border border-white/40">
                        <div className="flex items-center gap-1">
                          <p className="uppercase tracking-wide text-[10px] text-brand-dark/50">Score</p>
                          <Popover>
                            <PopoverTrigger asChild>
                              <button 
                                type="button" 
                                className="inline-flex items-center justify-center rounded-full hover:bg-brand-dark/10 p-0.5 -m-0.5 transition-colors"
                                aria-label="How score is calculated"
                              >
                                <Info className="h-3 w-3 text-brand-dark/40" />
                              </button>
                            </PopoverTrigger>
                            <PopoverContent 
                              side="bottom" 
                              align="start"
                              className="w-72 bg-white border border-gray-200 shadow-lg p-3"
                            >
                              <p className="text-xs font-medium text-brand-dark mb-1">How Score is Calculated</p>
                              <p className="text-xs text-brand-dark/70 mb-2">
                                Score = time in seconds. <span className="font-medium">Lower is better.</span>
                              </p>
                              <div className="text-[10px] text-brand-dark/50 border-t border-gray-100 pt-2 space-y-1">
                                <p><span className="font-medium">With goals:</span> Time of the last required hit</p>
                                <p><span className="font-medium">Without goals:</span> Time from first to last shot</p>
                                <p className="text-brand-dark/40 italic">DNF = not all required hits achieved</p>
                              </div>
                            </PopoverContent>
                          </Popover>
                        </div>
                        <p className="font-heading text-sm text-brand-dark">
                          {Number.isFinite(session.score) ? formatScoreValue(session.score) : 'N/A'}
                        </p>
                      </div>
                      <div className="rounded-md bg-white/50 px-2 py-1 border border-white/40">
                        <p className="uppercase tracking-wide text-[10px] text-brand-dark/50">Hits</p>
                        <p className="font-heading text-sm text-brand-dark">
                          {Number.isFinite(session.hitCount) ? session.hitCount : '—'}
                        </p>
                      </div>
                      <div className="rounded-md bg-white/50 px-2 py-1 border border-white/40 text-right">
                        <p className="uppercase tracking-wide text-[10px] text-brand-dark/50">Duration</p>
                        <p className="font-heading text-sm text-brand-dark">
                          {formatDurationValue(session.duration)}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-4">
            <p className="text-xs text-brand-dark/70 font-body mb-3">No sessions yet</p>
            <Button className="bg-brand-secondary hover:bg-brand-primary text-white font-body" onClick={onViewAll}>
              Start Training
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default RecentSessionsCard;
