import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/providers/AuthProvider';
import { useDemoMode } from '@/providers/DemoModeProvider';
import { useStats } from '@/store/useStats';
import { useIsMobile } from '@/hooks/use-mobile';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from '@/components/ui/sonner';
import { UserRound, Settings, LogOut, Home, Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface HeaderProps {
  onMenuClick?: () => void;
}

const Header: React.FC<HeaderProps> = ({ onMenuClick }) => {
  const { wsConnected } = useStats();
  const { user, signOut } = useAuth();
  const { isDemoMode, toggleDemoMode } = useDemoMode();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const isDevelopment = import.meta.env.DEV;

  // In development mode, we auto-login as andrew.tam@gmail.com, so user should always exist
  const displayUser = user;

  const handleSignOut = async () => {
    try {
      await signOut();
      // toast.success('Logged out successfully'); // Disabled notifications
      navigate('/login');
    } catch (error) {
      // toast.error('Failed to log out'); // Disabled notifications
      console.error('Logout error:', error);
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getUserDisplayName = (user: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
    if (user?.user_metadata?.first_name && user?.user_metadata?.last_name) {
      return `${user.user_metadata.first_name} ${user.user_metadata.last_name}`;
    }
    return user?.email || 'User';
  };

  return (
    <header className="w-full h-12 md:h-16 bg-white text-brand-dark border-b border-gray-200 shadow-sm flex items-center justify-between px-2 md:px-4 z-10">
      <div className="flex items-center gap-2 md:gap-4 h-full">
        {/* Mobile hamburger menu */}
        {isMobile && onMenuClick && (
          <button
            onClick={onMenuClick}
            className="p-1 bg-brand-brown rounded-lg text-white hover:bg-brand-secondary/90 transition-colors"
          >
            <Menu className="w-4 h-4" />
          </button>
        )}
        {isDevelopment && (
          <div className="bg-yellow-100 text-yellow-800 px-1.5 py-0.5 md:px-2 md:py-1 rounded text-xs font-medium">
            DEV
          </div>
        )}
        
        {/* Logo - Left aligned on desktop, centered on mobile */}
        {!isMobile && (
          <Link to="/dashboard" className="flex items-center h-full">
            <img src="/ailith_dark.png" alt="ailith.co Logo" className="h-6 md:h-8 lg:h-10 w-auto object-contain" />
          </Link>
        )}
      </div>
      
      {/* Mobile-only Centered Logo */}
      {isMobile && (
        <div className="flex-1 flex justify-center">
          <Link to="/dashboard" className="flex items-center h-full">
            <img src="/ailith_dark.png" alt="ailith.co Logo" className="h-6 w-auto object-contain" />
          </Link>
        </div>
      )}
      
      <div className="flex items-center gap-1 md:gap-3">
        {/* Demo Mode Toggle */}
        <div className="flex items-center gap-1 md:gap-2">
          <div className={`px-1.5 py-0.5 md:px-2 md:py-1 rounded-md text-xs font-body font-medium ${
            isDemoMode 
              ? 'bg-yellow-100 text-yellow-800' 
              : 'bg-green-100 text-green-800'
          }`}>
            {isDemoMode ? '🎭 Demo' : '🔗 Live'}
          </div>
          <Button
            onClick={toggleDemoMode}
            variant="outline"
            size="sm"
            className="h-6 md:h-7 px-1.5 md:px-2 text-[10px] md:text-xs font-body border border-brand-secondary/30 text-brand-secondary hover:bg-brand-primary hover:text-white hover:border-brand-primary"
          >
            Toggle
          </Button>
        </div>

        {displayUser || isDevelopment ? (
          <Button 
            onClick={handleSignOut}
            size="sm"
            className="h-7 md:h-9 px-2 md:px-3 bg-brand-primary hover:bg-brand-primary/80 text-white font-body flex items-center gap-1 md:gap-2 text-xs md:text-sm"
          >
            <LogOut className="size-3 md:size-4" />
            <span className="hidden sm:inline">Logout</span>
            <span className="sm:hidden">Out</span>
          </Button>
        ) : (
          <Button asChild variant="outline" size="sm" className="h-7 md:h-9 px-2 md:px-3 font-body text-brand-primary border-gray-200 hover:bg-brand-secondary hover:text-white text-xs md:text-sm">
            <Link to="/login">
              <span className="hidden sm:inline">Sign In</span>
              <span className="sm:hidden">In</span>
            </Link>
          </Button>
        )}
      </div>
    </header>
  );
};

export default Header;