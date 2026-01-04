/**
 * Dashboard Domain Mappers
 *
 * Transform data between layers.
 * Pure functions - no React or Supabase imports.
 */

export type DashboardMetricsSummary = {
  totalTargets: number;
  onlineTargets: number;
  offlineTargets: number;
  assignedTargets: number;
  unassignedTargets: number;
  totalRooms: number;
  lastUpdated: number;
};

export type DashboardMetricsTotals = {
  totalSessions: number;
  bestScore: number | null;
  avgScore: number | null;
};

export type DashboardRecentSession = {
  id: string;
  started_at: string;
  score: number;
  hit_count: number;
  duration_ms: number;
  accuracy_percentage: number | null;
};

export type DashboardMetricsDomainModel = {
  summary: DashboardMetricsSummary;
  totals: DashboardMetricsTotals;
  recentSessions: DashboardRecentSession[];
  generatedAt: number;
};

export type DashboardMetricsPayload = {
  summary?: Partial<DashboardMetricsSummary> | null;
  totals?: Partial<DashboardMetricsTotals> | null;
  recentSessions?: Array<Partial<DashboardRecentSession>> | null;
  generatedAt?: number | null;
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

/**
 * Map dashboard metrics payload to domain model.
 */
export function mapDashboardMetricsPayload(
  payload: DashboardMetricsPayload | null | undefined
): DashboardMetricsDomainModel | null {
  if (!payload) {
    return null;
  }

  const summaryInput = payload.summary ?? {};
  const totalsInput = payload.totals ?? {};
  const recentSessionsInput = Array.isArray(payload.recentSessions)
    ? payload.recentSessions
    : [];

  const summary: DashboardMetricsSummary = {
    totalTargets: toNumber(summaryInput.totalTargets),
    onlineTargets: toNumber(summaryInput.onlineTargets),
    offlineTargets: toNumber(summaryInput.offlineTargets),
    assignedTargets: toNumber(summaryInput.assignedTargets),
    unassignedTargets: toNumber(summaryInput.unassignedTargets),
    totalRooms: toNumber(summaryInput.totalRooms),
    lastUpdated: toNumber(summaryInput.lastUpdated, Date.now()),
  };

  const totals: DashboardMetricsTotals = {
    totalSessions: toNumber(totalsInput.totalSessions),
    bestScore: toNullableNumber(totalsInput.bestScore),
    avgScore: toNullableNumber(totalsInput.avgScore),
  };

  const recentSessions = recentSessionsInput
    .filter((session) => session && typeof session.id === 'string' && typeof session.started_at === 'string')
    .map((session) => ({
      id: session.id as string,
      started_at: session.started_at as string,
      score: toNumber(session.score),
      hit_count: toNumber(session.hit_count),
      duration_ms: toNumber(session.duration_ms),
      accuracy_percentage: toNullableNumber(session.accuracy_percentage),
    }));

  return {
    summary,
    totals,
    recentSessions,
    generatedAt: toNumber(payload.generatedAt, Date.now()),
  };
}
