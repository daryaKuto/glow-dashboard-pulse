import React from 'react';
import { Target, Zap, Shield, Star } from 'lucide-react';

interface TargetIconProps {
  type: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const TargetIcon: React.FC<TargetIconProps> = ({ 
  type, 
  size = 'md', 
  className = "" 
}) => {
  const getIcon = (type: string) => {
    const typeLower = type?.toLowerCase() || 'standard';
    switch (typeLower) {
      case 'standard':
        return <Target className="w-full h-full" />;
      case 'reactive':
        return <Zap className="w-full h-full" />;
      case 'armored':
        return <Shield className="w-full h-full" />;
      case 'premium':
        return <Star className="w-full h-full" />;
      default:
        return <Target className="w-full h-full" />;
    }
  };

  const getSizeClasses = (size: string) => {
    switch (size) {
      case 'sm':
        return 'w-6 h-6';
      case 'lg':
        return 'w-12 h-12';
      default:
        return 'w-8 h-8';
    }
  };

  const getTypeColor = (type: string) => {
    const typeLower = type?.toLowerCase() || 'standard';
    switch (typeLower) {
      case 'standard':
        return 'text-brand-primary';
      case 'reactive':
        return 'text-blue-600';
      case 'armored':
        return 'text-gray-700';
      case 'premium':
        return 'text-yellow-600';
      default:
        return 'text-brand-primary';
    }
  };

  return (
    <div className={`flex flex-col items-center ${className}`}>
      <div className={`${getSizeClasses(size)} ${getTypeColor(type)} flex items-center justify-center`}>
        {getIcon(type)}
      </div>
      <span className="text-xs text-brand-dark/70 mt-1 overflow-hidden text-ellipsis whitespace-nowrap max-w-full px-1 font-body">
        {type || 'Standard'}
      </span>
    </div>
  );
};

export default TargetIcon;
