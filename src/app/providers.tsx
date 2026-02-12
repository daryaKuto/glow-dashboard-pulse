import React from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './query-client';

interface ProvidersProps {
  children: React.ReactNode;
}

/**
 * Application providers wrapper
 * 
 * Wraps the app with React Query provider and devtools.
 * Add other providers (theme, auth, etc.) here as needed.
 */
export function Providers({ children }: ProvidersProps) {
  // React Query DevTools - optional, install with: npm install @tanstack/react-query-devtools
  let ReactQueryDevtools: React.ComponentType<{ initialIsOpen?: boolean }> | null = null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    ReactQueryDevtools = require('@tanstack/react-query-devtools').ReactQueryDevtools;
  } catch {
    // DevTools not installed - that's okay
  }

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {import.meta.env.DEV && ReactQueryDevtools && (
        <ReactQueryDevtools initialIsOpen={false} />
      )}
    </QueryClientProvider>
  );
}

