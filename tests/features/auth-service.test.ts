import { describe, it, expect, vi, beforeEach } from 'vitest';
import { apiOk, apiErr, isApiOk } from '../../src/shared/lib/api-response';

// Mock the auth repo so we never hit Supabase
vi.mock('../../src/features/auth/repo', () => ({
  getSession: vi.fn(),
  getCurrentUser: vi.fn(),
  signIn: vi.fn(),
  signUp: vi.fn(),
  signOut: vi.fn(),
  resetPassword: vi.fn(),
  updatePassword: vi.fn(),
  getSessionFromUrl: vi.fn(),
  onAuthStateChange: vi.fn(),
  getSubscriptionTier: vi.fn(),
}));

import * as authRepo from '../../src/features/auth/repo';
import {
  signIn,
  signUp,
  signOut,
  resetPassword,
  updatePassword,
  changePassword,
  isAuthenticated,
  getSubscriptionTier,
  isPremiumUser,
} from '../../src/features/auth/service';

const mockRepo = vi.mocked(authRepo);

const fakeUser = { id: 'u1', email: 'test@example.com' } as any;
const fakeSession = { access_token: 'tok' } as any;

beforeEach(() => {
  vi.resetAllMocks();
});

// ---------------------------------------------------------------------------
// signIn
// ---------------------------------------------------------------------------
describe('signIn', () => {
  it('rejects empty email', async () => {
    const res = await signIn('', 'password123');
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.message).toMatch(/valid email/i);
  });

  it('rejects email without @', async () => {
    const res = await signIn('notemail', 'password123');
    expect(res.ok).toBe(false);
  });

  it('rejects password shorter than 6 chars', async () => {
    const res = await signIn('a@b.com', '12345');
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.message).toMatch(/6 characters/i);
  });

  it('delegates to repo on valid input', async () => {
    mockRepo.signIn.mockResolvedValue(apiOk({ user: fakeUser, session: fakeSession }));
    const res = await signIn('a@b.com', 'password123');
    expect(mockRepo.signIn).toHaveBeenCalledWith('a@b.com', 'password123');
    expect(res.ok).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// signUp
// ---------------------------------------------------------------------------
describe('signUp', () => {
  it('rejects empty email', async () => {
    const res = await signUp('', 'password123');
    expect(res.ok).toBe(false);
  });

  it('rejects short password', async () => {
    const res = await signUp('a@b.com', '123');
    expect(res.ok).toBe(false);
  });

  it('delegates to repo on valid input', async () => {
    mockRepo.signUp.mockResolvedValue(apiOk({ user: fakeUser, session: fakeSession }));
    const res = await signUp('a@b.com', 'password123', { name: 'Test' });
    expect(mockRepo.signUp).toHaveBeenCalledWith('a@b.com', 'password123', { name: 'Test' });
    expect(res.ok).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// resetPassword
// ---------------------------------------------------------------------------
describe('resetPassword', () => {
  it('rejects invalid email', async () => {
    const res = await resetPassword('');
    expect(res.ok).toBe(false);
  });

  it('delegates to repo on valid email', async () => {
    mockRepo.resetPassword.mockResolvedValue(apiOk(undefined));
    const res = await resetPassword('a@b.com');
    expect(mockRepo.resetPassword).toHaveBeenCalledWith('a@b.com');
    expect(res.ok).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// updatePassword
// ---------------------------------------------------------------------------
describe('updatePassword', () => {
  it('rejects short password', async () => {
    const res = await updatePassword('abc');
    expect(res.ok).toBe(false);
  });

  it('delegates to repo on valid password', async () => {
    mockRepo.updatePassword.mockResolvedValue(apiOk(undefined));
    const res = await updatePassword('newpass123');
    expect(mockRepo.updatePassword).toHaveBeenCalledWith('newpass123');
    expect(res.ok).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// changePassword
// ---------------------------------------------------------------------------
describe('changePassword', () => {
  it('rejects short current password', async () => {
    const res = await changePassword('short', 'newpass123');
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.message).toMatch(/current password/i);
  });

  it('rejects short new password', async () => {
    const res = await changePassword('oldpass123', 'abc');
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.message).toMatch(/new password/i);
  });

  it('fails if no authenticated user', async () => {
    mockRepo.getCurrentUser.mockResolvedValue(apiOk({ user: null }));
    const res = await changePassword('oldpass123', 'newpass123');
    expect(res.ok).toBe(false);
  });

  it('fails if current password is incorrect', async () => {
    mockRepo.getCurrentUser.mockResolvedValue(apiOk({ user: fakeUser }));
    mockRepo.signIn.mockResolvedValue(apiErr('AUTH_ERROR', 'Invalid credentials'));
    const res = await changePassword('wrongpass', 'newpass123');
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.message).toMatch(/incorrect/i);
  });

  it('succeeds when current password verifies', async () => {
    mockRepo.getCurrentUser.mockResolvedValue(apiOk({ user: fakeUser }));
    mockRepo.signIn.mockResolvedValue(apiOk({ user: fakeUser, session: fakeSession }));
    mockRepo.updatePassword.mockResolvedValue(apiOk(undefined));

    const res = await changePassword('oldpass123', 'newpass123');
    expect(res.ok).toBe(true);
    expect(mockRepo.updatePassword).toHaveBeenCalledWith('newpass123');
  });
});

// ---------------------------------------------------------------------------
// isAuthenticated
// ---------------------------------------------------------------------------
describe('isAuthenticated', () => {
  it('returns true when session exists', async () => {
    mockRepo.getSession.mockResolvedValue(apiOk({ session: fakeSession }));
    expect(await isAuthenticated()).toBe(true);
  });

  it('returns false when session is null', async () => {
    mockRepo.getSession.mockResolvedValue(apiOk({ session: null }));
    expect(await isAuthenticated()).toBe(false);
  });

  it('returns false on repo error', async () => {
    mockRepo.getSession.mockResolvedValue(apiErr('AUTH_ERROR', 'failed'));
    expect(await isAuthenticated()).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// getSubscriptionTier
// ---------------------------------------------------------------------------
describe('getSubscriptionTier', () => {
  it('rejects empty userId', async () => {
    const res = await getSubscriptionTier('');
    expect(res.ok).toBe(false);
  });

  it('delegates to repo on valid userId', async () => {
    mockRepo.getSubscriptionTier.mockResolvedValue(apiOk('premium' as const));
    const res = await getSubscriptionTier('u1');
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.data).toBe('premium');
  });
});

// ---------------------------------------------------------------------------
// isPremiumUser
// ---------------------------------------------------------------------------
describe('isPremiumUser', () => {
  it('returns true for premium tier', async () => {
    mockRepo.getSubscriptionTier.mockResolvedValue(apiOk('premium' as const));
    expect(await isPremiumUser('u1')).toBe(true);
  });

  it('returns true for enterprise tier', async () => {
    mockRepo.getSubscriptionTier.mockResolvedValue(apiOk('enterprise' as const));
    expect(await isPremiumUser('u1')).toBe(true);
  });

  it('returns false for free tier', async () => {
    mockRepo.getSubscriptionTier.mockResolvedValue(apiOk('free' as const));
    expect(await isPremiumUser('u1')).toBe(false);
  });

  it('returns false on repo error', async () => {
    mockRepo.getSubscriptionTier.mockResolvedValue(apiErr('ERROR', 'failed'));
    expect(await isPremiumUser('u1')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// signOut
// ---------------------------------------------------------------------------
describe('signOut', () => {
  it('delegates to repo', async () => {
    mockRepo.signOut.mockResolvedValue(apiOk(undefined));
    const res = await signOut();
    expect(res.ok).toBe(true);
    expect(mockRepo.signOut).toHaveBeenCalled();
  });
});
