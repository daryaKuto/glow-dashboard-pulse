/**
 * Shared Library
 * 
 * Common utilities and infrastructure used across the application.
 */

// API Response utilities
export {
  apiOk,
  apiErr,
  isApiOk,
  isApiErr,
  type ApiResponse,
  type ApiOk,
  type ApiErr,
} from './api-response';

// Rate limiting
export {
  TokenBucketRateLimiter,
  RateLimitError,
  withRateLimit,
  calculateBackoff,
  retryWithBackoff,
  type RateLimitConfig,
  type RateLimitStatus,
} from './rate-limiter';

export {
  RATE_LIMIT_PRESETS,
  getRateLimitConfig,
  isRateLimitingEnabled,
  getRateLimiter,
  getCustomRateLimiter,
  resetAllRateLimiters,
  destroyAllRateLimiters,
  getAllRateLimiterStatuses,
} from './rate-limit-config';

export {
  RateLimitMonitor,
  useRateLimitMonitor,
  createRateLimitMiddleware,
  type RateLimitEvent,
  type RateLimitEventType,
  type RateLimitStats,
} from './rate-limit-monitor';

// Error boundary
export { ErrorBoundary } from './error-boundary';

