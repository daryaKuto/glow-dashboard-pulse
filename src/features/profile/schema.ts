import { z } from 'zod';

/**
 * Zod schemas for Profile feature
 */

export const userProfileDataSchema = z.object({
  userId: z.string(),
  email: z.string().email(),
  name: z.string(),
  avatarUrl: z.string().url().optional(),
  totalHits: z.number(),
  totalShots: z.number(),
  bestScore: z.number(),
  totalSessions: z.number(),
  avgAccuracy: z.number(),
  avgReactionTime: z.number().nullable(),
  bestReactionTime: z.number().nullable(),
  totalDuration: z.number(),
  scoreImprovement: z.number(),
  accuracyImprovement: z.number(),
});

export const recentSessionSchema = z.object({
  id: z.string(),
  scenarioName: z.string().nullable(),
  scenarioType: z.string().nullable(),
  roomName: z.string().nullable(),
  roomId: z.string().nullable(),
  score: z.number(),
  accuracy: z.number(),
  duration: z.number(),
  hitCount: z.number(),
  totalShots: z.number(),
  missCount: z.number(),
  avgReactionTime: z.number().nullable(),
  bestReactionTime: z.number().nullable(),
  worstReactionTime: z.number().nullable(),
  startedAt: z.string(),
  endedAt: z.string().nullable(),
  thingsboardData: z.unknown().optional(),
  rawSensorData: z.unknown().optional(),
});

export const updateProfileSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  avatarUrl: z.string().url().optional(),
});

export const userAnalyticsSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  period_type: z.string(),
  total_hits: z.number(),
  total_shots: z.number(),
  total_sessions: z.number(),
  best_score: z.number(),
  avg_accuracy: z.number(),
  avg_reaction_time: z.number().nullable(),
  best_reaction_time: z.number().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

// Inferred types
export type UserProfileData = z.infer<typeof userProfileDataSchema>;
export type RecentSession = z.infer<typeof recentSessionSchema>;
export type UpdateProfile = z.infer<typeof updateProfileSchema>;
export type UserAnalytics = z.infer<typeof userAnalyticsSchema>;

