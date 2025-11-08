/**
 * Hook to check user subscription tier and premium status
 * Fetches subscription_tier from user_profiles table
 */

import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/providers/AuthProvider';

export type SubscriptionTier = 'free' | 'premium' | 'enterprise';

interface UseSubscriptionReturn {
  tier: SubscriptionTier;
  isPremium: boolean;
  isLoading: boolean;
  error: string | null;
}

export const useSubscription = (): UseSubscriptionReturn => {
  const { user } = useAuth();
  const [tier, setTier] = useState<SubscriptionTier>('free');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSubscriptionTier = async () => {
      if (!user) {
        setTier('free');
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);

        const { data, error: fetchError } = await supabase
          .from('user_profiles')
          .select('subscription_tier')
          .eq('id', user.id)
          .single();

        if (fetchError) {
          throw fetchError;
        }

        // Validate tier value, default to 'free' if invalid
        const validTier = ['free', 'premium', 'enterprise'].includes(data?.subscription_tier)
          ? (data.subscription_tier as SubscriptionTier)
          : 'free';

        setTier(validTier);
      } catch (err) {
        console.error('Error fetching subscription tier:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch subscription');
        setTier('free'); // Default to free on error
      } finally {
        setIsLoading(false);
      }
    };

    fetchSubscriptionTier();
  }, [user]);

  const isPremium = tier === 'premium' || tier === 'enterprise';

  return {
    tier,
    isPremium,
    isLoading,
    error,
  };
};

