/**
 * Auth Feature Hooks
 * 
 * React Query hooks for auth-related data fetching.
 * Note: Core auth state (user, session) is managed by AuthProvider.
 * These hooks are for supplementary auth data like subscription tier.
 */

import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/shared/hooks/use-auth';
import * as authService from './service';
import { isApiOk } from '@/shared/lib/api-response';

export type { SubscriptionTier } from './repo';

/**
 * Query keys for auth feature
 */
export const authQueryKeys = {
  all: ['auth'] as const,
  subscription: (userId: string) => [...authQueryKeys.all, 'subscription', userId] as const,
};

/**
 * Hook to get user subscription tier
 * Uses React Query for caching and automatic refetching
 */
export function useSubscription() {
  const { user } = useAuth();

  const query = useQuery({
    queryKey: authQueryKeys.subscription(user?.id ?? ''),
    queryFn: async () => {
      if (!user?.id) {
        return 'free' as const;
      }
      const result = await authService.getSubscriptionTier(user.id);
      if (isApiOk(result)) {
        return result.data;
      }
      // Default to free on error
      return 'free' as const;
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });

  const tier = query.data ?? 'free';
  const isPremium = tier === 'premium' || tier === 'enterprise';

  return {
    tier,
    isPremium,
    isLoading: query.isLoading,
    error: query.error?.message ?? null,
  };
}

