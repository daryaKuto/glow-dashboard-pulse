import { create } from 'zustand';
import { supabase } from '@/integrations/supabase/client';

interface AuthState {
  user: any | null;
  session: any | null;
  loading: boolean;
  // Methods
  checkSession: () => Promise<void>;
  signOut: () => Promise<void>;
}

export const useAuth = create<AuthState>((set, get) => ({
  user: null,
  session: null,
  loading: true,
  
  // Check if user is authenticated
  checkSession: async () => {
    set({ loading: true });
    
    try {
      // Set up auth state listener first
      const { data: { subscription } } = supabase.auth.onAuthStateChange(
        (event, session) => {
          console.log("Auth state changed:", event, session?.user?.id);
          set({ 
            session, 
            user: session?.user ?? null
          });
        }
      );
      
      // Then check for existing session
      const { data } = await supabase.auth.getSession();
      console.log("Initial session check:", data.session?.user?.id);
      set({ 
        session: data.session, 
        user: data.session?.user ?? null,
        loading: false 
      });
      
      // Return the cleanup function but don't make it part of the Promise resolution
      return;
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
  }
}));