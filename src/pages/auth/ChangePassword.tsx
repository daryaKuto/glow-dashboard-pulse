import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Lock, Eye, EyeOff, CheckCircle, ArrowLeft } from 'lucide-react';
import { toast } from '@/components/ui/sonner';

const ChangePassword = () => {
  const { changePassword } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false
  });
  const [formData, setFormData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (formData.newPassword !== formData.confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }

    if (formData.newPassword.length < 6) {
      toast.error('New password must be at least 6 characters long');
      return;
    }

    setLoading(true);

    try {
      await changePassword(formData.currentPassword, formData.newPassword);
      setSuccess(true);
      toast.success('Password changed successfully!');
      
      // Redirect to dashboard after 2 seconds
      setTimeout(() => {
        navigate('/dashboard');
      }, 2000);
    } catch (error: any) {
      console.error('Change password error:', error);
      toast.error(error.message || 'Failed to change password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const togglePasswordVisibility = (field: 'current' | 'new' | 'confirm') => {
    setShowPasswords(prev => ({
      ...prev,
      [field]: !prev[field]
    }));
  };

  if (success) {
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
                Password Changed!
              </h2>
              <p className="text-gray-600 mb-4">
                Your password has been successfully changed. You will be redirected to the dashboard.
              </p>
              <Button 
                onClick={() => navigate('/dashboard')}
                className="w-full"
              >
                Go to Dashboard
              </Button>
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
            Change Password
          </CardTitle>
          <CardDescription>
            Enter your current password and choose a new one
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="currentPassword">Current Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  id="currentPassword"
                  type={showPasswords.current ? 'text' : 'password'}
                  placeholder="Enter current password"
                  value={formData.currentPassword}
                  onChange={(e) => setFormData({ ...formData, currentPassword: e.target.value })}
                  required
                  className="pl-10 pr-10"
                />
                <button
                  type="button"
                  onClick={() => togglePasswordVisibility('current')}
                  className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
                >
                  {showPasswords.current ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="newPassword">New Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  id="newPassword"
                  type={showPasswords.new ? 'text' : 'password'}
                  placeholder="Enter new password"
                  value={formData.newPassword}
                  onChange={(e) => setFormData({ ...formData, newPassword: e.target.value })}
                  required
                  className="pl-10 pr-10"
                />
                <button
                  type="button"
                  onClick={() => togglePasswordVisibility('new')}
                  className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
                >
                  {showPasswords.new ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm New Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  id="confirmPassword"
                  type={showPasswords.confirm ? 'text' : 'password'}
                  placeholder="Confirm new password"
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                  required
                  className="pl-10 pr-10"
                />
                <button
                  type="button"
                  onClick={() => togglePasswordVisibility('confirm')}
                  className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
                >
                  {showPasswords.confirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                type="submit"
                className="flex-1"
                disabled={loading}
              >
                {loading ? 'Changing Password...' : 'Change Password'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate('/dashboard')}
                className="flex-1"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Dashboard
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default ChangePassword;