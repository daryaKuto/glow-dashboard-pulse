/**
 * Profile Domain Validators
 * 
 * Validation rules for profile operations.
 * Pure functions - no React or Supabase imports.
 */

import { z } from 'zod';
import { validateWithSchema, type ValidationResult, isValidUuid, isNonEmptyString } from '../shared/validation-helpers';

/**
 * Profile validation constants
 */
export const PROFILE_CONSTRAINTS = {
  NAME_MIN_LENGTH: 1,
  NAME_MAX_LENGTH: 100,
  BIO_MAX_LENGTH: 500,
  AVATAR_URL_MAX_LENGTH: 2048,
  MAX_RECENT_SESSIONS: 100,
} as const;

/**
 * User ID validation schema
 */
export const userIdSchema = z.string().uuid('Invalid user ID');

/**
 * Email validation schema
 */
export const emailSchema = z.string().email('Invalid email address');

/**
 * Profile name validation schema
 */
export const profileNameSchema = z.string()
  .min(PROFILE_CONSTRAINTS.NAME_MIN_LENGTH, 'Name is required')
  .max(PROFILE_CONSTRAINTS.NAME_MAX_LENGTH, 'Name is too long')
  .transform((val) => val.trim());

/**
 * Avatar URL validation schema
 */
export const avatarUrlSchema = z.string()
  .url('Invalid URL')
  .max(PROFILE_CONSTRAINTS.AVATAR_URL_MAX_LENGTH, 'URL is too long')
  .optional();

/**
 * Update profile input schema
 */
export const updateProfileInputSchema = z.object({
  name: profileNameSchema.optional(),
  avatarUrl: avatarUrlSchema,
});

/**
 * Profile query options schema
 */
export const profileQueryOptionsSchema = z.object({
  includeStats: z.boolean().optional(),
  includeRecentSessions: z.boolean().optional(),
  recentSessionsLimit: z.number()
    .min(1)
    .max(PROFILE_CONSTRAINTS.MAX_RECENT_SESSIONS)
    .optional(),
});

/**
 * Recent sessions query schema
 */
export const recentSessionsQuerySchema = z.object({
  userId: userIdSchema,
  limit: z.number()
    .min(1)
    .max(PROFILE_CONSTRAINTS.MAX_RECENT_SESSIONS)
    .default(10),
  offset: z.number().min(0).default(0),
});

/**
 * Stats trend query schema
 */
export const statsTrendQuerySchema = z.object({
  userId: userIdSchema,
  periodType: z.enum(['daily', 'weekly', 'monthly']).default('daily'),
  days: z.number().min(1).max(365).default(30),
});

// Inferred types
export type UpdateProfileInput = z.infer<typeof updateProfileInputSchema>;
export type ProfileQueryOptions = z.infer<typeof profileQueryOptionsSchema>;
export type RecentSessionsQuery = z.infer<typeof recentSessionsQuerySchema>;
export type StatsTrendQuery = z.infer<typeof statsTrendQuerySchema>;

/**
 * Validate user ID
 */
export function validateUserId(userId: unknown): ValidationResult<string> {
  if (!isNonEmptyString(userId)) {
    return {
      success: false,
      errors: [{ field: 'userId', message: 'User ID is required', code: 'required' }],
    };
  }
  
  if (!isValidUuid(userId)) {
    return {
      success: false,
      errors: [{ field: 'userId', message: 'Invalid user ID format', code: 'invalid_uuid' }],
    };
  }
  
  return { success: true, data: userId };
}

/**
 * Validate email
 */
export function validateEmail(email: unknown): ValidationResult<string> {
  return validateWithSchema(emailSchema, email);
}

/**
 * Validate update profile input
 */
export function validateUpdateProfileInput(input: unknown): ValidationResult<UpdateProfileInput> {
  return validateWithSchema(updateProfileInputSchema, input);
}

/**
 * Validate profile query options
 */
export function validateProfileQueryOptions(options: unknown): ValidationResult<ProfileQueryOptions> {
  return validateWithSchema(profileQueryOptionsSchema, options);
}

/**
 * Validate recent sessions query
 */
export function validateRecentSessionsQuery(query: unknown): ValidationResult<RecentSessionsQuery> {
  return validateWithSchema(recentSessionsQuerySchema, query);
}

/**
 * Validate stats trend query
 */
export function validateStatsTrendQuery(query: unknown): ValidationResult<StatsTrendQuery> {
  return validateWithSchema(statsTrendQuerySchema, query);
}

/**
 * Validate profile name
 */
export function validateProfileName(name: unknown): ValidationResult<string> {
  if (!isNonEmptyString(name)) {
    return {
      success: false,
      errors: [{ field: 'name', message: 'Name is required', code: 'required' }],
    };
  }
  
  const trimmed = name.trim();
  
  if (trimmed.length < PROFILE_CONSTRAINTS.NAME_MIN_LENGTH) {
    return {
      success: false,
      errors: [{ field: 'name', message: 'Name is required', code: 'too_short' }],
    };
  }
  
  if (trimmed.length > PROFILE_CONSTRAINTS.NAME_MAX_LENGTH) {
    return {
      success: false,
      errors: [{ field: 'name', message: 'Name is too long', code: 'too_long' }],
    };
  }
  
  return { success: true, data: trimmed };
}

/**
 * Validate avatar URL
 */
export function validateAvatarUrl(url: unknown): ValidationResult<string | undefined> {
  if (url === undefined || url === null || url === '') {
    return { success: true, data: undefined };
  }
  
  return validateWithSchema(avatarUrlSchema, url);
}



