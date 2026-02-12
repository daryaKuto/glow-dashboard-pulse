import { useState, useCallback } from 'react';
import { ensureTbAuthToken } from '@/features/games/lib/thingsboard-client';

export interface UseTbAuthReturn {
  directControlToken: string | null;
  directControlError: string | null;
  isDirectAuthLoading: boolean;
  setDirectControlError: React.Dispatch<React.SetStateAction<string | null>>;
  refreshDirectAuthToken: () => Promise<string>;
}

export function useTbAuth(): UseTbAuthReturn {
  // Stores the JWT returned by `ensureTbAuthToken` for RPCs and direct WebSocket subscriptions.
  const [directControlToken, setDirectControlToken] = useState<string | null>(null);
  // Populates the dialog error banner whenever the ThingsBoard auth handshake fails.
  const [directControlError, setDirectControlError] = useState<string | null>(null);
  // Spinner state for the authentication request shown while the dialog prepares direct control.
  const [isDirectAuthLoading, setIsDirectAuthLoading] = useState(false);

  const refreshDirectAuthToken = useCallback(async () => {
    try {
      setIsDirectAuthLoading(true);
      const token = await ensureTbAuthToken();
      setDirectControlToken(token);
      setDirectControlError(null);
      return token;
    } catch (authError) {
      const message =
        authError instanceof Error ? authError.message : 'Failed to refresh ThingsBoard authentication.';
      setDirectControlError(message);
      throw authError;
    } finally {
      setIsDirectAuthLoading(false);
    }
  }, []);

  return {
    directControlToken,
    directControlError,
    isDirectAuthLoading,
    setDirectControlError,
    refreshDirectAuthToken,
  };
}
