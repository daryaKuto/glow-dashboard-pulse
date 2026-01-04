/**
 * Dashboard Domain Aggregators
 * 
 * Functions for aggregating and calculating dashboard metrics.
 * Pure functions - no React or Supabase imports.
 */

import type { SessionMetrics, TargetSummary, SessionTotals, DashboardMetrics } from './validators';

/**
 * Session data for aggregation
 */
export type SessionData = {
  id: string;
  startedAt: string;
  score: number;
  hitCount: number;
  durationMs: number;
  accuracyPercentage: number | null;
};

/**
 * Target data for aggregation
 */
export type TargetData = {
  id: string;
  status: 'online' | 'offline' | 'standby';
  roomId: string | null;
};

/**
 * Time period for aggregations
 */
export type TimePeriod = 'day' | 'week' | 'month' | 'year' | 'all';

/**
 * Trend data point
 */
export type TrendDataPoint = {
  date: string;
  value: number;
};

/**
 * Calculate session totals from session data
 */
export function calculateSessionTotals(sessions: SessionData[]): SessionTotals {
  if (sessions.length === 0) {
    return {
      totalSessions: 0,
      bestScore: null,
      avgScore: null,
    };
  }
  
  const scores = sessions.map((s) => s.score);
  const totalScore = scores.reduce((sum, score) => sum + score, 0);
  
  return {
    totalSessions: sessions.length,
    bestScore: Math.max(...scores),
    avgScore: Math.round(totalScore / sessions.length),
  };
}

/**
 * Calculate target summary from target data
 */
export function calculateTargetSummary(
  targets: TargetData[],
  totalRooms: number
): TargetSummary {
  const onlineTargets = targets.filter((t) => t.status === 'online').length;
  const offlineTargets = targets.filter((t) => t.status === 'offline').length;
  const assignedTargets = targets.filter((t) => t.roomId !== null).length;
  
  return {
    totalTargets: targets.length,
    onlineTargets,
    offlineTargets: offlineTargets + targets.filter((t) => t.status === 'standby').length,
    assignedTargets,
    unassignedTargets: targets.length - assignedTargets,
    totalRooms,
    lastUpdated: Date.now(),
  };
}

/**
 * Get recent sessions (sorted by date, limited)
 */
export function getRecentSessions(
  sessions: SessionData[],
  limit: number = 10
): SessionMetrics[] {
  return sessions
    .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
    .slice(0, limit)
    .map((session) => ({
      id: session.id,
      startedAt: session.startedAt,
      score: session.score,
      hitCount: session.hitCount,
      durationMs: session.durationMs,
      accuracyPercentage: session.accuracyPercentage,
    }));
}

/**
 * Calculate average accuracy from sessions
 */
export function calculateAverageAccuracy(sessions: SessionData[]): number | null {
  const sessionsWithAccuracy = sessions.filter((s) => s.accuracyPercentage !== null);
  
  if (sessionsWithAccuracy.length === 0) {
    return null;
  }
  
  const totalAccuracy = sessionsWithAccuracy.reduce(
    (sum, s) => sum + (s.accuracyPercentage ?? 0),
    0
  );
  
  return Math.round(totalAccuracy / sessionsWithAccuracy.length);
}

/**
 * Calculate total hits from sessions
 */
export function calculateTotalHits(sessions: SessionData[]): number {
  return sessions.reduce((sum, s) => sum + s.hitCount, 0);
}

/**
 * Calculate total practice time from sessions (in milliseconds)
 */
export function calculateTotalPracticeTime(sessions: SessionData[]): number {
  return sessions.reduce((sum, s) => sum + s.durationMs, 0);
}

/**
 * Format practice time for display
 */
export function formatPracticeTime(totalMs: number): string {
  const hours = Math.floor(totalMs / (1000 * 60 * 60));
  const minutes = Math.floor((totalMs % (1000 * 60 * 60)) / (1000 * 60));
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  
  return `${minutes}m`;
}

/**
 * Calculate sessions per day average
 */
