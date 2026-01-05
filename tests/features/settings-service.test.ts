import { describe, it, expect, afterEach } from 'vitest';
import { apiOk } from '../../src/shared/lib/api-response';
import { settingsRepository } from '../../src/features/settings/repo';
import {
  getCurrentUserId,
  getNotificationSettings,
  updateNotificationSettings,
  setSettingsRepository,
} from '../../src/features/settings/service';
import type { SettingsRepository } from '../../src/domain/settings/ports';

describe('settings service repository injection', () => {
  // Reset to real repository after each test
  afterEach(() => {
    setSettingsRepository(settingsRepository);
  });

  it('uses the injected repository for getCurrentUserId', async () => {
    const mockRepo: SettingsRepository = {
      getCurrentUserId: async () => apiOk('user-123'),
      getNotificationSettings: async () => apiOk(null),
      updateNotificationSettings: async () => apiOk(true),
      deleteUserAccount: async () => apiOk(true),
    };

    setSettingsRepository(mockRepo);
    const result = await getCurrentUserId();
    
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toBe('user-123');
    }
  });

  it('uses the injected repository for getNotificationSettings', async () => {
    const mockSettings = {
      email_session_invites: true,
      email_firmware_updates: false,
      email_target_offline: true,
    };

    const mockRepo: SettingsRepository = {
      getCurrentUserId: async () => apiOk('user-123'),
      getNotificationSettings: async () => apiOk(mockSettings),
      updateNotificationSettings: async () => apiOk(true),
      deleteUserAccount: async () => apiOk(true),
    };

    setSettingsRepository(mockRepo);
    const result = await getNotificationSettings('user-123');
    
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual(mockSettings);
    }
  });

  it('returns default settings when none exist', async () => {
    const mockRepo: SettingsRepository = {
      getCurrentUserId: async () => apiOk('user-123'),
      getNotificationSettings: async () => apiOk(null),
      updateNotificationSettings: async () => apiOk(true),
      deleteUserAccount: async () => apiOk(true),
    };

    setSettingsRepository(mockRepo);
    const result = await getNotificationSettings('user-123');
    
    expect(result.ok).toBe(true);
    if (result.ok) {
      // Should return default settings
      expect(result.data).toBeDefined();
      expect(typeof result.data.email_session_invites).toBe('boolean');
    }
  });

  it('uses the injected repository for updateNotificationSettings', async () => {
    let savedSettings: any = null;

    const mockRepo: SettingsRepository = {
      getCurrentUserId: async () => apiOk('user-123'),
      getNotificationSettings: async () => apiOk(null),
      updateNotificationSettings: async (userId, settings) => {
        savedSettings = { userId, settings };
        return apiOk(true);
      },
      deleteUserAccount: async () => apiOk(true),
    };

    const newSettings = {
      email_session_invites: false,
      email_firmware_updates: true,
      email_target_offline: false,
    };

    setSettingsRepository(mockRepo);
    const result = await updateNotificationSettings('user-123', newSettings);
    
    expect(result.ok).toBe(true);
    expect(savedSettings).toEqual({
      userId: 'user-123',
      settings: newSettings,
    });
  });
});

