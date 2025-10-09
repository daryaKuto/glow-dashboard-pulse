import { supabase } from '@/integrations/supabase/client';
import { login as tbLogin, logout as tbLogout } from '@/services/thingsboard';
import thingsBoardService from '@/services/thingsboard';
import { getThingsBoardCredentials } from '@/services/profile';
import type { User, Session } from '@supabase/supabase-js';

export interface DualAuthResult {
  success: boolean;
  supabase?: {
    success: boolean;
    user?: User;
    session?: Session;
    error?: string;
  };
  thingsboard?: {
    success: boolean;
    token?: string;
    refreshToken?: string;
    error?: string;
  };
  message: string;
}

export interface DualAuthStatus {
  supabase: 'idle' | 'loading' | 'success' | 'error';
  thingsboard: 'idle' | 'loading' | 'success' | 'error';
  message: string;
}

class DualAuthService {
  private authStatus: DualAuthStatus = {
    supabase: 'idle',
    thingsboard: 'idle',
    message: ''
  };

  // Get current authentication status
  getAuthStatus(): DualAuthStatus {
    return { ...this.authStatus };
  }

  // Set authentication status
  private setAuthStatus(updates: Partial<DualAuthStatus>) {
    this.authStatus = { ...this.authStatus, ...updates };
  }

  // Check if user is authenticated with at least one service
  isAuthenticated(): boolean {
    const supabaseAuth = !!supabase.auth.getSession();
    const thingsboardAuth = thingsBoardService.isAuthenticated();
    return supabaseAuth || thingsboardAuth;
  }

