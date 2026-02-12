import { describe, it, expect } from 'vitest';
import {
  canViewDashboard,
  type UserContext,
  type DashboardContext,
} from '../../src/domain/dashboard/permissions';

describe('dashboard permissions', () => {
  const createUser = (overrides: Partial<UserContext> = {}): UserContext => ({
    userId: 'user-123',
    isAdmin: false,
    subscriptionTier: 'free',
    ...overrides,
  });

  const createDashboard = (overrides: Partial<DashboardContext> = {}): DashboardContext => ({
    ownerId: 'user-123',
    ...overrides,
  });

  describe('canViewDashboard', () => {
    it('allows admin to view any dashboard', () => {
      const user = createUser({ isAdmin: true, userId: 'admin-1' });
      const dashboard = createDashboard({ ownerId: 'other-user' });
      const result = canViewDashboard(user, dashboard);
      expect(result.allowed).toBe(true);
    });

    it('allows owner to view their dashboard', () => {
      const user = createUser({ userId: 'user-123' });
      const dashboard = createDashboard({ ownerId: 'user-123' });
      const result = canViewDashboard(user, dashboard);
      expect(result.allowed).toBe(true);
    });

    it('rejects non-owner from viewing dashboard', () => {
      const user = createUser({ userId: 'user-123' });
      const dashboard = createDashboard({ ownerId: 'other-user' });
      const result = canViewDashboard(user, dashboard);
      expect(result.allowed).toBe(false);
      if (!result.allowed) {
        expect(result.code).toBe('NOT_OWNER');
        expect(result.reason).toContain('permission');
      }
    });

    it('allows owner regardless of subscription tier', () => {
      const freeTierUser = createUser({ userId: 'user-123', subscriptionTier: 'free' });
      const proTierUser = createUser({ userId: 'user-123', subscriptionTier: 'pro' });
      const enterpriseUser = createUser({ userId: 'user-123', subscriptionTier: 'enterprise' });
      const dashboard = createDashboard({ ownerId: 'user-123' });

      expect(canViewDashboard(freeTierUser, dashboard).allowed).toBe(true);
      expect(canViewDashboard(proTierUser, dashboard).allowed).toBe(true);
      expect(canViewDashboard(enterpriseUser, dashboard).allowed).toBe(true);
    });
  });
});
