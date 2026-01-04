/**
 * Rate Limit Configuration
 * 
 * Default rate limits for different API endpoints.
 * Can be overridden via environment variables.
 */

import { TokenBucketRateLimiter, type RateLimitConfig } from './rate-limiter';

/**
 * Rate limit presets for different use cases
 */
export const RATE_LIMIT_PRESETS = {
  /**
   * Supabase database queries - generous limit
   * 100 requests per minute, burst up to 20
   */
  SUPABASE_DB: {
    maxTokens: 20,
    refillRate: 2,
    refillIntervalMs: 1000, // 2 tokens per second = 120/min
    queueWhenLimited: true,
    maxQueueSize: 50,
  } satisfies RateLimitConfig,

  /**
   * Supabase Edge Functions - moderate limit
   * 60 requests per minute, burst up to 10
   */
  SUPABASE_EDGE: {
    maxTokens: 10,
    refillRate: 1,
    refillIntervalMs: 1000, // 1 token per second = 60/min
    queueWhenLimited: true,
    maxQueueSize: 30,
  } satisfies RateLimitConfig,

  /**
   * ThingsBoard REST API - conservative limit
   * 30 requests per minute, burst up to 5
   */
  THINGSBOARD_REST: {
    maxTokens: 5,
    refillRate: 1,
    refillIntervalMs: 2000, // 0.5 tokens per second = 30/min
    queueWhenLimited: true,
    maxQueueSize: 20,
  } satisfies RateLimitConfig,

  /**
   * ThingsBoard telemetry queries - higher limit
   * 180 requests per minute, burst up to 40
   * Increased to handle 16 telemetry + 16 attribute calls (32 total) plus buffer
   * for multiple WebSocket subscriptions and concurrent requests
   */
  THINGSBOARD_TELEMETRY: {
    maxTokens: 40,
    refillRate: 3,
    refillIntervalMs: 1000, // 3 tokens per second = 180/min
    queueWhenLimited: true,
    maxQueueSize: 50,
  } satisfies RateLimitConfig,

  /**
   * ThingsBoard RPC commands - strict limit
   * 20 requests per minute, burst up to 3
   */
  THINGSBOARD_RPC: {
    maxTokens: 3,
    refillRate: 1,
    refillIntervalMs: 3000, // ~20/min
    queueWhenLimited: false, // Don't queue RPC commands
  } satisfies RateLimitConfig,

  /**
   * Dashboard metrics - low frequency
   * 10 requests per minute, burst up to 2
   */
  DASHBOARD_METRICS: {
    maxTokens: 2,
    refillRate: 1,
    refillIntervalMs: 6000, // ~10/min
    queueWhenLimited: true,
    maxQueueSize: 5,
  } satisfies RateLimitConfig,

  /**
   * Auth operations - strict limit
   * 10 requests per minute, burst up to 3
   */
  AUTH: {
    maxTokens: 3,
    refillRate: 1,
    refillIntervalMs: 6000,
    queueWhenLimited: false,
  } satisfies RateLimitConfig,

  /**
   * File uploads - very strict limit
   * 5 requests per minute, burst up to 2
   */
  FILE_UPLOAD: {
    maxTokens: 2,
    refillRate: 1,
    refillIntervalMs: 12000, // ~5/min
    queueWhenLimited: true,
    maxQueueSize: 5,
  } satisfies RateLimitConfig,
} as const;

/**
 * Environment-based configuration overrides
 */
