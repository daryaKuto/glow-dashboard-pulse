
import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import API from '@/lib/api';

interface AuthContextType {
  user: any | null;
  session: any | null;
  loading: boolean;
  phoneVerifyModalOpen: boolean;
  hasVerifiedPhone: boolean;
  phoneVerificationStep: 'input' | 'verify' | 'complete';
  phoneVerificationError: string | null;
  
  // Methods
  checkSession: () => Promise<void>;
  autoLoginDev: () => Promise<void>;
  signOut: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<any>;
  signInWithGoogle: () => Promise<void>;
  signUp: (email: string, password: string, userData?: any) => Promise<any>;
  setPhoneVerifyModalOpen: (isOpen: boolean) => void;
  linkPhone: (phone: string) => Promise<boolean>;
  verifyPhoneOtp: (phone: string, otp: string) => Promise<boolean>;
  resetPhoneVerification: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<any | null>(null);
  const [session, setSession] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [phoneVerifyModalOpen, setPhoneVerifyModalOpenState] = useState(false);
  const [hasVerifiedPhone, setHasVerifiedPhone] = useState(false);
  const [phoneVerificationStep, setPhoneVerificationStep] = useState<'input' | 'verify' | 'complete'>('input');
  const [phoneVerificationError, setPhoneVerificationError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [hasAttemptedAutoLogin, setHasAttemptedAutoLogin] = useState(false);
  const [hasCheckedSession, setHasCheckedSession] = useState(false);
  
  // Check if user is already logged in from localStorage - only once
  useEffect(() => {
    if (!hasCheckedSession) {
      setHasCheckedSession(true);
      checkSession();
    }
  }, [hasCheckedSession]);

  // Auto-login for development environment - only once and with better conditions
  useEffect(() => {
    const isDevelopment = import.meta.env.DEV;
    if (isDevelopment && !user && !loading && !isLoggingIn && !hasAttemptedAutoLogin && hasCheckedSession) {
      console.log('[AuthProvider] Development mode detected - auto-login with andrew.tam');
      setHasAttemptedAutoLogin(true);
      // Add a longer delay to prevent rapid attempts and rate limiting
      setTimeout(() => {
        autoLoginDev();
      }, 5000); // 5 second delay to avoid rate limiting
    }
  }, [user, loading, isLoggingIn, hasAttemptedAutoLogin, hasCheckedSession]);

  // Listen for auth state changes
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        // ThingsBoard login is handled in checkSession and autoLoginDev
        setUser(session.user);
        setSession(session);
        setHasVerifiedPhone(!!session.user?.phone);
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        setSession(null);
        setHasVerifiedPhone(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);
  
  // Wrap checkSession in useCallback to prevent infinite re-renders
  const checkSession = useCallback(async () => {
    console.log('[AuthProvider] checkSession: start');
    if (isLoggingIn) {
      console.log('[AuthProvider] Login already in progress, skipping checkSession');
      return;
    }
    
    setLoading(true);
    
    try {
      console.log('[AuthProvider] Checking Supabase session...');
      const { data: { session } } = await supabase.auth.getSession();
      console.log('[AuthProvider] Supabase session:', session);
      
      if (session?.user) {
        // Check if we have a valid ThingsBoard token
        const existingToken = localStorage.getItem('tb_access');
        console.log('[AuthProvider] Existing ThingsBoard token:', existingToken ? 'exists' : 'none');
        
        if (!existingToken && !isLoggingIn) {
          try {
            console.log('[AuthProvider] Signing in to ThingsBoard...');
            setIsLoggingIn(true);
            // Use the real password for the known user
            const password = session.user.email === 'andrew.tam@gmail.com' ? 'dryfire2025' : '<service-password>';
            console.log('[AuthProvider] Attempting ThingsBoard login with:', session.user.email, 'password length:', password.length);
            const { token, refreshToken } = await API.signIn(session.user.email!, password);
            localStorage.setItem('tb_access', token);
            localStorage.setItem('tb_refresh', refreshToken);
            console.log('[AuthProvider] ThingsBoard login complete');
          } catch (error) {
            console.error('[AuthProvider] Failed to sign in to ThingsBoard:', error);
            // Clear old tokens on failure
            localStorage.removeItem('tb_access');
            localStorage.removeItem('tb_refresh');
            console.log('[AuthProvider] Cleared old tokens due to login failure');
          } finally {
            setIsLoggingIn(false);
          }
        } else if (existingToken && !isLoggingIn) {
          console.log('[AuthProvider] ThingsBoard token already exists or login in progress, skipping...');
        }
        
        setUser(session.user);
      } else {
        setUser(null);
      }
    } catch (error) {
      console.error('[AuthProvider] Error checking session:', error);
      setUser(null);
    } finally {
      setLoading(false);
      console.log('[AuthProvider] checkSession: done');
    }
  }, [isLoggingIn]);

  // Wrap autoLoginDev in useCallback
  const autoLoginDev = useCallback(async () => {
    if (isLoggingIn) {
      console.log('[AuthProvider] Auto-login already in progress, skipping...');
      return;
    }
    
    console.log('[AuthProvider] autoLoginDev: start');
    setIsLoggingIn(true);
    setLoading(true);
    
    try {
      // Auto-login to Supabase with andrew.tam credentials
      const { data, error } = await supabase.auth.signInWithPassword({
        email: 'andrew.tam@gmail.com',
        password: 'dryfire2025'
      });
      
      if (error) {
        console.error('[AuthProvider] Auto-login Supabase error:', error);
        setLoading(false);
        setIsLoggingIn(false);
        setHasAttemptedAutoLogin(false);
        return;
      }
      
      console.log('[AuthProvider] Auto-login Supabase success:', data.user);
      
      // Auto-login to ThingsBoard
      try {
        console.log('[AuthProvider] Auto-login to ThingsBoard...');
        const { token, refreshToken } = await API.signIn('andrew.tam@gmail.com', 'dryfire2025');
        localStorage.setItem('tb_access', token);
        localStorage.setItem('tb_refresh', refreshToken);
        console.log('[AuthProvider] Auto-login ThingsBoard complete');
      } catch (error) {
        console.error('[AuthProvider] Auto-login ThingsBoard failed:', error);
      }
      
      setUser(data.user);
      setSession(data.session);
      setHasVerifiedPhone(!!data.user?.phone);
      console.log('[AuthProvider] Auto-login complete, user set:', data.user);
      
    } catch (error) {
      console.error('[AuthProvider] Auto-login error:', error);
      setHasAttemptedAutoLogin(false);
    } finally {
      setLoading(false);
      setIsLoggingIn(false);
    }
  }, [isLoggingIn]);
  
  // Wrap signIn in useCallback
  const signIn = useCallback(async (email: string, password: string) => {
    console.log('[AuthProvider] signIn: start', email);
    try {
      // Sign in with Supabase first
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        console.error('[AuthProvider] Supabase signIn error:', error);
        throw error;
      }
      console.log('[AuthProvider] Supabase signIn success:', data.user);
      
      // Then sign in to ThingsBoard
      const response = await API.signIn(email, password);
      console.log('[AuthProvider] ThingsBoard signIn success');
      
      // Store ThingsBoard tokens
      localStorage.setItem('tb_access', response.token);
      localStorage.setItem('tb_refresh', response.refreshToken);
      
      setUser(data.user);
      setSession(data.session);
      setHasVerifiedPhone(!!data.user?.phone);
      
      console.log('[AuthProvider] signIn: done', data.user);
      return response;
    } catch (error) {
      console.error('[AuthProvider] signIn error:', error);
      throw error;
    }
  }, []);
  
