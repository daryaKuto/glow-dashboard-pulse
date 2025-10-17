import React, { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { ArrowUp } from 'lucide-react';
import { Button } from '@/components/ui/button';

const ScrollToTopButton: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);
  const location = useLocation();
  
  const checkScrollPosition = useCallback(() => {
    // Get all possible scrollable elements
    const windowScrollY = window.scrollY;
    const documentScrollTop = document.documentElement.scrollTop;
    const bodyScrollTop = document.body.scrollTop;
    const mainElement = document.querySelector('main');
    const mainScrollTop = mainElement ? mainElement.scrollTop : 0;
    
    // Show button if any scrollable element is scrolled more than 200px
    const isScrolled = windowScrollY > 200 || 
                      documentScrollTop > 200 || 
                      bodyScrollTop > 200 || 
                      mainScrollTop > 200;
    
    setIsVisible(isScrolled);
  }, []);
  
  useEffect(() => {
    // Throttled scroll handler
    let timeoutId: NodeJS.Timeout;
    const throttledCheckScroll = () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      timeoutId = setTimeout(checkScrollPosition, 100);
    };

    // Add scroll listeners to multiple elements
    const scrollElements = [
      window,
      document,
      document.documentElement,
      document.body
    ];
    
    // Also try to find the main scrollable container
    const mainElement = document.querySelector('main');
    if (mainElement) {
      scrollElements.push(mainElement);
    }

    // Add event listeners
    scrollElements.forEach((element) => {
      if (element) {
        element.addEventListener('scroll', throttledCheckScroll);
      }
    });

    // Initial check
    checkScrollPosition();

    // Cleanup function
    return () => {
      scrollElements.forEach((element) => {
        if (element) {
          element.removeEventListener('scroll', throttledCheckScroll);
        }
      });
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [checkScrollPosition, location.pathname]);

  const scrollToTop = () => {
    // Get all possible scrollable elements
    const mainElement = document.querySelector('main');
    
    try {
      // Method 1: Scroll the main container (primary scrollable area)
      if (mainElement) {
        mainElement.scrollTo({
          top: 0,
          left: 0,
          behavior: 'smooth'
        });
        mainElement.scrollTop = 0;
      }
      
      // Method 2: Scroll window
      window.scrollTo({
        top: 0,
        left: 0,
        behavior: 'smooth'
      });
      
      // Method 3: Scroll document element
      document.documentElement.scrollTo({
        top: 0,
        left: 0,
        behavior: 'smooth'
      });
      
      // Method 4: Direct property setting as fallback
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
      
      // Method 5: Try scrolling the root element
      const rootElement = document.getElementById('root');
      if (rootElement) {
        rootElement.scrollTo({
          top: 0,
          left: 0,
          behavior: 'smooth'
        });
        rootElement.scrollTop = 0;
      }
      
    } catch (error) {
      // Fallback for browsers that don't support smooth scrolling
      if (mainElement) {
        mainElement.scrollTop = 0;
      }
      window.scrollTo(0, 0);
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    }
  };

  return (
    <Button
        onClick={scrollToTop}
        size="icon"
        className={`fixed bottom-4 right-4 md:bottom-6 md:right-6 z-[9999] h-10 w-10 md:h-12 md:w-12 rounded-full bg-brand-secondary hover:bg-brand-primary text-white shadow-lg hover:shadow-xl transition-all duration-300 ease-in-out transform hover:scale-105 ${
          isVisible 
            ? 'opacity-100 translate-y-0' 
            : 'opacity-0 translate-y-2 pointer-events-none'
        }`}
        aria-label="Scroll to top"
        style={{
          position: 'fixed',
          bottom: '16px',
          right: '16px',
          zIndex: 9999,
          backgroundColor: isVisible ? '#816E94' : '#816E94',
          color: 'white',
          border: 'none',
          borderRadius: '50%',
          width: '48px',
          height: '48px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
          opacity: isVisible ? 1 : 0,
          transform: isVisible ? 'translateY(0)' : 'translateY(2px)'
        }}
      >
        <ArrowUp className="h-5 w-5" />
      </Button>
  );
};

export default ScrollToTopButton;
