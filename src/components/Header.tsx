
import React from 'react';
import { useNavigate } from 'react-router-dom';
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
import { UserRound, Settings, LogOut } from 'lucide-react';

const Header: React.FC = () => {
  const { wsConnected } = useStats();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    try {
      await signOut();
      toast.success('Logged out successfully');
      navigate('/login');
    } catch (error) {
      toast.error('Failed to log out');
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
    <header className="sticky top-0 z-10 bg-brand-indigo border-b border-brand-surface py-3 px-4">
      <div className="container mx-auto flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-md bg-brand-lavender flex items-center justify-center">
            <span className="text-white font-display font-bold">FG</span>
          </div>
          <h1 className="text-xl md:text-2xl font-display font-bold text-white hidden sm:block">
            FunGun Dashboard
          </h1>
        </div>
        
        <div className="flex items-center gap-4">
          <div className={`px-3 py-1 rounded-full text-xs flex items-center gap-1 
            ${wsConnected ? 'bg-brand-success/20 text-brand-success' : 'bg-brand-error/20 text-brand-error'}`}>
            <span className={`w-2 h-2 rounded-full ${wsConnected ? 'bg-brand-success' : 'bg-brand-error'}`}></span>
            <span>{wsConnected ? 'Connected' : 'Disconnected'}</span>
          </div>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="outline-none">
                <Avatar>
                  <AvatarImage src={user?.avatar_url} />
                  <AvatarFallback className="bg-brand-lavender">
                    {user?.name ? getInitials(user.name) : 'U'}
                  </AvatarFallback>
                </Avatar>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="bg-brand-surface text-white border-brand-lavender/30 w-56">
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">{user?.name || 'User'}</p>
                  <p className="text-xs leading-none text-brand-fg-secondary">{user?.email}</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-brand-lavender/20" />
              <DropdownMenuItem 
                className="hover:bg-brand-lavender/20 cursor-pointer gap-2"
                onClick={() => navigate('/profile')}
              >
                <UserRound className="size-4" />
                Profile
              </DropdownMenuItem>
              <DropdownMenuItem 
                className="hover:bg-brand-lavender/20 cursor-pointer gap-2"
                onClick={() => navigate('/settings')}
              >
                <Settings className="size-4" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-brand-lavender/20" />
              <DropdownMenuItem 
                className="hover:bg-brand-error/20 text-brand-error cursor-pointer gap-2"
                onClick={handleSignOut}
              >
                <LogOut className="size-4" />
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
};

export default Header;

