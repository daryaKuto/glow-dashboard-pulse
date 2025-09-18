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
      console.log('[AuthProvider] Auto-login to ThingsBoard for development...');
      
      // Auto-login to ThingsBoard
      const response = await API.signIn('andrew.tam@gmail.com', 'password123');
      
      if (response.token) {
        console.log('[AuthProvider] ThingsBoard login complete for development');
        // Set a mock user for development
        setUser({
          id: 'dev-user',
          email: 'andrew.tam@gmail.com',
          app_metadata: {},
          aud: 'authenticated',
          created_at: new Date().toISOString(),
          user_metadata: {
            name: 'Development User'
          }
        } as User);
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
    if (isDevelopment && !user && !loading && !isLoggingIn && !hasAttemptedAutoLogin) {
      console.log('[AuthProvider] Development mode - bypassing authentication');
      setHasAttemptedAutoLogin(true);
      
      // Auto-login to ThingsBoard for development
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

  const value: AuthContextType = {
    user,
    session,
    loading,
    checkSession,
    autoLoginDev,
    signOut,
    signIn,
    signInWithGoogle,
    signUp
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