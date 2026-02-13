import React from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// Standardized button patterns based on brand colors
// Default: #816E94 (secondary) → Hover: #CE3E0A (primary)

interface ButtonTemplateProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  variant?: 'default' | 'outline' | 'ghost' | 'link';
  size?: 'sm' | 'md' | 'lg';
  isActive?: boolean;
  className?: string;
}

// Primary Action Button - Default: secondary, Hover: primary
export const PrimaryButton: React.FC<ButtonTemplateProps> = ({ 
  children, 
  className, 
  isActive = false,
  ...props 
}) => {
  return (
    <Button
      className={cn(
        'bg-brand-secondary hover:bg-brand-primary text-white font-body transition-colors',
        isActive && 'bg-brand-primary',
        className
      )}
      {...props}
    >
      {children}
    </Button>
  );
};

// Outline Button - Border: secondary, Hover: primary background
export const OutlineButton: React.FC<ButtonTemplateProps> = ({ 
  children, 
  className, 
  ...props 
}) => {
  return (
    <Button
      variant="outline"
      className={cn(
        'border-brand-secondary text-brand-secondary hover:bg-brand-primary hover:text-white hover:border-brand-primary font-body transition-all',
        className
      )}
      {...props}
    >
      {children}
    </Button>
  );
};

// Ghost Button - Transparent, text: secondary, hover: primary background
export const GhostButton: React.FC<ButtonTemplateProps> = ({ 
  children, 
  className, 
  ...props 
}) => {
  return (
    <Button
      variant="ghost"
      className={cn(
        'text-brand-secondary hover:bg-brand-primary hover:text-white font-body transition-all',
        className
      )}
      {...props}
    >
      {children}
    </Button>
  );
};

// Link Button - Text style, secondary → primary on hover
export const LinkButton: React.FC<ButtonTemplateProps> = ({ 
  children, 
  className, 
  ...props 
}) => {
  return (
    <Button
      variant="link"
      className={cn(
        'text-brand-secondary hover:text-brand-primary font-body p-0',
        className
      )}
      {...props}
    >
      {children}
    </Button>
  );
};

// Navigation Button - For sidebar/navigation with active state
export const NavButton: React.FC<ButtonTemplateProps & { isActive?: boolean }> = ({ 
  children, 
  className, 
  isActive = false,
  ...props 
}) => {
  return (
    <Button
      variant="ghost"
      className={cn(
        'justify-start w-full text-white/80 hover:bg-white/10 hover:text-white font-body',
        isActive && 'bg-brand-primary text-white',
        className
      )}
      {...props}
    >
      {children}
    </Button>
  );
};

// Danger Button - For destructive actions
export const DangerButton: React.FC<ButtonTemplateProps> = ({ 
  children, 
  className, 
  ...props 
}) => {
  return (
    <Button
      className={cn(
        'bg-red-600 hover:bg-red-700 text-white font-body transition-colors',
        className
      )}
      {...props}
    >
      {children}
    </Button>
  );
};

// Success Button - For positive actions
export const SuccessButton: React.FC<ButtonTemplateProps> = ({ 
  children, 
  className, 
  ...props 
}) => {
  return (
    <Button
      className={cn(
        'bg-green-600 hover:bg-green-700 text-white font-body transition-colors',
        className
      )}
      {...props}
    >
      {children}
    </Button>
  );
};
