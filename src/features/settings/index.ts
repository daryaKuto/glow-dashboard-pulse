/**
 * Settings feature barrel export
 */

// Schema & Types
export type { NotificationSettings } from './schema';
export { notificationSettingsSchema, defaultNotificationSettings } from './schema';

// Hooks
export {
  settingsKeys,
  useNotificationSettings,
  useUpdateNotificationSettings,
  useToggleNotificationSetting,
  useDeleteAccount,
} from './hooks';

// Service (for direct use if needed)
export * as settingsService from './service';
