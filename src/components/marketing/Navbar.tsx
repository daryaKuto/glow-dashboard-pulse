
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
  
  // Define link types with proper TypeScript interface - making className optional
  interface NavLinkType {
    to: string;
    label: string;
    className?: string; // Make className optional with the ? operator
    alwaysVisible?: boolean; // Add flag to determine if link is always visible
  }
  
  // NavLinks component with properly wrapped SheetClose for mobile
  const NavLinks = ({ isMobile = false }) => {
    // Marketing links - always visible regardless of auth status
    const marketingLinks: NavLinkType[] = [
      { to: "/", label: "Home", alwaysVisible: true },
      { to: "/products", label: "Products", alwaysVisible: true },
      { to: "/affiliate/apply", label: "Apply as Affiliate", className: "bg-brand-lavender hover:bg-brand-lavender/80 text-white", alwaysVisible: true }
    ];
    
    // Auth links - only visible when not logged in
    const authLinks: NavLinkType[] = !user ? [
      { to: "/login", label: "Login" },
      { to: "/signup", label: "Sign Up", className: "bg-brand-lavender hover:bg-brand-lavender/80 text-white" }
    ] : [];
    
    // Dashboard link - only visible when logged in
    const dashboardLink: NavLinkType = user ? 
      { to: "/dashboard", label: "Dashboard", className: "bg-brand-lavender hover:bg-brand-lavender/80 text-white" } : 
      { to: "", label: "", alwaysVisible: false };
    
    // Combine all links
    const allLinks = [...marketingLinks, ...authLinks];
    
    // Add dashboard link if user is logged in
    if (user) {
      allLinks.push(dashboardLink);
    }
    
    // Filter out empty links (for type safety)
    const visibleLinks = allLinks.filter(link => link.label && (link.alwaysVisible || (!user && !link.alwaysVisible) || (user && link.to === '/dashboard')));
    
    console.log("User status:", !!user, "Visible links:", visibleLinks.map(l => l.label));
    
    return (
      <>
        {visibleLinks.map((link, index) => (
          isMobile ? (
            <SheetClose key={index} asChild>
              <Link 
                to={link.to}
                className={`text-white hover:text-brand-lavender transition-colors px-4 py-2 rounded-md ${link.className || ''}`}
              >
                {link.label}
              </Link>
            </SheetClose>
          ) : (
            <Link 
              key={index}
              to={link.to}
              className={`text-white hover:text-brand-lavender transition-colors px-4 py-2 rounded-md ${link.className || ''}`}
            >
              {link.label}
            </Link>
          )
        ))}
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
