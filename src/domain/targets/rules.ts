/**
 * Targets Domain Business Rules
 *
 * Business rules and invariants for target operations.
 * Pure functions - no React or Supabase imports.
 */

import type { TargetStatus, ActivityStatus } from './validators';

/**
 * Target domain model (internal representation)
 * Used by rules functions for type-safe business logic
 */
export type TargetDomainModel = {
  id: string;
  name: string;
  customName: string | null;
  status: TargetStatus;
  activityStatus: ActivityStatus;
  battery: number | null;
  wifiStrength: number | null;
  roomId: string | null;
  lastShotTime: number | null;
  lastActivityTime: number | null;
  totalShots: number | null;
  recentShotsCount: number;
  lastEvent: string | null;
  gameStatus: string | null;
  errors: string[];
};

/**
 * Target detail domain model
 */
export type TargetDetailDomainModel = {
  deviceId: string;
  status: TargetStatus;
  activityStatus: ActivityStatus;
  lastShotTime: number | null;
  totalShots: number;
  recentShotsCount: number;
  telemetry: Record<string, unknown>;
  history: Record<string, unknown>;
  battery: number | null;
  wifiStrength: number | null;
  lastEvent: string | null;
  gameStatus: string | null;
  errors: string[];
};

/**
 * Target business rule result
 */
export type RuleResult = 
  | { valid: true }
  | { valid: false; violation: string; code: string };

/**
 * Telemetry freshness thresholds (in milliseconds)
 */
export const TELEMETRY_THRESHOLDS = {
  ACTIVE_WINDOW: 5 * 60 * 1000, // 5 minutes - considered active
  RECENT_WINDOW: 30 * 60 * 1000, // 30 minutes - considered recent
  STALE_WINDOW: 60 * 60 * 1000, // 1 hour - considered stale
  OFFLINE_THRESHOLD: 2 * 60 * 60 * 1000, // 2 hours - considered offline
} as const;

/**
 * Battery level thresholds
 */
export const BATTERY_THRESHOLDS = {
  CRITICAL: 10,
  LOW: 25,
  MEDIUM: 50,
  HIGH: 75,
} as const;

/**
 * WiFi signal strength thresholds (in dBm, typical range -30 to -90)
 */
export const WIFI_THRESHOLDS = {
  EXCELLENT: -50,
  GOOD: -60,
  FAIR: -70,
  POOR: -80,
} as const;

/**
 * Determine target status based on last activity time
 */
export function determineTargetStatus(lastActivityTime: number | null): TargetStatus {
  if (lastActivityTime === null) {
    return 'offline';
  }
  
  const now = Date.now();
  const timeSinceActivity = now - lastActivityTime;
  
  if (timeSinceActivity <= TELEMETRY_THRESHOLDS.STALE_WINDOW) {
    return 'online';
  }
  
  if (timeSinceActivity <= TELEMETRY_THRESHOLDS.OFFLINE_THRESHOLD) {
    return 'standby';
  }
  
  return 'offline';
}

/**
 * Determine activity status based on last shot time
 */
export function determineActivityStatus(lastShotTime: number | null): ActivityStatus {
  if (lastShotTime === null) {
    return 'standby';
  }
  
  const now = Date.now();
  const timeSinceShot = now - lastShotTime;
  
  if (timeSinceShot <= TELEMETRY_THRESHOLDS.ACTIVE_WINDOW) {
    return 'active';
  }
  
  if (timeSinceShot <= TELEMETRY_THRESHOLDS.RECENT_WINDOW) {
    return 'recent';
  }
  
  return 'standby';
}

/**
 * Get battery level category
 */
export function getBatteryLevel(percentage: number | null): 'critical' | 'low' | 'medium' | 'high' | 'full' | 'unknown' {
  if (percentage === null) {
    return 'unknown';
  }
  
  if (percentage <= BATTERY_THRESHOLDS.CRITICAL) {
    return 'critical';
  }
  
  if (percentage <= BATTERY_THRESHOLDS.LOW) {
    return 'low';
  }
  
  if (percentage <= BATTERY_THRESHOLDS.MEDIUM) {
    return 'medium';
  }
  
  if (percentage <= BATTERY_THRESHOLDS.HIGH) {
    return 'high';
  }
  
  return 'full';
}

/**
 * Get WiFi signal quality
 */
export function getWifiQuality(signalStrength: number | null): 'excellent' | 'good' | 'fair' | 'poor' | 'weak' | 'unknown' {
  if (signalStrength === null) {
    return 'unknown';
  }
  
  if (signalStrength >= WIFI_THRESHOLDS.EXCELLENT) {
    return 'excellent';
  }
  
  if (signalStrength >= WIFI_THRESHOLDS.GOOD) {
    return 'good';
  }
  
  if (signalStrength >= WIFI_THRESHOLDS.FAIR) {
    return 'fair';
  }
  
  if (signalStrength >= WIFI_THRESHOLDS.POOR) {
    return 'poor';
  }
  
  return 'weak';
}

/**
 * Check if target needs attention (low battery, poor connection, errors)
 */
