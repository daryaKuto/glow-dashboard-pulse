import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuth } from '@/shared/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Mail, Lock, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { signInSchema, type SignInData } from '@/features/auth/schema';

const Login = () => {
  const navigate = useNavigate();
  const { signIn } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignInData>({
    resolver: zodResolver(signInSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onSubmit = async (data: SignInData) => {
    setSubmitError(null);
    try {
      await signIn(data.email, data.password);
      navigate('/dashboard');
    } catch (error) {
      console.error('Login error:', error);
      setSubmitError(
        error instanceof Error
          ? error.message
          : 'Login failed. Please check your credentials.'
      );
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-light p-4">
      <Card className="w-full max-w-md bg-white border-gray-200 shadow-sm">
        <div className="mb-6 text-center" style={{ marginTop: '20px' }}>
          <a
            href="https://ailith.co"
            target="_blank"
            rel="noopener noreferrer"
          >
            <img 
              src="/ailith_dark.png" 
              alt="Ailith" 
              className="h-8 mx-auto"
            />
          </a>
        </div>
        <CardHeader className="text-center">
          <CardTitle className="text-h2 font-heading text-brand-dark">Welcome Back</CardTitle>
          <CardDescription className="text-brand-dark/70 font-body">
            Sign in to your ailith.co account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {submitError && (
              <div className="flex items-center gap-2 p-3 text-sm text-red-600 bg-red-50 rounded-md border border-red-200">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                <span>{submitError}</span>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email" className="text-brand-dark font-body">
                Email
              </Label>
              <div className="relative">
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter your email"
                  {...register('email')}
                  aria-invalid={errors.email ? 'true' : 'false'}
                  aria-describedby={errors.email ? 'email-error' : undefined}
                  className={`pl-10 bg-brand-light border-gray-200 text-brand-dark placeholder:text-brand-dark/70 ${
                    errors.email ? 'border-red-500 focus-visible:ring-red-500' : ''
                  }`}
                />
                <Mail className="absolute left-3 top-3 h-4 w-4 text-brand-primary" />
              </div>
              {errors.email && (
                <p id="email-error" className="text-sm text-red-600">
                  {errors.email.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-brand-dark font-body">
                Password
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your password"
                  {...register('password')}
                  aria-invalid={errors.password ? 'true' : 'false'}
                  aria-describedby={errors.password ? 'password-error' : undefined}
                  className={`pl-10 pr-10 bg-brand-light border-gray-200 text-brand-dark placeholder:text-brand-dark/70 ${
                    errors.password ? 'border-red-500 focus-visible:ring-red-500' : ''
                  }`}
                />
                <Lock className="absolute left-3 top-3 h-4 w-4 text-brand-primary" />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3 text-brand-primary hover:text-brand-dark"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              {errors.password && (
                <p id="password-error" className="text-sm text-red-600">
                  {errors.password.message}
                </p>
              )}
            </div>

            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-brand-secondary hover:bg-brand-primary text-white font-body"
            >
              {isSubmitting ? 'Logging in...' : 'Log in'}
            </Button>

            <div className="text-center mt-4">
              <Button
                variant="link"
                className="text-brand-primary hover:text-brand-primary/80 p-0 font-body text-sm"
                onClick={() => navigate('/forgot-password')}
                type="button"
              >
                Forgot your password?
              </Button>
            </div>

            <p className="text-center text-brand-dark/70 font-body">
              Don't have an account?{' '}
              <Button
                variant="link"
                className="text-brand-primary hover:text-brand-primary/80 p-0 font-body"
                onClick={() => navigate('/signup')}
                type="button"
              >
                Sign up
              </Button>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default Login;
