
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
import { UserRound, Settings, LogOut, Home, LogIn } from 'lucide-react';
import { Button } from '@/components/ui/button';

const Header: React.FC = () => {
  const { wsConnected } = useStats();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

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
    <header className="bg-white border-b border-brand-brown/20 shadow-sm">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <a href="https://ailith.co" target="_blank" rel="noopener noreferrer" className="flex items-center">
            <img 
              src="/LogoFinal.png" 
              alt="Ailith" 
              className="h-8 w-auto"
            />
          </a>

          {/* Connection Status */}
          <div className="hidden md:flex items-center gap-4">
            <div className={`px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-2 
              ${wsConnected ? 'bg-green-500/20 text-green-700 border border-green-500/30' : 'bg-red-500/20 text-red-700 border border-red-500/30'}`}>
              <span className={`w-2 h-2 rounded-full ${wsConnected ? 'bg-green-500' : 'bg-red-500'}`}></span>
              <span>{wsConnected ? 'Live' : 'Offline'}</span>
            </div>
          </div>

          {/* User Menu */}
          <div className="flex items-center gap-4">
            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={user.avatarUrl} alt={user.name} />
                      <AvatarFallback className="bg-brand-brown text-white text-sm font-heading">
                        {getInitials(user.name || 'User')}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="bg-white text-brand-dark border border-brand-brown/20 w-56 shadow-lg">
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none text-brand-dark">{user?.name || 'User'}</p>
                      <p className="text-xs leading-none text-brand-dark/60">{user?.email}</p>
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
                    className="hover:bg-red-500/10 text-red-600 cursor-pointer gap-2"
                    onClick={handleSignOut}
                  >
                    <LogOut className="size-4" />
                    Log out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate('/login')}
                  className="text-brand-dark hover:text-brand-brown"
                >
                  <LogIn className="h-4 w-4 mr-2" />
                  Log In
                </Button>
                <Button
                  size="sm"
                  onClick={() => navigate('/signup')}
                  className="bg-brand-brown hover:bg-brand-dark text-white"
                >
                  Sign Up
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
