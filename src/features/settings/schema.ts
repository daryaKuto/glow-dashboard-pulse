import { z } from 'zod';

/**
 * Zod schemas for Settings feature
 */

export const notificationSettingsSchema = z.object({
  email_session_invites: z.boolean(),
  email_firmware_updates: z.boolean(),
  email_target_offline: z.boolean(),
});

export type NotificationSettings = z.infer<typeof notificationSettingsSchema>;

export const defaultNotificationSettings: NotificationSettings = {
  email_session_invites: true,
  email_firmware_updates: true,
  email_target_offline: true,
};
