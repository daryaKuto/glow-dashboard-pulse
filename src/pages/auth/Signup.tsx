
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/providers/AuthProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { User, Mail, Lock, Eye, EyeOff } from 'lucide-react';

const Signup = () => {
  const navigate = useNavigate();
  const { signUp } = useAuth();
  const [loading, setLoading] = useState(false);
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
      await signUp(formData.email, formData.password, { name: formData.name });
      // toast.success('Account created successfully'); // Disabled notifications
      navigate('/dashboard');
    } catch (error) {
      // toast.error('Signup failed. Please try again.'); // Disabled notifications
      console.error('Signup error:', error);
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
