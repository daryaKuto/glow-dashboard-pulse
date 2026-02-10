/**
 * Targets Domain Ports
 *
 * Repository interfaces for data access.
 * Pure types - no React or Supabase imports.
 */

import type { ApiResponse } from '@/shared/lib/api-response';

/**
 * Target status type
 */
export type TargetStatus = 'online' | 'standby' | 'offline';

/**
 * Activity status type
 */
export type ActivityStatus = 'active' | 'recent' | 'standby';

/**
 * Target record from data layer
 */
export type TargetRecord = {
  id: string;
  name: string;
  status: TargetStatus;
  battery: number | null;
  wifiStrength: number | null;
  roomId: string | null;
  roomName?: string;
  telemetry: Record<string, unknown>;
  lastEvent: string | null;
  lastGameId: string | null;
  lastGameName: string | null;
  lastHits: number | null;
  lastActivity: string | null;
  lastActivityTime: number | null;
  deviceName: string;
  deviceType: string;
  createdTime: number | null;
  additionalInfo: Record<string, unknown>;
  type?: string;
  activityStatus?: ActivityStatus;
  lastShotTime?: number | null;
  totalShots?: number | null;
  recentShotsCount?: number;
  telemetryHistory?: Record<string, unknown>;
  gameStatus?: string | null;
  errors?: string[];
  isNoDataMessage?: boolean;
  isErrorMessage?: boolean;
  message?: string;
};

/**
 * Target detail record
 */
export type TargetDetailRecord = {
  deviceId: string;
  status: TargetStatus;
  activityStatus: ActivityStatus;
  lastShotTime: number | null;
  totalShots: number;
  recentShotsCount: number;
  telemetry: Record<string, unknown>;
  history?: Record<string, unknown>;
  battery?: number | null;
  wifiStrength?: number | null;
  lastEvent?: string | null;
  gameStatus?: string | null;
  errors?: string[];
};

/**
 * Targets summary
 */
export type TargetsSummaryRecord = {
  totalTargets: number;
  onlineTargets: number;
  standbyTargets: number;
  offlineTargets: number;
  assignedTargets: number;
  unassignedTargets: number;
  totalRooms: number;
  lastUpdated: number;
};

/**
 * Targets with summary response
 */
export type TargetsWithSummary = {
  targets: TargetRecord[];
  summary: TargetsSummaryRecord | null;
  cached: boolean;
};

/**
 * Target details options
 */
export type TargetDetailsOptions = {
  force?: boolean;
  includeHistory?: boolean;
  historyRangeMs?: number;
  historyLimit?: number;
  telemetryKeys?: string[];
  historyKeys?: string[];
  recentWindowMs?: number;
};

/**
 * Target Repository Interface
 * 
 * Defines the contract for target data access.
 */
export interface TargetRepository {
  /**
   * Get all targets with telemetry
   */
  getTargets(force?: boolean): Promise<ApiResponse<TargetsWithSummary>>;

  /**
   * Get target details for specific devices
   */
  getTargetDetails(
    deviceIds: string[],
    options?: TargetDetailsOptions
  ): Promise<ApiResponse<TargetDetailRecord[]>>;

  /**
   * Get targets summary only
   */
  getTargetsSummary(force?: boolean): Promise<ApiResponse<TargetsSummaryRecord | null>>;

  /**
   * Send RPC command to devices
   */
  sendDeviceCommand(
    deviceIds: string[],
    method: string,
    params?: Record<string, unknown>
  ): Promise<ApiResponse<void>>;

  /**
   * Set device attributes
   */
  setDeviceAttributes(
    deviceIds: string[],
    attributes: Record<string, unknown>
  ): Promise<ApiResponse<void>>;

  /**
   * Get all target custom names for the current user
   */
  getTargetCustomNames(): Promise<ApiResponse<Map<string, string>>>;

  /**
   * Set a custom name for a target
   */
  setTargetCustomName(
    targetId: string,
    originalName: string,
    customName: string
  ): Promise<ApiResponse<void>>;

  /**
   * Remove a custom name for a target
   */
  removeTargetCustomName(targetId: string): Promise<ApiResponse<void>>;
}

