
import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/providers/AuthProvider';
import { useStats } from '@/store/useStats';
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
import { UserRound, Settings, LogOut, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';

const Header: React.FC = () => {
  const { wsConnected } = useStats();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  // Only show user if authenticated
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

  return (
    <header className="w-full h-16 bg-white text-brand-dark border-b border-brand-brown/20 shadow-sm flex items-center justify-between px-4 z-10">
      <div className="flex items-center gap-4 h-full">
        <Link to="/dashboard" className="flex items-center gap-2 h-full">
          <img src="/LogoFinal.png" alt="Ailith Logo" className="h-full max-h-16 w-auto object-contain" />
        </Link>
      </div>
      <div className="flex items-center gap-4">
        {displayUser ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={displayUser?.avatarUrl || 'https://github.com/shadcn.png'} alt={displayUser?.name || 'User'} />
                  <AvatarFallback className="bg-brand-brown text-white text-sm font-heading">
                    {getInitials(displayUser?.name || 'User')}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="bg-white text-brand-dark border border-brand-brown/20 w-56 shadow-lg">
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none text-brand-dark">{displayUser?.name || 'User'}</p>
                  <p className="text-xs leading-none text-brand-dark/70">{displayUser?.email || 'user@example.com'}</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-brand-brown/20" />
              <DropdownMenuItem 
                className="hover:bg-brand-brown/10 cursor-pointer gap-2 text-brand-dark"
                onClick={() => navigate('/dashboard/profile')}
              >
                <UserRound className="size-4" />
                Profile
              </DropdownMenuItem>
              <DropdownMenuItem 
                className="hover:bg-brand-brown/10 cursor-pointer gap-2 text-brand-dark"
                onClick={() => navigate('/dashboard/settings')}
              >
                <Settings className="size-4" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-brand-brown/20" />
              <DropdownMenuItem 
                className="hover:bg-brand-brown/10 cursor-pointer gap-2 text-brand-dark"
                onClick={handleSignOut}
              >
                <LogOut className="size-4" />
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <Button asChild variant="outline" className="font-body text-brand-brown border-brand-brown/30 hover:bg-brand-brown hover:text-white">
            <Link to="/login">Sign In</Link>
          </Button>
        )}
      </div>
    </header>
  );
};

export default Header;