export function targetNeedsAttention(target: TargetDomainModel): RuleResult {
  // Check for errors
  if (target.errors && target.errors.length > 0) {
    return {
      valid: false,
      violation: `Target has ${target.errors.length} error(s)`,
      code: 'HAS_ERRORS',
    };
  }
  
  // Check battery
  const batteryLevel = getBatteryLevel(target.battery);
  if (batteryLevel === 'critical' || batteryLevel === 'low') {
    return {
      valid: false,
      violation: `Battery is ${batteryLevel} (${target.battery}%)`,
      code: 'LOW_BATTERY',
    };
  }
  
  // Check WiFi
  const wifiQuality = getWifiQuality(target.wifiStrength);
  if (wifiQuality === 'poor' || wifiQuality === 'weak') {
    return {
      valid: false,
      violation: `WiFi signal is ${wifiQuality}`,
      code: 'POOR_WIFI',
    };
  }
  
  // Check offline status
  if (target.status === 'offline') {
    return {
      valid: false,
      violation: 'Target is offline',
      code: 'OFFLINE',
    };
  }
  
  return { valid: true };
}

/**
 * Check if target is ready for a game session
 */
export function isTargetReadyForGame(target: TargetDomainModel): RuleResult {
  // Must be online
  if (target.status !== 'online') {
    return {
      valid: false,
      violation: `Target is ${target.status}, must be online to start a game`,
      code: 'NOT_ONLINE',
    };
  }
  
  // Check battery (must be at least low, not critical)
  const batteryLevel = getBatteryLevel(target.battery);
  if (batteryLevel === 'critical') {
    return {
      valid: false,
      violation: 'Battery is critically low',
      code: 'CRITICAL_BATTERY',
    };
  }
  
  // Check for blocking errors
  if (target.errors && target.errors.length > 0) {
    const blockingErrors = target.errors.filter(isBlockingError);
    if (blockingErrors.length > 0) {
      return {
        valid: false,
        violation: `Target has blocking errors: ${blockingErrors.join(', ')}`,
        code: 'BLOCKING_ERRORS',
      };
    }
  }
  
  // Check if already in a game
  if (target.gameStatus && target.gameStatus !== 'idle' && target.gameStatus !== 'stopped') {
    return {
      valid: false,
      violation: `Target is already in game state: ${target.gameStatus}`,
      code: 'ALREADY_IN_GAME',
    };
  }
  
  return { valid: true };
}

/**
 * Check if an error is blocking (prevents game participation)
 */
function isBlockingError(error: string): boolean {
  const blockingPatterns = [
    'hardware',
    'sensor',
    'calibration',
    'fatal',
    'critical',
  ];
  
  const lowerError = error.toLowerCase();
  return blockingPatterns.some((pattern) => lowerError.includes(pattern));
}

/**
 * Calculate target health score (0-100)
 */
export function calculateTargetHealthScore(target: TargetDomainModel): number {
  let score = 100;
  
  // Status penalty
  if (target.status === 'offline') {
    score -= 50;
  } else if (target.status === 'standby') {
    score -= 20;
  }
  
  // Battery penalty
  const batteryLevel = getBatteryLevel(target.battery);
  switch (batteryLevel) {
    case 'critical':
      score -= 30;
      break;
    case 'low':
      score -= 15;
      break;
    case 'medium':
      score -= 5;
      break;
    case 'unknown':
      score -= 10;
      break;
  }
  
  // WiFi penalty
  const wifiQuality = getWifiQuality(target.wifiStrength);
  switch (wifiQuality) {
    case 'weak':
      score -= 20;
      break;
    case 'poor':
      score -= 10;
      break;
    case 'fair':
      score -= 5;
      break;
    case 'unknown':
      score -= 5;
      break;
  }
  
  // Error penalty
  if (target.errors && target.errors.length > 0) {
    score -= Math.min(target.errors.length * 10, 30);
  }
  
  return Math.max(0, score);
}

/**
 * Sort targets by priority (for display)
 */
export function sortTargetsByPriority(targets: TargetDomainModel[]): TargetDomainModel[] {
  return [...targets].sort((a, b) => {
    // Online targets first
    const statusOrder: Record<TargetStatus, number> = { online: 0, standby: 1, offline: 2 };
    const statusDiff = statusOrder[a.status] - statusOrder[b.status];
    if (statusDiff !== 0) return statusDiff;
    
    // Active targets first
    const activityOrder: Record<ActivityStatus, number> = { active: 0, recent: 1, standby: 2 };
    const activityDiff = activityOrder[a.activityStatus] - activityOrder[b.activityStatus];
    if (activityDiff !== 0) return activityDiff;
    
    // Then by name
    return a.name.localeCompare(b.name);
  });
}

/**
 * Filter targets by status
 */
export function filterTargetsByStatus(
  targets: TargetDomainModel[],
  status: TargetStatus | TargetStatus[]
): TargetDomainModel[] {
  const statusArray = Array.isArray(status) ? status : [status];
  return targets.filter((target) => statusArray.includes(target.status));
}

/**
 * Get targets that need attention
 */
export function getTargetsNeedingAttention(targets: TargetDomainModel[]): TargetDomainModel[] {
  return targets.filter((target) => {
    const result = targetNeedsAttention(target);
    return !result.valid;
  });
}



