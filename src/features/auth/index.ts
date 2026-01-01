/**
 * Public API for Auth feature
 * 
 * Note: Auth state is managed by AuthProvider (src/providers/AuthProvider.tsx).
 * This feature module provides types and utilities for auth-related operations.
 * 
 * For auth state (user, session, loading), use the AuthProvider's useAuth hook.
 */

// Types
export type {
  AuthSession,
  SignInData,
  SignUpData,
  ResetPasswordData,
  UpdatePasswordData,
  ChangePasswordData,
} from './schema';

// Re-export AuthProvider hook for convenience
export { useAuth } from '@/providers/AuthProvider';

