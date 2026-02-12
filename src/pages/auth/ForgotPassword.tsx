import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuth } from '@/shared/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Mail, ArrowLeft, CheckCircle, AlertCircle } from 'lucide-react';
import { toast } from '@/components/ui/sonner';
import { resetPasswordSchema, type ResetPasswordData } from '@/features/auth/schema';

const ForgotPassword = () => {
  const { resetPassword } = useAuth();
  const [emailSent, setEmailSent] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState('');
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<ResetPasswordData>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      email: '',
    },
  });

  const onSubmit = async (data: ResetPasswordData) => {
    setSubmitError(null);
    try {
      await resetPassword(data.email);
      setSubmittedEmail(data.email);
      setEmailSent(true);
      toast.success('Password reset email sent! Check your inbox.');
    } catch (error: unknown) {
      console.error('Password reset error:', error);
      const errorMessage = error instanceof Error 
        ? error.message 
        : 'Failed to send reset email. Please try again.';
      setSubmitError(errorMessage);
      toast.error(errorMessage);
    }
  };

  const handleSendAnother = () => {
    setEmailSent(false);
    setSubmittedEmail('');
    reset();
  };

  if (emailSent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-light p-4">
        <Card className="w-full max-w-md">
          <div className="mb-6 text-center pt-6">
            <a
              href="https://ailith.co"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block"
            >
              <img 
                src="/ailith_dark.png" 
                alt="Ailith" 
                className="h-8 w-auto hover:opacity-80 transition-opacity"
              />
            </a>
          </div>
          <CardContent className="pt-0">
            <div className="text-center">
              <CheckCircle className="mx-auto h-16 w-16 text-green-500 mb-4" />
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Check Your Email
              </h2>
              <p className="text-gray-600 mb-4">
                We've sent a password reset link to <strong>{submittedEmail}</strong>
              </p>
              <p className="text-sm text-gray-500 mb-6">
                Click the link in the email to reset your password. The link will expire in 1 hour.
              </p>
              <div className="space-y-2">
                <Button 
                  onClick={handleSendAnother}
                  variant="outline"
                  className="w-full"
                >
                  Send Another Email
                </Button>
                <Button 
                  asChild
                  variant="ghost"
                  className="w-full"
                >
                  <Link to="/login">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to Login
                  </Link>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-light p-4">
      <Card className="w-full max-w-md">
        <div className="mb-6 text-center pt-6">
          <a
            href="https://ailith.co"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block"
          >
            <img 
              src="/ailith_dark.png" 
              alt="Ailith" 
              className="h-8 w-auto hover:opacity-80 transition-opacity"
            />
          </a>
        </div>
        <CardHeader className="text-center pt-0">
          <CardTitle className="text-2xl font-bold text-gray-900">
            Forgot Password?
          </CardTitle>
          <CardDescription>
            Enter your email address and we'll send you a link to reset your password
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
              <Label htmlFor="email">Email Address</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter your email"
                  {...register('email')}
                  aria-invalid={errors.email ? 'true' : 'false'}
                  aria-describedby={errors.email ? 'email-error' : undefined}
                  className={`pl-10 ${
                    errors.email ? 'border-red-500 focus-visible:ring-red-500' : ''
                  }`}
                />
              </div>
              {errors.email && (
                <p id="email-error" className="text-sm text-red-600">
                  {errors.email.message}
                </p>
              )}
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Sending...' : 'Send Reset Link'}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <Button 
              asChild
              variant="ghost"
              className="text-sm"
            >
              <Link to="/login">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Login
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ForgotPassword;
