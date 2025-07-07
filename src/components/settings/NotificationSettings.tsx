
import React from 'react';
import { Bell } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

interface NotificationSettingsProps {
  settings: {
    email_session_invites: boolean;
    email_firmware_updates: boolean;
    email_target_offline: boolean;
  };
  onToggle: (key: keyof NotificationSettingsProps['settings']) => void;
}

const NotificationSettings = ({ settings, onToggle }: NotificationSettingsProps) => {
  return (
    <Card className="bg-brand-surface border-brand-lavender/30">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Email Notifications
        </CardTitle>
        <CardDescription className="text-brand-fg-secondary">
          Manage which emails you receive from us
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label className="text-white">Session Invites</Label>
            <p className="text-xs text-brand-fg-secondary">
              Receive emails when you're invited to join a session
            </p>
          </div>
          <Switch 
            checked={settings.email_session_invites}
            onCheckedChange={() => onToggle('email_session_invites')}
          />
        </div>
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label className="text-white">Firmware Updates</Label>
            <p className="text-xs text-brand-fg-secondary">
              Get notified when firmware updates are available for your targets
            </p>
          </div>
          <Switch 
            checked={settings.email_firmware_updates}
            onCheckedChange={() => onToggle('email_firmware_updates')}
          />
        </div>
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label className="text-white">Target Offline Alerts</Label>
            <p className="text-xs text-brand-fg-secondary">
              Receive alerts when a target goes offline
            </p>
          </div>
          <Switch 
            checked={settings.email_target_offline}
            onCheckedChange={() => onToggle('email_target_offline')}
          />
        </div>
      </CardContent>
    </Card>
  );
};

export default NotificationSettings;
