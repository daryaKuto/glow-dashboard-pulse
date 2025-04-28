
import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useAuth } from '@/providers/AuthProvider';

const Navbar = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  
  const navigateTo = (path: string) => {
    if (location.pathname !== path) {
      navigate(path);
    }
  };
  
  const NavLinks = ({ onClose }: { onClose?: () => void }) => (
    <>
      <Button 
        variant="ghost" 
        className="text-white hover:text-brand-lavender transition-colors"
        onClick={() => {
          navigateTo('/');
          if (onClose) onClose();
        }}
      >
        Home
      </Button>
      
      <Button 
        variant="ghost" 
        className="text-white hover:text-brand-lavender transition-colors"
        onClick={() => {
          navigateTo('/products');
          if (onClose) onClose();
        }}
      >
        Products
      </Button>
      
      {user ? (
        <Button 
          variant="ghost" 
          className="text-white hover:text-brand-lavender transition-colors"
          onClick={() => {
            navigateTo('/dashboard');
            if (onClose) onClose();
          }}
        >
          Dashboard
        </Button>
      ) : (
        <>
          <Button 
            variant="ghost" 
            className="text-white hover:text-brand-lavender transition-colors"
            onClick={() => {
              navigateTo('/login');
              if (onClose) onClose();
            }}
          >
            Login
          </Button>
          
          <Button 
            variant="default"
            className="bg-brand-lavender hover:bg-brand-lavender/80"
            onClick={() => {
              navigateTo('/signup');
              if (onClose) onClose();
            }}
          >
            Sign Up
          </Button>
        </>
      )}
      
      <Button 
        variant="default"
        className="bg-brand-lavender hover:bg-brand-lavender/80"
        onClick={() => {
          navigateTo('/affiliate/apply');
          if (onClose) onClose();
        }}
      >
        Apply as Affiliate
      </Button>
    </>
  );

  return (
    <nav className="sticky top-0 z-50 w-full bg-brand-surface border-b border-brand-lavender/10">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <Button 
            variant="ghost" 
            className="text-xl font-display text-white p-0" 
            onClick={() => navigateTo('/')}
          >
            Fun Gun Training
          </Button>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-4">
            <NavLinks />
          </div>

          {/* Mobile Navigation */}
          <Sheet>
            <SheetTrigger asChild className="md:hidden">
              <Button variant="ghost" size="icon" className="text-brand-lavender">
                <Menu className="h-6 w-6" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[300px] bg-brand-surface">
              <div className="flex flex-col space-y-6 mt-12">
                <NavLinks onClose={() => {
                  // Find and click the close button
                  const closeButton = document.querySelector('[data-radix-collection-item]');
                  if (closeButton) {
                    (closeButton as HTMLElement).click();
                  }
                }} />
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
