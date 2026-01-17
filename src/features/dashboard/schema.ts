import { z } from 'zod';

/**
 * Zod schemas for Dashboard feature
 */

export const dashboardMetricsTotalsSchema = z.object({
  totalSessions: z.number(),
  bestScore: z.number().nullable(),
  avgScore: z.number().nullable(),
});

export const dashboardRecentSessionSchema = z.object({
  id: z.string(),
  started_at: z.string(),
  score: z.number(),
  hit_count: z.number(),
  duration_ms: z.number(),
  accuracy_percentage: z.number().nullable(),
});

export const dashboardMetricsDataSchema = z.object({
  summary: z.object({
    totalTargets: z.number(),
    onlineTargets: z.number(),
    offlineTargets: z.number(),
    assignedTargets: z.number(),
    unassignedTargets: z.number(),
    totalRooms: z.number(),
    lastUpdated: z.number(),
  }),
  totals: dashboardMetricsTotalsSchema,
  recentSessions: z.array(dashboardRecentSessionSchema),
  generatedAt: z.number(),
});

// Inferred types
export type DashboardMetricsTotals = z.infer<typeof dashboardMetricsTotalsSchema>;
export type DashboardRecentSession = z.infer<typeof dashboardRecentSessionSchema>;
export type DashboardMetricsData = z.infer<typeof dashboardMetricsDataSchema>;



