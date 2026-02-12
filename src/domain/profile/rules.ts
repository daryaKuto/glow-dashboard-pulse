/**
 * Profile Domain Business Rules
 * 
 * Business rules and invariants for profile operations.
 * Pure functions - no React or Supabase imports.
 */

import { PROFILE_CONSTRAINTS } from './validators';

/**
 * Profile business rule result
 */
export type RuleResult = 
  | { valid: true }
  | { valid: false; violation: string; code: string };

/**
 * Session summary for rule checks
 */
export type SessionSummary = {
  id: string;
  score: number;
  hitCount: number;
  durationMs: number;
  accuracyPercentage: number | null;
  startedAt: string;
};

/**
 * Profile statistics summary
 */
export type ProfileStats = {
  totalSessions: number;
  totalHits: number;
  totalPracticeTimeMs: number;
  averageAccuracy: number | null;
  bestScore: number | null;
  currentStreak: number;
};

/**
 * Check if profile name is valid
 */
export function isValidProfileName(name: string): RuleResult {
  const trimmed = name.trim();
  
  if (trimmed.length < PROFILE_CONSTRAINTS.NAME_MIN_LENGTH) {
    return {
      valid: false,
      violation: 'Name is required',
      code: 'NAME_TOO_SHORT',
    };
  }
  
  if (trimmed.length > PROFILE_CONSTRAINTS.NAME_MAX_LENGTH) {
    return {
      valid: false,
      violation: `Name must be ${PROFILE_CONSTRAINTS.NAME_MAX_LENGTH} characters or less`,
      code: 'NAME_TOO_LONG',
    };
  }
  
  return { valid: true };
}

/**
 * Check if avatar URL is valid
 */
export function isValidAvatarUrl(url: string | null | undefined): RuleResult {
  if (!url) {
    return { valid: true }; // Avatar is optional
  }
  
  if (url.length > PROFILE_CONSTRAINTS.AVATAR_URL_MAX_LENGTH) {
    return {
      valid: false,
      violation: 'Avatar URL is too long',
      code: 'URL_TOO_LONG',
    };
  }
  
  // Basic URL validation
  try {
    new URL(url);
  } catch {
    return {
      valid: false,
      violation: 'Invalid avatar URL format',
      code: 'INVALID_URL',
    };
  }
  
  return { valid: true };
}

/**
 * Calculate total practice time from sessions
 */
export function calculateTotalPracticeTime(sessions: SessionSummary[]): number {
  return sessions.reduce((total, session) => total + session.durationMs, 0);
}

/**
 * Calculate average accuracy from sessions
 */
export function calculateAverageAccuracy(sessions: SessionSummary[]): number | null {
  const sessionsWithAccuracy = sessions.filter(s => s.accuracyPercentage !== null);
  
  if (sessionsWithAccuracy.length === 0) {
    return null;
  }
  
  const total = sessionsWithAccuracy.reduce(
    (sum, s) => sum + (s.accuracyPercentage ?? 0),
    0
  );
  
  return Math.round(total / sessionsWithAccuracy.length);
}

/**
 * Calculate best score from sessions.
 * For time-based scoring, "best" means the lowest/fastest time.
 */
export function calculateBestScore(sessions: SessionSummary[]): number | null {
  if (sessions.length === 0) {
    return null;
  }
  
  // For time-based scoring, lower is better
  return Math.min(...sessions.map(s => s.score));
}

/**
 * Calculate total hits from sessions
 */
export function calculateTotalHits(sessions: SessionSummary[]): number {
  return sessions.reduce((total, session) => total + session.hitCount, 0);
}

/**
 * Calculate current streak (consecutive days with sessions)
 */
export function calculateCurrentStreak(sessions: SessionSummary[]): number {
  if (sessions.length === 0) {
    return 0;
  }
  
  // Get unique dates with sessions
  const dates = new Set(
    sessions.map(s => new Date(s.startedAt).toISOString().split('T')[0])
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
 * Build profile statistics from sessions
 */
export function buildProfileStats(sessions: SessionSummary[]): ProfileStats {
  return {
    totalSessions: sessions.length,
    totalHits: calculateTotalHits(sessions),
    totalPracticeTimeMs: calculateTotalPracticeTime(sessions),
    averageAccuracy: calculateAverageAccuracy(sessions),
    bestScore: calculateBestScore(sessions),
    currentStreak: calculateCurrentStreak(sessions),
  };
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
 * Get performance rating based on accuracy
 */
export function getPerformanceRating(
  accuracy: number | null
): 'excellent' | 'good' | 'average' | 'needs_improvement' | 'unknown' {
  if (accuracy === null) {
    return 'unknown';
  }
  
  if (accuracy >= 90) return 'excellent';
  if (accuracy >= 75) return 'good';
  if (accuracy >= 50) return 'average';
  return 'needs_improvement';
}

/**
 * Check if recent sessions limit is valid
 */
export function isValidRecentSessionsLimit(limit: number): RuleResult {
  if (limit < 1) {
    return {
      valid: false,
      violation: 'Limit must be at least 1',
      code: 'LIMIT_TOO_SMALL',
    };
  }
  
  if (limit > PROFILE_CONSTRAINTS.MAX_RECENT_SESSIONS) {
    return {
      valid: false,
      violation: `Limit cannot exceed ${PROFILE_CONSTRAINTS.MAX_RECENT_SESSIONS}`,
      code: 'LIMIT_TOO_LARGE',
    };
  }
  
  return { valid: true };
}

/**
 * Calculate improvement percentage between two periods
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
 * Get sessions within a date range
 */
export function filterSessionsByDateRange(
  sessions: SessionSummary[],
  startDate: Date,
  endDate: Date
): SessionSummary[] {
  return sessions.filter(session => {
    const sessionDate = new Date(session.startedAt);
    return sessionDate >= startDate && sessionDate <= endDate;
  });
}

/**
 * Sort sessions by date (most recent first)
 */
export function sortSessionsByDate(sessions: SessionSummary[]): SessionSummary[] {
  return [...sessions].sort((a, b) => 
    new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
  );
}



