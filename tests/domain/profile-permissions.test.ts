import { describe, it, expect } from 'vitest';
import {
  canViewProfile,
  canUpdateProfile,
  canDeleteProfile,
  canViewSessionHistory,
  canViewWifiCredentials,
  canUpdateWifiCredentials,
  canViewAnalytics,
  type UserContext,
  type ProfileContext,
} from '../../src/domain/profile/permissions';

describe('profile permissions', () => {
  const createUser = (overrides: Partial<UserContext> = {}): UserContext => ({
    userId: 'user-123',
    isAdmin: false,
    isOwner: false,
    ...overrides,
  });

  const createProfile = (overrides: Partial<ProfileContext> = {}): ProfileContext => ({
    profileId: 'profile-123',
    ownerId: 'user-123',
    ...overrides,
  });

  describe('canViewProfile', () => {
    it('allows admin to view any profile', () => {
      const user = createUser({ isAdmin: true, userId: 'admin-1' });
      const profile = createProfile({ ownerId: 'other-user' });
      const result = canViewProfile(user, profile);
      expect(result.allowed).toBe(true);
    });

    it('allows owner to view their profile', () => {
      const user = createUser({ userId: 'user-123' });
      const profile = createProfile({ ownerId: 'user-123' });
      const result = canViewProfile(user, profile);
      expect(result.allowed).toBe(true);
    });

    it('rejects non-owner from viewing profile', () => {
      const user = createUser({ userId: 'user-123' });
      const profile = createProfile({ ownerId: 'other-user' });
      const result = canViewProfile(user, profile);
      expect(result.allowed).toBe(false);
      if (!result.allowed) {
        expect(result.code).toBe('NOT_AUTHORIZED');
      }
    });
  });

  describe('canUpdateProfile', () => {
    it('allows admin to update any profile', () => {
      const user = createUser({ isAdmin: true, userId: 'admin-1' });
      const profile = createProfile({ ownerId: 'other-user' });
      const result = canUpdateProfile(user, profile);
      expect(result.allowed).toBe(true);
    });

    it('allows owner to update their profile', () => {
      const user = createUser({ userId: 'user-123' });
      const profile = createProfile({ ownerId: 'user-123' });
      const result = canUpdateProfile(user, profile);
      expect(result.allowed).toBe(true);
    });

    it('rejects non-owner from updating profile', () => {
      const user = createUser({ userId: 'user-123' });
      const profile = createProfile({ ownerId: 'other-user' });
      const result = canUpdateProfile(user, profile);
      expect(result.allowed).toBe(false);
      if (!result.allowed) {
        expect(result.code).toBe('NOT_OWNER');
      }
    });
  });

  describe('canDeleteProfile', () => {
    it('allows admin to delete any profile', () => {
      const user = createUser({ isAdmin: true, userId: 'admin-1' });
      const profile = createProfile({ ownerId: 'other-user' });
      const result = canDeleteProfile(user, profile);
      expect(result.allowed).toBe(true);
    });

    it('allows owner to delete their profile', () => {
      const user = createUser({ userId: 'user-123' });
      const profile = createProfile({ ownerId: 'user-123' });
      const result = canDeleteProfile(user, profile);
      expect(result.allowed).toBe(true);
    });

    it('rejects non-owner from deleting profile', () => {
      const user = createUser({ userId: 'user-123' });
      const profile = createProfile({ ownerId: 'other-user' });
      const result = canDeleteProfile(user, profile);
      expect(result.allowed).toBe(false);
      if (!result.allowed) {
        expect(result.code).toBe('NOT_OWNER');
      }
    });
  });

  describe('canViewSessionHistory', () => {
    it('allows admin to view any session history', () => {
      const user = createUser({ isAdmin: true, userId: 'admin-1' });
      const profile = createProfile({ ownerId: 'other-user' });
      const result = canViewSessionHistory(user, profile);
      expect(result.allowed).toBe(true);
    });

    it('allows owner to view their session history', () => {
      const user = createUser({ userId: 'user-123' });
      const profile = createProfile({ ownerId: 'user-123' });
      const result = canViewSessionHistory(user, profile);
      expect(result.allowed).toBe(true);
    });

    it('rejects non-owner from viewing session history', () => {
      const user = createUser({ userId: 'user-123' });
      const profile = createProfile({ ownerId: 'other-user' });
      const result = canViewSessionHistory(user, profile);
      expect(result.allowed).toBe(false);
      if (!result.allowed) {
        expect(result.code).toBe('NOT_OWNER');
      }
    });
  });

  describe('canViewWifiCredentials', () => {
    it('allows admin to view any WiFi credentials', () => {
      const user = createUser({ isAdmin: true, userId: 'admin-1' });
      const profile = createProfile({ ownerId: 'other-user' });
      const result = canViewWifiCredentials(user, profile);
      expect(result.allowed).toBe(true);
    });

    it('allows owner to view their WiFi credentials', () => {
      const user = createUser({ userId: 'user-123' });
      const profile = createProfile({ ownerId: 'user-123' });
      const result = canViewWifiCredentials(user, profile);
      expect(result.allowed).toBe(true);
    });

    it('rejects non-owner from viewing WiFi credentials', () => {
      const user = createUser({ userId: 'user-123' });
      const profile = createProfile({ ownerId: 'other-user' });
      const result = canViewWifiCredentials(user, profile);
      expect(result.allowed).toBe(false);
      if (!result.allowed) {
        expect(result.code).toBe('NOT_OWNER');
      }
    });
  });

  describe('canUpdateWifiCredentials', () => {
    it('allows admin to update any WiFi credentials', () => {
      const user = createUser({ isAdmin: true, userId: 'admin-1' });
      const profile = createProfile({ ownerId: 'other-user' });
      const result = canUpdateWifiCredentials(user, profile);
      expect(result.allowed).toBe(true);
    });

    it('allows owner to update their WiFi credentials', () => {
      const user = createUser({ userId: 'user-123' });
      const profile = createProfile({ ownerId: 'user-123' });
      const result = canUpdateWifiCredentials(user, profile);
      expect(result.allowed).toBe(true);
    });

    it('rejects non-owner from updating WiFi credentials', () => {
      const user = createUser({ userId: 'user-123' });
      const profile = createProfile({ ownerId: 'other-user' });
      const result = canUpdateWifiCredentials(user, profile);
      expect(result.allowed).toBe(false);
      if (!result.allowed) {
        expect(result.code).toBe('NOT_OWNER');
      }
    });
  });

  describe('canViewAnalytics', () => {
    it('allows admin to view any analytics', () => {
      const user = createUser({ isAdmin: true, userId: 'admin-1' });
      const profile = createProfile({ ownerId: 'other-user' });
      const result = canViewAnalytics(user, profile);
      expect(result.allowed).toBe(true);
    });

    it('allows owner to view their analytics', () => {
      const user = createUser({ userId: 'user-123' });
      const profile = createProfile({ ownerId: 'user-123' });
      const result = canViewAnalytics(user, profile);
      expect(result.allowed).toBe(true);
    });

    it('rejects non-owner from viewing analytics', () => {
      const user = createUser({ userId: 'user-123' });
      const profile = createProfile({ ownerId: 'other-user' });
      const result = canViewAnalytics(user, profile);
      expect(result.allowed).toBe(false);
      if (!result.allowed) {
        expect(result.code).toBe('NOT_OWNER');
      }
    });
  });
});
