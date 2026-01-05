/**
 * Auth Feature Service
 * 
 * Business logic layer for authentication operations.
 * Orchestrates auth operations and handles cross-cutting concerns.
 */

import * as authRepo from './repo';
import { apiErr, isApiOk, type ApiResponse } from '@/shared/lib/api-response';
import type { User, Session } from '@supabase/supabase-js';

export type { AuthResult, SubscriptionTier } from './repo';

/**
 * Check if user is authenticated
 */
export async function isAuthenticated(): Promise<boolean> {
  const result = await authRepo.getSession();
  return isApiOk(result) && result.data.session !== null;
}

/**
 * Get current session
 */
export async function getSession(): Promise<ApiResponse<{ session: Session | null }>> {
  return authRepo.getSession();
}

/**
 * Get current user
 */
export async function getCurrentUser(): Promise<ApiResponse<{ user: User | null }>> {
  return authRepo.getCurrentUser();
}

/**
 * Sign in with email and password
 */
export async function signIn(
  email: string,
  password: string
): Promise<ApiResponse<{ user: User; session: Session }>> {
  // Validate inputs
  if (!email || !email.includes('@')) {
    return apiErr('VALIDATION_ERROR', 'Please enter a valid email');
  }
  if (!password || password.length < 6) {
    return apiErr('VALIDATION_ERROR', 'Password must be at least 6 characters');
  }

  return authRepo.signIn(email, password);
}

/**
 * Sign up with email and password
 */
export async function signUp(
  email: string,
  password: string,
  userData?: Record<string, unknown>
): Promise<ApiResponse<{ user: User; session: Session }>> {
  // Validate inputs
  if (!email || !email.includes('@')) {
    return apiErr('VALIDATION_ERROR', 'Please enter a valid email');
  }
  if (!password || password.length < 6) {
    return apiErr('VALIDATION_ERROR', 'Password must be at least 6 characters');
  }

  return authRepo.signUp(email, password, userData);
}

/**
 * Sign out current user
 */
export async function signOut(): Promise<ApiResponse<void>> {
  return authRepo.signOut();
}

/**
 * Send password reset email
 */
export async function resetPassword(email: string): Promise<ApiResponse<void>> {
  // Validate email
  if (!email || !email.includes('@')) {
    return apiErr('VALIDATION_ERROR', 'Please enter a valid email');
  }

  return authRepo.resetPassword(email);
}

/**
 * Update password for authenticated user
 */
export async function updatePassword(newPassword: string): Promise<ApiResponse<void>> {
  // Validate password
  if (!newPassword || newPassword.length < 6) {
    return apiErr('VALIDATION_ERROR', 'Password must be at least 6 characters');
  }

  return authRepo.updatePassword(newPassword);
}

/**
 * Change password (verify current password first)
 */
export async function changePassword(
  currentPassword: string,
  newPassword: string
): Promise<ApiResponse<void>> {
  // Validate passwords
  if (!currentPassword || currentPassword.length < 6) {
    return apiErr('VALIDATION_ERROR', 'Current password must be at least 6 characters');
  }
  if (!newPassword || newPassword.length < 6) {
    return apiErr('VALIDATION_ERROR', 'New password must be at least 6 characters');
  }

  // Get current user email
  const userResult = await authRepo.getCurrentUser();
  if (!isApiOk(userResult) || !userResult.data.user?.email) {
    return apiErr('AUTH_ERROR', 'No authenticated user found');
  }

  // Verify current password by attempting to sign in
  const verifyResult = await authRepo.signIn(userResult.data.user.email, currentPassword);
  if (!isApiOk(verifyResult)) {
    return apiErr('AUTH_ERROR', 'Current password is incorrect');
  }

  // Update to new password
  return authRepo.updatePassword(newPassword);
}

/**
 * Handle OAuth callback
 */
export async function handleOAuthCallback(): Promise<ApiResponse<{ session: Session | null }>> {
  return authRepo.getSessionFromUrl();
}

/**
 * Subscribe to auth state changes
 */
export function onAuthStateChange(
  callback: (event: string, session: Session | null) => void
): { unsubscribe: () => void } {
  return authRepo.onAuthStateChange(callback);
}

/**
 * Get user subscription tier
 */
export async function getSubscriptionTier(
  userId: string
): Promise<ApiResponse<'free' | 'premium' | 'enterprise'>> {
  if (!userId) {
    return apiErr('VALIDATION_ERROR', 'User ID is required');
  }

  return authRepo.getSubscriptionTier(userId);
}

/**
 * Check if user has premium subscription
 */
export async function isPremiumUser(userId: string): Promise<boolean> {
  const result = await authRepo.getSubscriptionTier(userId);
  if (!isApiOk(result)) {
    return false;
  }
  return result.data === 'premium' || result.data === 'enterprise';
}

