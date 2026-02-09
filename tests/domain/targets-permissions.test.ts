import { describe, it, expect } from 'vitest';
import {
  canViewTarget,
  canUpdateTarget,
  canSendTargetCommand,
  canAssignTarget,
  canViewTargetTelemetry,
  canRequestBatchDetails,
  getMaxBatchSizeForTier,
  getMaxHistoryRangeForTier,
  type UserContext,
  type TargetContext,
} from '../../src/domain/targets/permissions';
import { TARGET_CONSTRAINTS } from '../../src/domain/targets/validators';

describe('targets permissions', () => {
  const createUser = (overrides: Partial<UserContext> = {}): UserContext => ({
    userId: 'user-123',
    isAdmin: false,
    subscriptionTier: 'free',
    ...overrides,
  });

  const createTarget = (overrides: Partial<TargetContext> = {}): TargetContext => ({
    deviceId: 'device-123',
    ownerId: 'user-123',
    roomId: 'room-123',
    ...overrides,
  });

  describe('canViewTarget', () => {
    it('allows admin to view any target', () => {
      const user = createUser({ isAdmin: true, userId: 'admin-1' });
      const target = createTarget({ ownerId: 'other-user' });
      const result = canViewTarget(user, target);
      expect(result.allowed).toBe(true);
    });

    it('allows owner to view their target', () => {
      const user = createUser({ userId: 'user-123' });
      const target = createTarget({ ownerId: 'user-123' });
      const result = canViewTarget(user, target);
      expect(result.allowed).toBe(true);
    });

    it('rejects non-owner from viewing target', () => {
      const user = createUser({ userId: 'user-123' });
      const target = createTarget({ ownerId: 'other-user' });
      const result = canViewTarget(user, target);
      expect(result.allowed).toBe(false);
      if (!result.allowed) {
        expect(result.code).toBe('NOT_OWNER');
      }
    });
  });

  describe('canUpdateTarget', () => {
    it('allows admin to update any target', () => {
      const user = createUser({ isAdmin: true, userId: 'admin-1' });
      const target = createTarget({ ownerId: 'other-user' });
      const result = canUpdateTarget(user, target);
      expect(result.allowed).toBe(true);
    });

    it('allows owner to update their target', () => {
      const user = createUser({ userId: 'user-123' });
      const target = createTarget({ ownerId: 'user-123' });
      const result = canUpdateTarget(user, target);
      expect(result.allowed).toBe(true);
    });

    it('rejects non-owner from updating target', () => {
      const user = createUser({ userId: 'user-123' });
      const target = createTarget({ ownerId: 'other-user' });
      const result = canUpdateTarget(user, target);
      expect(result.allowed).toBe(false);
      if (!result.allowed) {
        expect(result.code).toBe('NOT_OWNER');
      }
    });
  });

  describe('canSendTargetCommand', () => {
    it('allows admin to send commands to any target', () => {
      const user = createUser({ isAdmin: true, userId: 'admin-1' });
      const target = createTarget({ ownerId: 'other-user' });
      const result = canSendTargetCommand(user, target);
      expect(result.allowed).toBe(true);
    });

    it('allows owner to send commands to their target', () => {
      const user = createUser({ userId: 'user-123' });
      const target = createTarget({ ownerId: 'user-123' });
      const result = canSendTargetCommand(user, target);
      expect(result.allowed).toBe(true);
    });

    it('rejects non-owner from sending commands', () => {
      const user = createUser({ userId: 'user-123' });
      const target = createTarget({ ownerId: 'other-user' });
      const result = canSendTargetCommand(user, target);
      expect(result.allowed).toBe(false);
      if (!result.allowed) {
        expect(result.code).toBe('NOT_OWNER');
      }
    });
  });

  describe('canAssignTarget', () => {
    it('allows admin to assign any target', () => {
      const user = createUser({ isAdmin: true, userId: 'admin-1' });
      const target = createTarget({ ownerId: 'other-user' });
      const result = canAssignTarget(user, target, 'room-owner');
      expect(result.allowed).toBe(true);
    });

    it('allows user who owns both target and room', () => {
      const user = createUser({ userId: 'user-123' });
      const target = createTarget({ ownerId: 'user-123' });
      const result = canAssignTarget(user, target, 'user-123');
      expect(result.allowed).toBe(true);
    });

    it('rejects when user does not own target', () => {
      const user = createUser({ userId: 'user-123' });
      const target = createTarget({ ownerId: 'other-user' });
      const result = canAssignTarget(user, target, 'user-123');
      expect(result.allowed).toBe(false);
      if (!result.allowed) {
        expect(result.code).toBe('NOT_TARGET_OWNER');
      }
    });

    it('rejects when user does not own destination room', () => {
      const user = createUser({ userId: 'user-123' });
      const target = createTarget({ ownerId: 'user-123' });
      const result = canAssignTarget(user, target, 'other-room-owner');
      expect(result.allowed).toBe(false);
      if (!result.allowed) {
        expect(result.code).toBe('NOT_ROOM_OWNER');
      }
    });
  });

  describe('canViewTargetTelemetry', () => {
    it('delegates to canViewTarget - allows owner', () => {
      const user = createUser({ userId: 'user-123' });
      const target = createTarget({ ownerId: 'user-123' });
      const result = canViewTargetTelemetry(user, target);
      expect(result.allowed).toBe(true);
    });

    it('delegates to canViewTarget - rejects non-owner', () => {
      const user = createUser({ userId: 'user-123' });
      const target = createTarget({ ownerId: 'other-user' });
      const result = canViewTargetTelemetry(user, target);
      expect(result.allowed).toBe(false);
    });
  });

  describe('canRequestBatchDetails', () => {
    it('allows admin unlimited batch size', () => {
      const user = createUser({ isAdmin: true });
      const result = canRequestBatchDetails(user, 1000);
      expect(result.allowed).toBe(true);
    });

    it('allows free user within batch limit', () => {
      const user = createUser({ subscriptionTier: 'free' });
      const result = canRequestBatchDetails(user, TARGET_CONSTRAINTS.MAX_TARGETS_PER_BATCH);
      expect(result.allowed).toBe(true);
    });

    it('rejects free user exceeding batch limit', () => {
      const user = createUser({ subscriptionTier: 'free' });
      const result = canRequestBatchDetails(user, TARGET_CONSTRAINTS.MAX_TARGETS_PER_BATCH + 1);
      expect(result.allowed).toBe(false);
      if (!result.allowed) {
        expect(result.code).toBe('BATCH_SIZE_EXCEEDED');
      }
    });

    it('allows pro user higher batch limit', () => {
      const user = createUser({ subscriptionTier: 'pro' });
      expect(canRequestBatchDetails(user, 100).allowed).toBe(true);
      expect(canRequestBatchDetails(user, 101).allowed).toBe(false);
    });

    it('allows enterprise user highest batch limit', () => {
      const user = createUser({ subscriptionTier: 'enterprise' });
      expect(canRequestBatchDetails(user, 200).allowed).toBe(true);
      expect(canRequestBatchDetails(user, 201).allowed).toBe(false);
    });
  });

  describe('tier limit helpers', () => {
    describe('getMaxBatchSizeForTier', () => {
      it('returns 50 for free tier', () => {
        expect(getMaxBatchSizeForTier('free')).toBe(TARGET_CONSTRAINTS.MAX_TARGETS_PER_BATCH);
      });

      it('returns 100 for pro tier', () => {
        expect(getMaxBatchSizeForTier('pro')).toBe(100);
      });

      it('returns 200 for enterprise tier', () => {
        expect(getMaxBatchSizeForTier('enterprise')).toBe(200);
      });

      it('returns default for undefined tier', () => {
        expect(getMaxBatchSizeForTier(undefined)).toBe(TARGET_CONSTRAINTS.MAX_TARGETS_PER_BATCH);
      });
    });

    describe('getMaxHistoryRangeForTier', () => {
      it('returns 24 hours for free tier', () => {
        expect(getMaxHistoryRangeForTier('free')).toBe(TARGET_CONSTRAINTS.HISTORY_RANGE_MAX_MS);
      });

      it('returns 3 days for pro tier', () => {
        expect(getMaxHistoryRangeForTier('pro')).toBe(3 * 24 * 60 * 60 * 1000);
      });

      it('returns 7 days for enterprise tier', () => {
        expect(getMaxHistoryRangeForTier('enterprise')).toBe(7 * 24 * 60 * 60 * 1000);
      });
    });
  });
});
