
import React from 'react';
import { Link } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetClose
} from "@/components/ui/sheet";
import { useAuth } from '@/providers/AuthProvider';

const Navbar = () => {
  const { user } = useAuth();
  
  // NavLinks component for both desktop and mobile
  const NavLinks = () => (
    <>
      <Link 
        to="/"
        className="text-white hover:text-brand-lavender transition-colors px-4 py-2 rounded-md"
      >
        Home
      </Link>
      
      <Link 
        to="/products"
        className="text-white hover:text-brand-lavender transition-colors px-4 py-2 rounded-md"
      >
        Products
      </Link>
      
      {user ? (
        <Link 
          to="/dashboard"
          className="text-white hover:text-brand-lavender transition-colors px-4 py-2 rounded-md"
        >
          Dashboard
        </Link>
      ) : (
        <>
          <Link 
            to="/login"
            className="text-white hover:text-brand-lavender transition-colors px-4 py-2 rounded-md"
          >
            Login
          </Link>
          
          <Link 
            to="/signup"
            className="bg-brand-lavender hover:bg-brand-lavender/80 text-white px-4 py-2 rounded-md"
          >
            Sign Up
          </Link>
        </>
      )}
      
      <Link 
        to="/affiliate/apply"
        className="bg-brand-lavender hover:bg-brand-lavender/80 text-white px-4 py-2 rounded-md"
      >
        Apply as Affiliate
      </Link>
    </>
  );

  return (
    <nav className="sticky top-0 z-50 w-full bg-brand-surface border-b border-brand-lavender/10">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <Link 
            to="/"
            className="text-xl font-display text-white"
          >
            Fun Gun Training
          </Link>

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
                <div className="flex flex-col space-y-4">
                  <NavLinks />
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
