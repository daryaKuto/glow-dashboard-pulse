
import React from 'react';
import { Moon } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

const ThemeSettings = () => {
  return (
    <Card className="bg-brand-surface border-brand-lavender/30">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <Moon className="h-5 w-5" />
          Theme
        </CardTitle>
        <CardDescription className="text-brand-fg-secondary">
          Customize the application appearance
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label className="text-white">Dark Mode</Label>
            <p className="text-xs text-brand-fg-secondary">
              Application is currently in dark mode by default
            </p>
          </div>
          <Switch checked={true} disabled />
        </div>
      </CardContent>
    </Card>
  );
};

export default ThemeSettings;
