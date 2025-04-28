
import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetClose,
} from "@/components/ui/sheet";
import { useAuth } from '@/providers/AuthProvider';

const Navbar = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const handleNavigate = (path: string, callback?: () => void) => {
    navigate(path);
    if (callback) callback();
  };
  
  const NavLinks = ({ onNavLinkClick }: { onNavLinkClick?: () => void }) => (
    <>
      <Button 
        variant="ghost" 
        className="text-white hover:text-brand-lavender transition-colors"
        onClick={() => handleNavigate('/', onNavLinkClick)}
      >
        Home
      </Button>
      <Button 
        variant="ghost" 
        className="text-white hover:text-brand-lavender transition-colors"
        onClick={() => handleNavigate('/products', onNavLinkClick)}
      >
        Products
      </Button>
      {user ? (
        <Button 
          variant="ghost" 
          className="text-white hover:text-brand-lavender transition-colors"
          onClick={() => handleNavigate('/dashboard', onNavLinkClick)}
        >
          Dashboard
        </Button>
      ) : (
        <>
          <Button 
            variant="ghost" 
            className="text-white hover:text-brand-lavender transition-colors"
            onClick={() => handleNavigate('/login', onNavLinkClick)}
          >
            Login
          </Button>
          <Button 
            variant="default"
            className="bg-brand-lavender hover:bg-brand-lavender/80"
            onClick={() => handleNavigate('/signup', onNavLinkClick)}
          >
            Sign Up
          </Button>
        </>
      )}
      <Button 
        variant="default"
        className="bg-brand-lavender hover:bg-brand-lavender/80"
        onClick={() => handleNavigate('/affiliate/apply', onNavLinkClick)}
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
            onClick={() => navigate('/')}
          >
            Fun Gun Training
          </Button>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-8">
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
              <div className="flex flex-col space-y-6 mt-6">
                <NavLinks onNavLinkClick={() => {
                  // Add a slight delay to allow the navigation to happen before closing the sheet
                  setTimeout(() => {
                    const closeButton = document.querySelector('[data-radix-collection-item]');
                    if (closeButton) {
                      closeButton.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
                    }
                  }, 200);
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
