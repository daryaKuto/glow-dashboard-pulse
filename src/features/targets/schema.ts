import { z } from 'zod';

/**
 * Zod schemas for Targets feature
 * 
 * Defines contracts for all Target-related operations.
 * Types are inferred from these schemas to ensure consistency.
 */

export const targetStatusSchema = z.enum(['online', 'offline', 'standby']);
export const activityStatusSchema = z.enum(['active', 'recent', 'standby']);

export const targetSchema = z.object({
  id: z.string(),
  name: z.string(),
  customName: z.string().nullable().optional(),
  status: targetStatusSchema,
  battery: z.number().nullable().optional(),
  wifiStrength: z.number().nullable().optional(),
  roomId: z.union([z.string(), z.number()]).nullable().optional(),
  telemetry: z.record(z.unknown()).optional(),
  telemetryHistory: z.record(z.unknown()).optional(),
  lastEvent: z.string().nullable().optional(),
  lastGameId: z.string().nullable().optional(),
  lastGameName: z.string().nullable().optional(),
  lastHits: z.number().nullable().optional(),
  lastActivity: z.string().nullable().optional(),
  lastActivityTime: z.number().nullable().optional(),
  lastShotTime: z.number().nullable().optional(),
  totalShots: z.number().nullable().optional(),
  recentShotsCount: z.number().optional(),
  activityStatus: activityStatusSchema.optional(),
  gameStatus: z.string().nullable().optional(),
  errors: z.array(z.string()).optional(),
  deviceName: z.string().optional(),
  deviceType: z.string().optional(),
  createdTime: z.number().nullable().optional(),
  additionalInfo: z.record(z.unknown()).optional(),
  type: z.string().optional(),
  isNoDataMessage: z.boolean().optional(),
  isErrorMessage: z.boolean().optional(),
  message: z.string().optional(),
});

export const targetDetailSchema = z.object({
  deviceId: z.string(),
  status: targetStatusSchema,
  activityStatus: activityStatusSchema.optional(),
  lastShotTime: z.number().nullable(),
  totalShots: z.number(),
  recentShotsCount: z.number(),
  telemetry: z.record(z.unknown()),
  history: z.record(z.unknown()).optional(),
  battery: z.number().nullable().optional(),
  wifiStrength: z.number().nullable().optional(),
  lastEvent: z.string().nullable().optional(),
  gameStatus: z.string().nullable().optional(),
  errors: z.array(z.string()).optional(),
});

export const targetDetailsOptionsSchema = z.object({
  force: z.boolean().optional(),
  includeHistory: z.boolean().optional(),
  historyRangeMs: z.number().optional(),
  historyLimit: z.number().optional(),
  telemetryKeys: z.array(z.string()).optional(),
  historyKeys: z.array(z.string()).optional(),
  recentWindowMs: z.number().optional(),
});

export const targetsSummarySchema = z.object({
  totalTargets: z.number(),
  onlineTargets: z.number(),
  offlineTargets: z.number(),
  assignedTargets: z.number(),
  unassignedTargets: z.number(),
  totalRooms: z.number(),
  lastUpdated: z.number(),
});

export const updateTargetCustomNameSchema = z.object({
  targetId: z.string(),
  customName: z.string().nullable(),
});

// Inferred types
export type Target = z.infer<typeof targetSchema>;
export type TargetDetail = z.infer<typeof targetDetailSchema>;
export type TargetDetailsOptions = z.infer<typeof targetDetailsOptionsSchema>;
export type TargetsSummary = z.infer<typeof targetsSummarySchema>;
export type UpdateTargetCustomName = z.infer<typeof updateTargetCustomNameSchema>;

