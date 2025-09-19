import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import API from '@/lib/api';
import type { User, Session } from '@supabase/supabase-js';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  
  // Methods
  checkSession: () => Promise<void>;
  autoLoginDev: () => Promise<void>;
  signOut: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<{ token: string; refreshToken: string }>;
  signInWithGoogle: () => Promise<void>;
  signUp: (email: string, password: string, userData?: Record<string, unknown>) => Promise<{ token: string; refreshToken: string }>;
  
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
  const [hasAttemptedAutoLogin, setHasAttemptedAutoLogin] = useState(false);
  const [hasCheckedSession, setHasCheckedSession] = useState(false);
  
  // Auto-login for development mode
  const autoLoginDev = useCallback(async () => {
    const isDevelopment = import.meta.env.DEV;
    if (!isDevelopment) return;

    try {
      console.log('[AuthProvider] Auto-login to Supabase for development...');
      
      // Actually log into Supabase with the test user
      const testEmail = import.meta.env.VITE_TEST_EMAIL || 'test@example.com';
      const testPassword = import.meta.env.VITE_TEST_PASSWORD || 'testpassword123';
      
      console.log('[AuthProvider] Attempting login with:', { testEmail, hasPassword: !!testPassword });
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email: testEmail,
        password: testPassword
      });

      console.log('[AuthProvider] Supabase login response:', { 
        user: data?.user?.email, 
        userId: data?.user?.id,
        session: !!data?.session, 
        error: error?.message 
      });

      if (error) {
        console.error('[AuthProvider] Supabase login failed:', error);
        console.log('[AuthProvider] Dev mode: Using direct user setup instead of password auth');
        
        // In dev mode, if password auth fails, create a mock user session
        const testUserId = import.meta.env.VITE_TEST_USER_ID || '1dca810e-7f11-4ec9-8605-8633cf2b74f0';
        const mockUser = {
          id: testUserId,
          email: testEmail,
          app_metadata: {},
          user_metadata: { name: 'Andrew Tam' },
          aud: 'authenticated',
          created_at: new Date().toISOString(),
        } as User;
        
        console.log('[AuthProvider] Setting dev mode user:', mockUser.email);
        setUser(mockUser);
        setLoading(false);
        return;
      }

      if (data.user && data.session) {
        console.log('[AuthProvider] Supabase login successful:', data.user.email);
        setUser(data.user);
        setSession(data.session);
        setLoading(false);
      } else {
        console.error('[AuthProvider] No user or session in response');
        setLoading(false);
      }
    } catch (error) {
      console.error('[AuthProvider] Development auto-login failed:', error);
      setLoading(false);
    }
  }, []);

  // Check if user is authenticated
  const checkSession = useCallback(async () => {
    console.log('[AuthProvider] checkSession: start');
    setLoading(true);
    
    try {
      console.log('[AuthProvider] Checking Supabase session...');
      const { data: { session }, error } = await supabase.auth.getSession();
      
      console.log('[AuthProvider] Supabase session:', session?.user?.id);
      
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
        console.log('[AuthProvider] User authenticated:', session.user.email);
      } else {
        setUser(null);
        setSession(null);
        console.log('[AuthProvider] No active session');
      }
    } catch (error) {
      console.error('[AuthProvider] Session check error:', error);
      setUser(null);
      setSession(null);
    } finally {
      setLoading(false);
      console.log('[AuthProvider] checkSession: done');
    }
  }, []);

  // Development mode: Skip authentication entirely
  useEffect(() => {
    const isDevelopment = import.meta.env.DEV;
    console.log('[AuthProvider] Development mode check:', {
      isDevelopment,
      user: !!user,
      loading,
      isLoggingIn,
      hasAttemptedAutoLogin
    });
    
    if (isDevelopment && !user && !loading && !isLoggingIn && !hasAttemptedAutoLogin) {
      console.log('[AuthProvider] Development mode - bypassing authentication');
      setHasAttemptedAutoLogin(true);
      
      // Auto-login to Supabase for development
      autoLoginDev();
    }
  }, [user, loading, isLoggingIn, hasAttemptedAutoLogin, autoLoginDev]);

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
      await supabase.auth.signOut();
      setUser(null);
      setSession(null);
    } catch (error) {
      console.error('[AuthProvider] Sign out error:', error);
    }
  }, []);

  // Sign in with email and password
  const signIn = useCallback(async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      // Also sign in to ThingsBoard
      const tbResponse = await API.signIn(email, password);
      
      return {
        token: data.session?.access_token || '',
        refreshToken: data.session?.refresh_token || ''
      };
    } catch (error) {
      console.error('[AuthProvider] Sign in error:', error);
      throw error;
    }
  }, []);

  // Sign up with email and password
  const signUp = useCallback(async (email: string, password: string, userData?: Record<string, unknown>) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: userData
        }
      });

      if (error) throw error;

      return {
        token: data.session?.access_token || '',
        refreshToken: data.session?.refresh_token || ''
      };
    } catch (error) {
      console.error('[AuthProvider] Sign up error:', error);
      throw error;
    }
  }, []);

  // Wrap signInWithGoogle in useCallback
  const signInWithGoogle = useCallback(async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`
      }
    });
    
    if (error) throw error;
  }, []);

  // Password reset - send reset email
  const resetPassword = useCallback(async (email: string) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`
      });
      
      if (error) throw error;
    } catch (error) {
      console.error('[AuthProvider] Password reset error:', error);
      throw error;
    }
  }, []);

  // Update password - for authenticated users
  const updatePassword = useCallback(async (newPassword: string) => {
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });
      
      if (error) throw error;
    } catch (error) {
      console.error('[AuthProvider] Update password error:', error);
      throw error;
    }
  }, []);

  // Change password - verify current password first
  const changePassword = useCallback(async (currentPassword: string, newPassword: string) => {
    try {
      if (!user?.email) {
        throw new Error('No user email available');
      }

      // First verify current password by attempting to sign in
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword
      });

      if (signInError) {
        throw new Error('Current password is incorrect');
      }

      // If current password is correct, update to new password
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (updateError) throw updateError;
    } catch (error) {
      console.error('[AuthProvider] Change password error:', error);
      throw error;
    }
  }, [user]);

  const value: AuthContextType = {
    user,
    session,
    loading,
    checkSession,
    autoLoginDev,
    signOut,
    signIn,
    signInWithGoogle,
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