import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import supabaseAuthService from '@/services/supabase-auth';
import { saveThingsBoardCredentials } from '@/services/profile';
import { performCompleteLogout } from '@/utils/logout';
import type { User, Session } from '@supabase/supabase-js';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  
  // Methods
  checkSession: () => Promise<void>;
  signOut: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, userData?: Record<string, unknown>) => Promise<void>;
  
  // Password Management
  resetPassword: (email: string) => Promise<void>;
  updatePassword: (newPassword: string) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

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
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        console.error('[AuthProvider] Session error:', error);
        setUser(null);
        setSession(null);
        setLoading(false);
        return;
      }
      
      if (session?.user) {
        setUser(session.user);
        setSession(session);
        console.log('[Auth] Authenticated as', session.user.email);
      } else {
        setUser(null);
        setSession(null);
      }
    } catch (error) {
      console.error('[AuthProvider] Session check error:', error);
      setUser(null);
      setSession(null);
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
      const result = await supabaseAuthService.signOut();
      if (result.success) {
        // success
      } else {
        console.error('[AuthProvider] Supabase sign out error:', result.error);
      }
      
      // Clear all application state using comprehensive logout utility
      performCompleteLogout();
      
      // Clear ThingsBoard tokens
      localStorage.removeItem('tb_access');
      localStorage.removeItem('tb_refresh');
      
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
      setUser(null);
      setSession(null);
      window.location.href = '/login';
    }
  }, []);

  // Sign in with email and password
  const signIn = useCallback(async (email: string, password: string) => {
    try {
      const result = await supabaseAuthService.signIn(email, password);
      
      if (!result.success) {
        throw new Error(result.message);
      }

      if (result.user && result.session) {
        setUser(result.user);
        setSession(result.session);
        
        // Trigger ThingsBoard authentication in background
        try {
          const { unifiedDataService } = await import('@/services/unified-data');
          await unifiedDataService.getThingsBoardData(result.user.id, result.user.email);
          // Sync WiFi credentials after ThingsBoard authentication
          try {
            const { syncWifiCredentialsOnLogin } = await import('@/services/wifi-credentials');
            await syncWifiCredentialsOnLogin(result.user.id);
          } catch (wifiError) {
            console.warn('[AuthProvider] WiFi sync failed (non-blocking):', wifiError);
            // Don't block login if WiFi sync fails
          }
        } catch (tbError) {
          console.warn('[AuthProvider] ThingsBoard authentication failed (non-blocking):', tbError);
          // Don't block login if ThingsBoard fails
        }
      }
      const emailForLog = result.user?.email ?? email;
      if (emailForLog) {
        console.log('[Auth] Signed in as', emailForLog);
      }
    } catch (error) {
      console.error('[AuthProvider] Sign in error:', error);
      throw error;
    }
  }, []);

  // Sign up with email and password
  const signUp = useCallback(async (email: string, password: string, userData?: Record<string, unknown>) => {
    try {
      const result = await supabaseAuthService.signUp(email, password, userData);
      
      if (!result.success) {
        throw new Error(result.message);
      }

      if (result.user && result.session) {
        setUser(result.user);
        setSession(result.session);
        
        // Save ThingsBoard credentials using the same email/password
        try {
          await saveThingsBoardCredentials(result.user.id, email, password);
        } catch (tbError) {
          console.warn('[AuthProvider] Failed to save ThingsBoard credentials (user can set up later):', tbError);
          // Don't fail the signup if ThingsBoard credential saving fails
          // User can set up ThingsBoard integration later from their profile
        }
      }
      const emailForLog = result.user?.email ?? email;
      if (emailForLog) {
        console.log('[Auth] Signed up as', emailForLog);
      }
    } catch (error) {
      console.error('[AuthProvider] Sign up error:', error);
      throw error;
    }
  }, []);

  // Password reset - send reset email
  const resetPassword = useCallback(async (email: string) => {
    try {
      const result = await supabaseAuthService.resetPassword(email);
      
      if (!result.success) {
        throw new Error(result.message);
      }
    } catch (error) {
      console.error('[AuthProvider] Password reset error:', error);
      throw error;
    }
  }, []);

  // Update password - for authenticated users
  const updatePassword = useCallback(async (newPassword: string) => {
    try {
      const result = await supabaseAuthService.updatePassword(newPassword);
      
      if (!result.success) {
        throw new Error(result.message);
      }
    } catch (error) {
      console.error('[AuthProvider] Update password error:', error);
      throw error;
    }
  }, []);

  // Change password - verify current password first
  const changePassword = useCallback(async (currentPassword: string, newPassword: string) => {
    try {
      const result = await supabaseAuthService.changePassword(currentPassword, newPassword);
      
      if (!result.success) {
        throw new Error(result.message);
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

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
