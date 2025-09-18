import React from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { Search } from 'lucide-react';

interface InputTemplateProps extends React.InputHTMLAttributes<HTMLInputElement> {
  className?: string;
}

// Search Input - Background: secondary (#816E94), white text
export const SearchInput: React.FC<InputTemplateProps> = ({ 
  className, 
  placeholder = "Search...",
  ...props 
}) => {
  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-white/70" />
      <Input
        className={cn(
          'pl-10 bg-brand-secondary text-white placeholder:text-white/70 border-brand-secondary focus:ring-brand-primary font-body',
          className
        )}
        placeholder={placeholder}
        {...props}
      />
    </div>
  );
};

// Standard Input - White background, brand-dark text
export const StandardInput: React.FC<InputTemplateProps> = ({ 
  className, 
  ...props 
}) => {
  return (
    <Input
      className={cn(
        'bg-white border-gray-200 text-brand-dark placeholder:text-brand-dark/50 focus:ring-brand-primary font-body',
        className
      )}
      {...props}
    />
  );
};

// Form Input with Icon
interface IconInputProps extends InputTemplateProps {
  icon: React.ReactNode;
  iconPosition?: 'left' | 'right';
}

export const IconInput: React.FC<IconInputProps> = ({ 
  icon,
  iconPosition = 'left',
  className, 
  ...props 
}) => {
  return (
    <div className="relative">
      {iconPosition === 'left' && (
        <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-brand-primary">
          {icon}
        </div>
      )}
      <Input
        className={cn(
          'bg-white border-gray-200 text-brand-dark placeholder:text-brand-dark/50 focus:ring-brand-primary font-body',
          iconPosition === 'left' && 'pl-10',
          iconPosition === 'right' && 'pr-10',
          className
        )}
        {...props}
      />
      {iconPosition === 'right' && (
        <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-brand-primary">
          {icon}
        </div>
      )}
    </div>
  );
};
