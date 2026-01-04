/**
 * Profile Domain Mappers
 *
 * Transform data between layers.
 * Pure functions - no React or Supabase imports.
 */

/**
 * Database row shapes (snake_case).
 */
export type UserProfileDbRow = {
  id: string;
  email: string | null;
  display_name: string | null;
  name: string | null;
  avatar_url: string | null;
};

export type UserAnalyticsDbRow = {
  total_hits: number | null;
  total_shots: number | null;
  best_score: number | null;
  total_sessions: number | null;
  accuracy_percentage: number | null;
  avg_reaction_time_ms: number | null;
  best_reaction_time_ms: number | null;
  total_duration_ms: number | null;
  score_improvement: number | null;
  accuracy_improvement: number | null;
};

export type SessionDbRow = {
  id: string;
  scenario_name: string | null;
  scenario_type: string | null;
  room_name: string | null;
  room_id: string | null;
  score: number | null;
  accuracy_percentage: number | null;
  duration_ms: number | null;
  hit_count: number | null;
  total_shots: number | null;
  miss_count: number | null;
  avg_reaction_time_ms: number | null;
  best_reaction_time_ms: number | null;
  worst_reaction_time_ms: number | null;
  started_at: string;
  ended_at: string | null;
  thingsboard_data?: unknown;
  raw_sensor_data?: unknown;
};

/**
 * Domain models (camelCase).
 */
export type UserProfileIdentity = {
  userId: string;
  email: string;
  name: string;
  avatarUrl?: string;
};

export type UserProfileMetrics = {
  totalHits: number;
  totalShots: number;
  bestScore: number;
  totalSessions: number;
  avgAccuracy: number;
  avgReactionTime: number | null;
  bestReactionTime: number | null;
  totalDuration: number;
  scoreImprovement: number;
  accuracyImprovement: number;
};

export type RecentSessionDomain = {
  id: string;
  scenarioName: string | null;
  scenarioType: string | null;
  roomName: string | null;
  roomId: string | null;
  score: number;
  accuracy: number;
  duration: number;
  hitCount: number;
  totalShots: number;
  missCount: number;
  avgReactionTime: number | null;
  bestReactionTime: number | null;
  worstReactionTime: number | null;
  startedAt: string;
  endedAt: string | null;
  thingsboardData?: unknown;
  rawSensorData?: unknown;
};

const toNumber = (value: unknown, fallback = 0): number => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  return fallback;
};

const toNullableNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  return null;
};

const roundToTwo = (value: number): number => Math.round(value * 100) / 100;

const resolveDisplayName = (row: UserProfileDbRow): string => {
  const displayName = typeof row.display_name === 'string' ? row.display_name.trim() : '';
  if (displayName) {
    return displayName;
  }

  const name = typeof row.name === 'string' ? row.name.trim() : '';
  if (name) {
    return name;
  }

  if (typeof row.email === 'string' && row.email.includes('@')) {
    return row.email.split('@')[0] || 'User';
  }

  return 'User';
};

/**
 * Map profile row to identity model.
 */
export function mapUserProfileRowToIdentity(row: UserProfileDbRow): UserProfileIdentity {
  const avatarUrl =
    typeof row.avatar_url === 'string' && row.avatar_url.length > 0
      ? row.avatar_url
      : undefined;

  return {
    userId: row.id,
    email: row.email ?? '',
    name: resolveDisplayName(row),
    avatarUrl,
  };
}

/**
 * Map analytics row to profile metrics.
 */
export function mapUserAnalyticsRowToMetrics(row: UserAnalyticsDbRow): UserProfileMetrics {
  return {
    totalHits: toNumber(row.total_hits),
    totalShots: toNumber(row.total_shots),
    bestScore: toNumber(row.best_score),
    totalSessions: toNumber(row.total_sessions),
    avgAccuracy: roundToTwo(toNumber(row.accuracy_percentage)),
    avgReactionTime: toNullableNumber(row.avg_reaction_time_ms),
    bestReactionTime: toNullableNumber(row.best_reaction_time_ms),
    totalDuration: toNumber(row.total_duration_ms),
    scoreImprovement: toNumber(row.score_improvement),
    accuracyImprovement: toNumber(row.accuracy_improvement),
  };
}

/**
 * Map session row to recent session model.
 */
export function mapSessionRowToRecentSession(row: SessionDbRow): RecentSessionDomain {
  return {
    id: row.id,
    scenarioName: row.scenario_name ?? null,
    scenarioType: row.scenario_type ?? null,
    roomName: row.room_name ?? null,
    roomId: row.room_id ?? null,
    score: toNumber(row.score),
    accuracy: roundToTwo(toNumber(row.accuracy_percentage)),
    duration: toNumber(row.duration_ms),
    hitCount: toNumber(row.hit_count),
    totalShots: toNumber(row.total_shots),
    missCount: toNumber(row.miss_count),
    avgReactionTime: toNullableNumber(row.avg_reaction_time_ms),
    bestReactionTime: toNullableNumber(row.best_reaction_time_ms),
    worstReactionTime: toNullableNumber(row.worst_reaction_time_ms),
    startedAt: row.started_at,
    endedAt: row.ended_at ?? null,
    thingsboardData: row.thingsboard_data,
    rawSensorData: row.raw_sensor_data,
  };
}
