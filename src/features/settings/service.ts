import { type ApiResponse } from '@/shared/lib/api-response';
import { settingsRepository } from './repo';
import type { SettingsRepository } from '@/domain/settings/ports';
import type { NotificationSettings } from './schema';
import { defaultNotificationSettings } from './schema';

/**
 * Service layer for Settings feature
 *
 * Contains business logic and orchestrates repository calls.
 */

// Repository injection for testing
let settingsRepo: SettingsRepository = settingsRepository;

/**
 * Set the settings repository (for testing/dependency injection)
 */
export const setSettingsRepository = (repo: SettingsRepository): void => {
  settingsRepo = repo;
};

/**
 * Get current user ID from auth
 */
export async function getCurrentUserId(): Promise<ApiResponse<string | null>> {
  return settingsRepo.getCurrentUserId();
}

/**
 * Get notification settings for current user
 */
export async function getNotificationSettings(
  userId: string
): Promise<ApiResponse<NotificationSettings>> {
  const result = await settingsRepo.getNotificationSettings(userId);

  if (!result.ok) {
    return result as ApiResponse<NotificationSettings>;
  }

  // Return defaults if no settings found
  return {
    ok: true,
    data: result.data ?? defaultNotificationSettings,
  };
}

/**
 * Update notification settings for a user
 */
export async function updateNotificationSettings(
  userId: string,
  settings: NotificationSettings
): Promise<ApiResponse<boolean>> {
  return settingsRepo.updateNotificationSettings(userId, settings);
}

/**
 * Toggle a specific notification setting
 */
export async function toggleNotificationSetting(
  userId: string,
  currentSettings: NotificationSettings,
  key: keyof NotificationSettings
): Promise<ApiResponse<NotificationSettings>> {
  const newSettings: NotificationSettings = {
    ...currentSettings,
    [key]: !currentSettings[key],
  };

  const result = await settingsRepo.updateNotificationSettings(userId, newSettings);

  if (!result.ok) {
    return {
      ok: false,
      error: result.error,
    };
  }

  return {
    ok: true,
    data: newSettings,
  };
}

/**
 * Delete user account
 */
export async function deleteAccount(userId: string): Promise<ApiResponse<boolean>> {
  return settingsRepo.deleteUserAccount(userId);
}
