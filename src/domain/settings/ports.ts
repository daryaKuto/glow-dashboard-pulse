/**
 * Settings Domain Ports
 *
 * Repository interfaces for data access.
 * Pure types - no React or Supabase imports.
 */

import type { ApiResponse } from '@/shared/lib/api-response';

/**
 * Notification settings record
 */
export type NotificationSettingsRecord = {
  emailNotifications: boolean;
  pushNotifications: boolean;
  gameReminders: boolean;
  achievementAlerts: boolean;
  weeklyDigest: boolean;
};

/**
 * Settings Repository Interface
 * 
 * Defines the contract for settings data access.
 */
export interface SettingsRepository {
  /**
   * Get current user ID
   */
  getCurrentUserId(): Promise<ApiResponse<string | null>>;

  /**
   * Get notification settings for a user
   */
  getNotificationSettings(userId: string): Promise<ApiResponse<NotificationSettingsRecord | null>>;

  /**
   * Update notification settings for a user
   */
  updateNotificationSettings(
    userId: string,
    settings: NotificationSettingsRecord
  ): Promise<ApiResponse<boolean>>;

  /**
   * Delete user account
   */
  deleteUserAccount(userId: string): Promise<ApiResponse<boolean>>;
}