  // Wrap signUp in useCallback
  const signUp = useCallback(async (email: string, password: string, userData?: any) => {
    try {
      // Sign up with Supabase first
      const { data, error } = await supabase.auth.signUp({ 
        email, 
        password,
        options: {
          data: userData
        }
      });
      if (error) throw error;
      
      // Then sign up with ThingsBoard (if needed)
      const response = await API.signUp(email, password, userData);
      
      // For simplicity in our static demo, auto sign in after signup
      return signIn(email, password);
    } catch (error) {
      console.error('Sign up error:', error);
      throw error;
    }
  }, [signIn]);
  
  // Wrap signOut in useCallback
  const signOut = useCallback(async () => {
    try {
      // Sign out from Supabase
      await supabase.auth.signOut();
      
      // Sign out from ThingsBoard
      await API.signOut();
      
      // Clear localStorage session
      localStorage.removeItem('authSession');
      
      setUser(null);
      setSession(null);
      setHasVerifiedPhone(false);
      setHasAttemptedAutoLogin(false);
    } catch (error) {
      console.error('Sign out error:', error);
    }
  }, []);
  
  // Wrap setPhoneVerifyModalOpen in useCallback
  const setPhoneVerifyModalOpen = useCallback((isOpen: boolean) => {
    setPhoneVerifyModalOpenState(isOpen);
    
    // Reset state when closing
    if (!isOpen) {
      setPhoneVerificationStep('input');
      setPhoneVerificationError(null);
    }
  }, []);
  
