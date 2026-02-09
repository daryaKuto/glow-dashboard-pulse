/**
 * Comprehensive logout utility
 * Clears all application state, localStorage, and resets stores
 *
 * This utility follows the architecture pattern where:
 * - React Query cache is cleared via queryClient.clear() for all server data
 * - Feature-scoped state (like game flow) is reset via feature public APIs
 */

import { resetGameFlowState } from '@/features/games';
import { queryClient } from '@/app/query-client';

/**
 * Clear all application state and data
 */
export const clearAllApplicationState = () => {
  console.log('[Logout] Clearing all application state...');

  try {
    localStorage.clear();
    console.log('[Logout] localStorage cleared');

    sessionStorage.clear();
    console.log('[Logout] sessionStorage cleared');

    if ('caches' in window) {
      caches.keys().then(names => {
        names.forEach(name => {
          caches.delete(name);
        });
      });
    }

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(registrations => {
        registrations.forEach(registration => {
          registration.unregister();
        });
      });
    }

    console.log('[Logout] Application state cleared successfully');
  } catch (error) {
    console.error('[Logout] Error clearing application state:', error);
  }
};

/**
 * Reset all data caches and stores
 *
 * Uses a single queryClient.clear() call for all React Query-managed server data,
 * and calls feature-specific reset functions for any remaining Zustand stores.
 */
export const resetAllStores = () => {
  console.log('[Logout] Resetting all stores...');

  try {
    // Clear all React Query caches (covers all server data)
    queryClient.clear();
    console.log('[Logout] React Query cache cleared');

    // Reset the game flow store via its public API
    // (the only remaining Zustand store with runtime state)
    try {
      resetGameFlowState();
      console.log('[Logout] GameFlow store reset');
    } catch (error) {
      console.warn('[Logout] Could not reset GameFlow store:', error);
    }

    console.log('[Logout] All stores reset successfully');
  } catch (error) {
    console.error('[Logout] Error resetting stores:', error);
  }
};

/**
 * Complete logout process
 */
export const performCompleteLogout = () => {
  console.log('[Logout] Starting complete logout process...');

  clearAllApplicationState();
  resetAllStores();

  // Clear any intervals or timeouts
  try {
    const highestTimeoutId = setTimeout(() => {}, 0);
    for (let i = 0; i < highestTimeoutId; i++) {
      clearTimeout(i);
    }

    const highestIntervalId = setInterval(() => {}, 0);
    for (let i = 0; i < highestIntervalId; i++) {
      clearInterval(i);
    }
  } catch (error) {
    console.warn('[Logout] Error clearing intervals/timeouts:', error);
  }

  console.log('[Logout] Complete logout process finished');
};
