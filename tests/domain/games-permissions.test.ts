import { describe, it, expect } from 'vitest';
import {
  canStartGameSession,
  canStopGameSession,
  canViewGameSession,
  canUseTargetForGame,
  canSaveGamePreset,
  canDeleteGamePreset,
  canViewGameHistory,
  canUseTargetCount,
  getMaxConcurrentSessions,
  getMaxGamePresets,
  getMaxTargetsPerGame,
  getMaxGameDuration,
  type UserContext,
  type GameSessionContext,
  type TargetContext,
} from '../../src/domain/games/permissions';
import { GAME_CONSTRAINTS } from '../../src/domain/games/validators';

describe('games permissions', () => {
  const createUser = (overrides: Partial<UserContext> = {}): UserContext => ({
    userId: 'user-123',
    isAdmin: false,
    subscriptionTier: 'free',
    ...overrides,
  });

  const createSession = (overrides: Partial<GameSessionContext> = {}): GameSessionContext => ({
    sessionId: 'session-123',
    ownerId: 'user-123',
    status: 'running',
    targetIds: ['target-1'],
    ...overrides,
  });

  const createTarget = (overrides: Partial<TargetContext> = {}): TargetContext => ({
    targetId: 'target-123',
    ownerId: 'user-123',
    isOnline: true,
    ...overrides,
  });

  describe('canStartGameSession', () => {
    it('allows admin to start any number of sessions', () => {
      const user = createUser({ isAdmin: true });
      const result = canStartGameSession(user, 100);
      expect(result.allowed).toBe(true);
    });

    it('allows free user to start first session', () => {
      const user = createUser({ subscriptionTier: 'free' });
      const result = canStartGameSession(user, 0);
      expect(result.allowed).toBe(true);
    });

    it('rejects free user at session limit', () => {
      const user = createUser({ subscriptionTier: 'free' });
      const result = canStartGameSession(user, 1);
      expect(result.allowed).toBe(false);
      if (!result.allowed) {
        expect(result.code).toBe('SESSION_LIMIT_REACHED');
      }
    });

    it('allows pro user up to 3 sessions', () => {
      const user = createUser({ subscriptionTier: 'pro' });
      expect(canStartGameSession(user, 0).allowed).toBe(true);
      expect(canStartGameSession(user, 1).allowed).toBe(true);
      expect(canStartGameSession(user, 2).allowed).toBe(true);
      expect(canStartGameSession(user, 3).allowed).toBe(false);
    });

    it('allows enterprise user up to 10 sessions', () => {
      const user = createUser({ subscriptionTier: 'enterprise' });
      expect(canStartGameSession(user, 9).allowed).toBe(true);
      expect(canStartGameSession(user, 10).allowed).toBe(false);
    });
  });

  describe('canStopGameSession', () => {
    it('allows admin to stop any session', () => {
      const user = createUser({ isAdmin: true, userId: 'admin-1' });
      const session = createSession({ ownerId: 'other-user' });
      const result = canStopGameSession(user, session);
      expect(result.allowed).toBe(true);
    });

    it('allows owner to stop their session', () => {
      const user = createUser({ userId: 'user-123' });
      const session = createSession({ ownerId: 'user-123' });
      const result = canStopGameSession(user, session);
      expect(result.allowed).toBe(true);
    });

    it('rejects non-owner from stopping session', () => {
      const user = createUser({ userId: 'user-123' });
      const session = createSession({ ownerId: 'other-user' });
      const result = canStopGameSession(user, session);
      expect(result.allowed).toBe(false);
      if (!result.allowed) {
        expect(result.code).toBe('NOT_OWNER');
      }
    });
  });

  describe('canViewGameSession', () => {
    it('allows admin to view any session', () => {
      const user = createUser({ isAdmin: true });
      const session = createSession({ ownerId: 'other-user' });
      expect(canViewGameSession(user, session).allowed).toBe(true);
    });

    it('allows owner to view their session', () => {
      const user = createUser({ userId: 'user-123' });
      const session = createSession({ ownerId: 'user-123' });
      expect(canViewGameSession(user, session).allowed).toBe(true);
    });

    it('rejects non-owner from viewing session', () => {
      const user = createUser({ userId: 'user-123' });
      const session = createSession({ ownerId: 'other-user' });
      const result = canViewGameSession(user, session);
      expect(result.allowed).toBe(false);
    });
  });

  describe('canUseTargetForGame', () => {
    it('allows admin to use any target', () => {
      const user = createUser({ isAdmin: true });
      const target = createTarget({ ownerId: 'other-user' });
      expect(canUseTargetForGame(user, target).allowed).toBe(true);
    });

    it('allows owner to use their online target', () => {
      const user = createUser({ userId: 'user-123' });
      const target = createTarget({ ownerId: 'user-123', isOnline: true });
      expect(canUseTargetForGame(user, target).allowed).toBe(true);
    });

    it('rejects non-owner from using target', () => {
      const user = createUser({ userId: 'user-123' });
      const target = createTarget({ ownerId: 'other-user' });
      const result = canUseTargetForGame(user, target);
      expect(result.allowed).toBe(false);
      if (!result.allowed) {
        expect(result.code).toBe('NOT_OWNER');
      }
    });

    it('rejects offline target even for owner', () => {
      const user = createUser({ userId: 'user-123' });
      const target = createTarget({ ownerId: 'user-123', isOnline: false });
      const result = canUseTargetForGame(user, target);
      expect(result.allowed).toBe(false);
      if (!result.allowed) {
        expect(result.code).toBe('TARGET_OFFLINE');
      }
    });
  });

  describe('canSaveGamePreset', () => {
    it('allows admin unlimited presets', () => {
      const user = createUser({ isAdmin: true });
      expect(canSaveGamePreset(user, 1000).allowed).toBe(true);
    });

    it('allows free user up to 5 presets', () => {
      const user = createUser({ subscriptionTier: 'free' });
      expect(canSaveGamePreset(user, 4).allowed).toBe(true);
      expect(canSaveGamePreset(user, 5).allowed).toBe(false);
    });

    it('allows pro user up to 25 presets', () => {
      const user = createUser({ subscriptionTier: 'pro' });
      expect(canSaveGamePreset(user, 24).allowed).toBe(true);
      expect(canSaveGamePreset(user, 25).allowed).toBe(false);
    });

    it('allows enterprise user up to 100 presets', () => {
      const user = createUser({ subscriptionTier: 'enterprise' });
      expect(canSaveGamePreset(user, 99).allowed).toBe(true);
      expect(canSaveGamePreset(user, 100).allowed).toBe(false);
    });

    it('returns proper error when limit reached', () => {
      const user = createUser({ subscriptionTier: 'free' });
      const result = canSaveGamePreset(user, 5);
      expect(result.allowed).toBe(false);
      if (!result.allowed) {
        expect(result.code).toBe('PRESET_LIMIT_REACHED');
      }
    });
  });

  describe('canDeleteGamePreset', () => {
    it('allows admin to delete any preset', () => {
      const user = createUser({ isAdmin: true });
      expect(canDeleteGamePreset(user, 'other-user').allowed).toBe(true);
    });

    it('allows owner to delete their preset', () => {
      const user = createUser({ userId: 'user-123' });
      expect(canDeleteGamePreset(user, 'user-123').allowed).toBe(true);
    });

    it('rejects non-owner from deleting preset', () => {
      const user = createUser({ userId: 'user-123' });
      const result = canDeleteGamePreset(user, 'other-user');
      expect(result.allowed).toBe(false);
      if (!result.allowed) {
        expect(result.code).toBe('NOT_OWNER');
      }
    });
  });

  describe('canViewGameHistory', () => {
    it('allows admin to view any history', () => {
      const user = createUser({ isAdmin: true });
      expect(canViewGameHistory(user, 'other-user').allowed).toBe(true);
    });

    it('allows owner to view their history', () => {
      const user = createUser({ userId: 'user-123' });
      expect(canViewGameHistory(user, 'user-123').allowed).toBe(true);
    });

    it('rejects non-owner from viewing history', () => {
      const user = createUser({ userId: 'user-123' });
      const result = canViewGameHistory(user, 'other-user');
      expect(result.allowed).toBe(false);
    });
  });

  describe('canUseTargetCount', () => {
    it('rejects count below minimum', () => {
      const user = createUser();
      const result = canUseTargetCount(user, 0);
      expect(result.allowed).toBe(false);
      if (!result.allowed) {
        expect(result.code).toBe('INSUFFICIENT_TARGETS');
      }
    });

    it('allows free user up to 10 targets', () => {
      const user = createUser({ subscriptionTier: 'free' });
      expect(canUseTargetCount(user, 10).allowed).toBe(true);
      expect(canUseTargetCount(user, 11).allowed).toBe(false);
    });

    it('allows pro user up to 25 targets', () => {
      const user = createUser({ subscriptionTier: 'pro' });
      expect(canUseTargetCount(user, 25).allowed).toBe(true);
      expect(canUseTargetCount(user, 26).allowed).toBe(false);
    });

    it('allows enterprise user up to max targets', () => {
      const user = createUser({ subscriptionTier: 'enterprise' });
      expect(canUseTargetCount(user, GAME_CONSTRAINTS.MAX_TARGETS).allowed).toBe(true);
    });

    it('returns proper error when limit exceeded', () => {
      const user = createUser({ subscriptionTier: 'free' });
      const result = canUseTargetCount(user, 15);
      expect(result.allowed).toBe(false);
      if (!result.allowed) {
        expect(result.code).toBe('TARGET_LIMIT_EXCEEDED');
      }
    });
  });

  describe('tier limit helpers', () => {
    describe('getMaxConcurrentSessions', () => {
      it('returns 1 for free tier', () => {
        expect(getMaxConcurrentSessions('free')).toBe(1);
      });

      it('returns 3 for pro tier', () => {
        expect(getMaxConcurrentSessions('pro')).toBe(3);
      });

      it('returns 10 for enterprise tier', () => {
        expect(getMaxConcurrentSessions('enterprise')).toBe(10);
      });

      it('returns 1 for undefined tier', () => {
        expect(getMaxConcurrentSessions(undefined)).toBe(1);
      });
    });

    describe('getMaxGamePresets', () => {
      it('returns 5 for free tier', () => {
        expect(getMaxGamePresets('free')).toBe(5);
      });

      it('returns 25 for pro tier', () => {
        expect(getMaxGamePresets('pro')).toBe(25);
      });

      it('returns 100 for enterprise tier', () => {
        expect(getMaxGamePresets('enterprise')).toBe(100);
      });
    });

    describe('getMaxTargetsPerGame', () => {
      it('returns 10 for free tier', () => {
        expect(getMaxTargetsPerGame('free')).toBe(10);
      });

      it('returns 25 for pro tier', () => {
        expect(getMaxTargetsPerGame('pro')).toBe(25);
      });

      it('returns max targets for enterprise tier', () => {
        expect(getMaxTargetsPerGame('enterprise')).toBe(GAME_CONSTRAINTS.MAX_TARGETS);
      });
    });

    describe('getMaxGameDuration', () => {
      it('returns 10 minutes for free tier', () => {
        expect(getMaxGameDuration('free')).toBe(10 * 60 * 1000);
      });

      it('returns 30 minutes for pro tier', () => {
        expect(getMaxGameDuration('pro')).toBe(30 * 60 * 1000);
      });

      it('returns max time for enterprise tier', () => {
        expect(getMaxGameDuration('enterprise')).toBe(GAME_CONSTRAINTS.MAX_TIME_LIMIT_MS);
      });
    });
  });
});
