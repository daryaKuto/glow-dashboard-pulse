import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Lock, Key } from 'lucide-react';

const PasswordSettings: React.FC = () => {
  const navigate = useNavigate();

  return (
    <Card className="bg-white border border-gray-200 shadow-sm">
      <CardHeader>
        <div className="flex items-center space-x-2">
          <Lock className="h-5 w-5 text-brand-primary" />
          <CardTitle className="text-h3 font-heading text-brand-dark">
            Password & Security
          </CardTitle>
        </div>
        <CardDescription className="text-brand-dark/70 font-body">
          Manage your password and account security
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
          <div className="flex items-center space-x-3">
            <Key className="h-5 w-5 text-brand-primary" />
            <div>
              <h4 className="font-medium text-brand-dark font-body">
                Change Password
              </h4>
              <p className="text-sm text-brand-dark/70 font-body">
                Update your password to keep your account secure
              </p>
            </div>
          </div>
          <Button
            onClick={() => navigate('/change-password')}
            className="bg-brand-secondary hover:bg-brand-primary text-white font-body"
          >
            Change Password
          </Button>
        </div>
        
        <div className="text-xs text-brand-dark/60 font-body">
          <p>• Passwords must be at least 6 characters long</p>
          <p>• Use a combination of letters, numbers, and symbols for better security</p>
          <p>• Never share your password with anyone</p>
        </div>
      </CardContent>
    </Card>
  );
};

export default PasswordSettings;
