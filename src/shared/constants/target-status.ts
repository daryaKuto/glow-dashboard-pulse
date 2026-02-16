/**
 * Target Status Display Constants
 *
 * Single source of truth for how target device statuses are displayed across the UI.
 * Every component that renders a status dot, label, badge, or pill MUST import from here.
 *
 * Status semantics:
 *   online  → "Active"  — game signal sent, device is playing
 *   standby → "Ready"   — powered on, connected, idle (ready to play)
 *   offline → "Offline"  — not reachable
 */

export type TargetDisplayStatus = 'online' | 'standby' | 'offline';

export interface StatusDisplayConfig {
  /** Short label: "Active", "Ready", "Offline" */
  label: string;
  /** Extended description: "Active — in game", "Ready — powered on", "Offline" */
  description: string;
  /** Dot background class: bg-green-500, bg-amber-500, bg-gray-400 */
  dotColor: string;
  /** Text color class for labels next to dots */
  textColor: string;
  /** Badge/pill background + text classes (light bg, darker text) */
  badgeClassName: string;
  /** Pill with ring border (for RoomCard-style target pills) */
  pillClassName: string;
  /** Row background gradient (for rooms-page detail rows) */
  rowBgClassName: string;
  /** Sort order for ordering targets by status */
  sortOrder: number;
}

export const TARGET_STATUS_DISPLAY: Record<TargetDisplayStatus, StatusDisplayConfig> = {
  online: {
    label: 'Active',
    description: 'Active — in game',
    dotColor: 'bg-green-500',
    textColor: 'text-green-600',
    badgeClassName: 'bg-green-100 text-green-700',
    pillClassName: 'bg-green-50 text-green-700 ring-1 ring-green-200/60',
    rowBgClassName: 'bg-gradient-to-r from-green-500/[0.06] to-white',
    sortOrder: 0,
  },
  standby: {
    label: 'Ready',
    description: 'Ready — powered on',
    dotColor: 'bg-amber-500',
    textColor: 'text-amber-600',
    badgeClassName: 'bg-amber-100 text-amber-700',
    pillClassName: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200/60',
    rowBgClassName: 'bg-gradient-to-r from-amber-500/[0.06] to-white',
    sortOrder: 1,
  },
  offline: {
    label: 'Offline',
    description: 'Offline',
    dotColor: 'bg-gray-400',
    textColor: 'text-brand-dark/40',
    badgeClassName: 'bg-gray-100 text-gray-600',
    pillClassName: 'bg-gray-100 text-gray-500 ring-1 ring-gray-200/60',
    rowBgClassName: 'bg-gradient-to-r from-gray-200/[0.2] to-white',
    sortOrder: 2,
  },
} as const;

/**
 * Get display config for a target status. Normalizes null/undefined/unknown to 'offline'.
 */
export function getStatusDisplay(status: string | null | undefined): StatusDisplayConfig {
  if (status === 'online' || status === 'standby' || status === 'offline') {
    return TARGET_STATUS_DISPLAY[status];
  }
  return TARGET_STATUS_DISPLAY.offline;
}

/** Sort order constant for use in domain layer */
export const TARGET_STATUS_SORT_ORDER: Record<string, number> = {
  online: 0,
  standby: 1,
  offline: 2,
};
