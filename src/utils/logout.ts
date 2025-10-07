/**
 * Comprehensive logout utility
 * Clears all application state, localStorage, and resets stores
 */

import { useGameFlow } from '@/store/useGameFlow';
import { useStats } from '@/store/useStats';
import { useProfile } from '@/store/useProfile';
import { useRooms } from '@/store/useRooms';
import { useTargets } from '@/store/useTargets';
import { useDashboardStats } from '@/store/useDashboardStats';

/**
 * Clear all application state and data
 */
export const clearAllApplicationState = () => {
  console.log('[Logout] Clearing all application state...');
  
  try {
    // Clear localStorage completely
    localStorage.clear();
    console.log('[Logout] localStorage cleared');
    
    // Clear sessionStorage
    sessionStorage.clear();
    console.log('[Logout] sessionStorage cleared');
    
    // Clear any cached data in browser
    if ('caches' in window) {
      caches.keys().then(names => {
        names.forEach(name => {
          caches.delete(name);
        });
      });
    }
    
    // Clear any service worker registrations
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
 * Reset all Zustand stores to their initial state
 */
export const resetAllStores = () => {
  console.log('[Logout] Resetting all stores...');
  
  try {
    // Reset stores that have reset methods
    const stores = [
      useGameFlow,
      useStats,
      useProfile,
      useRooms,
      useTargets,
      useDashboardStats
    ];
    
    stores.forEach(store => {
      try {
        const storeInstance = store.getState();
        if (storeInstance && typeof storeInstance.reset === 'function') {
          storeInstance.reset();
          console.log(`[Logout] Reset store: ${store.name || 'Unknown'}`);
        }
      } catch (error) {
        console.warn(`[Logout] Could not reset store:`, error);
      }
    });
    
    console.log('[Logout] All stores reset successfully');
  } catch (error) {
    console.error('[Logout] Error resetting stores:', error);
  }
};

/**
 * Complete logout process
 * This should be called when the user logs out
 */
export const performCompleteLogout = () => {
  console.log('[Logout] Starting complete logout process...');
  
  // Clear all application state
  clearAllApplicationState();
  
  // Reset all stores
  resetAllStores();
  
  // Clear any WebSocket connections
  try {
    // Close any open WebSocket connections
    if (window.WebSocket) {
      // This is a basic approach - in a real app you'd track WebSocket instances
      console.log('[Logout] WebSocket connections should be closed by their respective services');
    }
  } catch (error) {
    console.warn('[Logout] Error closing WebSocket connections:', error);
  }
  
  // Clear any intervals or timeouts
  try {
    // Clear all intervals and timeouts
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
