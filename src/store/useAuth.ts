
import { create } from 'zustand';
import { supabase } from '@/integrations/supabase/client';

interface AuthState {
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
  setPhoneVerifyModalOpen: (isOpen: boolean) => void;
  linkPhone: (phone: string) => Promise<boolean>;
  verifyPhoneOtp: (phone: string, otp: string) => Promise<boolean>;
  resetPhoneVerification: () => void;
}

export const useAuth = create<AuthState>((set, get) => ({
  user: null,
  session: null,
  loading: true,
  phoneVerifyModalOpen: false,
  hasVerifiedPhone: false,
  phoneVerificationStep: 'input',
  phoneVerificationError: null,
  
  // Check if user is authenticated
  checkSession: async () => {
    set({ loading: true });
    
    try {
      // Set up auth state listener first
      const { data: { subscription } } = supabase.auth.onAuthStateChange(
        (event, session) => {
          set({ 
            session, 
            user: session?.user ?? null,
            hasVerifiedPhone: !!session?.user?.user_metadata?.phone_verified
          });
        }
      );
      
      // Then check for existing session
      const { data } = await supabase.auth.getSession();
      set({ 
        session: data.session, 
        user: data.session?.user ?? null,
        hasVerifiedPhone: !!data.session?.user?.user_metadata?.phone_verified,
        loading: false 
      });
      
      return () => subscription.unsubscribe();
    } catch (error) {
      console.error("Auth error:", error);
      set({ loading: false });
    }
  },
  
  signOut: async () => {
    try {
      await supabase.auth.signOut();
      set({ user: null, session: null });
    } catch (error) {
      console.error("Sign out error:", error);
    }
  },
  
  setPhoneVerifyModalOpen: (isOpen: boolean) => {
    set({ 
      phoneVerifyModalOpen: isOpen,
      // Reset state when closing
      phoneVerificationStep: isOpen ? get().phoneVerificationStep : 'input',
      phoneVerificationError: isOpen ? get().phoneVerificationError : null
    });
  },
  
  linkPhone: async (phone: string) => {
    set({ phoneVerificationError: null });
    
    try {
      // In a real app with Supabase, we would use:
      // const { data, error } = await supabase.auth.signInWithOtp({ phone });
      
      // For our mock:
      const response = await fetch('/auth/phone/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to send verification code');
      }
      
      set({ phoneVerificationStep: 'verify' });
      return true;
    } catch (error: any) {
      console.error("Phone verification error:", error);
      set({ phoneVerificationError: error.message });
      return false;
    }
  },
  
  verifyPhoneOtp: async (phone: string, otp: string) => {
    set({ phoneVerificationError: null });
    
    try {
      // In a real app with Supabase, we would use:
      // const { data, error } = await supabase.auth.verifyOtp({
      //   phone, token: otp, type: 'sms'
      // });
      
      // For our mock:
      const response = await fetch('/auth/phone/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, token: otp })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Invalid verification code');
      }
      
      // Update user metadata
      if (get().user) {
        await supabase.auth.updateUser({
          data: { 
            phone: phone,
            phone_verified: true 
          }
        });
      }
      
      set({ 
        hasVerifiedPhone: true,
        phoneVerificationStep: 'complete' 
      });
      
      // Auto-close modal after success
      setTimeout(() => {
        set({ phoneVerifyModalOpen: false });
      }, 1500);
      
      return true;
    } catch (error: any) {
      console.error("OTP verification error:", error);
      set({ phoneVerificationError: error.message });
      return false;
    }
  },
  
  resetPhoneVerification: () => {
    set({
      phoneVerificationStep: 'input',
      phoneVerificationError: null
    });
  }
}));
