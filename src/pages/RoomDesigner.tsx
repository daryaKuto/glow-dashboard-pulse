import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useRoomDesigner } from '@/store/useRoomDesigner';
import { useRooms } from '@/store/useRooms';
import Header from '@/components/shared/Header';
import Sidebar from '@/components/shared/Sidebar';
import MobileDrawer from '@/components/shared/MobileDrawer';
import { useIsMobile } from '@/hooks/use-mobile';
import { useResponsive } from '@/hooks/use-responsive';
import RoomCanvas from '@/components/RoomCanvas';
import InspectorPanel from '@/components/InspectorPanel';
import PalettePanel from '@/components/PalettePanel';
import FloorPlanTools from '@/components/FloorPlanTools';
import ErrorBoundary from '@/components/ErrorBoundary';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Save, ArrowLeft, RotateCcw, Palette, Settings } from 'lucide-react';
import { toast } from '@/components/ui/sonner';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

// Import mobile canvas improvements
import '@/styles/mobile-canvas-improvements.css';

const RoomDesigner: React.FC = () => {
  const { id: roomId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { isDesktop, isTablet } = useResponsive();
  const isTabletOrMobile = !isDesktop; // Tablet or mobile (< 1024px)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isPaletteOpen, setIsPaletteOpen] = React.useState(false);
  const [isInspectorOpen, setIsInspectorOpen] = React.useState(false);

  const { rooms, fetchRooms } = useRooms();
  const {
    setRoom,
    fetchLayout,
    saveLayout,
    floorPlan,
  } = useRoomDesigner();

  // Get current room data
  const currentRoom = roomId ? rooms.find(r => r.id === roomId) : null;

  // TODO: Get proper token from auth context
  const token = ''; // We need to implement proper token handling

  // Initialize room designer on mount
  useEffect(() => {
    const initialize = async () => {
      if (!roomId) {
        toast.error('Room ID not found');
        navigate('/dashboard/rooms');
        return;
      }

      setIsLoading(true);
      try {
        // Fetch rooms if not loaded
        if (rooms.length === 0) {
          await fetchRooms();
        }

        // Set room in designer
        setRoom(roomId);

        // Load layout
        await fetchLayout(token);
      } catch (error) {
        console.error('Error initializing room designer:', error);
        toast.error('Failed to load room designer');
      } finally {
        setIsLoading(false);
      }
    };

    initialize();
  }, [roomId, setRoom, fetchLayout, fetchRooms, rooms.length, navigate]);

  const handleSave = async () => {
    try {
      const success = await saveLayout(token);
      if (success) {
        toast.success('Room layout saved successfully!');
      }
    } catch (error) {
      console.error('Error saving room:', error);
      toast.error('Failed to save room layout');
    }
  };

  const handleReset = async () => {
    if (confirm('Are you sure you want to reset the layout? This cannot be undone.')) {
      if (roomId) {
        try {
          setRoom(roomId);
          await fetchLayout(token);
          toast.success('Layout reset');
        } catch (error) {
          console.error('Error resetting layout:', error);
          toast.error('Failed to reset layout');
        }
      }
    }
  };

  const handleBack = () => {
    navigate('/dashboard/rooms');
  };

  // Enhanced responsive layout testing and optimization
  useEffect(() => {
    const measureLayout = () => {
      const header = document.querySelector('header');
      const toolbar = document.querySelector('[data-toolbar]');
      const tools = document.querySelector('[data-tools]');
      const canvas = document.querySelector('[data-canvas]');
      
      const measurements = {
        windowWidth: window.innerWidth,
        windowHeight: window.innerHeight,
        devicePixelRatio: window.devicePixelRatio || 1,
        headerHeight: header?.offsetHeight || 0,
        toolbarHeight: toolbar?.offsetHeight || 0,
        toolsHeight: tools?.offsetHeight || 0,
        canvasHeight: canvas?.offsetHeight || 0,
        canvasScrollHeight: canvas?.scrollHeight || 0,
        viewportHeight: window.visualViewport?.height || window.innerHeight,
        breakpoint: isMobile ? 'mobile' : isTablet ? 'tablet' : 'desktop',
        safeAreaBottom: getComputedStyle(document.documentElement).getPropertyValue('--safe-area-inset-bottom') || '0px'
      };
      
      // Test button visibility - ensure all 5 primary tools are visible
      if (tools) {
        const buttons = tools.querySelectorAll('button');
        const toolsRect = tools.getBoundingClientRect();
        const visibleButtons = Array.from(buttons).filter(btn => {
          const btnRect = btn.getBoundingClientRect();
          return btnRect.right <= toolsRect.right && btnRect.left >= toolsRect.left;
        });
        
        measurements.totalButtons = buttons.length;
        measurements.visibleButtons = visibleButtons.length;
        measurements.allButtonsVisible = buttons.length === visibleButtons.length;
      }
      
      // Test canvas scrollability
      if (canvas) {
        const canvasRect = canvas.getBoundingClientRect();
        measurements.canvasScrollable = canvas.scrollHeight > canvas.clientHeight || canvas.scrollWidth > canvas.clientWidth;
        measurements.canvasOverflow = {
          vertical: canvas.scrollHeight > canvas.clientHeight,
          horizontal: canvas.scrollWidth > canvas.clientWidth
        };
      }
      
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/833eaf25-0547-420d-a570-1d7cab6b5873',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'RoomDesigner.tsx:responsiveTest',message:'Responsive layout measurements',data:measurements,timestamp:Date.now(),sessionId:'debug-session',runId:'responsive-test',hypothesisId:'FINAL'})}).catch(()=>{});
      // #endregion
    };
    
    measureLayout();
    window.addEventListener('resize', measureLayout);
    window.addEventListener('orientationchange', () => {
      // Delay measurement after orientation change to get accurate dimensions
      setTimeout(measureLayout, 300);
    });
    
    return () => {
      window.removeEventListener('resize', measureLayout);
      window.removeEventListener('orientationchange', measureLayout);
    };
  }, [isMobile, isTablet, isDesktop]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col bg-brand-light">
        <Header onMenuClick={() => setIsMobileMenuOpen(true)} />
        <div className="flex flex-1">
          {!isMobile && <Sidebar />}
          <MobileDrawer 
            isOpen={isMobileMenuOpen} 
            onClose={() => setIsMobileMenuOpen(false)} 
          />
          <main className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="text-brand-dark/70 font-body">Loading room designer...</div>
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-brand-light">
      <Header onMenuClick={() => setIsMobileMenuOpen(true)} />
      
      <div className="flex flex-1 min-h-0">
        {!isMobile && <Sidebar />}
        <MobileDrawer 
          isOpen={isMobileMenuOpen} 
          onClose={() => setIsMobileMenuOpen(false)} 
        />
        
        <div 
          className="flex-1 flex flex-col min-h-0"
          style={isDesktop ? { height: '600px', maxHeight: '600px' } : undefined}
        >
          {/* Toolbar - Fixed height on desktop: 62px */}
          <div 
            data-toolbar 
            className={`bg-brand-surface ${isMobile ? 'p-2' : 'p-3'} border-b border-gray-200 flex justify-between items-center ${isMobile ? 'flex-shrink-0' : ''}`}
            style={isDesktop ? { height: '62px', minHeight: '62px', maxHeight: '62px', flexShrink: 0 } : undefined}
          >
            <div className={`flex items-center ${isMobile ? 'gap-2' : 'gap-4'}`}>
              <Button
                onClick={handleBack}
                variant="ghost"
                size={isMobile ? "sm" : "sm"}
                className={`text-brand-primary hover:text-brand-dark ${isMobile ? 'px-2' : ''}`}
              >
                <ArrowLeft className={`${isMobile ? 'h-4 w-4' : 'h-4 w-4'} ${isMobile ? 'mr-0' : 'mr-2'}`} />
                {!isMobile && 'Back'}
              </Button>
              <h2 className={`${isMobile ? 'text-base' : 'text-h3'} font-heading font-bold text-brand-dark ${isMobile ? 'truncate max-w-[140px]' : 'ml-4'}`}>
                {currentRoom?.name || 'Room Designer'}
              </h2>
            </div>
            
            <div className={`flex items-center ${isMobile ? 'gap-1' : 'gap-2'}`}>
              {/* Mobile/Tablet: Show palette and inspector buttons */}
              {!isDesktop && (
                <>
                  <Sheet open={isPaletteOpen} onOpenChange={setIsPaletteOpen}>
                    <SheetTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className={`border-primary text-brand-primary hover:bg-brand-secondary hover:text-white ${isMobile ? 'px-2' : ''}`}
                        title="Open target palette"
                      >
                        <Palette className="h-4 w-4" />
                        {!isMobile && 'Targets'}
                      </Button>
                    </SheetTrigger>
                    <SheetContent side={isMobile ? "bottom" : "right"} className={`${isMobile ? 'h-3/4' : 'w-80'} bg-brand-light`}>
                      <SheetHeader>
                        <SheetTitle>Available Targets</SheetTitle>
                        <SheetDescription>
                          Drag targets to place them on the canvas
                        </SheetDescription>
                      </SheetHeader>
                      <div className="mt-6">
                        <PalettePanel />
                      </div>
                    </SheetContent>
                  </Sheet>
                  <Sheet open={isInspectorOpen} onOpenChange={setIsInspectorOpen}>
                    <SheetTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className={`border-primary text-brand-primary hover:bg-brand-secondary hover:text-white ${isMobile ? 'px-2' : ''}`}
                        title="Open properties panel"
                      >
                        <Settings className="h-4 w-4" />
                        {!isMobile && 'Properties'}
                      </Button>
                    </SheetTrigger>
                    <SheetContent side={isMobile ? "bottom" : "right"} className={`${isMobile ? 'h-3/4' : 'w-80'} bg-brand-light`}>
                      <SheetHeader>
                        <SheetTitle>Properties & Groups</SheetTitle>
                        <SheetDescription>
                          Edit selected elements and manage groups
                        </SheetDescription>
                      </SheetHeader>
                      <div className="mt-6">
                        <InspectorPanel />
                      </div>
                    </SheetContent>
                  </Sheet>
                </>
              )}
              <Button
                onClick={handleReset}
                variant="outline"
                size="sm"
                className={`border-primary text-brand-primary hover:bg-brand-secondary hover:text-white ${isMobile ? 'px-2 text-xs' : ''}`}
              >
                <RotateCcw className="h-4 w-4" />
                {!isMobile && 'Reset'}
              </Button>
              <Button
                onClick={handleSave}
                size="sm"
                className={`bg-brand-success hover:bg-brand-success/90 text-white font-body ${isMobile ? 'px-2 text-xs' : ''}`}
              >
                <Save className="h-4 w-4" />
                {!isMobile && 'Save'}
              </Button>
            </div>
          </div>
          
          {/* Main Content - Total height: 600px on desktop (62px toolbar + 538px canvas/sidebar) */}
          <div 
            ref={(el) => {
              if (el && isTabletOrMobile) {
                // #region agent log
                fetch('http://127.0.0.1:7242/ingest/833eaf25-0547-420d-a570-1d7cab6b5873',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'RoomDesigner.tsx:mainContentRef',message:'Main content container dimensions',data:{offsetWidth:el.offsetWidth,offsetHeight:el.offsetHeight,clientWidth:el.clientWidth,clientHeight:el.clientHeight,scrollWidth:el.scrollWidth,scrollHeight:el.scrollHeight,computedHeight:getComputedStyle(el).height,computedMinHeight:getComputedStyle(el).minHeight,windowHeight:window.innerHeight},timestamp:Date.now(),sessionId:'debug-session',runId:'mobile-visibility',hypothesisId:'A'})}).catch(()=>{});
                // #endregion
              }
            }}
            className="flex flex-1 min-h-0 overflow-hidden flex-col lg:flex-row"
            style={isDesktop ? { height: '538px', maxHeight: '538px' } : undefined}
          >
            {/* Canvas Area - Scrollable on tablet and mobile only */}
            <div
              data-canvas
              ref={(el) => {
                if (el && isTabletOrMobile) {
                  const parent = el.parentElement;
                  // #region agent log
                  fetch('http://127.0.0.1:7242/ingest/833eaf25-0547-420d-a570-1d7cab6b5873',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'RoomDesigner.tsx:canvasAreaRef',message:'Canvas area container dimensions',data:{offsetWidth:el.offsetWidth,offsetHeight:el.offsetHeight,clientWidth:el.clientWidth,clientHeight:el.clientHeight,scrollWidth:el.scrollWidth,scrollHeight:el.scrollHeight,computedWidth:getComputedStyle(el).width,computedHeight:getComputedStyle(el).height,computedMinHeight:getComputedStyle(el).minHeight,parentHeight:parent?.clientHeight,parentComputedHeight:parent ? getComputedStyle(parent).height : null,windowHeight:window.innerHeight},timestamp:Date.now(),sessionId:'debug-session',runId:'mobile-visibility',hypothesisId:'B'})}).catch(()=>{});
                  // #endregion
                }
              }}
              className={`${
                isMobile
                  ? 'flex-1 min-h-0'
                  : isTablet
                    ? 'flex-1 min-h-0'
                    : 'w-3/4 lg:w-3/4 flex-1 min-h-0'
              } relative ${
                isDesktop
                  ? 'overflow-hidden'
                  : 'overflow-auto'
              } bg-brand-surface ${
                !isMobile ? 'border-r border-gray-200' : ''
              }`}
              style={{
                ...(isDesktop ? { height: '538px', maxHeight: '538px' } : {}),
                // CRITICAL: On mobile/tablet, constrain parent to viewport width to enable child overflow
                ...(isTabletOrMobile ? { 
                  width: `${window.innerWidth}px`, // CRITICAL: Use explicit viewport width, not 100%
                  maxWidth: `${window.innerWidth}px`,
                  minWidth: `${window.innerWidth}px`,
                  // Ensure parent doesn't expand beyond viewport
                  overflowX: 'auto',
                  overflowY: 'auto'
                  // Note: flex-1 min-h-0 from className handles height via flexbox
                } : {})
              }}
            >
              <ErrorBoundary>
                <RoomCanvas />
              </ErrorBoundary>
            </div>
            
            {/* Sidebar - PC only (>= 1024px) */}
            {isDesktop && (
              <div className="w-1/4 bg-brand-surface border-l border-gray-200 flex flex-col min-h-0" style={{ height: '538px', maxHeight: '538px' }}>
                <Card className="bg-white border-0 shadow-sm hover:shadow-md transition-shadow rounded-md md:rounded-lg h-full flex flex-col">
                  <CardContent className="p-0 flex flex-col h-full min-h-0">
                    <div className="flex-1 min-h-0 overflow-y-auto">
                      <FloorPlanTools />
                    </div>
                    <div className="border-t border-gray-200 flex-shrink-0">
                      <PalettePanel />
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Tablet: Fixed bottom toolbar with better spacing */}
            {isTablet && (
              <div
                data-tools
                className="pointer-events-none fixed bottom-0 left-0 right-0 z-40 flex justify-center"
                style={{
                  paddingBottom: 'env(safe-area-inset-bottom)',
                }}
              >
                <div className="pointer-events-auto w-full max-w-[100vw] bg-brand-surface/95 border-t border-gray-200 shadow-lg">
                  <div className="flex flex-col gap-3 p-3">
                    <div className="flex-1">
                      <FloorPlanTools isBottomBar={true} />
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      <Sheet open={isPaletteOpen} onOpenChange={setIsPaletteOpen}>
                        <SheetTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className="border-primary text-brand-primary hover:bg-brand-secondary hover:text-white flex-1 min-w-[120px]"
                            title="Target palette"
                          >
                            <Palette className="h-4 w-4 mr-1" />
                            Targets
                          </Button>
                        </SheetTrigger>
                        <SheetContent side="right" className="w-80 bg-brand-light">
                          <SheetHeader>
                            <SheetTitle>Available Targets</SheetTitle>
                            <SheetDescription>
                              Drag targets to place them on the canvas
                            </SheetDescription>
                          </SheetHeader>
                          <div className="mt-6">
                            <PalettePanel />
                          </div>
                        </SheetContent>
                      </Sheet>
                      <Sheet open={isInspectorOpen} onOpenChange={setIsInspectorOpen}>
                        <SheetTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className="border-primary text-brand-primary hover:bg-brand-secondary hover:text-white flex-1 min-w-[120px]"
                            title="Properties panel"
                          >
                            <Settings className="h-4 w-4 mr-1" />
                            Properties
                          </Button>
                        </SheetTrigger>
                        <SheetContent side="right" className="w-80 bg-brand-light">
                          <SheetHeader>
                            <SheetTitle>Properties & Groups</SheetTitle>
                            <SheetDescription>
                              Edit selected elements and manage groups
                            </SheetDescription>
                          </SheetHeader>
                          <div className="mt-6">
                            <InspectorPanel />
                          </div>
                        </SheetContent>
                      </Sheet>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Mobile: Fixed drawing tools at bottom */}
            {isMobile && (
              <div
                data-tools
                className="pointer-events-none fixed bottom-0 left-0 right-0 z-50 flex justify-center"
                style={{
                  paddingBottom: 'env(safe-area-inset-bottom)',
                }}
              >
                <div className="pointer-events-auto w-full max-w-[100vw] bg-brand-surface/95 border-t border-gray-200 shadow-lg">
                  <FloorPlanTools isBottomBar={true} />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default RoomDesigner;
