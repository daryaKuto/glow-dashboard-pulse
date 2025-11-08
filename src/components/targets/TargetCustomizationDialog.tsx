/**
 * Dialog component for customizing target sound and light color settings
 * Premium feature - only available to paid users
 */

import React, { useState, useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { ColorPicker } from '@/components/ui/color-picker';
import { useUserPrefs, type TargetPreferences } from '@/store/useUserPrefs';
import { uploadTargetSound, validateSoundFile, type SoundUploadResult } from '@/services/target-sounds';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/sonner';
import { Upload, X, Music, Palette, Loader2, Sparkles, Star, Zap, Crown, CheckCircle2 } from 'lucide-react';
import { useSubscription } from '@/hooks/useSubscription';

interface TargetCustomizationDialogProps {
  targetId: string;
  targetName: string;
  isOpen: boolean;
  onClose: () => void;
}

export const TargetCustomizationDialog: React.FC<TargetCustomizationDialogProps> = ({
  targetId,
  targetName,
  isOpen,
  onClose,
}) => {
  const { isPremium } = useSubscription();
  const { prefs, save, updatePref } = useUserPrefs();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const currentPrefs = prefs[targetId] || {};
  
  // Local state for form
  const [soundEnabled, setSoundEnabled] = useState(currentPrefs.soundEnabled ?? false);
  const [lightEnabled, setLightEnabled] = useState(currentPrefs.lightEnabled ?? false);
  const [lightColor, setLightColor] = useState(currentPrefs.lightColor || '');
  const [customSoundUrl, setCustomSoundUrl] = useState(currentPrefs.customSoundUrl || '');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Load current preferences when dialog opens (only when isOpen changes, not when currentPrefs changes)
  useEffect(() => {
    if (isOpen) {
      const targetPrefs = prefs[targetId] || {};
      setSoundEnabled(targetPrefs.soundEnabled ?? false);
      setLightEnabled(targetPrefs.lightEnabled ?? false);
      setLightColor(targetPrefs.lightColor || '');
      setCustomSoundUrl(targetPrefs.customSoundUrl || '');
      setSelectedFile(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, targetId]); // Only reset when dialog opens/closes or target changes, not when prefs update

  // Don't show dialog if user is not premium
  if (!isPremium) {
    return null;
  }

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const validation = validateSoundFile(file);
    if (!validation.valid) {
      toast.error(validation.error || 'Invalid file');
      return;
    }

    setSelectedFile(file);
  };

  const handleUploadSound = async () => {
    if (!selectedFile) {
      toast.error('Please select a file first');
      return;
    }

    setUploading(true);
    try {
      const result = await uploadTargetSound(targetId, selectedFile);
      
      if (result.error) {
        toast.error(result.error);
        return;
      }

      setCustomSoundUrl(result.url);
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      toast.success('Sound uploaded successfully');
    } catch (error) {
      console.error('Error uploading sound:', error);
      toast.error('Failed to upload sound file');
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Update local preferences
      const updatedPrefs: TargetPreferences = {
        ...currentPrefs,
        soundEnabled,
        lightEnabled,
        lightColor: lightEnabled ? lightColor : undefined,
        customSoundUrl: soundEnabled ? customSoundUrl : undefined,
      };

      // Update in Zustand store
      updatePref(targetId, 'soundEnabled', soundEnabled);
      updatePref(targetId, 'lightEnabled', lightEnabled);
      if (lightEnabled) {
        updatePref(targetId, 'lightColor', lightColor);
      }
      if (soundEnabled && customSoundUrl) {
        updatePref(targetId, 'customSoundUrl', customSoundUrl);
      }

      // Save to Supabase
      const newPrefs = {
        ...prefs,
        [targetId]: updatedPrefs,
      };
      await save(newPrefs);

      // Sync to ThingsBoard via device-command Edge Function
      const attributes: Record<string, unknown> = {};
      
      if (soundEnabled && customSoundUrl) {
        attributes.customSoundUrl = customSoundUrl;
        attributes.soundEnabled = true;
      } else {
        attributes.soundEnabled = false;
      }

      if (lightEnabled && lightColor) {
        attributes.lightColor = lightColor;
        attributes.lightEnabled = true;
      } else {
        attributes.lightEnabled = false;
      }

      const { error: commandError } = await supabase.functions.invoke('device-command', {
        body: {
          action: 'set-attributes',
          setAttributes: {
            deviceIds: [targetId],
            attributes,
          },
        },
      });

      if (commandError) {
        console.error('Failed to sync to device:', commandError);
        toast.warning('Preferences saved but failed to sync to device');
      } else {
        toast.success('Preferences saved and synced to device');
      }

      onClose();
    } catch (error) {
      console.error('Error saving preferences:', error);
      toast.error('Failed to save preferences');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setSoundEnabled(false);
    setLightEnabled(false);
    setLightColor('');
    setCustomSoundUrl('');
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto premium-dialog">
        <DialogHeader className="relative">
          <div className="flex items-center gap-2 mb-2">
            <Crown className="h-5 w-5 text-purple-500 premium-icon-float" />
            <DialogTitle className="text-xl font-bold bg-gradient-to-r from-purple-600 via-pink-500 to-purple-600 bg-clip-text text-transparent">
              Customize Target: {targetName}
            </DialogTitle>
            <Sparkles className="h-4 w-4 text-purple-400 premium-sparkle-icon" />
          </div>
          <DialogDescription className="flex items-center gap-2 text-sm">
            <Star className="h-4 w-4 text-yellow-400 premium-star-icon" />
            <span>Configure custom sound and light color for this target</span>
            <span className="px-2 py-0.5 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xs font-semibold premium-badge">
              PREMIUM
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Sound Customization Section */}
          <div className="space-y-4 premium-section-card">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-gradient-to-br from-purple-100 to-pink-100 premium-icon-container">
                  <Music className="h-5 w-5 text-purple-600 premium-icon-bounce" />
                </div>
                <div>
                  <Label className="text-base font-semibold text-gray-800">Custom Sound</Label>
                  <p className="text-xs text-gray-500">Upload your own audio file</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor="sound-enabled" className="text-sm">
                  Enable
                </Label>
                <Switch
                  id="sound-enabled"
                  checked={soundEnabled}
                  onCheckedChange={(checked) => {
                    console.log('Sound enabled toggle:', checked);
                    setSoundEnabled(checked);
                  }}
                  className="premium-switch"
                />
              </div>
            </div>

            {soundEnabled && (
              <div className="space-y-3 premium-content-reveal premium-gradient-border-left">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Zap className="h-4 w-4 text-yellow-500" />
                    <Label htmlFor="sound-file" className="font-semibold">Upload Sound File</Label>
                  </div>
                  <div className="flex gap-2">
                    <Input
                      id="sound-file"
                      ref={fileInputRef}
                      type="file"
                      accept="audio/mpeg,audio/mp3,audio/wav,audio/ogg,audio/webm"
                      onChange={handleFileSelect}
                      className="flex-1 premium-input"
                      disabled={uploading}
                    />
                    <Button
                      onClick={handleUploadSound}
                      disabled={!selectedFile || uploading}
                      size="sm"
                      className="premium-upload-button"
                    >
                      {uploading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <Upload className="h-4 w-4 mr-1" />
                          Upload
                        </>
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-gray-500 flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    Supported formats: MP3, WAV, OGG (Max 5MB)
                  </p>
                </div>

                {customSoundUrl && (
                  <div className="space-y-2 premium-success-card">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                      <Label className="font-semibold">Current Sound</Label>
                    </div>
                    <div className="flex items-center gap-2 p-3 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border-2 border-green-200 shadow-sm">
                      <audio controls src={customSoundUrl} className="flex-1 h-8">
                        Your browser does not support audio playback.
                      </audio>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setCustomSoundUrl('');
                          setSoundEnabled(false);
                        }}
                        className="hover:bg-red-100 hover:text-red-600"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Light Color Customization Section */}
          <div className="space-y-4 premium-section-card">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-gradient-to-br from-pink-100 to-purple-100 premium-icon-container">
                  <Palette className="h-5 w-5 text-pink-600 premium-icon-bounce" />
                </div>
                <div>
                  <Label className="text-base font-semibold text-gray-800">Light Color</Label>
                  <p className="text-xs text-gray-500">Choose your RGB color</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor="light-enabled" className="text-sm">
                  Enable
                </Label>
                <Switch
                  id="light-enabled"
                  checked={lightEnabled}
                  onCheckedChange={(checked) => {
                    console.log('Light enabled toggle:', checked);
                    setLightEnabled(checked);
                  }}
                  className="premium-switch"
                />
              </div>
            </div>

            {lightEnabled && (
              <div className="space-y-3 premium-content-reveal premium-gradient-border-left-alt">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="h-4 w-4 text-purple-500" />
                  <Label className="font-semibold">Select Color</Label>
                </div>
                <ColorPicker
                  value={lightColor}
                  onChange={setLightColor}
                  label=""
                />
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-between gap-2 pt-4 premium-gradient-border-top">
          <Button 
            variant="outline" 
            onClick={handleReset} 
            disabled={saving}
            className="premium-outline-button"
          >
            <X className="h-4 w-4 mr-2" />
            Reset to Default
          </Button>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={onClose} 
              disabled={saving}
              className="premium-outline-button"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleSave} 
              disabled={saving} 
              className="premium-button-gradient"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

