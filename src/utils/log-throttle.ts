/**
 * Throttle utility for console logs to prevent flooding
 */

import { logger } from '@/shared/lib/logger';

interface ThrottleState {
  lastLogTime: number;
  count: number;
}

const throttleState = new Map<string, ThrottleState>();

/**
 * Throttled console.info - only logs if enough time has passed since last log
 * @param key Unique key for this log (e.g., 'auth-session', 'games-history')
 * @param minIntervalMs Minimum milliseconds between logs
 * @param message Log message
 * @param data Log data
 */
export function throttledLog(
  key: string,
  minIntervalMs: number,
  message: string,
  data?: unknown
): void {
  const now = Date.now();
  const state = throttleState.get(key);
  
  if (!state || now - state.lastLogTime >= minIntervalMs) {
    logger.info(message, data);
    throttleState.set(key, {
      lastLogTime: now,
      count: (state?.count ?? 0) + 1,
    });
  } else {
    // Silently skip - log is throttled
    const newState = throttleState.get(key);
    if (newState) {
      newState.count += 1;
    }
  }
}

/**
 * Throttled console.info that only logs when data actually changes
 * @param key Unique key for this log
 * @param minIntervalMs Minimum milliseconds between logs
 * @param message Log message
 * @param data Log data (will be compared with previous)
 */
const lastDataCache = new Map<string, unknown>();
const lastDataHashCache = new Map<string, string>();

// Simple hash function for quick comparison (faster than JSON.stringify)
function quickHash(obj: unknown): string {
  if (obj === null || obj === undefined) return String(obj);
  if (typeof obj === 'string') return obj;
  if (typeof obj === 'number' || typeof obj === 'boolean') return String(obj);
  
  // For objects/arrays, use a lightweight hash based on keys and length
  if (typeof obj === 'object') {
    if (Array.isArray(obj)) {
      return `[${obj.length}]${obj.slice(0, 3).map(v => quickHash(v)).join(',')}`;
    }
    const keys = Object.keys(obj).sort();
    const sample = keys.slice(0, 5).map(k => `${k}:${quickHash((obj as Record<string, unknown>)[k])}`).join(',');
    return `{${keys.length}:${sample}}`;
  }
  return String(obj);
}

export function throttledLogOnChange(
  key: string,
  minIntervalMs: number,
  message: string,
  data: unknown
): void {
  const now = Date.now();
  const state = throttleState.get(key);
  const lastHash = lastDataHashCache.get(key);
  
  // Use lightweight hash comparison instead of expensive JSON.stringify
  const currentHash = quickHash(data);
  const dataChanged = currentHash !== lastHash;
  const timePassed = !state || now - state.lastLogTime >= minIntervalMs;
  
  if (dataChanged || timePassed) {
    logger.info(message, data);
    throttleState.set(key, {
      lastLogTime: now,
      count: (state?.count ?? 0) + 1,
    });
    // Store lightweight hash instead of full deep clone
    lastDataHashCache.set(key, currentHash);
    // Only store a lightweight reference, not full deep clone
    lastDataCache.set(key, data);
  }
}

/**
 * Clear throttle state (useful for testing)
 */
export function clearThrottleState(): void {
  throttleState.clear();
  lastDataCache.clear();
}

