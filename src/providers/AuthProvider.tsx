import React, { useState, useEffect, ReactNode, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import API from '@/lib/api';
import type { User, Session } from '@supabase/supabase-js';
import { AuthContext, type AuthContextType } from '@/contexts/AuthContext';

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasCheckedSession, setHasCheckedSession] = useState(false);
  

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
        
        // Automatically switch to live mode when user is authenticated
        const currentDemoMode = localStorage.getItem('demo_mode');
        if (currentDemoMode === 'true') {
          console.log('🔗 User authenticated, switching to live mode to show real data');
          localStorage.setItem('demo_mode', 'false');
          // Trigger a custom event to notify components of the mode change
          window.dispatchEvent(new CustomEvent('demoModeChanged', { detail: { isDemoMode: false } }));
        }
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


  // Check session on mount
  useEffect(() => {
    if (!hasCheckedSession) {
      checkSession();
      setHasCheckedSession(true);
    }
  }, [hasCheckedSession, checkSession]);

  // Set up Supabase auth state listener
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('[AuthProvider] Auth state changed:', event, session?.user?.email);
        
        if (event === 'SIGNED_IN' && session) {
          setUser(session.user);
          setSession(session);
          setLoading(false);
          
          // Clear ThingsBoard tokens for different user
          const currentTbUser = localStorage.getItem('tb_user_email');
          if (currentTbUser && currentTbUser !== session.user.email) {
            console.log('🔄 Different user logging in, clearing old ThingsBoard tokens');
            localStorage.removeItem('tb_access');
            localStorage.removeItem('tb_refresh');
            localStorage.removeItem('tb_user_email');
          }
          
          // Automatically switch to live mode when user is authenticated
          const currentDemoMode = localStorage.getItem('demo_mode');
          if (currentDemoMode === 'true') {
            console.log('🔗 User authenticated, switching to live mode to show real data');
            localStorage.setItem('demo_mode', 'false');
            // Trigger a custom event to notify components of the mode change
            window.dispatchEvent(new CustomEvent('demoModeChanged', { detail: { isDemoMode: false } }));
          }
        } else if (event === 'SIGNED_OUT') {
          setUser(null);
          setSession(null);
          setLoading(false);
          
          // Clear ThingsBoard tokens when user signs out
          localStorage.removeItem('tb_access');
          localStorage.removeItem('tb_refresh');
          localStorage.removeItem('tb_user_email');
          console.log('🧹 Cleared ThingsBoard tokens on sign out');
        } else if (event === 'TOKEN_REFRESHED' && session) {
          setUser(session.user);
          setSession(session);
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Sign out
  const signOut = useCallback(async () => {
    try {
      await supabase.auth.signOut();
      setUser(null);
      setSession(null);
      
      // Clear ThingsBoard tokens when user logs out
      localStorage.removeItem('tb_access');
      localStorage.removeItem('tb_refresh');
      localStorage.removeItem('tb_user_email');
      console.log('🧹 Cleared ThingsBoard tokens on logout');
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

      // Note: ThingsBoard authentication is handled separately using shared credentials
      // Each user's data is isolated through Supabase RLS policies
      console.log('🔐 Supabase authentication successful for:', email);
      
      // Automatically switch to live mode when user signs in
      const currentDemoMode = localStorage.getItem('demo_mode');
      if (currentDemoMode === 'true') {
        console.log('🔗 User signed in, switching to live mode to show real data');
        localStorage.setItem('demo_mode', 'false');
        // Trigger a custom event to notify components of the mode change
        window.dispatchEvent(new CustomEvent('demoModeChanged', { detail: { isDemoMode: false } }));
      }
      
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
  const signUp = useCallback(async (name: string, email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name: name,
            full_name: name
          }
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
