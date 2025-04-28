
import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
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
  const location = useLocation();
  
  const handleNavigate = (path: string, callback?: () => void) => {
    // Only navigate if we're not already on that page
    if (location.pathname !== path) {
      navigate(path);
    }
    
    if (callback) callback();
  };
  
  const NavLinks = ({ onNavLinkClick }: { onNavLinkClick?: () => void }) => (
    <>
      <Link to="/" className="block">
        <Button 
          variant="ghost" 
          className="text-white hover:text-brand-lavender transition-colors"
          onClick={(e) => {
            e.preventDefault();
            handleNavigate('/', onNavLinkClick);
          }}
        >
          Home
        </Button>
      </Link>
      <Link to="/products" className="block">
        <Button 
          variant="ghost" 
          className="text-white hover:text-brand-lavender transition-colors"
          onClick={(e) => {
            e.preventDefault();
            handleNavigate('/products', onNavLinkClick);
          }}
        >
          Products
        </Button>
      </Link>
      {user ? (
        <Link to="/dashboard" className="block">
          <Button 
            variant="ghost" 
            className="text-white hover:text-brand-lavender transition-colors"
            onClick={(e) => {
              e.preventDefault();
              handleNavigate('/dashboard', onNavLinkClick);
            }}
          >
            Dashboard
          </Button>
        </Link>
      ) : (
        <>
          <Link to="/login" className="block">
            <Button 
              variant="ghost" 
              className="text-white hover:text-brand-lavender transition-colors"
              onClick={(e) => {
                e.preventDefault();
                handleNavigate('/login', onNavLinkClick);
              }}
            >
              Login
            </Button>
          </Link>
          <Link to="/signup" className="block">
            <Button 
              variant="default"
              className="bg-brand-lavender hover:bg-brand-lavender/80"
              onClick={(e) => {
                e.preventDefault();
                handleNavigate('/signup', onNavLinkClick);
              }}
            >
              Sign Up
            </Button>
          </Link>
        </>
      )}
      <Link to="/affiliate/apply" className="block">
        <Button 
          variant="default"
          className="bg-brand-lavender hover:bg-brand-lavender/80"
          onClick={(e) => {
            e.preventDefault();
            handleNavigate('/affiliate/apply', onNavLinkClick);
          }}
        >
          Apply as Affiliate
        </Button>
      </Link>
    </>
  );

  return (
    <nav className="sticky top-0 z-50 w-full bg-brand-surface border-b border-brand-lavender/10">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <Link to="/" className="block">
            <Button 
              variant="ghost" 
              className="text-xl font-display text-white p-0" 
              onClick={(e) => {
                e.preventDefault();
                navigate('/');
              }}
            >
              Fun Gun Training
            </Button>
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
            <SheetContent side="right" className="w-[300px] bg-brand-surface">
              <SheetClose className="absolute top-4 right-4">
                {/* Close button is automatically provided by SheetClose */}
              </SheetClose>
              <div className="flex flex-col space-y-6 mt-6">
                <NavLinks onNavLinkClick={() => {
                  // Use the built-in SheetClose functionality
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
