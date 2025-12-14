import React from 'react';
import { Button } from '@/components/ui/button';
import { RectangleHorizontal, DoorOpen, SquareStack, Trash2, Minus, Target, RotateCw } from 'lucide-react';
import { useRoomDesigner, type DrawingMode } from '@/store/useRoomDesigner';
import { useIsMobile } from '@/hooks/use-mobile';

/**
 * FloorPlanTools component provides a toolbar for selecting drawing tools
 * and managing floor plan elements
 */
interface FloorPlanToolsProps {
  isBottomBar?: boolean; // When true, shows compact button-only layout for mobile
  isTabletSidebar?: boolean; // When true, shows compact vertical layout for tablet sidebar
}

const FloorPlanTools: React.FC<FloorPlanToolsProps> = ({ isBottomBar = false, isTabletSidebar = false }) => {
  const isMobile = useIsMobile();
  const {
    drawingMode,
    setDrawingMode,
    selectedFloorPlanElement,
    deleteFloorPlanElement,
    rotateFloorPlanElement,
    floorPlan,
  } = useRoomDesigner();
  
  // TODO: Get proper token from auth context
  const token = '';

  const handleToolClick = (mode: DrawingMode) => {
    // Always activate the tool on click - it will automatically deactivate after placing an object
    setDrawingMode(mode);
  };

  const handleDelete = () => {
    if (!selectedFloorPlanElement) return;

    // Determine element type
    let elementType: 'wall' | 'room' | 'door' | 'window' | null = null;
    if (floorPlan?.walls?.some(w => w.id === selectedFloorPlanElement)) {
      elementType = 'wall';
    } else if (floorPlan?.rooms?.some(r => r.id === selectedFloorPlanElement)) {
      elementType = 'room';
    } else if (floorPlan?.doors?.some(d => d.id === selectedFloorPlanElement)) {
      elementType = 'door';
    } else if (floorPlan?.windows?.some(w => w.id === selectedFloorPlanElement)) {
      elementType = 'window';
    }

    if (elementType) {
      deleteFloorPlanElement(selectedFloorPlanElement, elementType);
    }
  };

  const getElementType = () => {
    if (!selectedFloorPlanElement || !floorPlan) return null;
    if (floorPlan.walls?.some(w => w.id === selectedFloorPlanElement)) return 'wall';
    if (floorPlan.rooms?.some(r => r.id === selectedFloorPlanElement)) return 'room';
    if (floorPlan.doors?.some(d => d.id === selectedFloorPlanElement)) return 'door';
    if (floorPlan.windows?.some(w => w.id === selectedFloorPlanElement)) return 'window';
    return null;
  };

  const elementType = getElementType();

  // Measure button layout on mobile/tablet bottom bar
  const containerRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (isBottomBar && containerRef.current) {
      const container = containerRef.current;
      const measureButtons = () => {
        if (!container) return;
        const buttons = container.querySelectorAll('button');
        const buttonWidths = Array.from(buttons).map(btn => btn.offsetWidth);
        const totalWidth = buttonWidths.reduce((sum, w) => sum + w, 0);
        const gaps = (buttons.length - 1) * 4; // gap-1 = 4px
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/833eaf25-0547-420d-a570-1d7cab6b5873',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'FloorPlanTools.tsx:measureButtons',message:'Button layout measurement',data:{containerWidth:container.offsetWidth,windowWidth:window.innerWidth,buttonCount:buttons.length,buttonWidths,totalWidth,gaps,requiredWidth:totalWidth+gaps},timestamp:Date.now(),sessionId:'debug-session',runId:'mobile-buttons',hypothesisId:'A'})}).catch(()=>{});
        // #endregion
      };
      measureButtons();
      const resizeObserver = new ResizeObserver(measureButtons);
      resizeObserver.observe(container);
      return () => resizeObserver.disconnect();
    }
  }, [isBottomBar]);

  // For bottom bar mode (tablet/mobile), show compact button-only layout
  if (isBottomBar) {
    return (
      <div className="w-full p-2">
        {/* Primary drawing tools - optimized for 430px mobile width */}
        <div ref={containerRef} className="grid grid-cols-5 gap-1.5 w-full">
          <Button
            variant={drawingMode === 'wall' ? 'default' : 'outline'}
            size="sm"
            onClick={() => handleToolClick('wall')}
            className="p-2 flex flex-col items-center justify-center gap-1 min-h-[44px] min-w-0"
            title="Draw walls"
          >
            <Minus className="h-5 w-5 flex-shrink-0" />
            <span className="text-xs leading-tight whitespace-nowrap">Wall</span>
          </Button>
          <Button
            variant={drawingMode === 'room' ? 'default' : 'outline'}
            size="sm"
            onClick={() => handleToolClick('room')}
            className="p-2 flex flex-col items-center justify-center gap-1 min-h-[44px] min-w-0"
            title="Draw rooms"
          >
            <RectangleHorizontal className="h-5 w-5 flex-shrink-0" />
            <span className="text-xs leading-tight whitespace-nowrap">Room</span>
          </Button>
          <Button
            variant={drawingMode === 'door' ? 'default' : 'outline'}
            size="sm"
            onClick={() => handleToolClick('door')}
            className="p-2 flex flex-col items-center justify-center gap-1 min-h-[44px] min-w-0"
            title="Place doors"
          >
            <DoorOpen className="h-5 w-5 flex-shrink-0" />
            <span className="text-xs leading-tight whitespace-nowrap">Door</span>
          </Button>
          <Button
            variant={drawingMode === 'window' ? 'default' : 'outline'}
            size="sm"
            onClick={() => handleToolClick('window')}
            className="p-2 flex flex-col items-center justify-center gap-1 min-h-[44px] min-w-0"
            title="Place windows"
          >
            <SquareStack className="h-5 w-5 flex-shrink-0" />
            <span className="text-xs leading-tight whitespace-nowrap">Window</span>
          </Button>
          <Button
            variant={drawingMode === 'target' ? 'default' : 'outline'}
            size="sm"
            onClick={() => handleToolClick('target')}
            className="p-2 flex flex-col items-center justify-center gap-1 min-h-[44px] min-w-0"
            title="Place targets"
          >
            <Target className="h-5 w-5 flex-shrink-0" />
            <span className="text-xs leading-tight whitespace-nowrap">Target</span>
          </Button>
        </div>
        
        {/* Secondary actions row - only shows when element is selected */}
        {selectedFloorPlanElement && (
          <div className="border-t border-gray-200 pt-2 mt-2">
            <div className="grid grid-cols-2 gap-2 w-full">
              {(elementType === 'door' || elementType === 'window' || elementType === 'room') && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => rotateFloorPlanElement(selectedFloorPlanElement, elementType as 'door' | 'window' | 'room', token)}
                  className="flex items-center justify-center gap-2 min-h-[44px] px-3"
                  title="Rotate 90 degrees"
                >
                  <RotateCw className="h-4 w-4" />
                  <span className="text-sm whitespace-nowrap">Rotate</span>
                </Button>
              )}
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDelete}
                className={`flex items-center justify-center gap-2 min-h-[44px] px-3 ${
                  !(elementType === 'door' || elementType === 'window' || elementType === 'room') 
                    ? 'col-span-2' 
                    : ''
                }`}
                title="Delete selected element"
              >
                <Trash2 className="h-4 w-4" />
                <span className="text-sm whitespace-nowrap">Delete</span>
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Tablet sidebar mode - compact vertical layout
  if (isTabletSidebar) {
    return (
      <div className="w-full space-y-2">
        <h4 className="text-xs font-heading font-medium text-brand-purple text-center mb-2">Tools</h4>
        <div className="grid grid-cols-1 gap-2">
          <Button
            variant={drawingMode === 'wall' ? 'default' : 'outline'}
            size="sm"
            onClick={() => handleToolClick('wall')}
            className="w-full aspect-square p-2"
            title="Draw walls"
          >
            <Minus className="h-4 w-4" />
          </Button>
          <Button
            variant={drawingMode === 'room' ? 'default' : 'outline'}
            size="sm"
            onClick={() => handleToolClick('room')}
            className="w-full aspect-square p-2"
            title="Draw rooms"
          >
            <RectangleHorizontal className="h-4 w-4" />
          </Button>
          <Button
            variant={drawingMode === 'door' ? 'default' : 'outline'}
            size="sm"
            onClick={() => handleToolClick('door')}
            className="w-full aspect-square p-2"
            title="Place doors"
          >
            <DoorOpen className="h-4 w-4" />
          </Button>
          <Button
            variant={drawingMode === 'window' ? 'default' : 'outline'}
            size="sm"
            onClick={() => handleToolClick('window')}
            className="w-full aspect-square p-2"
            title="Place windows"
          >
            <SquareStack className="h-4 w-4" />
          </Button>
          <Button
            variant={drawingMode === 'target' ? 'default' : 'outline'}
            size="sm"
            onClick={() => handleToolClick('target')}
            className="w-full aspect-square p-2"
            title="Place targets"
          >
            <Target className="h-4 w-4" />
          </Button>
        </div>

        {/* Selected Element Actions - Compact */}
        {selectedFloorPlanElement && (
          <div className="border-t border-gray-200 pt-2 mt-3">
            <div className="grid grid-cols-1 gap-2">
              {(elementType === 'door' || elementType === 'window' || elementType === 'room') && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => rotateFloorPlanElement(selectedFloorPlanElement, elementType as 'door' | 'window' | 'room', token)}
                  className="w-full aspect-square p-2"
                  title="Rotate 90 degrees"
                >
                  <RotateCw className="h-4 w-4" />
                </Button>
              )}
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDelete}
                className="w-full aspect-square p-2"
                title="Delete selected element"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Full layout for PC sidebar - compact buttons but spread sections to fill available height
  return (
    <div className="p-6">
      <h3 className="text-base font-heading font-medium text-brand-purple mb-4">Drawing Tools</h3>
      <div className="space-y-4">
        {/* Drawing Tools Section */}
        <div className="flex-shrink-0">
          <div ref={containerRef} className="grid grid-cols-2 gap-2">
            <Button
              variant={drawingMode === 'wall' ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleToolClick('wall')}
              className="w-full"
              title="Draw walls"
            >
              <Minus className="h-4 w-4 mr-1" />
              Wall
            </Button>
            <Button
              variant={drawingMode === 'room' ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleToolClick('room')}
              className="w-full"
              title="Draw rooms"
            >
              <RectangleHorizontal className="h-4 w-4 mr-1" />
              Room
            </Button>
            <Button
              variant={drawingMode === 'door' ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleToolClick('door')}
              className="w-full"
              title="Place doors"
            >
              <DoorOpen className="h-4 w-4 mr-1" />
              Door
            </Button>
            <Button
              variant={drawingMode === 'window' ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleToolClick('window')}
              className="w-full"
              title="Place windows"
            >
              <SquareStack className="h-4 w-4 mr-1" />
              Window
            </Button>
            <Button
              variant={drawingMode === 'target' ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleToolClick('target')}
              className="w-full col-span-2"
              title="Place targets"
            >
              <Target className="h-4 w-4 mr-1" />
              Target
            </Button>
          </div>
        </div>

        {/* Selected Element Section */}
        {selectedFloorPlanElement && (
          <div className="border-t border-gray-200 pt-4 flex-shrink-0">
            <h3 className="text-sm font-heading font-medium text-brand-purple mb-2">Selected Element</h3>
            <div className="text-xs font-body text-brand-fg-secondary mb-2">
              {elementType ? elementType.charAt(0).toUpperCase() + elementType.slice(1) : 'Unknown'}
            </div>
            <div className="space-y-2">
              {(elementType === 'door' || elementType === 'window' || elementType === 'room') && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => rotateFloorPlanElement(selectedFloorPlanElement, elementType as 'door' | 'window' | 'room', token)}
                  className="w-full"
                  title="Rotate 90 degrees"
                >
                  <RotateCw className="h-4 w-4 mr-1" />
                  Rotate
                </Button>
              )}
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDelete}
                className="w-full"
                title="Delete selected element"
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Delete
              </Button>
            </div>
          </div>
        )}

        {/* Help text - Bottom section */}
        <div className="border-t border-gray-200 pt-4 flex-shrink-0">
          <div className="text-xs font-body text-brand-fg-secondary space-y-1">
            <p className="font-body"><strong className="font-heading">Wall:</strong> Click and drag</p>
            <p className="font-body"><strong className="font-heading">Room:</strong> Click to place rectangular room</p>
            <p className="font-body"><strong className="font-heading">Door/Window/Target:</strong> Click to place</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FloorPlanTools;

