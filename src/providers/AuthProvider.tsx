
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { API } from '../lib/api';
import { supabase } from '@/integrations/supabase/client';

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
  
  // Check if user is already logged in from localStorage
  useEffect(() => {
    checkSession();
  }, []);

  // Listen for auth state changes
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        try {
          // Sign in to ThingsBoard when Supabase user signs in
          const { token, refreshToken } = await API.signIn(session.user.email!, '<service-password>');
          localStorage.setItem('tb_access', token);
          localStorage.setItem('tb_refresh', refreshToken);
        } catch (error) {
          console.error('Failed to sign in to ThingsBoard:', error);
        }
        
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
  
  const checkSession = async () => {
    setLoading(true);
    
    try {
      // Check Supabase session first
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.user) {
        // If we have a Supabase session, also sign in to ThingsBoard
        try {
          const { token, refreshToken } = await API.signIn(session.user.email!, '<service-password>');
          localStorage.setItem('tb_access', token);
          localStorage.setItem('tb_refresh', refreshToken);
        } catch (error) {
          console.error('Failed to sign in to ThingsBoard:', error);
        }
        
        setUser(session.user);
        setSession(session);
        setHasVerifiedPhone(!!session.user?.phone);
      } else {
        // Fallback to stored session
        const storedSession = localStorage.getItem('authSession');
        
        if (storedSession) {
          const sessionData = JSON.parse(storedSession);
          setUser(sessionData.user);
          setSession(sessionData);
          setHasVerifiedPhone(!!sessionData.user?.phone);
        }
      }
      
      setLoading(false);
    } catch (error) {
      console.error('Auth session check error:', error);
      setLoading(false);
    }
  };
  
  const signIn = async (email: string, password: string) => {
    try {
      // Sign in with Supabase first
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      
      // Then sign in to ThingsBoard
      const response = await API.signIn(email, password);
      
      // Store ThingsBoard tokens
      localStorage.setItem('tb_access', response.token);
      localStorage.setItem('tb_refresh', response.refreshToken);
      
      // Create a session-like object for compatibility
      const sessionData = {
        user: data.user,
        access_token: data.session?.access_token,
        expires_at: data.session?.expires_at
      };
      
      // Store in localStorage
      localStorage.setItem('authSession', JSON.stringify(sessionData));
      
      setUser(data.user);
      setSession(data.session);
      setHasVerifiedPhone(!!data.user?.phone);
      
      return response;
    } catch (error) {
      console.error('Sign in error:', error);
      throw error;
    }
  };
  
  const signUp = async (email: string, password: string, userData?: any) => {
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
  };
  
  const signOut = async () => {
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
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };
  
  const setPhoneVerifyModalOpen = (isOpen: boolean) => {
    setPhoneVerifyModalOpenState(isOpen);
    
    // Reset state when closing
    if (!isOpen) {
      setPhoneVerificationStep('input');
      setPhoneVerificationError(null);
    }
  };
  
  const linkPhone = async (phone: string): Promise<boolean> => {
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
  };
  
  const verifyPhoneOtp = async (phone: string, otp: string): Promise<boolean> => {
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
  };
  
  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin + '/auth/callback' },
    });
    if (error) throw error;
  };

  const resetPhoneVerification = () => {
    setPhoneVerificationStep('input');
    setPhoneVerificationError(null);
  };
  
  const contextValue: AuthContextType = {
    user,
    session,
    loading,
    phoneVerifyModalOpen,
    hasVerifiedPhone,
    phoneVerificationStep,
    phoneVerificationError,
    checkSession,
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
