import { describe, it, expect } from 'vitest';
import {
  canCreateRoom,
  canUpdateRoom,
  canDeleteRoom,
  canAssignTargetsToRoom,
  canViewRoom,
  getMaxRoomsForTier,
  getMaxTargetsPerRoomForTier,
  type UserContext,
  type RoomContext,
} from '../../src/domain/rooms/permissions';
import { ROOM_CONSTRAINTS } from '../../src/domain/rooms/validators';

describe('rooms permissions', () => {
  const createUser = (overrides: Partial<UserContext> = {}): UserContext => ({
    userId: 'user-123',
    isAdmin: false,
    subscriptionTier: 'free',
    ...overrides,
  });

  const createRoom = (overrides: Partial<RoomContext> = {}): RoomContext => ({
    roomId: 'room-123',
    ownerId: 'user-123',
    targetCount: 0,
    ...overrides,
  });

  describe('canCreateRoom', () => {
    it('allows admin to create unlimited rooms', () => {
      const user = createUser({ isAdmin: true });
      const result = canCreateRoom(user, 1000);
      expect(result.allowed).toBe(true);
    });

    it('allows user under room limit', () => {
      const user = createUser({ subscriptionTier: 'free' });
      const result = canCreateRoom(user, 10);
      expect(result.allowed).toBe(true);
    });

    it('rejects user at room limit', () => {
      const user = createUser({ subscriptionTier: 'free' });
      const result = canCreateRoom(user, ROOM_CONSTRAINTS.MAX_ROOMS_PER_USER);
      expect(result.allowed).toBe(false);
      if (!result.allowed) {
        expect(result.code).toBe('ROOM_LIMIT_REACHED');
      }
    });

    it('allows pro user higher limit', () => {
      const user = createUser({ subscriptionTier: 'pro' });
      expect(canCreateRoom(user, 99).allowed).toBe(true);
      expect(canCreateRoom(user, 100).allowed).toBe(false);
    });

    it('allows enterprise user highest limit', () => {
      const user = createUser({ subscriptionTier: 'enterprise' });
      expect(canCreateRoom(user, 199).allowed).toBe(true);
      expect(canCreateRoom(user, 200).allowed).toBe(false);
    });
  });

  describe('canUpdateRoom', () => {
    it('allows admin to update any room', () => {
      const user = createUser({ isAdmin: true, userId: 'admin-1' });
      const room = createRoom({ ownerId: 'other-user' });
      const result = canUpdateRoom(user, room);
      expect(result.allowed).toBe(true);
    });

    it('allows owner to update their room', () => {
      const user = createUser({ userId: 'user-123' });
      const room = createRoom({ ownerId: 'user-123' });
      const result = canUpdateRoom(user, room);
      expect(result.allowed).toBe(true);
    });

    it('rejects non-owner from updating room', () => {
      const user = createUser({ userId: 'user-123' });
      const room = createRoom({ ownerId: 'other-user' });
      const result = canUpdateRoom(user, room);
      expect(result.allowed).toBe(false);
      if (!result.allowed) {
        expect(result.code).toBe('NOT_OWNER');
      }
    });
  });

  describe('canDeleteRoom', () => {
    it('allows admin to delete any room', () => {
      const user = createUser({ isAdmin: true, userId: 'admin-1' });
      const room = createRoom({ ownerId: 'other-user' });
      const result = canDeleteRoom(user, room);
      expect(result.allowed).toBe(true);
    });

    it('allows owner to delete their room', () => {
      const user = createUser({ userId: 'user-123' });
      const room = createRoom({ ownerId: 'user-123' });
      const result = canDeleteRoom(user, room);
      expect(result.allowed).toBe(true);
    });

    it('rejects non-owner from deleting room', () => {
      const user = createUser({ userId: 'user-123' });
      const room = createRoom({ ownerId: 'other-user' });
      const result = canDeleteRoom(user, room);
      expect(result.allowed).toBe(false);
      if (!result.allowed) {
        expect(result.code).toBe('NOT_OWNER');
      }
    });
  });

  describe('canAssignTargetsToRoom', () => {
    it('allows admin to assign to any room', () => {
      const user = createUser({ isAdmin: true, userId: 'admin-1' });
      const room = createRoom({ ownerId: 'other-user' });
      const result = canAssignTargetsToRoom(user, room, 5);
      expect(result.allowed).toBe(true);
    });

    it('allows owner to assign within limits', () => {
      const user = createUser({ userId: 'user-123' });
      const room = createRoom({ ownerId: 'user-123', targetCount: 50 });
      const result = canAssignTargetsToRoom(user, room, 10);
      expect(result.allowed).toBe(true);
    });

    it('rejects non-owner from assigning', () => {
      const user = createUser({ userId: 'user-123' });
      const room = createRoom({ ownerId: 'other-user' });
      const result = canAssignTargetsToRoom(user, room, 1);
      expect(result.allowed).toBe(false);
      if (!result.allowed) {
        expect(result.code).toBe('NOT_OWNER');
      }
    });

    it('rejects assignment exceeding target limit', () => {
      const user = createUser({ userId: 'user-123' });
      const room = createRoom({ ownerId: 'user-123', targetCount: 95 });
      const result = canAssignTargetsToRoom(user, room, 10);
      expect(result.allowed).toBe(false);
      if (!result.allowed) {
        expect(result.code).toBe('TARGET_LIMIT_REACHED');
      }
    });

    it('handles undefined targetCount', () => {
      const user = createUser({ userId: 'user-123' });
      const room = createRoom({ ownerId: 'user-123', targetCount: undefined });
      const result = canAssignTargetsToRoom(user, room, 5);
      expect(result.allowed).toBe(true);
    });
  });

  describe('canViewRoom', () => {
    it('allows admin to view any room', () => {
      const user = createUser({ isAdmin: true, userId: 'admin-1' });
      const room = createRoom({ ownerId: 'other-user' });
      const result = canViewRoom(user, room);
      expect(result.allowed).toBe(true);
    });

    it('allows owner to view their room', () => {
      const user = createUser({ userId: 'user-123' });
      const room = createRoom({ ownerId: 'user-123' });
      const result = canViewRoom(user, room);
      expect(result.allowed).toBe(true);
    });

    it('rejects non-owner from viewing room', () => {
      const user = createUser({ userId: 'user-123' });
      const room = createRoom({ ownerId: 'other-user' });
      const result = canViewRoom(user, room);
      expect(result.allowed).toBe(false);
      if (!result.allowed) {
        expect(result.code).toBe('NOT_OWNER');
      }
    });
  });

  describe('tier limit helpers', () => {
    describe('getMaxRoomsForTier', () => {
      it('returns 50 for free tier', () => {
        expect(getMaxRoomsForTier('free')).toBe(ROOM_CONSTRAINTS.MAX_ROOMS_PER_USER);
      });

      it('returns 100 for pro tier', () => {
        expect(getMaxRoomsForTier('pro')).toBe(100);
      });

      it('returns 200 for enterprise tier', () => {
        expect(getMaxRoomsForTier('enterprise')).toBe(200);
      });

      it('returns default for undefined tier', () => {
        expect(getMaxRoomsForTier(undefined)).toBe(ROOM_CONSTRAINTS.MAX_ROOMS_PER_USER);
      });
    });

    describe('getMaxTargetsPerRoomForTier', () => {
      it('returns 100 for free tier', () => {
        expect(getMaxTargetsPerRoomForTier('free')).toBe(ROOM_CONSTRAINTS.MAX_TARGETS_PER_ROOM);
      });

      it('returns 200 for pro tier', () => {
        expect(getMaxTargetsPerRoomForTier('pro')).toBe(200);
      });

      it('returns 500 for enterprise tier', () => {
        expect(getMaxTargetsPerRoomForTier('enterprise')).toBe(500);
      });
    });
  });
});
