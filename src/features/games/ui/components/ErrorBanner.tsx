import React from 'react';
import { AlertCircle, X } from 'lucide-react';

export type ErrorBannerProps = {
  message: string;
  onDismiss: () => void;
};

const _ErrorBanner: React.FC<ErrorBannerProps> = ({ message, onDismiss }) => {
  return (
    <div className="rounded-[var(--radius)] bg-red-50 shadow-subtle px-4 py-3 flex items-start gap-3">
      <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
      <div className="flex-1">
        <p className="text-sm text-red-800 font-body">{message}</p>
      </div>
      <button onClick={onDismiss} className="rounded-full p-1 hover:bg-red-100 transition-colors">
        <X className="h-3.5 w-3.5 text-red-500" />
      </button>
    </div>
  );
};

export const ErrorBanner = React.memo(_ErrorBanner);
ErrorBanner.displayName = 'ErrorBanner';
