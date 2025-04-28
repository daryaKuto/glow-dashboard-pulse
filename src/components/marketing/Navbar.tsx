
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
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
  
  const NavLinks = ({ onNavLinkClick }: { onNavLinkClick?: () => void }) => (
    <>
      <Link 
        to="/" 
        className="text-white hover:text-brand-lavender transition-colors"
        onClick={onNavLinkClick}
      >
        Home
      </Link>
      <Link 
        to="/products" 
        className="text-white hover:text-brand-lavender transition-colors"
        onClick={onNavLinkClick}
      >
        Products
      </Link>
      {user ? (
        <Link 
          to="/dashboard" 
          className="text-white hover:text-brand-lavender transition-colors"
          onClick={onNavLinkClick}
        >
          Dashboard
        </Link>
      ) : (
        <>
          <Link 
            to="/login" 
            className="text-white hover:text-brand-lavender transition-colors"
            onClick={onNavLinkClick}
          >
            Login
          </Link>
          <Button 
            asChild 
            className="bg-brand-lavender hover:bg-brand-lavender/80"
            onClick={onNavLinkClick}
          >
            <Link to="/signup">Sign Up</Link>
          </Button>
        </>
      )}
      <Button 
        asChild 
        className="bg-brand-lavender hover:bg-brand-lavender/80"
        onClick={onNavLinkClick}
      >
        <Link to="/affiliate/apply">Apply as Affiliate</Link>
      </Button>
    </>
  );

  return (
    <nav className="sticky top-0 z-50 w-full bg-brand-surface border-b border-brand-lavender/10">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <Link to="/" className="text-xl font-display text-white">
            Fun Gun Training
          </Link>

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
            <SheetContent className="w-[300px] bg-brand-surface">
              <div className="flex flex-col space-y-6 mt-6">
                <NavLinks onNavLinkClick={() => {
                  // Add a slight delay to allow the navigation to happen before closing the sheet
                  setTimeout(() => {
                    document.querySelector('[data-radix-collection-item]')?.dispatchEvent(
                      new KeyboardEvent('keydown', { key: 'Escape' })
                    );
                  }, 100);
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
