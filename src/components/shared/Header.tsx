import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/shared/hooks/use-auth';
import { useIsMobile } from '@/shared/hooks/use-mobile';
import { toast } from '@/components/ui/sonner';
import { LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { logger } from '@/shared/lib/logger';

const Header: React.FC = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  const handleSignOut = async () => {
    try {
      logger.debug('[Header] Starting logout process...');
      await signOut();
      logger.debug('[Header] Logout completed, redirecting to login...');
    } catch (error) {
      console.error('[Header] Logout error:', error);
      navigate('/login');
    }
  };

  return (
    <header className="w-full h-12 md:h-16 bg-white text-brand-dark border-b border-gray-200 shadow-sm flex items-center justify-between px-3 md:px-4 z-50 fixed top-0 left-0 right-0">
      {/* Logo */}
      <Link to="/dashboard" className="flex items-center h-full">
        <img src="/ailith_dark.png" alt="ailith.co Logo" className="h-6 md:h-8 lg:h-10 w-auto object-contain" />
      </Link>

      {/* Actions */}
      <div className="flex items-center gap-2 md:gap-4">
        {user ? (
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
