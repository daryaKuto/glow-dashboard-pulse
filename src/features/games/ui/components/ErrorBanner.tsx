import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { AlertCircle } from 'lucide-react';

export type ErrorBannerProps = {
  message: string;
  onDismiss: () => void;
};

const _ErrorBanner: React.FC<ErrorBannerProps> = ({ message, onDismiss }) => {
  return (
    <Card className="border-red-200 bg-red-50 mb-6">
      <CardContent className="p-4">
        <div className="flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-red-600" />
          <span className="text-red-800 font-medium">{message}</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={onDismiss}
            className="ml-auto text-red-600 hover:text-red-800"
          >
            ×
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export const ErrorBanner = React.memo(_ErrorBanner);
ErrorBanner.displayName = 'ErrorBanner';
