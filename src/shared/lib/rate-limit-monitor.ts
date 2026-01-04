/**
 * Rate Limit Monitor
 * 
 * Tracks rate limit hits and provides monitoring/logging capabilities.
 */

import { getAllRateLimiterStatuses } from './rate-limit-config';

/**
 * Rate limit event types
 */
export type RateLimitEventType = 
  | 'rate_limit_hit'
  | 'rate_limit_warning'
  | 'rate_limit_recovered'
  | 'request_queued'
  | 'request_completed';

/**
 * Rate limit event
 */
export interface RateLimitEvent {
  type: RateLimitEventType;
  limiterKey: string;
  timestamp: number;
  availableTokens: number;
  queuedRequests: number;
  message?: string;
}

/**
 * Rate limit statistics
 */
export interface RateLimitStats {
  totalHits: number;
  totalWarnings: number;
  totalQueued: number;
  hitsByLimiter: Record<string, number>;
  lastHitTime: number | null;
  averageWaitTime: number;
}

/**
 * Event listener type
 */
type RateLimitEventListener = (event: RateLimitEvent) => void;

/**
 * Rate Limit Monitor
 * 
 * Provides centralized monitoring and logging for rate limiting.
 */
class RateLimitMonitorImpl {
  private events: RateLimitEvent[] = [];
  private listeners: Set<RateLimitEventListener> = new Set();
  private stats: RateLimitStats = {
    totalHits: 0,
    totalWarnings: 0,
    totalQueued: 0,
    hitsByLimiter: {},
    lastHitTime: null,
    averageWaitTime: 0,
  };
  private waitTimes: number[] = [];
  private readonly maxEvents = 1000;
  private readonly maxWaitTimes = 100;
  private warningThreshold = 0.2; // Warn when tokens below 20%

  /**
   * Record a rate limit event
   */
  recordEvent(event: Omit<RateLimitEvent, 'timestamp'>): void {
    const fullEvent: RateLimitEvent = {
      ...event,
      timestamp: Date.now(),
    };

    // Add to events (with limit)
    this.events.push(fullEvent);
    if (this.events.length > this.maxEvents) {
      this.events.shift();
    }

    // Update stats
    this.updateStats(fullEvent);

    // Notify listeners
    this.notifyListeners(fullEvent);

    // Log to console in development
    this.logEvent(fullEvent);
  }

  /**
   * Record a rate limit hit
   */
  recordHit(limiterKey: string, availableTokens: number, queuedRequests: number): void {
    this.recordEvent({
      type: 'rate_limit_hit',
      limiterKey,
      availableTokens,
      queuedRequests,
      message: `Rate limit exceeded for ${limiterKey}`,
    });
  }

  /**
   * Record a warning (approaching limit)
   */
  recordWarning(limiterKey: string, availableTokens: number, maxTokens: number): void {
    const percentRemaining = availableTokens / maxTokens;
    if (percentRemaining <= this.warningThreshold) {
      this.recordEvent({
        type: 'rate_limit_warning',
        limiterKey,
        availableTokens,
        queuedRequests: 0,
        message: `Rate limit warning: ${limiterKey} at ${Math.round(percentRemaining * 100)}% capacity`,
      });
    }
  }

  /**
   * Record wait time for queued request
   */
  recordWaitTime(waitTimeMs: number): void {
    this.waitTimes.push(waitTimeMs);
    if (this.waitTimes.length > this.maxWaitTimes) {
      this.waitTimes.shift();
    }

    // Update average
    this.stats.averageWaitTime = 
      this.waitTimes.reduce((sum, t) => sum + t, 0) / this.waitTimes.length;
  }

  /**
   * Get current statistics
   */
  getStats(): RateLimitStats {
    return { ...this.stats };
  }

  /**
   * Get recent events
   */
  getRecentEvents(limit = 100): RateLimitEvent[] {
    return this.events.slice(-limit);
  }

  /**
   * Get current status of all limiters
   */
  getCurrentStatus(): ReturnType<typeof getAllRateLimiterStatuses> {
    return getAllRateLimiterStatuses();
  }