  // Get current user from Supabase
  async getCurrentUser(): Promise<User | null> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      return user;
    } catch (error) {
      console.error('Failed to get current user:', error);
      return null;
    }
  }

  // Get current session from Supabase
  async getCurrentSession(): Promise<Session | null> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      return session;
    } catch (error) {
      console.error('Failed to get current session:', error);
      return null;
    }
  }

  // Sign in with email and password
  async signIn(email: string, password: string): Promise<DualAuthResult> {
    this.setAuthStatus({
      supabase: 'loading',
      thingsboard: 'loading',
      message: 'Authenticating...'
    });

    const result: DualAuthResult = {
      success: false,
      message: ''
    };

    // Attempt Supabase authentication
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        result.supabase = {
          success: false,
          error: error.message
        };
        this.setAuthStatus({ supabase: 'error' });
      } else {
        result.supabase = {
          success: true,
          user: data.user,
          session: data.session
        };
        this.setAuthStatus({ supabase: 'success' });
      }
    } catch (error: any) {
      result.supabase = {
        success: false,
        error: error.message || 'Supabase authentication failed'
      };
      this.setAuthStatus({ supabase: 'error' });
    }

    // Attempt ThingsBoard authentication
    try {
      // Only attempt ThingsBoard auth if Supabase auth was successful
      if (result.supabase?.success && result.supabase?.user) {
        // Fetch ThingsBoard credentials from Supabase for this specific user
        const credentials = await getThingsBoardCredentials(result.supabase.user.id);
        
        if (credentials) {
          const tbAuth = await tbLogin(credentials.email, credentials.password);
          result.thingsboard = {
            success: true,
            token: tbAuth.token,
            refreshToken: tbAuth.refreshToken
          };
          this.setAuthStatus({ thingsboard: 'success' });
        } else {
          result.thingsboard = {
            success: false,
            error: 'ThingsBoard credentials not found in user profile'
          };
          this.setAuthStatus({ thingsboard: 'idle' });
        }
      } else {
        result.thingsboard = {
          success: false,
          error: 'Supabase authentication required for ThingsBoard access'
        };
        this.setAuthStatus({ thingsboard: 'idle' });
      }
    } catch (error: any) {
      result.thingsboard = {
        success: false,
        error: error.message || 'ThingsBoard authentication failed'
      };
      this.setAuthStatus({ thingsboard: 'error' });
    }

    // Determine overall success
    result.success = result.supabase?.success || result.thingsboard?.success || false;

    // Set appropriate message
    if (result.supabase?.success && result.thingsboard?.success) {
      result.message = 'Successfully authenticated with both Supabase and ThingsBoard';
      this.setAuthStatus({ message: result.message });
    } else if (result.supabase?.success) {
      result.message = 'Successfully authenticated with Supabase (ThingsBoard unavailable)';
      this.setAuthStatus({ message: result.message });
    } else if (result.thingsboard?.success) {
      result.message = 'Successfully authenticated with ThingsBoard (Supabase unavailable)';
      this.setAuthStatus({ message: result.message });
    } else {
      result.message = 'Authentication failed with both services';
      this.setAuthStatus({ message: result.message });
    }

    return result;
  }

  // Sign up with email and password
  async signUp(email: string, password: string, userData?: Record<string, unknown>): Promise<DualAuthResult> {
    this.setAuthStatus({
      supabase: 'loading',
      thingsboard: 'idle',
      message: 'Creating account...'
    });

    const result: DualAuthResult = {
      success: false,
      message: ''
    };

    // Attempt Supabase signup
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: userData
        }
      });

      if (error) {
        result.supabase = {
          success: false,
          error: error.message
        };
        this.setAuthStatus({ supabase: 'error' });
      } else {
        result.supabase = {
          success: true,
          user: data.user,
          session: data.session
        };
        this.setAuthStatus({ supabase: 'success' });
      }
    } catch (error: any) {
      result.supabase = {
        success: false,
        error: error.message || 'Supabase signup failed'
      };
      this.setAuthStatus({ supabase: 'error' });
    }

    // ThingsBoard doesn't support user registration
    result.thingsboard = {
      success: false,
      error: 'ThingsBoard does not support user registration'
    };
    this.setAuthStatus({ thingsboard: 'idle' });

    // Determine overall success
    result.success = result.supabase?.success || false;

    // Set appropriate message
    if (result.supabase?.success) {
      result.message = 'Account created successfully! You are now logged in.';
      this.setAuthStatus({ message: result.message });
    } else {
      result.message = 'Account creation failed';
      this.setAuthStatus({ message: result.message });
    }

    return result;
  }


  // Sign out from both services
  async signOut(): Promise<void> {
    this.setAuthStatus({
      supabase: 'loading',
      thingsboard: 'loading',
      message: 'Signing out...'
    });

    // Sign out from Supabase
    try {
      await supabase.auth.signOut();
      this.setAuthStatus(prev => ({ ...prev, supabase: 'success' }));
    } catch (error) {
      console.error('Supabase signout failed:', error);
      this.setAuthStatus(prev => ({ ...prev, supabase: 'error' }));
    }

    // Sign out from ThingsBoard
    try {
      await tbLogout();
      this.setAuthStatus(prev => ({ ...prev, thingsboard: 'success' }));
    } catch (error) {
      console.error('ThingsBoard signout failed:', error);
      this.setAuthStatus(prev => ({ ...prev, thingsboard: 'error' }));
    }

    this.setAuthStatus({ message: 'Successfully signed out' });
  }

  // Reset password
  async resetPassword(email: string): Promise<{ success: boolean; message: string }> {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`
      });

      if (error) {
        return {
          success: false,
          message: error.message
        };
      }

      return {
        success: true,
        message: 'Password reset email sent successfully'
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message || 'Failed to send password reset email'
      };
    }
  }

  // Update password
  async updatePassword(newPassword: string): Promise<{ success: boolean; message: string }> {
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) {
        return {
          success: false,
          message: error.message
        };
      }

      return {
        success: true,
        message: 'Password updated successfully'
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message || 'Failed to update password'
      };
    }
  }

  // Check authentication status
  async checkAuthStatus(): Promise<DualAuthStatus> {
    const supabaseSession = await this.getCurrentSession();
    const thingsboardAuth = thingsBoardService.isAuthenticated();

    this.setAuthStatus({
      supabase: supabaseSession ? 'success' : 'idle',
      thingsboard: thingsboardAuth ? 'success' : 'idle',
      message: ''
    });

    return this.getAuthStatus();
  }
}

// Create singleton instance
const dualAuthService = new DualAuthService();

export default dualAuthService;
