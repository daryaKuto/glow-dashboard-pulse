
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/providers/AuthProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { User, Mail, Lock, Eye, EyeOff } from 'lucide-react';
import { toast } from '@/components/ui/sonner';
import { Separator } from '@/components/ui/separator';

const Signup = () => {
  const navigate = useNavigate();
  const { signUp, signInWithGoogle } = useAuth();
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await signUp(formData.name, formData.email, formData.password);
      // toast.success('Account created successfully'); // Disabled notifications
      navigate('/dashboard');
    } catch (error) {
      // toast.error('Signup failed. Please try again.'); // Disabled notifications
      console.error('Signup error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignUp = async () => {
    setGoogleLoading(true);
    try {
      await signInWithGoogle();
    } catch (error) {
      console.error('Google sign up error:', error);
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-brand-light">
      <Card className="w-full max-w-md bg-white border-gray-200 shadow-sm">
        <div className="mb-6 text-center">
          <a
            href="https://ailith.co"
            className="text-sm text-brand-primary hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            ← Home
          </a>
        </div>
        <CardHeader className="text-center">
          <CardTitle className="text-h2 font-heading text-brand-dark">Create Account</CardTitle>
          <CardDescription className="text-brand-dark/70 font-body">
            Join ailith.co and start training smarter
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-brand-dark font-body">
                Full Name
              </Label>
              <div className="relative">
                <Input
                  id="name"
                  type="text"
                  placeholder="Enter your full name"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="pl-10 bg-brand-light border-gray-200 text-brand-dark placeholder:text-brand-dark/70"
                />
                <User className="absolute left-3 top-3 h-4 w-4 text-brand-primary" />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" className="text-brand-dark font-body">
                Email
              </Label>
              <div className="relative">
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter your email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="pl-10 bg-brand-light border-gray-200 text-brand-dark placeholder:text-brand-dark/70"
                />
                <Mail className="absolute left-3 top-3 h-4 w-4 text-brand-primary" />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-brand-dark font-body">
                Password
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Create a password"
                  required
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="pl-10 pr-10 bg-white border-gray-200 text-brand-dark"
                />
                <Lock className="absolute left-3 top-3 h-4 w-4 text-brand-primary" />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3 text-brand-primary hover:text-brand-dark"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-brand-secondary hover:bg-brand-primary text-white font-body"
            >
              {loading ? 'Creating account...' : 'Create Account'}
            </Button>

            <div className="relative my-4">
              <Separator className="bg-border" />
              <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white px-2 text-sm text-brand-dark/70 font-body">
                or
              </span>
            </div>

            <Button
              type="button"
              variant="outline"
              onClick={handleGoogleSignUp}
              disabled={googleLoading}
              className="w-full border-gray-200 text-brand-dark hover:bg-accent hover:text-accent-foreground font-body"
            >
              {googleLoading ? (
                'Signing up...'
              ) : (
                <>
                  <svg className="h-5 w-5 mr-2" viewBox="0 0 24 24">
                    <path
                      fill="currentColor"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="currentColor"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="currentColor"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    />
                    <path
                      fill="currentColor"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    />
                  </svg>
                  Sign up with Google
                </>
              )}
            </Button>

            <p className="text-center text-brand-dark/70 font-body">
              Already have an account?{' '}
              <Button
                variant="link"
                className="text-brand-primary hover:text-brand-dark p-0 font-body"
                onClick={() => navigate('/login')}
              >
                Log in
              </Button>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default Signup;