  // Wrap linkPhone in useCallback
  const linkPhone = useCallback(async (phone: string): Promise<boolean> => {
    setPhoneVerificationError(null);
    
    try {
      // In our static demo, we'll simulate OTP verification
      // In reality, this would send an OTP to the phone
      
      // Store the phone temporarily
      localStorage.setItem('tempPhone', phone);
      
      setPhoneVerificationStep('verify');
      return true;
    } catch (error: any) {
      console.error('Phone verification error:', error);
      setPhoneVerificationError(error.message || 'Failed to send verification code');
      return false;
    }
  }, []);
  
  // Wrap verifyPhoneOtp in useCallback
  const verifyPhoneOtp = useCallback(async (phone: string, otp: string): Promise<boolean> => {
    setPhoneVerificationError(null);
    
    try {
      // For our static demo, any 6-digit code works
      if (!/^\d{6}$/.test(otp)) {
        throw new Error('Invalid verification code. Must be 6 digits.');
      }
      
      if (user) {
        // Update user data with verified phone
        const updatedUser = await API.updateUser(user.id, { 
          phone: phone,
          phone_verified: true 
        });
        
        // Update session
        const updatedSession = { ...session, user: updatedUser.user };
        localStorage.setItem('authSession', JSON.stringify(updatedSession));
        
        setUser(updatedUser.user);
        setSession(updatedSession);
        setHasVerifiedPhone(true);
        setPhoneVerificationStep('complete');
        
        // Auto-close modal after success
        setTimeout(() => {
          setPhoneVerifyModalOpen(false);
        }, 1500);
        
        return true;
      } else {
        throw new Error('No user is logged in');
      }
    } catch (error: any) {
      console.error('OTP verification error:', error);
      setPhoneVerificationError(error.message || 'Invalid verification code');
      return false;
    }
  }, [user, session, setPhoneVerifyModalOpen]);
  
  // Wrap signInWithGoogle in useCallback
  const signInWithGoogle = useCallback(async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin + '/auth/callback' },
    });
    if (error) throw error;
  }, []);

  // Wrap resetPhoneVerification in useCallback
  const resetPhoneVerification = useCallback(() => {
    setPhoneVerificationStep('input');
    setPhoneVerificationError(null);
  }, []);
  
  const contextValue: AuthContextType = {
    user,
    session,
    loading,
    phoneVerifyModalOpen,
    hasVerifiedPhone,
    phoneVerificationStep,
    phoneVerificationError,
    checkSession,
    autoLoginDev,
    signOut,
    signIn,
    signInWithGoogle,
    signUp,
    setPhoneVerifyModalOpen,
    linkPhone,
    verifyPhoneOtp,
    resetPhoneVerification
  };
  
  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === null) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
