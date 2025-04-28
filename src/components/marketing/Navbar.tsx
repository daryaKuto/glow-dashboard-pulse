
import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
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
  const navigate = useNavigate();
  const location = useLocation();
  
  // Define link types with proper TypeScript interface
  interface NavLinkType {
    to: string;
    label: string;
    className?: string;
  }
  
  // NavLinks component with properly wrapped SheetClose for mobile
  const NavLinks = ({ isMobile = false }) => {
    // Standard marketing links visible to everyone
    const links: NavLinkType[] = [
      { to: "/", label: "Home" },
      { to: "/products", label: "Products" },
      { to: "/affiliate/apply", label: "Apply as Affiliate", className: "bg-brand-lavender hover:bg-brand-lavender/80 text-white" },
    ];
    
    // Add auth links if user is not logged in
    if (!user) {
      links.push(
        { to: "/login", label: "Login" },
        { to: "/signup", label: "Sign Up", className: "bg-brand-lavender hover:bg-brand-lavender/80 text-white" }
      );
    }
    
    // Add dashboard link if user is logged in
    if (user) {
      links.push({ to: "/dashboard", label: "Dashboard", className: "bg-brand-lavender hover:bg-brand-lavender/80 text-white" });
    }
    
    return (
      <>
        {links.map((link, index) => {
          const LinkElement = (
            <Link 
              to={link.to}
              key={link.to}
              className={`text-white hover:text-brand-lavender transition-colors px-4 py-2 rounded-md ${link.className || ''}`}
            >
              {link.label}
            </Link>
          );
          
          return isMobile ? (
            <SheetClose key={index} asChild>
              {LinkElement}
            </SheetClose>
          ) : (
            <div key={index} className="inline-block">
              {LinkElement}
            </div>
          );
        })}
      </>
    );
  };

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
            <NavLinks isMobile={false} />
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
                  <NavLinks isMobile={true} />
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
