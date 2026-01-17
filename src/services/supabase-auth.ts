import { supabase } from '@/integrations/supabase/client';
import type { User, Session } from '@supabase/supabase-js';

export interface AuthResult {
  success: boolean;
  user?: User;
  session?: Session;
  error?: string;
  message: string;
}

class SupabaseAuthService {
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

  // Check if user is authenticated
  async isAuthenticated(): Promise<boolean> {
    const session = await this.getCurrentSession();
    return !!session?.user;
  }

  // Sign in with email and password
  async signIn(email: string, password: string): Promise<AuthResult> {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        return {
          success: false,
          error: error.message,
          message: `Login failed: ${error.message}`
        };
      }

      return {
        success: true,
        user: data.user,
        session: data.session,
        message: 'Successfully logged in'
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Authentication failed',
        message: 'Login failed due to an unexpected error'
      };
    }
  }

  // Sign up with email and password
  async signUp(email: string, password: string, userData?: Record<string, unknown>): Promise<AuthResult> {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: userData
        }
      });

      if (error) {
        return {
          success: false,
          error: error.message,
          message: `Signup failed: ${error.message}`
        };
      }

      return {
        success: true,
        user: data.user,
        session: data.session,
        message: 'Account created successfully! Please check your email to confirm your account.'
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Signup failed',
        message: 'Account creation failed due to an unexpected error'
      };
    }
  }

  // Sign out
  async signOut(): Promise<AuthResult> {
    try {
      const { error } = await supabase.auth.signOut();

      if (error) {
        return {
          success: false,
          error: error.message,
          message: `Sign out failed: ${error.message}`
        };
      }

      return {
        success: true,
        message: 'Successfully signed out'
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Sign out failed',
        message: 'Sign out failed due to an unexpected error'
      };
    }
  }

  // Reset password
  async resetPassword(email: string): Promise<AuthResult> {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`
      });

      if (error) {
        return {
          success: false,
          error: error.message,
          message: `Password reset failed: ${error.message}`
        };
      }

      return {
        success: true,
        message: 'Password reset email sent successfully'
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Password reset failed',
        message: 'Password reset failed due to an unexpected error'
      };
    }
  }

  // Update password
  async updatePassword(newPassword: string): Promise<AuthResult> {
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) {
        return {
          success: false,
          error: error.message,
          message: `Password update failed: ${error.message}`
        };
      }

      return {
        success: true,
        message: 'Password updated successfully'
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Password update failed',
        message: 'Password update failed due to an unexpected error'
      };
    }
  }

  // Change password (verify current password first)
  async changePassword(currentPassword: string, newPassword: string): Promise<AuthResult> {
    try {
      const currentUser = await this.getCurrentUser();
      if (!currentUser?.email) {
        return {
          success: false,
          error: 'No user email available',
          message: 'Cannot change password: no user email available'
        };
      }

      // First verify current password by attempting to sign in
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: currentUser.email,
        password: currentPassword
      });

      if (signInError) {
        return {
          success: false,
          error: 'Current password is incorrect',
          message: 'Current password is incorrect'
        };
      }

      // If current password is correct, update to new password
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (updateError) {
        return {
          success: false,
          error: updateError.message,
          message: `Password change failed: ${updateError.message}`
        };
      }

      return {
        success: true,
        message: 'Password changed successfully'
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Password change failed',
        message: 'Password change failed due to an unexpected error'
      };
    }
  }
}

// Create singleton instance
const supabaseAuthService = new SupabaseAuthService();

export default supabaseAuthService;
