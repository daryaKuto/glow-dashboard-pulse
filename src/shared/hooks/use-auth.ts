/**
 * Hook to access authentication context
 *
 * @migrated from src/hooks/useAuth.ts
 * @see src/_legacy/README.md for migration details
 */

import { useContext } from 'react';
import { AuthContext } from '@/contexts/AuthContext';

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
