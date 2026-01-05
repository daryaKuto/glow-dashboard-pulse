import { create } from 'zustand';
import { supabase } from '@/data/supabase-client';
import { toast } from "@/components/ui/sonner";
import { cache, CACHE_KEYS } from '@/lib/cache';

export interface TargetPreferences {
  ipAddress?: string;
  customSoundUrl?: string;
  lightColor?: string;
  soundEnabled?: boolean;
  lightEnabled?: boolean;
}

export interface UserPreferences {
  [targetId: string]: TargetPreferences | undefined;
}

interface UserPrefsState {
  prefs: UserPreferences;
  loading: boolean;
  error: string | null;
  
  // Methods
  load: () => Promise<void>;
  save: (prefs: UserPreferences) => Promise<void>;
  updatePref: (targetId: string, field: keyof TargetPreferences, value: string) => void;
}

export const useUserPrefs = create<UserPrefsState>((set, get) => ({
  prefs: {},
  loading: false,
  error: null,
  
  load: async () => {
    set({ loading: true, error: null });
    
    try {
      // Check cache first
      const cached = cache.get(CACHE_KEYS.USER_PREFS);
      if (cached) {
        console.log('Using cached user preferences');
        set({ prefs: cached, loading: false });
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        set({ loading: false });
        return;
      }
      
      const { data, error } = await supabase
        .from('user_profiles')
        .select('target_preferences')
        .eq('id', user.id)
        .single();
      
      if (error) {
        throw error;
      }
      
      const preferences = (data?.target_preferences as UserPreferences) || {};
      cache.set(CACHE_KEYS.USER_PREFS, preferences, 60000); // Cache for 1 minute
      set({ prefs: preferences, loading: false });
    } catch (error) {
      console.error('Error loading user preferences:', error);
      set({ 
        error: error instanceof Error ? error.message : 'Failed to load preferences',
        loading: false 
      });
    }
  },
  
  save: async (prefs: UserPreferences) => {
    set({ loading: true, error: null });
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }
      
      const { error } = await supabase
        .from('user_profiles')
        .update({
          target_preferences: prefs,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);
      
      if (error) {
        throw error;
      }
      
      // Update cache with new data
      cache.set(CACHE_KEYS.USER_PREFS, prefs, 60000);
      set({ prefs, loading: false });
      toast.success('Preferences saved successfully');
    } catch (error) {
      console.error('Error saving user preferences:', error);
      set({ 
        error: error instanceof Error ? error.message : 'Failed to save preferences',
        loading: false 
      });
      toast.error('Failed to save preferences');
    }
  },
  
  updatePref: (targetId: string, field: keyof TargetPreferences, value: string | boolean) => {
    set(state => ({
      prefs: {
        ...state.prefs,
        [targetId]: {
          ...state.prefs[targetId],
          [field]: value
        }
      }
    }));
  },
  
})); 