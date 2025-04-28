
import React from 'react';
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

const Header: React.FC = () => {
  const { wsConnected } = useStats();

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
                  <AvatarImage src="https://github.com/shadcn.png" />
                  <AvatarFallback className="bg-brand-lavender">JD</AvatarFallback>
                </Avatar>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="bg-brand-surface text-white border-brand-lavender/30">
              <DropdownMenuLabel>My Account</DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-brand-lavender/20" />
              <DropdownMenuItem className="hover:bg-brand-lavender/20 cursor-pointer">
                Profile
              </DropdownMenuItem>
              <DropdownMenuItem className="hover:bg-brand-lavender/20 cursor-pointer">
                Settings
              </DropdownMenuItem>
              <DropdownMenuItem className="hover:bg-brand-error/20 text-brand-error cursor-pointer">
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
