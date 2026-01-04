/**
 * Dashboard Domain Permissions
 *
 * Permission checks for dashboard operations.
 * Pure functions - no React or Supabase imports.
 */

/**
 * Permission check result
 */
export type PermissionResult =
  | { allowed: true }
  | { allowed: false; reason: string; code: string };

/**
 * User context for permission checks
 */
export type UserContext = {
  userId: string;
  isAdmin?: boolean;
  subscriptionTier?: 'free' | 'pro' | 'enterprise';
};

/**
 * Dashboard context for permission checks
 */
export type DashboardContext = {
  ownerId: string;
};

/**
 * Check if user can view dashboard metrics.
 */
export function canViewDashboard(
  user: UserContext,
  dashboard: DashboardContext
): PermissionResult {
  if (user.isAdmin) {
    return { allowed: true };
  }

  if (user.userId !== dashboard.ownerId) {
    return {
      allowed: false,
      reason: 'You do not have permission to view this dashboard',
      code: 'NOT_OWNER',
    };
  }

  return { allowed: true };
}
