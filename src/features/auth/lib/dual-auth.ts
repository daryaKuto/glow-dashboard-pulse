import { supabase } from '@/data/supabase-client';
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
    lastSync?: string | null;
    reason?: string;
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

  private async invokeThingsBoardAuth(): Promise<{ success: boolean; lastSync?: string | null; reason?: string }> {
    try {
      const { data, error } = await supabase.functions.invoke('thingsboard-auth', {
        body: {},
      });

      if (error) {
        throw new Error(error.message ?? 'thingsboard-auth failed');
      }

      const payload = (data ?? {}) as { connected?: boolean; lastSync?: string | null; reason?: string };

      return {
        success: Boolean(payload.connected),
        lastSync: payload.lastSync ?? null,
        reason: payload.reason,
      };
    } catch (error) {
      console.warn('[DualAuth] thingsboard-auth invocation failed', error);
      return {
        success: false,
        reason: error instanceof Error ? error.message : 'thingsboard-auth invocation failed',
      };
    }
  }

  // Check if user is authenticated with at least one service
  async isAuthenticated(): Promise<boolean> {
    try {
      const { data } = await supabase.auth.getSession();
      return Boolean(data.session);
    } catch (error) {
      console.warn('Failed to determine Supabase auth state:', error);
      return false;
    }
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

    if (result.supabase?.success && result.supabase?.user) {
      const tbStatus = await this.invokeThingsBoardAuth();
      result.thingsboard = {
        success: tbStatus.success,
        lastSync: tbStatus.lastSync,
        reason: tbStatus.reason,
      };

      const status = tbStatus.success
        ? 'success'
        : tbStatus.reason === 'missing_credentials'
          ? 'idle'
          : 'error';
      this.setAuthStatus({ thingsboard: status });
    } else {
      result.thingsboard = {
        success: false,
        reason: 'supabase_auth_failed',
      };
      this.setAuthStatus({ thingsboard: 'idle' });
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
      reason: 'thingsboard_signup_not_supported',
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

    this.setAuthStatus({ thingsboard: 'idle', message: 'Successfully signed out' });
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

    this.setAuthStatus({
      supabase: supabaseSession ? 'success' : 'idle',
      thingsboard: 'idle',
      message: ''
    });

    return this.getAuthStatus();
  }
}

// Create singleton instance
const dualAuthService = new DualAuthService();

export default dualAuthService;
