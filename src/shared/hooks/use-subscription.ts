/**
 * Hook to check user subscription tier and premium status
 * 
 * @migrated Subscription logic moved to src/features/auth/hooks.ts
 * This file re-exports from the auth feature for backward compatibility.
 * 
 * @see src/features/auth/hooks.ts for implementation
 */

export { useSubscription } from '@/features/auth/hooks';
export type { SubscriptionTier } from '@/features/auth/hooks';
