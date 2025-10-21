import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Wifi, Target, Gamepad2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { encryptPassword } from '@/services/credentials';
import { toast } from '@/components/ui/sonner';

interface ThingsBoardSetupProps {
  userId: string;
  userEmail: string;
  onCredentialsSaved: () => void;
  onSkip: () => void;
}

export const ThingsBoardSetup: React.FC<ThingsBoardSetupProps> = ({
  userId,
  userEmail,
  onCredentialsSaved,
  onSkip
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    thingsboardEmail: userEmail, // Default to user's Supabase email
    thingsboardPassword: ''
  });

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError(null); // Clear error when user types
  };

  const handleSave = async () => {
    if (!formData.thingsboardEmail || !formData.thingsboardPassword) {
      setError('Please fill in both email and password');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { data, error: authError } = await supabase.functions.invoke('thingsboard-auth', {
        body: {
          credentials: {
            email: formData.thingsboardEmail,
            password: formData.thingsboardPassword,
          },
        },
      });

      if (authError || !data?.connected) {
        throw new Error('Invalid ThingsBoard email or password. Please check your credentials.');
      }

      const encryptedPassword = encryptPassword(formData.thingsboardPassword);

      const { error: updateError } = await supabase
        .from('user_profiles')
        .update({
          thingsboard_email: formData.thingsboardEmail,
          thingsboard_password_encrypted: encryptedPassword,
          thingsboard_last_sync: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);

      if (updateError) {
        throw new Error(`Failed to save credentials: ${updateError.message}`);
      }

      toast.success('ThingsBoard credentials saved successfully!');
      onCredentialsSaved();
      
    } catch (error: any) {
      console.error('Error saving ThingsBoard credentials:', error);
      setError(error?.message || 'Failed to save ThingsBoard credentials. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
          <Wifi className="h-6 w-6 text-blue-600" />
        </div>
        <CardTitle>Connect to ThingsBoard</CardTitle>
        <CardDescription>
          Enter your ThingsBoard credentials to sync targets, WiFi settings, and game data
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-2">
          <Label htmlFor="thingsboard-email">ThingsBoard Email</Label>
          <Input
            id="thingsboard-email"
            type="email"
            placeholder="your.email@example.com"
            value={formData.thingsboardEmail}
            onChange={(e) => handleInputChange('thingsboardEmail', e.target.value)}
            disabled={isLoading}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="thingsboard-password">ThingsBoard Password</Label>
          <Input
            id="thingsboard-password"
            type="password"
            placeholder="Enter your password"
            value={formData.thingsboardPassword}
            onChange={(e) => handleInputChange('thingsboardPassword', e.target.value)}
            disabled={isLoading}
          />
        </div>

        <div className="bg-blue-50 p-3 rounded-lg">
          <div className="flex items-start space-x-2">
            <Target className="h-4 w-4 text-blue-600 mt-0.5" />
            <div className="text-sm text-blue-800">
              <p className="font-medium">What you'll get:</p>
              <ul className="mt-1 space-y-1 text-xs">
                <li>• Real-time target data and status</li>
                <li>• WiFi credentials management</li>
                <li>• Game session history and analytics</li>
                <li>• Device telemetry and performance data</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="flex space-x-2">
          <Button
            onClick={handleSave}
            disabled={isLoading || !formData.thingsboardEmail || !formData.thingsboardPassword}
            className="flex-1"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Connecting...
              </>
            ) : (
              <>
                <Wifi className="mr-2 h-4 w-4" />
                Connect
              </>
            )}
          </Button>
          
          <Button
            variant="outline"
            onClick={onSkip}
            disabled={isLoading}
            className="flex-1"
          >
            Skip for now
          </Button>
        </div>

        <p className="text-xs text-gray-500 text-center">
          You can set up ThingsBoard integration later from your profile settings
        </p>
      </CardContent>
    </Card>
  );
};

export default ThingsBoardSetup;
