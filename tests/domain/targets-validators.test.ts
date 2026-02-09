import { describe, it, expect } from 'vitest';
import {
  TARGET_CONSTRAINTS,
  TARGET_STATUS,
  ACTIVITY_STATUS,
  validateDeviceId,
  validateDeviceIds,
  validateTargetDetailsOptions,
  validateUpdateCustomNameInput,
  validateTargetStatus,
  validateActivityStatus,
  isOnlineStatus,
  isActiveStatus,
  isValidTelemetryTimestamp,
} from '../../src/domain/targets/validators';

describe('targets validators', () => {
  describe('validateDeviceId', () => {
    it('validates non-empty device ID', () => {
      const result = validateDeviceId('device-123');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe('device-123');
      }
    });

    it('rejects empty string', () => {
      const result = validateDeviceId('');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors[0].code).toBe('required');
      }
    });

    it('rejects whitespace-only string', () => {
      const result = validateDeviceId('   ');
      expect(result.success).toBe(false);
    });

    it('rejects null', () => {
      const result = validateDeviceId(null);
      expect(result.success).toBe(false);
    });

    it('rejects undefined', () => {
      const result = validateDeviceId(undefined);
      expect(result.success).toBe(false);
    });
  });

  describe('validateDeviceIds', () => {
    it('validates array with single device ID', () => {
      const result = validateDeviceIds(['device-1']);
      expect(result.success).toBe(true);
    });

    it('validates array with multiple device IDs', () => {
      const result = validateDeviceIds(['device-1', 'device-2', 'device-3']);
      expect(result.success).toBe(true);
    });

    it('rejects empty array', () => {
      const result = validateDeviceIds([]);
      expect(result.success).toBe(false);
    });

    it('rejects array with too many items', () => {
      const deviceIds = Array.from(
        { length: TARGET_CONSTRAINTS.MAX_TARGETS_PER_BATCH + 1 },
        (_, i) => `device-${i}`
      );
      const result = validateDeviceIds(deviceIds);
      expect(result.success).toBe(false);
    });

    it('rejects array with empty string', () => {
      const result = validateDeviceIds(['device-1', '']);
      expect(result.success).toBe(false);
    });
  });

  describe('validateTargetDetailsOptions', () => {
    it('validates valid options', () => {
      const result = validateTargetDetailsOptions({
        force: true,
        includeHistory: true,
        historyRangeMs: 3600000,
        historyLimit: 100,
      });
      expect(result.success).toBe(true);
    });

    it('validates empty options', () => {
      const result = validateTargetDetailsOptions({});
      expect(result.success).toBe(true);
    });

    it('validates with telemetryKeys', () => {
      const result = validateTargetDetailsOptions({
        telemetryKeys: ['hits', 'battery', 'rssi'],
      });
      expect(result.success).toBe(true);
    });

    it('rejects historyRangeMs above maximum', () => {
      const result = validateTargetDetailsOptions({
        historyRangeMs: TARGET_CONSTRAINTS.HISTORY_RANGE_MAX_MS + 1,
      });
      expect(result.success).toBe(false);
    });

    it('rejects historyLimit above maximum', () => {
      const result = validateTargetDetailsOptions({
        historyLimit: TARGET_CONSTRAINTS.HISTORY_LIMIT_MAX + 1,
      });
      expect(result.success).toBe(false);
    });

    it('rejects historyLimit below minimum', () => {
      const result = validateTargetDetailsOptions({
        historyLimit: 0,
      });
      expect(result.success).toBe(false);
    });

    it('rejects too many telemetryKeys', () => {
      const keys = Array.from({ length: TARGET_CONSTRAINTS.TELEMETRY_KEYS_MAX + 1 }, (_, i) => `key-${i}`);
      const result = validateTargetDetailsOptions({
        telemetryKeys: keys,
      });
      expect(result.success).toBe(false);
    });

    it('rejects recentWindowMs above maximum', () => {
      const result = validateTargetDetailsOptions({
        recentWindowMs: TARGET_CONSTRAINTS.RECENT_WINDOW_MAX_MS + 1,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('validateUpdateCustomNameInput', () => {
    it('validates valid input', () => {
      const result = validateUpdateCustomNameInput({
        targetId: 'device-123',
        customName: 'My Target',
      });
      expect(result.success).toBe(true);
    });

    it('validates with null customName (clear name)', () => {
      const result = validateUpdateCustomNameInput({
        targetId: 'device-123',
        customName: null,
      });
      expect(result.success).toBe(true);
    });

    it('trims customName', () => {
      const result = validateUpdateCustomNameInput({
        targetId: 'device-123',
        customName: '  My Target  ',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.customName).toBe('My Target');
      }
    });

    it('rejects empty targetId', () => {
      const result = validateUpdateCustomNameInput({
        targetId: '',
        customName: 'My Target',
      });
      expect(result.success).toBe(false);
    });

    it('rejects customName that is too long', () => {
      const result = validateUpdateCustomNameInput({
        targetId: 'device-123',
        customName: 'a'.repeat(TARGET_CONSTRAINTS.CUSTOM_NAME_MAX_LENGTH + 1),
      });
      expect(result.success).toBe(false);
    });
  });

  describe('validateTargetStatus', () => {
    it.each(TARGET_STATUS)('validates status: %s', (status) => {
      const result = validateTargetStatus(status);
      expect(result.success).toBe(true);
    });

    it('rejects invalid status', () => {
      const result = validateTargetStatus('invalid');
      expect(result.success).toBe(false);
    });
  });

  describe('validateActivityStatus', () => {
    it.each(ACTIVITY_STATUS)('validates activity status: %s', (status) => {
      const result = validateActivityStatus(status);
      expect(result.success).toBe(true);
    });

    it('rejects invalid activity status', () => {
      const result = validateActivityStatus('invalid');
      expect(result.success).toBe(false);
    });
  });

  describe('isOnlineStatus', () => {
    it('returns true for online', () => {
      expect(isOnlineStatus('online')).toBe(true);
    });

    it('returns false for offline', () => {
      expect(isOnlineStatus('offline')).toBe(false);
    });

    it('returns false for standby', () => {
      expect(isOnlineStatus('standby')).toBe(false);
    });
  });

  describe('isActiveStatus', () => {
    it('returns true for active', () => {
      expect(isActiveStatus('active')).toBe(true);
    });

    it('returns false for recent', () => {
      expect(isActiveStatus('recent')).toBe(false);
    });

    it('returns false for standby', () => {
      expect(isActiveStatus('standby')).toBe(false);
    });
  });

  describe('isValidTelemetryTimestamp', () => {
    it('returns true for valid timestamp', () => {
      const now = Date.now();
      expect(isValidTelemetryTimestamp(now)).toBe(true);
    });

    it('returns true for past timestamp', () => {
      const pastTime = Date.now() - 3600000; // 1 hour ago
      expect(isValidTelemetryTimestamp(pastTime)).toBe(true);
    });

    it('returns true for timestamp slightly in future (within tolerance)', () => {
      const slightlyFuture = Date.now() + 30000; // 30 seconds in future
      expect(isValidTelemetryTimestamp(slightlyFuture)).toBe(true);
    });

    it('returns false for timestamp too far in future', () => {
      const farFuture = Date.now() + 120000; // 2 minutes in future
      expect(isValidTelemetryTimestamp(farFuture)).toBe(false);
    });

    it('returns false for zero', () => {
      expect(isValidTelemetryTimestamp(0)).toBe(false);
    });

    it('returns false for negative number', () => {
      expect(isValidTelemetryTimestamp(-1000)).toBe(false);
    });

    it('returns false for non-number', () => {
      expect(isValidTelemetryTimestamp('not-a-number')).toBe(false);
      expect(isValidTelemetryTimestamp(null)).toBe(false);
      expect(isValidTelemetryTimestamp(undefined)).toBe(false);
    });
  });
});
