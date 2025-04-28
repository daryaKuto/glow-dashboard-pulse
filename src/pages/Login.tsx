
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const Login = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: formData.email,
        password: formData.password,
      });

      if (error) throw error;

      toast.success("Successfully logged in!");
      navigate('/dashboard');
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-indigo p-4">
      <Card className="w-full max-w-md bg-brand-surface border-brand-lavender/30">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center text-white">
            Login to your account
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-brand-fg-secondary">
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
                  className="pl-10 bg-transparent border-brand-lavender/30 text-white"
                />
                <Mail className="absolute left-3 top-3 h-4 w-4 text-brand-lavender" />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-brand-fg-secondary">
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
                  className="pl-10 pr-10 bg-transparent border-brand-lavender/30 text-white"
                />
                <Lock className="absolute left-3 top-3 h-4 w-4 text-brand-lavender" />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3 text-brand-lavender hover:text-white"
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
              className="w-full bg-brand-lavender hover:bg-brand-lavender/80 text-white"
            >
              {loading ? 'Logging in...' : 'Log in'}
            </Button>

            <p className="text-center text-brand-fg-secondary">
              Don't have an account?{' '}
              <Button
                variant="link"
                className="text-brand-lavender hover:text-white p-0"
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
