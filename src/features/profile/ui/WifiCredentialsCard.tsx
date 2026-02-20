import React from 'react';
import { Wifi, Eye, EyeOff } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface WifiCredentialsCardProps {
  wifiFormData: { ssid: string; password: string };
  onWifiFormDataChange: (data: { ssid: string; password: string }) => void;
  wifiFormError: string | null;
  onWifiFormErrorChange: (error: string | null) => void;
  showWifiPassword: boolean;
  onTogglePasswordVisibility: () => void;
  currentSsid: string;
  isLoading: boolean;
  isSaving: boolean;
  onSave: () => void;
  onRefresh: () => void;
}

const WifiCredentialsCard: React.FC<WifiCredentialsCardProps> = ({
  wifiFormData,
  onWifiFormDataChange,
  wifiFormError,
  onWifiFormErrorChange,
  showWifiPassword,
  onTogglePasswordVisibility,
  currentSsid,
  isLoading,
  isSaving,
  onSave,
  onRefresh,
}) => {
  const isValid = wifiFormData.ssid.trim().length > 0 && wifiFormData.password.length >= 8;

  if (isLoading) {
    return (
      <Card className="shadow-card">
        <CardContent className="p-5 md:p-6">
          <div className="flex items-center justify-center py-6 gap-2">
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-brand-primary border-t-transparent" />
            <span className="text-sm text-brand-dark/40 font-body">
              Loading credentials...
            </span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-card bg-gradient-to-br from-white to-brand-primary/[0.03]">
      <CardHeader className="pb-2 md:pb-3 p-5 md:p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wifi className="h-4 w-4 text-brand-primary" />
            <CardTitle className="text-base font-heading text-brand-dark">
              Network Credentials
            </CardTitle>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onRefresh}
            disabled={isLoading}
            className="text-xs text-brand-primary font-body"
          >
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-5 md:p-6 pt-0">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (isValid && !isSaving) onSave();
          }}
          autoComplete="off"
        >
          {wifiFormError && (
            <div className="rounded-[var(--radius)] bg-red-50 px-3 py-2 mb-4">
              <p className="text-xs text-red-600 font-body">{wifiFormError}</p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-label text-brand-secondary font-body uppercase tracking-wide block mb-1.5">
                WiFi Network Name (SSID)
              </label>
              <Input
                value={wifiFormData.ssid}
                onChange={(e) => {
                  onWifiFormDataChange({ ...wifiFormData, ssid: e.target.value });
                  onWifiFormErrorChange(null);
                }}
                placeholder="Enter network name"
                className="bg-white border border-[rgba(28,25,43,0.1)] rounded-[var(--radius)] text-brand-dark placeholder:text-brand-dark/40 focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary/30 font-body h-10"
                maxLength={32}
              />
            </div>
            <div>
              <label className="text-label text-brand-secondary font-body uppercase tracking-wide block mb-1.5">
                Password
              </label>
              <div className="relative">
                <Input
                  type={showWifiPassword ? 'text' : 'password'}
                  value={wifiFormData.password}
                  onChange={(e) => {
                    onWifiFormDataChange({
                      ...wifiFormData,
                      password: e.target.value,
                    });
                    onWifiFormErrorChange(null);
                  }}
                  placeholder="Min 8 characters"
                  className="bg-white border border-[rgba(28,25,43,0.1)] rounded-[var(--radius)] text-brand-dark placeholder:text-brand-dark/40 focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary/30 font-body h-10 pr-10"
                  maxLength={63}
                />
                <button
                  type="button"
                  onClick={onTogglePasswordVisibility}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-dark/30 hover:text-brand-primary transition-colors"
                >
                  {showWifiPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
          </div>

          {currentSsid && (
            <div className="flex items-center gap-2 mt-3 pt-3 border-t border-[rgba(28,25,43,0.06)]">
              <div className="w-2 h-2 bg-green-500 rounded-full" />
              <span className="text-xs text-brand-dark/40 font-body">
                Current:{' '}
                <span className="font-medium text-brand-dark/60">
                  {currentSsid}
                </span>
              </span>
            </div>
          )}

          <div className="flex items-center justify-between mt-4">
            <span className="text-xs text-brand-dark/30 font-body">
              Credentials sync to all devices
            </span>
            <Button
              type="submit"
              disabled={isSaving || !isValid}
              className="bg-brand-primary hover:bg-brand-primary/90 text-white font-body"
            >
              {isSaving ? 'Saving...' : 'Save Credentials'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

export default WifiCredentialsCard;
