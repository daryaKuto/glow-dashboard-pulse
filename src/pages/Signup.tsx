
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock, User, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/providers/AuthProvider';
import { toast } from 'sonner';

const Signup = () => {
  const navigate = useNavigate();
  const { signUp } = useAuth();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
  });

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await signUp(formData.email, formData.password, {
        full_name: formData.name,
      });

      toast.success("Account created successfully!");
      navigate('/dashboard');
    } catch (error) {
      toast.error(error.message || "Signup failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-indigo p-4">
      <Card className="w-full max-w-md bg-brand-surface border-brand-lavender/30">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center text-white">
            Create an account
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSignup} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-brand-fg-secondary">
                Name
              </Label>
              <div className="relative">
                <Input
                  id="name"
                  type="text"
                  placeholder="Enter your name"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="pl-10 bg-transparent border-brand-lavender/30 text-white"
                />
                <User className="absolute left-3 top-3 h-4 w-4 text-brand-lavender" />
              </div>
            </div>

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
                  placeholder="Create a password"
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
              {loading ? 'Creating account...' : 'Create account'}
            </Button>

            <p className="text-center text-brand-fg-secondary">
              Already have an account?{' '}
              <Button
                variant="link"
                className="text-brand-lavender hover:text-white p-0"
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