  /**
   * Add event listener
   */
  addListener(listener: RateLimitEventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Remove event listener
   */
  removeListener(listener: RateLimitEventListener): void {
    this.listeners.delete(listener);
  }

  /**
   * Clear all data
   */
  clear(): void {
    this.events = [];
    this.waitTimes = [];
    this.stats = {
      totalHits: 0,
      totalWarnings: 0,
      totalQueued: 0,
      hitsByLimiter: {},
      lastHitTime: null,
      averageWaitTime: 0,
    };
  }

  /**
   * Set warning threshold (0-1)
   */
  setWarningThreshold(threshold: number): void {
    this.warningThreshold = Math.max(0, Math.min(1, threshold));
  }

  /**
   * Update statistics based on event
   */
  private updateStats(event: RateLimitEvent): void {
    switch (event.type) {
      case 'rate_limit_hit':
        this.stats.totalHits++;
        this.stats.lastHitTime = event.timestamp;
        this.stats.hitsByLimiter[event.limiterKey] = 
          (this.stats.hitsByLimiter[event.limiterKey] || 0) + 1;
        break;
      case 'rate_limit_warning':
        this.stats.totalWarnings++;
        break;
      case 'request_queued':
        this.stats.totalQueued++;
        break;
    }
  }

  /**
   * Notify all listeners
   */
  private notifyListeners(event: RateLimitEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (error) {
        console.error('[RateLimitMonitor] Listener error:', error);
      }
    }
  }

  /**
   * Log event to console (development only)
   */
  private logEvent(event: RateLimitEvent): void {
    if (typeof import.meta !== 'undefined' && import.meta.env?.DEV) {
      const prefix = '[RateLimitMonitor]';
      
      switch (event.type) {
        case 'rate_limit_hit':
          console.warn(`${prefix} 🚫 ${event.message}`);
          break;
        case 'rate_limit_warning':
          console.warn(`${prefix} ⚠️ ${event.message}`);
          break;
        case 'rate_limit_recovered':
          console.info(`${prefix} ✅ ${event.message}`);
          break;
        default:
          console.debug(`${prefix} ${event.type}: ${event.message}`);
      }
    }
  }
}

/**
 * Singleton instance
 */
export const RateLimitMonitor = new RateLimitMonitorImpl();

/**
 * Hook for React components to subscribe to rate limit events
 */
export function useRateLimitMonitor(
  onEvent?: RateLimitEventListener
): {
  stats: RateLimitStats;
  recentEvents: RateLimitEvent[];
  currentStatus: ReturnType<typeof getAllRateLimiterStatuses>;
} {
  // This is a simplified version - in a real implementation,
  // you'd use React state and effects to subscribe to changes
  return {
    stats: RateLimitMonitor.getStats(),
    recentEvents: RateLimitMonitor.getRecentEvents(10),
    currentStatus: RateLimitMonitor.getCurrentStatus(),
  };
}

/**
 * Middleware to track rate limit events
 */
export function createRateLimitMiddleware(limiterKey: string) {
  return {
    onRequest: () => {
      const status = getAllRateLimiterStatuses()[limiterKey];
      if (status) {
        // Check for warning threshold
        RateLimitMonitor.recordWarning(
          limiterKey,
          status.availableTokens,
          status.availableTokens + (status.isLimited ? 1 : 0) // Approximate max
        );
      }
    },
    onRateLimited: (availableTokens: number, queuedRequests: number) => {
      RateLimitMonitor.recordHit(limiterKey, availableTokens, queuedRequests);
    },
    onQueued: () => {
      RateLimitMonitor.recordEvent({
        type: 'request_queued',
        limiterKey,
        availableTokens: 0,
        queuedRequests: 1,
        message: `Request queued for ${limiterKey}`,
      });
    },
    onCompleted: (waitTimeMs?: number) => {
      if (waitTimeMs !== undefined && waitTimeMs > 0) {
        RateLimitMonitor.recordWaitTime(waitTimeMs);
      }
      RateLimitMonitor.recordEvent({
        type: 'request_completed',
        limiterKey,
        availableTokens: 1,
        queuedRequests: 0,
      });
    },
  };
}

