import React, { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { ArrowUp } from 'lucide-react';
import { Button } from '@/components/ui/button';

const ScrollToTopButton: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [mainElement, setMainElement] = useState<HTMLElement | null>(null);
  const location = useLocation();
  
  // Find the main scrollable element with retry mechanism
  const findMainElement = useCallback(() => {
    // Try to find the main element that has overflow-y-auto class
    const mainElements = document.querySelectorAll('main');
    for (const element of mainElements) {
      if (element.classList.contains('overflow-y-auto') || 
          element.classList.contains('flex-1')) {
        return element as HTMLElement;
      }
    }
    // Fallback to any main element
    return document.querySelector('main') as HTMLElement;
  }, []);

  // Check if we're on mobile (for different scroll behavior)
  const isMobile = useCallback(() => {
    return window.innerWidth <= 768; // md breakpoint
  }, []);
  
  const checkScrollPosition = useCallback(() => {
    let isScrolled = false;
    const mobile = isMobile();
    
    // Primary check: main element scroll (most pages use this)
    if (mainElement) {
      const mainScrollTop = mainElement.scrollTop;
      const mainScrollHeight = mainElement.scrollHeight;
      const mainClientHeight = mainElement.clientHeight;
      isScrolled = mainScrollTop > 200;
      
      // Debug: Log scroll info every 10th call to avoid spam
      if (Math.random() < 0.1) {
        console.log('ScrollToTopButton: Main element scroll debug:', {
          scrollTop: mainScrollTop,
          scrollHeight: mainScrollHeight,
          clientHeight: mainClientHeight,
          canScroll: mainScrollHeight > mainClientHeight,
          isScrolled,
          mobile
        });
      }
      
      if (isScrolled && !isVisible) {
        console.log('ScrollToTopButton: Showing button (main element scroll:', mainScrollTop, ', mobile:', mobile, ')');
      } else if (!isScrolled && isVisible) {
        console.log('ScrollToTopButton: Hiding button (main element scroll reset:', mainScrollTop, ', mobile:', mobile, ')');
      }
      
      setIsVisible(isScrolled);
      return; // Exit early since we found the main scrollable element
    }
    
    // Fallback checks for other scrollable elements (when main element not found)
    const windowScrollY = window.scrollY;
    const documentScrollTop = document.documentElement.scrollTop;
    const bodyScrollTop = document.body.scrollTop;
    
    // On mobile, prioritize body/html scrolling; on desktop, check all
    if (mobile) {
      // Mobile: Check body and document scrolling (common on mobile)
      isScrolled = bodyScrollTop > 200 || documentScrollTop > 200;
    } else {
      // Desktop: Check all scrollable elements
      isScrolled = windowScrollY > 200 || 
                   documentScrollTop > 200 || 
                   bodyScrollTop > 200;
    }
    
    if (isScrolled && !isVisible) {
      console.log('ScrollToTopButton: Showing button (fallback scroll detection, mobile:', mobile, ')');
    } else if (!isScrolled && isVisible) {
      console.log('ScrollToTopButton: Hiding button (scroll position reset, mobile:', mobile, ')');
    }
    
    setIsVisible(isScrolled);
  }, [mainElement, isVisible, isMobile]);
  
  // Find and set main element when component mounts or location changes
  useEffect(() => {
    const findAndSetMainElement = () => {
      const foundMainElement = findMainElement();
      if (foundMainElement) {
        console.log('ScrollToTopButton: Found main element:', foundMainElement);
        setMainElement(foundMainElement);
        return true;
      }
      console.log('ScrollToTopButton: No main element found');
      return false;
    };

    // Try to find main element immediately
    if (!findAndSetMainElement()) {
      // If not found, retry after a short delay (for dynamic content)
      const retryTimeout = setTimeout(() => {
        console.log('ScrollToTopButton: Retrying to find main element...');
        findAndSetMainElement();
      }, 100);
      
      return () => clearTimeout(retryTimeout);
    }
  }, [findMainElement, location.pathname]);

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
    
    // Add main element if it exists
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
  }, [checkScrollPosition, mainElement, location.pathname]);

  const scrollToTop = () => {
    console.log('ScrollToTopButton: Scroll to top clicked, mobile:', isMobile());
    
    // Hide button immediately for better UX
    setIsVisible(false);
    
    try {
      // Method 1: Scroll the main container (primary scrollable area)
      if (mainElement) {
        console.log('ScrollToTopButton: Scrolling main element to top');
        mainElement.scrollTo({
          top: 0,
          left: 0,
          behavior: 'smooth'
        });
        // Also set scrollTop directly as backup
        mainElement.scrollTop = 0;
        return; // Exit early if main element scroll succeeds
      }
      
      // Method 2: Fallback to window scroll
      console.log('ScrollToTopButton: Scrolling window to top');
      window.scrollTo({
        top: 0,
        left: 0,
        behavior: 'smooth'
      });
      
      // Method 3: Fallback to document element scroll
      document.documentElement.scrollTo({
        top: 0,
        left: 0,
        behavior: 'smooth'
      });
      
      // Method 4: Direct property setting as final fallback
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
      
    } catch (error) {
      console.warn('ScrollToTop: Smooth scrolling failed, using fallback:', error);
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
            ? 'opacity-100 translate-y-0 pointer-events-auto' 
            : 'opacity-0 translate-y-2 pointer-events-none'
        }`}
        aria-label="Scroll to top"
      >
        <ArrowUp className="h-5 w-5" />
      </Button>
  );
};

export default ScrollToTopButton;
