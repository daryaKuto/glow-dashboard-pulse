/**
 * Auth Feature Module
 * 
 * This feature now includes a full data layer with repo/service/hooks.
 * 
 * Structure:
 * - repo.ts: Data access layer (Supabase auth operations)
 * - service.ts: Business logic layer (validation, orchestration)
 * - hooks.ts: React Query hooks for auth data (subscription tier)
 * - schema.ts: Zod schemas and types
 * 
 * Note: Core auth state (user, session, loading) is still managed by 
 * AuthProvider (src/providers/AuthProvider.tsx) for session lifecycle.
 * The repo/service here centralizes Supabase auth operations.
 * 
 * For auth state: useAuth() from @/shared/hooks/use-auth
 * For subscription: useSubscription() from this module
 */

// Types from schema
export type {
  AuthSession,
  SignInData,
  SignUpData,
  ResetPasswordData,
  UpdatePasswordData,
  ChangePasswordData,
} from './schema';

// Types from repo/service
export type { AuthResult, SubscriptionTier } from './repo';

// Re-export useAuth hook for convenience
export { useAuth } from '@/shared/hooks/use-auth';

// Hooks
export { useSubscription, authQueryKeys } from './hooks';

// Service functions (for use in AuthProvider)
export * as authService from './service';

// Repo functions (for direct access if needed)
export * as authRepo from './repo';
