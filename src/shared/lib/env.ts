import { z } from 'zod';

/**
 * Environment Variable Validation
 *
 * Validates client-safe environment variables at runtime.
 * All VITE_ prefixed variables are exposed to the client.
 *
 * Usage:
 *   import { env } from '@/shared/lib/env';
 *   const url = env.VITE_SUPABASE_URL;
 */

// Schema for required environment variables
const requiredEnvSchema = z.object({
  // Supabase configuration (required)
  VITE_SUPABASE_URL: z.string().url('VITE_SUPABASE_URL must be a valid URL'),
  VITE_SUPABASE_ANON_KEY: z.string().min(1, 'VITE_SUPABASE_ANON_KEY is required'),
});

// Schema for optional environment variables
const optionalEnvSchema = z.object({
  // Build info
  VITE_BUILD_TIME: z.string().optional(),
  VITE_APP_VERSION: z.string().optional(),

  // ThingsBoard configuration
  VITE_TB_BASE_URL: z.string().url().optional(),
  VITE_THINGSBOARD_URL: z.string().url().optional(),
  VITE_TB_HOST: z.string().optional(),
  VITE_TB_USERNAME: z.string().optional(),
  VITE_TB_PASSWORD: z.string().optional(),

  // Rate limiting configuration
  VITE_RATE_LIMIT_ENABLED: z
    .enum(['true', 'false', '0', '1'])
    .optional()
    .transform((val) => val !== 'false' && val !== '0'),
  VITE_RATE_LIMIT_SUPABASE_REQ_PER_MIN: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : undefined)),
  VITE_RATE_LIMIT_THINGSBOARD_REQ_PER_MIN: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : undefined)),
});

// Combined schema
const envSchema = requiredEnvSchema.merge(optionalEnvSchema);

// Type for validated environment
export type Env = z.infer<typeof envSchema>;

/**
 * Validates environment variables and returns typed, validated values.
 * Throws a descriptive error if validation fails.
 */
function validateEnv(): Env {
  const rawEnv = {
    // Required
    VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
    VITE_SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY,

    // Optional - Build info
    VITE_BUILD_TIME: import.meta.env.VITE_BUILD_TIME,
    VITE_APP_VERSION: import.meta.env.VITE_APP_VERSION,

    // Optional - ThingsBoard
    VITE_TB_BASE_URL: import.meta.env.VITE_TB_BASE_URL,
    VITE_THINGSBOARD_URL: import.meta.env.VITE_THINGSBOARD_URL,
    VITE_TB_HOST: import.meta.env.VITE_TB_HOST,
    VITE_TB_USERNAME: import.meta.env.VITE_TB_USERNAME,
    VITE_TB_PASSWORD: import.meta.env.VITE_TB_PASSWORD,

    // Optional - Rate limiting
    VITE_RATE_LIMIT_ENABLED: import.meta.env.VITE_RATE_LIMIT_ENABLED,
    VITE_RATE_LIMIT_SUPABASE_REQ_PER_MIN: import.meta.env.VITE_RATE_LIMIT_SUPABASE_REQ_PER_MIN,
    VITE_RATE_LIMIT_THINGSBOARD_REQ_PER_MIN: import.meta.env.VITE_RATE_LIMIT_THINGSBOARD_REQ_PER_MIN,
  };

  const result = envSchema.safeParse(rawEnv);

  if (!result.success) {
    const errors = result.error.flatten().fieldErrors;
    const errorMessages = Object.entries(errors)
      .map(([key, messages]) => `  ${key}: ${messages?.join(', ')}`)
      .join('\n');

    console.error(
      `[env] Environment validation failed:\n${errorMessages}\n\n` +
        'Please check your .env file and ensure all required variables are set.'
    );

    // In development, throw to make issues obvious
    if (import.meta.env.DEV) {
      throw new Error(`Environment validation failed:\n${errorMessages}`);
    }

    // In production, return partial env with defaults to avoid breaking the app
    // This allows graceful degradation
    return {
      VITE_SUPABASE_URL: rawEnv.VITE_SUPABASE_URL ?? '',
      VITE_SUPABASE_ANON_KEY: rawEnv.VITE_SUPABASE_ANON_KEY ?? '',
      ...optionalEnvSchema.parse(rawEnv),
    };
  }

  return result.data;
}

/**
 * Validated environment variables.
 * Import this to access type-safe environment configuration.
 */
export const env = validateEnv();

/**
 * Check if running in development mode
 */
export const isDev = import.meta.env.DEV;

/**
 * Check if running in production mode
 */
export const isProd = import.meta.env.PROD;

/**
 * Current mode (development, production, etc.)
 */
export const mode = import.meta.env.MODE;

