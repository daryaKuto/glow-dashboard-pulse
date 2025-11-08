/**
 * Color Picker component using react-colorful
 * Provides a spectrum-based color selection interface
 */

import React, { useState } from 'react';
import { HexColorPicker } from 'react-colorful';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Palette } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
  label?: string;
  className?: string;
}

export const ColorPicker: React.FC<ColorPickerProps> = ({
  value,
  onChange,
  label,
  className,
}) => {
  const [open, setOpen] = useState(false);
  const [tempColor, setTempColor] = useState(value || '#FFFACD');

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen) {
      setTempColor(value || '#FFFACD');
    }
  };

  const handleColorChange = (color: string) => {
    setTempColor(color);
    onChange(color);
  };

  const handleHexInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    // Allow empty string or valid hex color
    if (inputValue === '' || /^#[0-9A-Fa-f]{0,6}$/.test(inputValue)) {
      if (inputValue === '') {
        onChange('');
        setTempColor('#FFFACD');
      } else if (inputValue.length === 7) {
        // Complete hex color
        onChange(inputValue);
        setTempColor(inputValue);
      } else {
        // Incomplete hex color (user typing)
        setTempColor(inputValue.padEnd(7, '0'));
      }
    }
  };

  const displayColor = value || '#FFFACD';

  return (
    <div className={cn('space-y-2', className)}>
      {label && <Label>{label}</Label>}
      <div className="flex items-center gap-3">
        <Popover open={open} onOpenChange={handleOpenChange}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              className="h-12 w-20 rounded-full border-2 overflow-hidden p-0"
              style={{
                backgroundColor: displayColor || '#FFFACD',
                borderColor: displayColor || '#FFFACD',
              }}
            >
              <div className="h-full w-full" />
            </Button>
          </PopoverTrigger>
          <PopoverContent 
            className="w-[240px] p-4 premium-color-picker-popover" 
            align="start"
            sideOffset={5}
          >
            <div className="space-y-3 w-full">
              <div className="w-full" style={{ width: '200px', height: '200px' }}>
                <HexColorPicker
                  color={tempColor}
                  onChange={handleColorChange}
                  style={{ width: '200px', height: '200px' }}
                />
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor="hex-input" className="text-sm w-12">
                  Hex:
                </Label>
                <Input
                  id="hex-input"
                  type="text"
                  value={value}
                  onChange={handleHexInputChange}
                  placeholder="#FFFACD"
                  className="flex-1 font-mono text-sm"
                  maxLength={7}
                />
              </div>
            </div>
          </PopoverContent>
        </Popover>

        <Input
          type="text"
          value={value}
          onChange={handleHexInputChange}
          placeholder="#FFFACD"
          className="flex-1 font-mono"
          maxLength={7}
        />

        <div
          className="w-12 h-12 rounded-md border-2 border-gray-300 flex items-center justify-center"
          style={{ backgroundColor: displayColor }}
        >
          {!value && (
            <Palette className="h-5 w-5 text-gray-400" />
          )}
        </div>
      </div>
      <p className="text-xs text-brand-dark/60">
        Click the color box to open the color picker spectrum
      </p>
    </div>
  );
};

