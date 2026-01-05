import React, { useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { supabase } from '@/data/supabase-client';
import { ensureThingsboardSession, invalidateThingsboardSessionCache } from '@/lib/edge';
import { authService } from '@/features/auth';
import { saveThingsBoardCredentialsService } from '@/features/profile/service';
import { performCompleteLogout } from '@/utils/logout';
import { isApiOk } from '@/shared/lib/api-response';
import type { User, Session } from '@supabase/supabase-js';
import { throttledLog } from '@/utils/log-throttle';
import { AuthContext } from '@/contexts/AuthContext';

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [hasCheckedSession, setHasCheckedSession] = useState(false);

  // Check if user is authenticated
  const checkSession = useCallback(async () => {
    setLoading(true);
    
    try {
      const result = await authService.getSession();
      
      if (!isApiOk(result)) {
        console.error('[AuthProvider] Session error:', result.error);
        setUser(null);
        setSession(null);
        invalidateThingsboardSessionCache();
        setLoading(false);
        return;
      }

      const currentSession = result.data.session;

      if (currentSession?.user) {
        setUser(currentSession.user);
        setSession(currentSession);
        const expiresIn = currentSession.expires_at ? currentSession.expires_at * 1000 - Date.now() : null;
        // Log session establishment in dev mode only (throttled to prevent flooding)
        if (import.meta.env.DEV) {
          throttledLog('auth-session', 5000, '[Auth] Session established', {
            source: 'supabase.auth.getSession',
            supabaseProjectUrl: supabase.supabaseUrl,
            tablesInPlay: ['auth.sessions', 'public.user_profiles'],
            userId: currentSession.user.id,
            email: currentSession.user.email,
            appMetadata: currentSession.user.app_metadata,
            lastSignInAt: currentSession.user.last_sign_in_at,
            expiresAt: currentSession.expires_at ? new Date(currentSession.expires_at * 1000).toISOString() : null,
            expiresInMs: expiresIn,
            roles: currentSession.user.app_metadata?.roles ?? null,
          });
        }
        // Defer ThingsBoard session fetch to avoid rate limiting on initial load
        // It will be fetched lazily when actually needed
        setTimeout(() => {
          void ensureThingsboardSession().catch((tbError) => {
            console.warn('[AuthProvider] Prefetch ThingsBoard session failed (non-blocking):', tbError);
          });
        }, 2000); // Delay by 2 seconds to let other initial requests complete
      } else {
        setUser(null);
        setSession(null);
        invalidateThingsboardSessionCache();
      }
    } catch (error) {
      console.error('[AuthProvider] Session check error:', error);
      setUser(null);
      setSession(null);
      invalidateThingsboardSessionCache();
    } finally {
      setLoading(false);
    }
  }, []);


  // Check session on mount
  useEffect(() => {
    if (!hasCheckedSession) {
      checkSession();
      setHasCheckedSession(true);
    }
  }, [hasCheckedSession, checkSession]);

  // Sign out
  const signOut = useCallback(async () => {
    try {
      // Clear Supabase session
      const result = await authService.signOut();
      if (!isApiOk(result)) {
        console.error('[AuthProvider] Supabase sign out error:', result.error);
      }
      
      // Clear all application state using comprehensive logout utility
      performCompleteLogout();
      invalidateThingsboardSessionCache();
      // Clear local auth state
      setUser(null);
      setSession(null);
      
      // Force redirect to login page to ensure clean state
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    } catch (error) {
      console.error('[AuthProvider] Sign out error:', error);
      // Even if there's an error, clear everything
      performCompleteLogout();
      invalidateThingsboardSessionCache();
      setUser(null);
      setSession(null);
      window.location.href = '/login';
    }
  }, []);

  // Sign in with email and password
  const signIn = useCallback(async (email: string, password: string) => {
    try {
      const result = await authService.signIn(email, password);
      
      if (!isApiOk(result)) {
        throw new Error(result.error.message);
      }

      const { user: authUser, session: authSession } = result.data;
      setUser(authUser);
      setSession(authSession);
      
      // Trigger ThingsBoard authentication in background
      try {
        const { unifiedDataService } = await import('@/features/profile/lib/unified-data');
        await unifiedDataService.getThingsBoardData(authUser.id, authUser.email);
        // Sync WiFi credentials after ThingsBoard authentication
        try {
          const { syncWifiCredentialsOnLogin } = await import('@/features/profile/lib/wifi-credentials');
          await syncWifiCredentialsOnLogin(authUser.id);
        } catch (wifiError) {
          console.warn('[AuthProvider] WiFi sync failed (non-blocking):', wifiError);
          // Don't block login if WiFi sync fails
        }
      } catch (tbError) {
        console.warn('[AuthProvider] ThingsBoard authentication failed (non-blocking):', tbError);
        // Don't block login if ThingsBoard fails
      }

      void ensureThingsboardSession().catch((tbError) => {
        console.warn('[AuthProvider] Unable to obtain ThingsBoard session token after login (non-blocking):', tbError);
      });

      if (authUser?.email && import.meta.env.DEV) {
        console.info('[Auth] Credentials accepted', {
          source: 'supabase.auth.signInWithPassword',
          email: authUser.email,
          userId: authUser.id,
          supabaseProjectUrl: supabase.supabaseUrl,
          tablesTouched: ['auth.sessions', 'public.user_profiles'],
        });
      }
    } catch (error) {
      console.error('[AuthProvider] Sign in error:', error);
      throw error;
    }
  }, []);

  // Sign up with email and password
  const signUp = useCallback(async (email: string, password: string, userData?: Record<string, unknown>) => {
    try {
      const result = await authService.signUp(email, password, userData);
      
      if (!isApiOk(result)) {
        throw new Error(result.error.message);
      }

      const { user: authUser, session: authSession } = result.data;
      setUser(authUser);
      setSession(authSession);
      
      // Save ThingsBoard credentials using the same email/password
      try {
        const saveResult = await saveThingsBoardCredentialsService(authUser.id, email, password);
        if (!saveResult.ok || !saveResult.data) {
          throw new Error(saveResult.ok ? 'Failed to save ThingsBoard credentials' : saveResult.error.message);
        }
      } catch (tbError) {
        console.warn('[AuthProvider] Failed to save ThingsBoard credentials (user can set up later):', tbError);
        // Don't fail the signup if ThingsBoard credential saving fails
        // User can set up ThingsBoard integration later from their profile
      }

      if (authUser?.email && import.meta.env.DEV) {
        console.log('[Auth] Signed up as', authUser.email);
      }
    } catch (error) {
      console.error('[AuthProvider] Sign up error:', error);
      throw error;
    }
  }, []);

  // Password reset - send reset email
  const resetPassword = useCallback(async (email: string) => {
    try {
      const result = await authService.resetPassword(email);
      
      if (!isApiOk(result)) {
        throw new Error(result.error.message);
      }
    } catch (error) {
      console.error('[AuthProvider] Password reset error:', error);
      throw error;
    }
  }, []);

  // Update password - for authenticated users
  const updatePassword = useCallback(async (newPassword: string) => {
    try {
      const result = await authService.updatePassword(newPassword);
      
      if (!isApiOk(result)) {
        throw new Error(result.error.message);
      }
    } catch (error) {
      console.error('[AuthProvider] Update password error:', error);
      throw error;
    }
  }, []);

  // Change password - verify current password first
  const changePassword = useCallback(async (currentPassword: string, newPassword: string) => {
    try {
      const result = await authService.changePassword(currentPassword, newPassword);
      
      if (!isApiOk(result)) {
        throw new Error(result.error.message);
      }
    } catch (error) {
      console.error('[AuthProvider] Change password error:', error);
      throw error;
    }
  }, []);

  const value: AuthContextType = {
    user,
    session,
    loading,
    checkSession,
    signOut,
    signIn,
    signUp,
    resetPassword,
    updatePassword,
    changePassword
  };
  
  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
