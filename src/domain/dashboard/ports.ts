/**
 * Dashboard Domain Ports
 *
 * Repository interfaces for data access.
 * Pure types - no React or Supabase imports.
 */

import type { ApiResponse } from '@/shared/lib/api-response';

/**
 * Dashboard summary data
 */
export type DashboardSummary = {
  totalTargets: number;
  onlineTargets: number;
  standbyTargets: number;
  offlineTargets: number;
  assignedTargets: number;
  unassignedTargets: number;
  totalRooms: number;
  lastUpdated: number;
};

/**
 * Dashboard totals data
 */
export type DashboardTotals = {
  totalSessions: number;
  bestScore: number | null;
  avgScore: number | null;
};

/**
 * Recent session record
 */
export type RecentSessionRecord = {
  id: string;
  started_at: string;
  score: number;
  hit_count: number;
  duration_ms: number;
  accuracy_percentage: number | null;
};

/**
 * Dashboard metrics data
 */
export type DashboardMetricsRecord = {
  summary: DashboardSummary;
  totals: DashboardTotals;
  recentSessions: RecentSessionRecord[];
  generatedAt: number;
};

/**
 * Dashboard metrics result with cache info
 */
export type DashboardMetricsResult = {
  metrics: DashboardMetricsRecord | null;
  cached: boolean;
  source?: string;
};

/**
 * Dashboard Repository Interface
 * 
 * Defines the contract for dashboard data access.
 */
export interface DashboardRepository {
  /**
   * Get dashboard metrics
   * @param force - Force refresh bypassing cache
   */
  getMetrics(force?: boolean): Promise<ApiResponse<DashboardMetricsResult>>;
}



