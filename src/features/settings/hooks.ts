import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as service from './service';
import type { NotificationSettings } from './schema';
import { defaultNotificationSettings } from './schema';

/**
 * React Query hooks for Settings feature
 */

export const settingsKeys = {
  all: ['settings'] as const,
  notifications: (userId: string) => [...settingsKeys.all, 'notifications', userId] as const,
};

/**
 * Hook to get notification settings
 */
export function useNotificationSettings(userId: string | null) {
  return useQuery({
    queryKey: settingsKeys.notifications(userId ?? ''),
    queryFn: async () => {
      if (!userId) return defaultNotificationSettings;

      const result = await service.getNotificationSettings(userId);
      if (!result.ok) {
        throw new Error(result.error?.message ?? 'Failed to fetch settings');
      }
      return result.data;
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook to update notification settings
 */
export function useUpdateNotificationSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      userId,
      settings,
    }: {
      userId: string;
      settings: NotificationSettings;
    }) => {
      const result = await service.updateNotificationSettings(userId, settings);
      if (!result.ok) {
        throw new Error(result.error?.message ?? 'Failed to update settings');
      }
      return settings;
    },
    onSuccess: (data, variables) => {
      queryClient.setQueryData(settingsKeys.notifications(variables.userId), data);
    },
  });
}

/**
 * Hook to toggle a notification setting
 */
export function useToggleNotificationSetting() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      userId,
      currentSettings,
      key,
    }: {
      userId: string;
      currentSettings: NotificationSettings;
      key: keyof NotificationSettings;
    }) => {
      const result = await service.toggleNotificationSetting(userId, currentSettings, key);
      if (!result.ok) {
        throw new Error(result.error?.message ?? 'Failed to toggle setting');
      }
      return result.data;
    },
    onSuccess: (data, variables) => {
      queryClient.setQueryData(settingsKeys.notifications(variables.userId), data);
    },
  });
}

/**
 * Hook to delete account
 */
export function useDeleteAccount() {
  return useMutation({
    mutationFn: async (userId: string) => {
      const result = await service.deleteAccount(userId);
      if (!result.ok) {
        throw new Error(result.error?.message ?? 'Failed to delete account');
      }
      return result.data;
    },
  });
}
