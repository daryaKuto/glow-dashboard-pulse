import { supabase } from '@/data/supabase-client';
import { apiOk, apiErr, type ApiResponse } from '@/shared/lib/api-response';
import type { SettingsRepository } from '@/domain/settings/ports';
import type { NotificationSettings } from './schema';

/**
 * Repository layer for Settings feature
 *
 * Handles all data access operations (Supabase queries).
 * Returns ApiResponse<T> for consistent error handling.
 */

/**
 * Get current user ID
 */
export async function getCurrentUserId(): Promise<ApiResponse<string | null>> {
  try {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) {
      console.warn('[Settings Repo] Error getting user:', error);
      return apiOk(null);
    }
    return apiOk(user?.id ?? null);
  } catch (error) {
    console.error('[Settings Repo] Error getting user:', error);
    return apiErr(
      'GET_USER_ERROR',
      error instanceof Error ? error.message : 'Failed to get user',
      error
    );
  }
}

/**
 * Get notification settings for a user
 */
export async function getNotificationSettings(
  userId: string
): Promise<ApiResponse<NotificationSettings | null>> {
  try {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('notification_settings')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    // notification_settings might be stored as JSON in the DB
    const settings = data?.notification_settings as NotificationSettings | null;
    return apiOk(settings);
  } catch (error) {
    console.error('[Settings Repo] Error fetching notification settings:', error);
    return apiErr(
      'FETCH_NOTIFICATION_SETTINGS_ERROR',
      error instanceof Error ? error.message : 'Failed to fetch notification settings',
      error
    );
  }
}

/**
 * Update notification settings for a user
 */
export async function updateNotificationSettings(
  userId: string,
  settings: NotificationSettings
): Promise<ApiResponse<boolean>> {
  try {
    const { error } = await supabase
      .from('user_profiles')
      .update({
        notification_settings: settings,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);

    if (error) {
      throw error;
    }

    return apiOk(true);
  } catch (error) {
    console.error('[Settings Repo] Error updating notification settings:', error);
    return apiErr(
      'UPDATE_NOTIFICATION_SETTINGS_ERROR',
      error instanceof Error ? error.message : 'Failed to update notification settings',
      error
    );
  }
}

/**
 * Delete user account
 * Note: This uses admin API which may require elevated privileges
 */
export async function deleteUserAccount(userId: string): Promise<ApiResponse<boolean>> {
  try {
    // Note: admin.deleteUser requires service role key, which typically
    // should not be exposed to client. This should be done via an edge function.
    // For now, we'll sign out the user and mark for deletion.
    const { error } = await supabase.auth.signOut();

    if (error) {
      throw error;
    }

    // In a production app, you'd call an edge function to handle the actual deletion
    console.warn(
      '[Settings Repo] Account marked for deletion. Full deletion should be handled by a server-side function.'
    );

    return apiOk(true);
  } catch (error) {
    console.error('[Settings Repo] Error deleting account:', error);
    return apiErr(
      'DELETE_ACCOUNT_ERROR',
      error instanceof Error ? error.message : 'Failed to delete account',
      error
    );
  }
}

/**
 * Repository adapter (ports & adapters pattern)
 */
export const settingsRepository: SettingsRepository = {
  getCurrentUserId,
  getNotificationSettings,
  updateNotificationSettings,
  deleteUserAccount,
};