function getEnvConfig(): Partial<Record<keyof typeof RATE_LIMIT_PRESETS, Partial<RateLimitConfig>>> {
  // Check if environment variables are available
  if (typeof import.meta === 'undefined' || !import.meta.env) {
    return {};
  }

  const overrides: Partial<Record<keyof typeof RATE_LIMIT_PRESETS, Partial<RateLimitConfig>>> = {};

  // Supabase overrides
  const supabaseReqPerMin = import.meta.env.VITE_RATE_LIMIT_SUPABASE_REQ_PER_MIN;
  if (supabaseReqPerMin) {
    const rate = parseInt(supabaseReqPerMin, 10);
    if (!isNaN(rate) && rate > 0) {
      overrides.SUPABASE_DB = {
        refillRate: Math.ceil(rate / 60),
        refillIntervalMs: 1000,
      };
      overrides.SUPABASE_EDGE = {
        refillRate: Math.ceil(rate / 60),
        refillIntervalMs: 1000,
      };
    }
  }

  // ThingsBoard overrides
  const tbReqPerMin = import.meta.env.VITE_RATE_LIMIT_THINGSBOARD_REQ_PER_MIN;
  if (tbReqPerMin) {
    const rate = parseInt(tbReqPerMin, 10);
    if (!isNaN(rate) && rate > 0) {
      overrides.THINGSBOARD_REST = {
        refillRate: Math.ceil(rate / 60),
        refillIntervalMs: 1000,
      };
      overrides.THINGSBOARD_TELEMETRY = {
        refillRate: Math.ceil(rate / 60),
        refillIntervalMs: 1000,
      };
    }
  }

  return overrides;
}

/**
 * Get rate limit configuration for a preset
 */
export function getRateLimitConfig(
  preset: keyof typeof RATE_LIMIT_PRESETS
): RateLimitConfig {
  const baseConfig = RATE_LIMIT_PRESETS[preset];
  const envOverrides = getEnvConfig()[preset] || {};

  return {
    ...baseConfig,
    ...envOverrides,
  };
}

/**
 * Check if rate limiting is enabled
 */
export function isRateLimitingEnabled(): boolean {
  if (typeof import.meta === 'undefined' || !import.meta.env) {
    return true; // Default to enabled
  }
  
  const enabled = import.meta.env.VITE_RATE_LIMIT_ENABLED;
  return enabled !== 'false' && enabled !== '0';
}

/**
 * Rate limiter instances (singleton per preset)
 */
const limiters = new Map<string, TokenBucketRateLimiter>();

/**
 * Get or create a rate limiter for a preset
 */
export function getRateLimiter(
  preset: keyof typeof RATE_LIMIT_PRESETS
): TokenBucketRateLimiter | null {
  // Return null if rate limiting is disabled
  if (!isRateLimitingEnabled()) {
    return null;
  }

  // Return existing limiter if available
  if (limiters.has(preset)) {
    return limiters.get(preset)!;
  }

  // Create new limiter
  const config = getRateLimitConfig(preset);
  const limiter = new TokenBucketRateLimiter(config);
  limiters.set(preset, limiter);

  return limiter;
}

/**
 * Get or create a custom rate limiter
 */
export function getCustomRateLimiter(
  key: string,
  config: RateLimitConfig
): TokenBucketRateLimiter | null {
  // Return null if rate limiting is disabled
  if (!isRateLimitingEnabled()) {
    return null;
  }

  const cacheKey = `custom:${key}`;

  // Return existing limiter if available
  if (limiters.has(cacheKey)) {
    return limiters.get(cacheKey)!;
  }

  // Create new limiter
  const limiter = new TokenBucketRateLimiter(config);
  limiters.set(cacheKey, limiter);

  return limiter;
}

/**
 * Reset all rate limiters
 */
export function resetAllRateLimiters(): void {
  for (const limiter of limiters.values()) {
    limiter.reset();
  }
}

/**
 * Destroy all rate limiters (cleanup)
 */
export function destroyAllRateLimiters(): void {
  for (const limiter of limiters.values()) {
    limiter.destroy();
  }
  limiters.clear();
}

/**
 * Get status of all rate limiters
 */
export function getAllRateLimiterStatuses(): Record<string, ReturnType<TokenBucketRateLimiter['getStatus']>> {
  const statuses: Record<string, ReturnType<TokenBucketRateLimiter['getStatus']>> = {};

  for (const [key, limiter] of limiters.entries()) {
    statuses[key] = limiter.getStatus();
  }

  return statuses;
}