export function calculateSessionsPerDay(
  sessions: SessionData[],
  days: number = 30
): number {
  if (sessions.length === 0 || days <= 0) {
    return 0;
  }
  
  const now = new Date();
  const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  
  const sessionsInRange = sessions.filter(
    (s) => new Date(s.startedAt) >= startDate
  );
  
  return Math.round((sessionsInRange.length / days) * 10) / 10;
}

/**
 * Calculate score trend over time
 */
export function calculateScoreTrend(
  sessions: SessionData[],
  period: TimePeriod = 'week'
): TrendDataPoint[] {
  if (sessions.length === 0) {
    return [];
  }
  
  const now = new Date();
  const periodMs = getPeriodMs(period);
  const startDate = new Date(now.getTime() - periodMs);
  
  const sessionsInRange = sessions.filter(
    (s) => new Date(s.startedAt) >= startDate
  );
  
  // Group by date
  const grouped = new Map<string, number[]>();
  
  for (const session of sessionsInRange) {
    const date = new Date(session.startedAt).toISOString().split('T')[0];
    const existing = grouped.get(date) ?? [];
    existing.push(session.score);
    grouped.set(date, existing);
  }
  
  // Calculate average per day
  const trend: TrendDataPoint[] = [];
  for (const [date, scores] of grouped) {
    const avg = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
    trend.push({ date, value: avg });
  }
  
  // Sort by date
  return trend.sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Calculate improvement percentage
 */
export function calculateImprovementPercentage(
  recentAvg: number | null,
  previousAvg: number | null
): number | null {
  if (recentAvg === null || previousAvg === null || previousAvg === 0) {
    return null;
  }
  
  return Math.round(((recentAvg - previousAvg) / previousAvg) * 100);
}

/**
 * Get period in milliseconds
 */
function getPeriodMs(period: TimePeriod): number {
  const day = 24 * 60 * 60 * 1000;
  
  switch (period) {
    case 'day':
      return day;
    case 'week':
      return 7 * day;
    case 'month':
      return 30 * day;
    case 'year':
      return 365 * day;
    case 'all':
      return Number.MAX_SAFE_INTEGER;
  }
}

/**
 * Build complete dashboard metrics from raw data
 */
export function buildDashboardMetrics(
  targets: TargetData[],
  sessions: SessionData[],
  totalRooms: number,
  recentSessionsLimit: number = 10
): DashboardMetrics {
  return {
    summary: calculateTargetSummary(targets, totalRooms),
    totals: calculateSessionTotals(sessions),
    recentSessions: getRecentSessions(sessions, recentSessionsLimit),
    generatedAt: Date.now(),
  };
}

/**
 * Calculate streak (consecutive days with sessions)
 */
export function calculateStreak(sessions: SessionData[]): number {
  if (sessions.length === 0) {
    return 0;
  }
  
  // Get unique dates with sessions
  const dates = new Set(
    sessions.map((s) => new Date(s.startedAt).toISOString().split('T')[0])
  );
  
  // Sort dates descending
  const sortedDates = Array.from(dates).sort().reverse();
  
  // Check if today or yesterday has a session
  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  
  if (!dates.has(today) && !dates.has(yesterday)) {
    return 0;
  }
  
  // Count consecutive days
  let streak = 0;
  let currentDate = new Date(sortedDates[0]);
  
  for (const dateStr of sortedDates) {
    const date = new Date(dateStr);
    const diff = Math.round((currentDate.getTime() - date.getTime()) / (24 * 60 * 60 * 1000));
    
    if (diff <= 1) {
      streak++;
      currentDate = date;
    } else {
      break;
    }
  }
  
  return streak;
}

/**
 * Get performance rating based on accuracy
 */
export function getPerformanceRating(accuracy: number | null): 'excellent' | 'good' | 'average' | 'needs_improvement' | 'unknown' {
  if (accuracy === null) {
    return 'unknown';
  }
  
  if (accuracy >= 90) return 'excellent';
  if (accuracy >= 75) return 'good';
  if (accuracy >= 50) return 'average';
  return 'needs_improvement';
}

