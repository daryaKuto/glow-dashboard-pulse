/**
 * @deprecated LEGACY CODE - Moved to _legacy on 2026-01-05
 * 
 * REASON: This file was never imported or used anywhere in the codebase.
 * The targets feature uses validators from @/domain/targets/validators but
 * these mappers were speculative/scaffolded and never wired into the service layer.
 * 
 * REPLACEMENT: None - the feature works without these mappers.
 * The targets repo (src/features/targets/repo.ts) and edge functions handle
 * data transformation.
 * 
 * ORIGINAL LOCATION: src/domain/targets/mappers.ts
 * 
 * POTENTIAL FUTURE USE: If strict domain-driven design is adopted, these mappers
 * could be wired into the targets service to separate concerns.
 */

import type { TargetStatus, ActivityStatus } from '../../domain/targets/validators';

/**
 * Target domain model (internal representation)
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
 * Target summary domain model
 */
export type TargetsSummaryDomainModel = {
  totalTargets: number;
  onlineTargets: number;
  offlineTargets: number;
  assignedTargets: number;
  unassignedTargets: number;
  totalRooms: number;
  lastUpdated: Date;
};

/**
 * Edge function target response
 */
export type EdgeTargetResponse = {
  id: string;
  name: string;
  customName?: string | null;
  status: string;
  battery?: number | null;
  wifiStrength?: number | null;
  roomId?: string | number | null;
  telemetry?: Record<string, unknown>;
  lastEvent?: string | null;
  lastShotTime?: number | null;
  lastActivityTime?: number | null;
  totalShots?: number | null;
  recentShotsCount?: number;
  activityStatus?: string;
  gameStatus?: string | null;
  errors?: string[];
};

/**
 * Edge function target detail response
 */
export type EdgeTargetDetailResponse = {
  deviceId: string;
  status: string;
  activityStatus?: string;
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
 * Map edge response to domain model
 */
export function mapEdgeTargetToDomain(response: EdgeTargetResponse): TargetDomainModel {
  return {
    id: response.id,
    name: response.name,
    customName: response.customName ?? null,
    status: normalizeStatus(response.status),
    activityStatus: normalizeActivityStatus(response.activityStatus),
    battery: response.battery ?? null,
    wifiStrength: response.wifiStrength ?? null,
    roomId: normalizeRoomId(response.roomId),
    lastShotTime: response.lastShotTime ?? null,
    lastActivityTime: response.lastActivityTime ?? null,
    totalShots: response.totalShots ?? null,
    recentShotsCount: response.recentShotsCount ?? 0,
    lastEvent: response.lastEvent ?? null,
    gameStatus: response.gameStatus ?? null,
    errors: response.errors ?? [],
  };
}

/**
 * Map edge target detail to domain model
 */
export function mapEdgeTargetDetailToDomain(response: EdgeTargetDetailResponse): TargetDetailDomainModel {
  return {
    deviceId: response.deviceId,
    status: normalizeStatus(response.status),
    activityStatus: normalizeActivityStatus(response.activityStatus),
    lastShotTime: response.lastShotTime,
    totalShots: response.totalShots,
    recentShotsCount: response.recentShotsCount,
    telemetry: response.telemetry ?? {},
    history: response.history ?? {},
    battery: response.battery ?? null,
    wifiStrength: response.wifiStrength ?? null,
    lastEvent: response.lastEvent ?? null,
    gameStatus: response.gameStatus ?? null,
    errors: response.errors ?? [],
  };
}

/**
 * Merge target details into base targets
 * This is a pure function that combines base target data with detailed telemetry
 */
export function mergeTargetWithDetails(
  target: TargetDomainModel,
  detail: TargetDetailDomainModel | undefined
): TargetDomainModel {
  if (!detail) {
    return target;
  }

  return {
    ...target,
    status: detail.status,
    activityStatus: detail.activityStatus,
    lastShotTime: detail.lastShotTime ?? target.lastShotTime,
    totalShots: detail.totalShots ?? target.totalShots,
    recentShotsCount: detail.recentShotsCount ?? target.recentShotsCount,
    battery: detail.battery ?? target.battery,
    wifiStrength: detail.wifiStrength ?? target.wifiStrength,
    lastEvent: detail.lastEvent ?? target.lastEvent,
    gameStatus: detail.gameStatus ?? target.gameStatus,
    errors: detail.errors.length > 0 ? detail.errors : target.errors,
  };
}

/**
 * Merge multiple targets with their details
 */
export function mergeTargetsWithDetails(
  targets: TargetDomainModel[],
  details: TargetDetailDomainModel[]
): TargetDomainModel[] {
  const detailMap = new Map(details.map((detail) => [detail.deviceId, detail]));

  return targets.map((target) => {
    const detail = detailMap.get(target.id);
    return mergeTargetWithDetails(target, detail);
  });
}

/**
 * Create target display name (custom name or default name)
 */
export function getTargetDisplayName(target: TargetDomainModel): string {
  return target.customName?.trim() || target.name;
}

/**
 * Create target status display string
 */
export function getTargetStatusDisplay(target: TargetDomainModel): string {
  const statusMap: Record<TargetStatus, string> = {
    online: 'Online',
    offline: 'Offline',
    standby: 'Standby',
  };
  return statusMap[target.status];
}

/**
 * Create target activity display string
 */
export function getTargetActivityDisplay(target: TargetDomainModel): string {
  const activityMap: Record<ActivityStatus, string> = {
    active: 'Active',
    recent: 'Recent Activity',
    standby: 'Standby',
  };
  return activityMap[target.activityStatus];
}

/**
 * Normalize status string to TargetStatus enum
 */
function normalizeStatus(status: string | undefined): TargetStatus {
  const normalized = status?.toLowerCase();
  if (normalized === 'online' || normalized === 'offline' || normalized === 'standby') {
    return normalized;
  }
  return 'offline'; // Default to offline for unknown statuses
}

/**
 * Normalize activity status string to ActivityStatus enum
 */
function normalizeActivityStatus(status: string | undefined): ActivityStatus {
  const normalized = status?.toLowerCase();
  if (normalized === 'active' || normalized === 'recent' || normalized === 'standby') {
    return normalized;
  }
  return 'standby'; // Default to standby for unknown statuses
}

/**
 * Normalize room ID to string or null
 */
function normalizeRoomId(roomId: string | number | null | undefined): string | null {
  if (roomId === null || roomId === undefined) {
    return null;
  }
  return String(roomId);
}

/**
 * Map targets summary from edge response
 */
export function mapEdgeSummaryToDomain(summary: {
  totalTargets: number;
  onlineTargets: number;
  offlineTargets: number;
  assignedTargets: number;
  unassignedTargets: number;
  totalRooms: number;
  lastUpdated: number;
}): TargetsSummaryDomainModel {
  return {
    totalTargets: summary.totalTargets,
    onlineTargets: summary.onlineTargets,
    offlineTargets: summary.offlineTargets,
    assignedTargets: summary.assignedTargets,
    unassignedTargets: summary.unassignedTargets,
    totalRooms: summary.totalRooms,
    lastUpdated: new Date(summary.lastUpdated),
  };
}

