/**
 * Structured logging utility
 *
 * - debug/info: silenced in production builds (console.log / console.info)
 * - warn/error: always visible (operational issues the team should see)
 *
 * Usage:
 *   import { logger } from '@/shared/lib/logger';
 *   logger.debug('[Rooms]', 'Cache cleared');
 *   logger.error('[Rooms]', 'Insert failed:', error);
 */

export const logger = {
  debug: (...args: unknown[]): void => {
    if (import.meta.env.DEV) console.log(...args);
  },
  info: (...args: unknown[]): void => {
    if (import.meta.env.DEV) console.info(...args);
  },
  warn: (...args: unknown[]): void => {
    console.warn(...args);
  },
  error: (...args: unknown[]): void => {
    console.error(...args);
  },
};
