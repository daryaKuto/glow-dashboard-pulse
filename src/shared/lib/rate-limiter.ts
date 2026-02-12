/**
 * Rate Limiter
 * 
 * Token bucket implementation for rate limiting API calls.
 * Prevents overwhelming Supabase and ThingsBoard APIs.
 */

/**
 * Rate limit configuration
 */
export interface RateLimitConfig {
  /** Maximum number of tokens (requests) in the bucket */
  maxTokens: number;
  /** Tokens (requests) refilled per interval */
  refillRate: number;
  /** Refill interval in milliseconds */
  refillIntervalMs: number;
  /** Whether to queue requests when rate limited (vs reject) */
  queueWhenLimited?: boolean;
  /** Maximum queue size (if queueing enabled) */
  maxQueueSize?: number;
}

/**
 * Rate limit status
 */
export interface RateLimitStatus {
  /** Current number of available tokens */
  availableTokens: number;
  /** Whether rate limit is currently exceeded */
  isLimited: boolean;
  /** Time until next token available (ms) */
  timeUntilNextToken: number;
  /** Number of requests in queue */
  queuedRequests: number;
}

/**
 * Queued request
 */
interface QueuedRequest {
  resolve: () => void;
  reject: (error: Error) => void;
  addedAt: number;
}

/**
 * Token Bucket Rate Limiter
 * 
 * Allows bursts up to maxTokens, then smoothly rate limits.
 * Tokens are refilled at a constant rate.
 */
export class TokenBucketRateLimiter {
  private tokens: number;
  private lastRefill: number;
  private queue: QueuedRequest[] = [];
  private refillTimer: ReturnType<typeof setInterval> | null = null;
  private readonly config: Required<RateLimitConfig>;

  constructor(config: RateLimitConfig) {
    this.config = {
      queueWhenLimited: false,
      maxQueueSize: 100,
      ...config,
    };
    this.tokens = this.config.maxTokens;
    this.lastRefill = Date.now();
    
    // Start refill timer
    this.startRefillTimer();
  }

  /**
   * Attempt to acquire a token (make a request)
   * Returns true if allowed, false if rate limited
   */
  tryAcquire(): boolean {
    this.refillTokens();
    
    if (this.tokens >= 1) {
      this.tokens -= 1;
      return true;
    }
    
    return false;
  }

  /**
   * Acquire a token, waiting if necessary
   * Resolves when token is acquired, rejects if queue is full
   */
  async acquire(): Promise<void> {
    this.refillTokens();
    
    // If tokens available, consume immediately
    if (this.tokens >= 1) {
      this.tokens -= 1;
      return;
    }
    
    // If queueing disabled, reject immediately
    if (!this.config.queueWhenLimited) {
      throw new RateLimitError(
        'Rate limit exceeded',
        this.getTimeUntilNextToken()
      );
    }
    
    // Check queue size
    if (this.queue.length >= this.config.maxQueueSize) {
      throw new RateLimitError(
        'Rate limit queue full',
        this.getTimeUntilNextToken()
      );
    }
    
    // Add to queue and wait
    return new Promise((resolve, reject) => {
      this.queue.push({
        resolve,
        reject,
        addedAt: Date.now(),
      });
    });
  }

  /**
   * Get current rate limit status
   */
  getStatus(): RateLimitStatus {
    this.refillTokens();
    
    return {
      availableTokens: Math.floor(this.tokens),
      isLimited: this.tokens < 1,
      timeUntilNextToken: this.getTimeUntilNextToken(),
      queuedRequests: this.queue.length,
    };
  }

  /**
   * Reset the rate limiter (refill all tokens)
   */
  reset(): void {
    this.tokens = this.config.maxTokens;
    this.lastRefill = Date.now();
  }

  /**
   * Destroy the rate limiter (cleanup timers)
   */
  destroy(): void {
    if (this.refillTimer) {
      clearInterval(this.refillTimer);
      this.refillTimer = null;
    }
    
    // Reject all queued requests
    for (const request of this.queue) {
      request.reject(new Error('Rate limiter destroyed'));
    }
    this.queue = [];
  }

  /**
   * Refill tokens based on elapsed time
   */
  private refillTokens(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    const intervalsElapsed = Math.floor(elapsed / this.config.refillIntervalMs);
    
    if (intervalsElapsed > 0) {
      const tokensToAdd = intervalsElapsed * this.config.refillRate;
      this.tokens = Math.min(this.config.maxTokens, this.tokens + tokensToAdd);
      this.lastRefill = now - (elapsed % this.config.refillIntervalMs);
      
      // Process queued requests
      this.processQueue();
    }
  }

  /**
   * Process queued requests if tokens available
   */
  private processQueue(): void {
    while (this.queue.length > 0 && this.tokens >= 1) {
      const request = this.queue.shift();
      if (request) {
        this.tokens -= 1;
        request.resolve();
      }
    }
  }

  /**
   * Get time until next token is available
   */
  private getTimeUntilNextToken(): number {
    if (this.tokens >= 1) {
      return 0;
    }
    
    const tokensNeeded = 1 - this.tokens;
    const intervalsNeeded = Math.ceil(tokensNeeded / this.config.refillRate);
    const elapsed = Date.now() - this.lastRefill;
    const timeUntilNextInterval = this.config.refillIntervalMs - (elapsed % this.config.refillIntervalMs);
    
    return timeUntilNextInterval + (intervalsNeeded - 1) * this.config.refillIntervalMs;
  }

  /**
   * Start the refill timer
   */
  private startRefillTimer(): void {
    this.refillTimer = setInterval(() => {
      this.refillTokens();
    }, this.config.refillIntervalMs);
  }
}

/**
 * Rate limit error
 */
export class RateLimitError extends Error {
  readonly retryAfterMs: number;
  readonly code = 'RATE_LIMIT_EXCEEDED';

  constructor(message: string, retryAfterMs: number) {
    super(message);
    this.name = 'RateLimitError';
    this.retryAfterMs = retryAfterMs;
  }
}

/**
 * Create a rate-limited wrapper function
 */
export function withRateLimit<T extends (...args: unknown[]) => Promise<unknown>>(
  fn: T,
  limiter: TokenBucketRateLimiter
): T {
  return (async (...args: Parameters<T>) => {
    await limiter.acquire();
    return fn(...args);
  }) as T;
}

/**
 * Exponential backoff helper for retry logic
 */
export function calculateBackoff(
  attempt: number,
  baseDelayMs: number = 1000,
  maxDelayMs: number = 30000
): number {
  const delay = Math.min(baseDelayMs * Math.pow(2, attempt), maxDelayMs);
  // Add jitter (±25%)
  const jitter = delay * 0.25 * (Math.random() * 2 - 1);
  return Math.round(delay + jitter);
}

/**
 * Retry with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: {
    maxAttempts?: number;
    baseDelayMs?: number;
    maxDelayMs?: number;
    shouldRetry?: (error: unknown) => boolean;
  } = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    baseDelayMs = 1000,
    maxDelayMs = 30000,
    shouldRetry = () => true,
  } = options;

  let lastError: unknown;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Check if we should retry
      if (!shouldRetry(error) || attempt >= maxAttempts - 1) {
        throw error;
      }

      // Wait before retrying
      const delay = calculateBackoff(attempt, baseDelayMs, maxDelayMs);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}



