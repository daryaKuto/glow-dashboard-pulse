/**
 * Component that gates premium features behind subscription check
 * Shows upgrade prompt for free users, renders children for premium users
 */

import React from 'react';
import { useSubscription } from '@/shared/hooks/use-subscription';
import { Lock, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface SubscriptionGateProps {
  children: React.ReactNode;
  featureName?: string;
  showUpgradePrompt?: boolean;
}

export const SubscriptionGate: React.FC<SubscriptionGateProps> = ({
  children,
  featureName = 'this feature',
  showUpgradePrompt = true,
}) => {
  const { isPremium, isLoading } = useSubscription();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-4">
        <div className="text-sm text-brand-dark/60">Loading...</div>
      </div>
    );
  }

  if (!isPremium) {
    if (!showUpgradePrompt) {
      return null;
    }

    return (
      <Card className="border-amber-200 bg-amber-50/50">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-amber-600" />
            <CardTitle className="text-base">Premium Feature</CardTitle>
          </div>
          <CardDescription className="text-sm">
            Upgrade to Premium to unlock {featureName}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <Button
              variant="default"
              size="sm"
              className="bg-amber-600 hover:bg-amber-700"
              onClick={() => {
                // TODO: Navigate to subscription/billing page
                console.log('Navigate to subscription page');
              }}
            >
              <Sparkles className="h-4 w-4 mr-2" />
              Upgrade to Premium
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return <>{children}</>;
};

/**
 * Inline lock icon component for use in buttons/menus
 */
export const PremiumLockIcon: React.FC<{ className?: string }> = ({ className = 'h-4 w-4' }) => {
  return <Lock className={className} />;
};

