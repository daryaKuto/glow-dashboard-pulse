
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/providers/AuthProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Mail, Lock, Eye, EyeOff } from 'lucide-react';

const Login = () => {
  const navigate = useNavigate();
  const { signIn } = useAuth();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await signIn(formData.email, formData.password);
      // toast.success('Logged in successfully'); // Disabled notifications
      navigate('/dashboard');
    } catch (error) {
      // toast.error('Login failed. Please check your credentials.'); // Disabled notifications
      console.error('Login error:', error);
    } finally {
      setLoading(false);
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
          <form onSubmit={handleSubmit} className="space-y-4">
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
                  placeholder="Enter your password"
                  required
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="pl-10 pr-10 bg-brand-light border-gray-200 text-brand-dark placeholder:text-brand-dark/70"
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
              {loading ? 'Logging in...' : 'Log in'}
            </Button>

            <div className="text-center mt-4">
              <Button
                variant="link"
                className="text-brand-primary hover:text-brand-primary/80 p-0 font-body text-sm"
                onClick={() => navigate('/forgot-password')}
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
