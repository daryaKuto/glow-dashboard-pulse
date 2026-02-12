import { describe, it, expect, afterEach } from 'vitest';
import { apiOk } from '../../src/shared/lib/api-response';
import { settingsRepository } from '../../src/features/settings/repo';
import { getNotificationSettings, setSettingsRepository } from '../../src/features/settings/service';
import type { SettingsRepository } from '../../src/domain/settings/ports';

describe('settings adapter conformance', () => {
  afterEach(() => {
    // Restore the real repository after each test
    setSettingsRepository(settingsRepository);
  });

  it('mock repository satisfies SettingsRepository interface', async () => {
    // Create a mock that satisfies the full interface
    const mockRepo: SettingsRepository = {
      getCurrentUserId: async () => apiOk('test-user-id'),
      getNotificationSettings: async () => apiOk(null),
      updateNotificationSettings: async () => apiOk(true),
      deleteUserAccount: async () => apiOk(true),
    };

    // Inject the mock
    setSettingsRepository(mockRepo);

    // Verify the service uses the injected repository
    const result = await getNotificationSettings('test-user-id');
    expect(result.ok).toBe(true);
    // Should return default settings when null
    if (result.ok) {
      expect(result.data).toBeDefined();
      // Check actual schema fields (email_session_invites, etc.)
      expect(result.data.email_session_invites).toBeDefined();
    }
  });

  it('mock repository with sample data works correctly', async () => {
    // Use actual schema field names
    const sampleSettings = {
      email_session_invites: true,
      email_firmware_updates: false,
      email_target_offline: true,
    };

    const mockRepo: SettingsRepository = {
      getCurrentUserId: async () => apiOk('user-123'),
      getNotificationSettings: async () => apiOk(sampleSettings),
      updateNotificationSettings: async () => apiOk(true),
      deleteUserAccount: async () => apiOk(true),
    };

    setSettingsRepository(mockRepo);

    const result = await getNotificationSettings('user-123');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.email_session_invites).toBe(true);
      expect(result.data.email_firmware_updates).toBe(false);
      expect(result.data.email_target_offline).toBe(true);
    }
  });

  it('real repository exports match interface', () => {
    // Verify the real repository has all required methods
    expect(typeof settingsRepository.getCurrentUserId).toBe('function');
    expect(typeof settingsRepository.getNotificationSettings).toBe('function');
    expect(typeof settingsRepository.updateNotificationSettings).toBe('function');
    expect(typeof settingsRepository.deleteUserAccount).toBe('function');
  });
});

