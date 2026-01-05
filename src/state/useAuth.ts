import { create } from 'zustand';
import { authRepo } from '@/features/auth';
import { isApiOk } from '@/shared/lib/api-response';

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
      const { unsubscribe } = authRepo.onAuthStateChange(
        (event, session) => {
          console.log("Auth state changed:", event, session?.user?.id);
          set({ 
            session, 
            user: session?.user ?? null
          });
        }
      );
      
      // Then check for existing session
      const result = await authRepo.getSession();
      if (isApiOk(result)) {
        const sessionData = result.data.session;
        console.log("Initial session check:", sessionData?.user?.id);
        set({ 
          session: sessionData, 
          user: sessionData?.user ?? null,
          loading: false 
        });
      } else {
        set({ loading: false });
      }
      
      // Return the cleanup function but don't make it part of the Promise resolution
      return;
    } catch (error) {
      console.error("Auth error:", error);
      set({ loading: false });
    }
  },
  
  signOut: async () => {
    try {
      await authRepo.signOut();
      set({ user: null, session: null });
    } catch (error) {
      console.error("Sign out error:", error);
    }
  }
}));
