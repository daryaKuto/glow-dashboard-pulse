/**
 * Dashboard Domain Validators
 * 
 * Validation rules for dashboard operations.
 * Pure functions - no React or Supabase imports.
 */

import { z } from 'zod';
import { validateWithSchema, type ValidationResult } from '../shared/validation-helpers';

/**
 * Dashboard validation constants
 */
export const DASHBOARD_CONSTRAINTS = {
  MAX_RECENT_SESSIONS: 100,
  MAX_DATE_RANGE_DAYS: 365,
  MIN_DATE_RANGE_DAYS: 1,
} as const;

/**
 * Dashboard metrics query options schema
 */
export const dashboardQueryOptionsSchema = z.object({
  force: z.boolean().optional(),
  dateRangeStart: z.string().datetime().optional(),
  dateRangeEnd: z.string().datetime().optional(),
  recentSessionsLimit: z.number()
    .min(1)
    .max(DASHBOARD_CONSTRAINTS.MAX_RECENT_SESSIONS)
    .optional(),
});

/**
 * Session metrics schema
 */
export const sessionMetricsSchema = z.object({
  id: z.string(),
  startedAt: z.string().datetime(),
  score: z.number().min(0),
  hitCount: z.number().min(0),
  durationMs: z.number().min(0),
  accuracyPercentage: z.number().min(0).max(100).nullable(),
});

/**
 * Target summary schema
 */
export const targetSummarySchema = z.object({
  totalTargets: z.number().min(0),
  onlineTargets: z.number().min(0),
  standbyTargets: z.number().min(0),
  offlineTargets: z.number().min(0),
  assignedTargets: z.number().min(0),
  unassignedTargets: z.number().min(0),
  totalRooms: z.number().min(0),
  lastUpdated: z.number(),
});

/**
 * Session totals schema
 */
export const sessionTotalsSchema = z.object({
  totalSessions: z.number().min(0),
  bestScore: z.number().nullable(),
  avgScore: z.number().nullable(),
});

/**
 * Full dashboard metrics schema
 */
export const dashboardMetricsSchema = z.object({
  summary: targetSummarySchema,
  totals: sessionTotalsSchema,
  recentSessions: z.array(sessionMetricsSchema),
  generatedAt: z.number(),
});

// Inferred types
export type DashboardQueryOptions = z.infer<typeof dashboardQueryOptionsSchema>;
export type SessionMetrics = z.infer<typeof sessionMetricsSchema>;
export type TargetSummary = z.infer<typeof targetSummarySchema>;
export type SessionTotals = z.infer<typeof sessionTotalsSchema>;
export type DashboardMetrics = z.infer<typeof dashboardMetricsSchema>;

/**
 * Validate dashboard query options
 */
export function validateDashboardQueryOptions(options: unknown): ValidationResult<DashboardQueryOptions> {
  return validateWithSchema(dashboardQueryOptionsSchema, options);
}

/**
 * Validate dashboard metrics response
 */
export function validateDashboardMetrics(metrics: unknown): ValidationResult<DashboardMetrics> {
  return validateWithSchema(dashboardMetricsSchema, metrics);
}

/**
 * Validate date range
 */
export function validateDateRange(
  startDate: string | undefined,
  endDate: string | undefined
): ValidationResult<{ start: Date; end: Date } | null> {
  if (!startDate && !endDate) {
    return { success: true, data: null };
  }
  
  if (!startDate || !endDate) {
    return {
      success: false,
      errors: [{ field: 'dateRange', message: 'Both start and end dates are required', code: 'incomplete_range' }],
    };
  }
  
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return {
      success: false,
      errors: [{ field: 'dateRange', message: 'Invalid date format', code: 'invalid_date' }],
    };
  }
  
  if (start > end) {
    return {
      success: false,
      errors: [{ field: 'dateRange', message: 'Start date must be before end date', code: 'invalid_range' }],
    };
  }
  
  const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  
  if (daysDiff > DASHBOARD_CONSTRAINTS.MAX_DATE_RANGE_DAYS) {
    return {
      success: false,
      errors: [{ 
        field: 'dateRange', 
        message: `Date range cannot exceed ${DASHBOARD_CONSTRAINTS.MAX_DATE_RANGE_DAYS} days`, 
        code: 'range_too_large' 
      }],
    };
  }
  
  return { success: true, data: { start, end } };
}

/**
 * Check if metrics are stale
 */
export function areMetricsStale(generatedAt: number, maxAgeMs: number = 5 * 60 * 1000): boolean {
  const now = Date.now();
  return now - generatedAt > maxAgeMs;
}



