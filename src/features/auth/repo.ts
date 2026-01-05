/**
 * Auth Feature Repository
 * 
 * Data access layer for authentication operations.
 * All Supabase auth operations are centralized here.
 */

import { supabase } from '@/data/supabase-client';
import { apiOk, apiErr, type ApiResponse } from '@/shared/lib/api-response';
import type { User, Session } from '@supabase/supabase-js';

export type AuthResult = {
  user: User;
  session: Session;
};

export type SubscriptionTier = 'free' | 'premium' | 'enterprise';

/**
 * Get current session from Supabase
 */
export async function getSession(): Promise<ApiResponse<{ session: Session | null }>> {
  try {
    const { data, error } = await supabase.auth.getSession();
    
    if (error) {
      return apiErr('AUTH_SESSION_ERROR', error.message);
    }
    
    return apiOk({ session: data.session });
  } catch (error) {
    return apiErr('AUTH_SESSION_ERROR', error instanceof Error ? error.message : 'Failed to get session');
  }
}

/**
 * Get current user from Supabase
 */
export async function getCurrentUser(): Promise<ApiResponse<{ user: User | null }>> {
  try {
    const { data, error } = await supabase.auth.getUser();
    
    if (error) {
      return apiErr('AUTH_USER_ERROR', error.message);
    }
    
    return apiOk({ user: data.user });
  } catch (error) {
    return apiErr('AUTH_USER_ERROR', error instanceof Error ? error.message : 'Failed to get user');
  }
}

/**
 * Sign in with email and password
 */
export async function signIn(email: string, password: string): Promise<ApiResponse<AuthResult>> {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return apiErr('AUTH_SIGN_IN_ERROR', error.message);
    }

    if (!data.user || !data.session) {
      return apiErr('AUTH_SIGN_IN_ERROR', 'Sign in succeeded but no user/session returned');
    }

    return apiOk({ user: data.user, session: data.session });
  } catch (error) {
    return apiErr('AUTH_SIGN_IN_ERROR', error instanceof Error ? error.message : 'Sign in failed');
  }
}

/**
 * Sign up with email and password
 */
export async function signUp(
  email: string,
  password: string,
  userData?: Record<string, unknown>
): Promise<ApiResponse<AuthResult>> {
  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: userData,
      },
    });

    if (error) {
      return apiErr('AUTH_SIGN_UP_ERROR', error.message);
    }

    if (!data.user || !data.session) {
      return apiErr('AUTH_SIGN_UP_ERROR', 'Sign up succeeded but no user/session returned');
    }

    return apiOk({ user: data.user, session: data.session });
  } catch (error) {
    return apiErr('AUTH_SIGN_UP_ERROR', error instanceof Error ? error.message : 'Sign up failed');
  }
}

/**
 * Sign out current user
 */
export async function signOut(): Promise<ApiResponse<void>> {
  try {
    const { error } = await supabase.auth.signOut();

    if (error) {
      return apiErr('AUTH_SIGN_OUT_ERROR', error.message);
    }

    return apiOk(undefined);
  } catch (error) {
    return apiErr('AUTH_SIGN_OUT_ERROR', error instanceof Error ? error.message : 'Sign out failed');
  }
}

/**
 * Send password reset email
 */
export async function resetPassword(email: string): Promise<ApiResponse<void>> {
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) {
      return apiErr('AUTH_RESET_PASSWORD_ERROR', error.message);
    }

    return apiOk(undefined);
  } catch (error) {
    return apiErr('AUTH_RESET_PASSWORD_ERROR', error instanceof Error ? error.message : 'Password reset failed');
  }
}

/**
 * Update password for authenticated user
 */
export async function updatePassword(newPassword: string): Promise<ApiResponse<void>> {
  try {
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (error) {
      return apiErr('AUTH_UPDATE_PASSWORD_ERROR', error.message);
    }

    return apiOk(undefined);
  } catch (error) {
    return apiErr('AUTH_UPDATE_PASSWORD_ERROR', error instanceof Error ? error.message : 'Password update failed');
  }
}

/**
 * Get session from OAuth callback URL
 */
export async function getSessionFromUrl(): Promise<ApiResponse<{ session: Session | null }>> {
  try {
    const { data, error } = await supabase.auth.getSessionFromUrl({ storeSession: true });
    
    if (error) {
      return apiErr('AUTH_CALLBACK_ERROR', error.message);
    }
    
    return apiOk({ session: data.session });
  } catch (error) {
    return apiErr('AUTH_CALLBACK_ERROR', error instanceof Error ? error.message : 'OAuth callback failed');
  }
}

/**
 * Subscribe to auth state changes
 * Returns an unsubscribe function
 */
export function onAuthStateChange(
  callback: (event: string, session: Session | null) => void
): { unsubscribe: () => void } {
  const { data: { subscription } } = supabase.auth.onAuthStateChange(callback);
  return { unsubscribe: () => subscription.unsubscribe() };
}

/**
 * Get user subscription tier from user_profiles table
 */
export async function getSubscriptionTier(userId: string): Promise<ApiResponse<SubscriptionTier>> {
  try {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('subscription_tier')
      .eq('id', userId)
      .single();

    if (error) {
      return apiErr('AUTH_SUBSCRIPTION_ERROR', error.message);
    }

    // Validate tier value, default to 'free' if invalid
    const validTier = ['free', 'premium', 'enterprise'].includes(data?.subscription_tier)
      ? (data.subscription_tier as SubscriptionTier)
      : 'free';

    return apiOk(validTier);
  } catch (error) {
    return apiErr('AUTH_SUBSCRIPTION_ERROR', error instanceof Error ? error.message : 'Failed to fetch subscription');
  }
}

