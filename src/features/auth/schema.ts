import { z } from 'zod';
import type { User, Session } from '@supabase/supabase-js';

/**
 * Zod schemas for Auth feature
 * 
 * Note: Auth state is managed by AuthProvider, not React Query.
 * This feature module is for auth-related queries/data fetching.
 */

export const authSessionSchema = z.object({
  user: z.custom<User>(),
  session: z.custom<Session>(),
});

export const signInSchema = z.object({
  email: z.string().email('Please enter a valid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export const signUpSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Please enter a valid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export const resetPasswordSchema = z.object({
  email: z.string().email('Please enter a valid email'),
});

export const updatePasswordSchema = z.object({
  newPassword: z.string().min(6),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(6),
  newPassword: z.string().min(6),
});

// Inferred types
export type AuthSession = z.infer<typeof authSessionSchema>;
export type SignInData = z.infer<typeof signInSchema>;
export type SignUpData = z.infer<typeof signUpSchema>;
export type ResetPasswordData = z.infer<typeof resetPasswordSchema>;
export type UpdatePasswordData = z.infer<typeof updatePasswordSchema>;
export type ChangePasswordData = z.infer<typeof changePasswordSchema>;

