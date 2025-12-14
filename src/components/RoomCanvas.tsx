import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { Stage, Layer, Group, Rect, Line, Shape, Circle, Text, Image } from 'react-konva';
import { useParams } from 'react-router-dom';
import { useRoomDesigner, gridSnap } from '@/store/useRoomDesigner';
import { useTargets } from '@/store/useTargets';
import type { Wall, RoomShape, Door, Window } from '@/lib/types';
import API from '@/lib/api';
import type { Target } from '@/store/useTargets';
import { useIsMobile } from '@/hooks/use-mobile';
import { useResponsive } from '@/hooks/use-responsive';

// Wrapper component to ensure Group position syncs with props
const PositionedGroup: React.FC<{
  x: number;
  y: number;
  rotation?: number;
  children: React.ReactNode;
  [key: string]: any;
}> = ({ x, y, rotation = 0, children, ...groupProps }) => {
  const groupRef = useRef<any>(null);
  const isDraggingRef = useRef(false);

  // Track dragging state
  const originalOnDragStart = groupProps.onDragStart;
  const originalOnDragEnd = groupProps.onDragEnd;

  const handleDragStart = useCallback((e: any) => {
    isDraggingRef.current = true;
    if (originalOnDragStart) {
      originalOnDragStart(e);
    }
  }, [originalOnDragStart]);

  const handleDragEnd = useCallback((e: any) => {
    isDraggingRef.current = false;
    if (originalOnDragEnd) {
      originalOnDragEnd(e);
    }
  }, [originalOnDragEnd]);

  useEffect(() => {
    if (groupRef.current && !isDraggingRef.current) {
      // Sync position and rotation when props change (but not during drag)
      const node = groupRef.current;
      const currentX = node.x();
      const currentY = node.y();
      const currentRotation = node.rotation();
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/833eaf25-0547-420d-a570-1d7cab6b5873',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'RoomCanvas.tsx:PositionedGroup:useEffect',message:'Position sync check',data:{propX:x,propY:y,currentX,currentY,isDragging:isDraggingRef.current,willUpdate:Math.abs(currentX-x)>0.5||Math.abs(currentY-y)>0.5},timestamp:Date.now(),sessionId:'debug-session',runId:'placement-debug',hypothesisId:'D'})}).catch(()=>{});
      // #endregion
      // Only update if position differs significantly
      if (Math.abs(currentX - x) > 0.5 || Math.abs(currentY - y) > 0.5) {
        node.x(x);
        node.y(y);
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/833eaf25-0547-420d-a570-1d7cab6b5873',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'RoomCanvas.tsx:PositionedGroup:useEffect',message:'Position updated',data:{setX:x,setY:y,afterX:node.x(),afterY:node.y()},timestamp:Date.now(),sessionId:'debug-session',runId:'placement-debug',hypothesisId:'D'})}).catch(()=>{});
        // #endregion
      }
      // Sync rotation if it differs
      if (Math.abs(currentRotation - rotation) > 0.5) {
        node.rotation(rotation);
      }
    }
  }, [x, y, rotation]);

  return (
    <Group 
      ref={groupRef} 
      x={x} 
      y={y}
      rotation={rotation}
      {...groupProps}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      {children}
    </Group>
  );
};

// Room dimensions (must match FloorPlanCanvas.tsx)
const ROOM_WIDTH = 300;
const ROOM_HEIGHT = 250;
const MAX_CANVAS_WIDTH = ROOM_WIDTH * 2; // 2x room width
const MAX_CANVAS_HEIGHT = ROOM_HEIGHT * 3; // 3x room height

const MAX_CANVAS_HEIGHT_FIXED = 562; // Fixed max height in pixels

const RoomCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [canvasSize, setCanvasSize] = useState({ width: MAX_CANVAS_WIDTH, height: MAX_CANVAS_HEIGHT_FIXED });
  const stageRef = useRef<any>(null);
  const [wallStartPos, setWallStartPos] = useState<{ x: number; y: number } | null>(null);
  const [isResizing, setIsResizing] = useState(false);
  const [resizeStartPos, setResizeStartPos] = useState<{ x: number; y: number } | null>(null);
  const [resizeRoomId, setResizeRoomId] = useState<string | null>(null);
  const [resizeInitialBounds, setResizeInitialBounds] = useState<{
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [stagePosition, setStagePosition] = useState({ x: 0, y: 0 });
  const [stageScale, setStageScale] = useState(1);
  const [stageSize, setStageSize] = useState({ width: MAX_CANVAS_WIDTH, height: MAX_CANVAS_HEIGHT_FIXED });
  const isMobile = useIsMobile();
  const { isTablet, isDesktop } = useResponsive();
  const isTabletOrMobile = !isDesktop; // Tablet or mobile (< 1024px)

  const {
    layout,
    groups,
    selectedIds,
    selectedGroupId,
    drawingMode,
    floorPlan,
    selectedFloorPlanElement,
    snapToGrid,
    gridSize,
    moveTarget,
    placeTarget,
    selectTargets,
    selectGroup,
    setDrawingMode,
    addWall,
    addRoom,
    addDoor,
    addWindow,
    updateFloorPlanElement,
    selectFloorPlanElement,
    saveLayout,
  } = useRoomDesigner();

  const { id: roomId } = useParams<{ id: string }>();
  const { targets: allTargets } = useTargets();
  const [roomTargets, setRoomTargets] = useState<Target[]>([]);
  const token = ''; // TODO: Get proper token from auth context

  // Fetch targets assigned to this room
  useEffect(() => {
    const fetchRoomTargets = async () => {
      if (!roomId) return;
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/833eaf25-0547-420d-a570-1d7cab6b5873',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'RoomCanvas.tsx:fetchRoomTargets',message:'Starting to fetch room targets',data:{roomId},timestamp:Date.now(),sessionId:'debug-session',runId:'promise-debug',hypothesisId:'L'})}).catch(()=>{});
      // #endregion
      try {
        const targets = await API.getRoomTargets(roomId);
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/833eaf25-0547-420d-a570-1d7cab6b5873',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'RoomCanvas.tsx:fetchRoomTargets',message:'Room targets fetched successfully',data:{roomId,targetCount:targets.length,targetIds:targets.map(t=>t.id)},timestamp:Date.now(),sessionId:'debug-session',runId:'promise-debug',hypothesisId:'L'})}).catch(()=>{});
        // #endregion
        setRoomTargets(targets);
      } catch (err) {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/833eaf25-0547-420d-a570-1d7cab6b5873',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'RoomCanvas.tsx:fetchRoomTargets',message:'Error fetching room targets',data:{roomId,error:err instanceof Error?err.message:String(err),errorStack:err instanceof Error?err.stack:undefined},timestamp:Date.now(),sessionId:'debug-session',runId:'promise-debug',hypothesisId:'L'})}).catch(()=>{});
        // #endregion
        console.error('Error fetching room targets:', err);
      }
    };
    fetchRoomTargets();
  }, [roomId]);

  // Enhanced viewport height calculation for mobile devices
  const useViewportHeight = useCallback(() => {
    // Handle iOS Safari dynamic viewport and other mobile browsers
    if (typeof window !== 'undefined') {
      // Use visualViewport API if available (better for mobile)
      if (window.visualViewport) {
        return window.visualViewport.height;
      }
      // Fallback to window.innerHeight
      return window.innerHeight;
    }
    return 600; // Fallback for SSR
  }, []);

  // Update canvas size to fill parent container (viewport)
  useEffect(() => {
    const updateCanvasSize = () => {
      if (canvasRef.current) {
        // CRITICAL FIX: Use parent container's clientWidth, not offsetWidth
        // offsetWidth includes scrollbar and can be affected by child Stage size
        // clientWidth gives us the actual viewport size
        // On mobile/tablet, use window.innerWidth directly to get true viewport width
        const parent = canvasRef.current.parentElement;
        const containerWidth = isTabletOrMobile 
          ? window.innerWidth  // Use actual viewport width for mobile/tablet
          : (parent ? parent.clientWidth : (canvasRef.current.clientWidth || window.innerWidth));
        let containerHeight = parent ? parent.clientHeight : (canvasRef.current.clientHeight || window.innerHeight);
        
        // On mobile/tablet, calculate available height accounting for fixed elements
        if (isTabletOrMobile && containerHeight > 0) {
          const viewportHeight = useViewportHeight();
          
          // More accurate height calculations for different screen sizes
          let fixedElementsHeight = 0;
          if (isMobile) {
            // Header (64px) + Fixed bottom toolbar (72px for mobile) + safe areas
            fixedElementsHeight = 64 + 72 + 20; // 20px for safe areas and margins
          } else {
            // Tablet: Header + bottom toolbar space
            fixedElementsHeight = 64 + 80 + 16; // 16px for margins
          }
          
          const maxAvailableHeight = viewportHeight - fixedElementsHeight;
          
          // Use the smaller of actual container height or calculated max
          // Ensure minimum canvas height for usability
          const minCanvasHeight = Math.min(400, viewportHeight * 0.5);
          containerHeight = Math.max(
            Math.min(containerHeight, maxAvailableHeight), 
            minCanvasHeight
          );
        }
        
        // Validate and clamp container dimensions to prevent feedback loops
        const maxWidth = window.innerWidth * 2; // Never exceed 2x viewport width
        const safeWidth = Math.min(Math.max(containerWidth || MAX_CANVAS_WIDTH, 100), maxWidth);
        // Desktop: use container height (868px), Mobile/Tablet: clamp to MAX_CANVAS_HEIGHT_FIXED (562px)
        const maxHeight = isTabletOrMobile ? MAX_CANVAS_HEIGHT_FIXED : (containerHeight || MAX_CANVAS_HEIGHT_FIXED);
        const safeHeight = containerHeight ? Math.min(Math.max(containerHeight, 100), maxHeight) : maxHeight;
        
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/833eaf25-0547-420d-a570-1d7cab6b5873',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'RoomCanvas.tsx:updateCanvasSize',message:'Canvas size calculation',data:{containerWidth,containerHeight,isMobile,windowWidth:window.innerWidth,windowHeight:window.innerHeight,parentWidth:parent?.clientWidth,parentHeight:parent?.clientHeight,safeWidth,safeHeight,currentCanvasWidth:canvasSize.width,currentCanvasHeight:canvasSize.height},timestamp:Date.now(),sessionId:'debug-session',runId:'mobile-debug',hypothesisId:'A'})}).catch(()=>{});
        // #endregion

        // Only update if size changed significantly to prevent feedback loops
        const widthChanged = Math.abs(canvasSize.width - safeWidth) > 10;
        const heightChanged = Math.abs(canvasSize.height - safeHeight) > 10;
        
        if (widthChanged || heightChanged) {
          setCanvasSize({
            width: safeWidth,
            height: safeHeight,
          });
        }
      }
    };

    // Initial size calculation
    updateCanvasSize();

    // Use ResizeObserver to track container size changes
    const resizeObserver = new ResizeObserver(() => {
      updateCanvasSize();
    });

    if (canvasRef.current) {
      resizeObserver.observe(canvasRef.current);
    }

    // Also listen to window resize as fallback
    window.addEventListener('resize', updateCanvasSize);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', updateCanvasSize);
    };
  }, [isMobile, isTabletOrMobile]);


  const snap = useCallback((value: number) => {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/833eaf25-0547-420d-a570-1d7cab6b5873',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'RoomCanvas.tsx:snap',message:'snap function called',data:{value,snapToGrid,gridSize,valueType:typeof value,isNaNValue:isNaN(value),isFiniteValue:isFinite(value)},timestamp:Date.now(),sessionId:'debug-session',runId:'snap-debug',hypothesisId:'E'})}).catch(()=>{});
    // #endregion
    
    // Validate input
    if (typeof value !== 'number' || isNaN(value) || !isFinite(value)) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/833eaf25-0547-420d-a570-1d7cab6b5873',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'RoomCanvas.tsx:snap',message:'Invalid value in snap function',data:{value,snapToGrid,gridSize},timestamp:Date.now(),sessionId:'debug-session',runId:'snap-debug',hypothesisId:'F'})}).catch(()=>{});
      // #endregion
      console.warn('snap: Invalid value', value);
      return 0; // Return safe default
    }
    
    if (!snapToGrid) {
      return value;
    }
    
    const result = gridSnap(value, gridSize);
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/833eaf25-0547-420d-a570-1d7cab6b5873',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'RoomCanvas.tsx:snap',message:'snap function result',data:{value,gridSize,result,snapToGrid},timestamp:Date.now(),sessionId:'debug-session',runId:'snap-debug',hypothesisId:'E'})}).catch(()=>{});
    // #endregion
    return result;
  }, [snapToGrid, gridSize]);

  // Enhanced touch/pointer tracking for mobile gestures
  const [lastPointerDistance, setLastPointerDistance] = useState<number | null>(null);
  const [isGesturing, setIsGesturing] = useState(false);

  // Handle stage click for drawing with enhanced mobile gesture support
  const handleStageClick = useCallback(async (e: any) => {
    try {
      // Don't handle clicks if we just finished dragging or gesturing
      if (isDragging || isGesturing) {
        setIsDragging(false);
        setIsGesturing(false);
        return;
      }

      const stage = e.target.getStage();
      if (!stage) return;

      const pointerPos = stage.getPointerPosition();
      if (!pointerPos) return;
      
      // Validate pointer position
      if (typeof pointerPos.x !== 'number' || typeof pointerPos.y !== 'number' || 
          isNaN(pointerPos.x) || isNaN(pointerPos.y) || 
          !isFinite(pointerPos.x) || !isFinite(pointerPos.y)) {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/833eaf25-0547-420d-a570-1d7cab6b5873',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'RoomCanvas.tsx:handleStageClick',message:'Invalid pointer position',data:{pointerPos,pointerX:pointerPos?.x,pointerY:pointerPos?.y},timestamp:Date.now(),sessionId:'debug-session',runId:'snap-debug',hypothesisId:'G'})}).catch(()=>{});
        // #endregion
        console.warn('Invalid pointer position:', pointerPos);
        return;
      }

      // Additional check for mobile: prevent accidental tool activation during scrolling
      if (isTabletOrMobile && e.evt) {
        const eventTarget = e.evt.target;
        // If the event was on a scrollable container that's currently scrolling, ignore
        if (eventTarget && eventTarget.closest && eventTarget.closest('[data-scrolling="true"]')) {
          return;
        }
      }

      const snappedX = snap(pointerPos.x);
      const snappedY = snap(pointerPos.y);
      
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/833eaf25-0547-420d-a570-1d7cab6b5873',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'RoomCanvas.tsx:handleStageClick',message:'Stage click - placement coordinates',data:{drawingMode,pointerX:pointerPos.x,pointerY:pointerPos.y,snappedX,snappedY},timestamp:Date.now(),sessionId:'debug-session',runId:'promise-debug',hypothesisId:'A'})}).catch(()=>{});
      // #endregion

      // Don't handle clicks on existing elements (Groups, Shapes, etc.)
      // Only handle clicks directly on the Stage
      const target = e.target;
      if (target !== stage) {
        // Check if click is on a draggable Group - let it handle drag
        const parent = target.getParent();
        if (parent && parent.draggable && parent.draggable()) {
          return; // Let the Group handle drag
        }
        return; // Don't handle clicks on other elements
      }

      if (drawingMode === 'wall') {
        if (!wallStartPos) {
          setWallStartPos({ x: snappedX, y: snappedY });
        } else {
          // Finish wall
          const id = `wall-${Date.now()}`;
          addWall({
            id,
            x1: wallStartPos.x,
            y1: wallStartPos.y,
            x2: snappedX,
            y2: snappedY,
            thickness: 5,
            color: '#666666',
          });
          // Save wall immediately
          if (token) {
            await saveLayout(token);
          }
          setWallStartPos(null);
          setDrawingMode(null);
        }
      } else if (drawingMode === 'room') {
        // Place a pre-made rectangular room
        const id = `room-${Date.now()}`;
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/833eaf25-0547-420d-a570-1d7cab6b5873',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'RoomCanvas.tsx:handleStageClick:room',message:'Before addRoom call',data:{id,minX:snappedX,minY:snappedY},timestamp:Date.now(),sessionId:'debug-session',runId:'promise-debug',hypothesisId:'B'})}).catch(()=>{});
        // #endregion
        try {
          await addRoom({
            id,
            name: 'Room',
            points: [
              { x: snappedX, y: snappedY },
              { x: snappedX + ROOM_WIDTH, y: snappedY },
              { x: snappedX + ROOM_WIDTH, y: snappedY + ROOM_HEIGHT },
              { x: snappedX, y: snappedY + ROOM_HEIGHT },
            ],
            fillColor: '#e0e0e0',
            strokeColor: '#666666',
          }, token);
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/833eaf25-0547-420d-a570-1d7cab6b5873',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'RoomCanvas.tsx:handleStageClick:room',message:'After addRoom call',data:{id,success:true},timestamp:Date.now(),sessionId:'debug-session',runId:'promise-debug',hypothesisId:'B'})}).catch(()=>{});
          // #endregion
        } catch (error) {
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/833eaf25-0547-420d-a570-1d7cab6b5873',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'RoomCanvas.tsx:handleStageClick:room',message:'addRoom error',data:{id,error:error instanceof Error?error.message:String(error),errorStack:error instanceof Error?error.stack:undefined},timestamp:Date.now(),sessionId:'debug-session',runId:'promise-debug',hypothesisId:'B'})}).catch(()=>{});
          // #endregion
          console.error('Error adding room:', error);
          throw error;
        }
        setDrawingMode(null);
      } else if (drawingMode === 'door') {
        const id = `door-${Date.now()}`;
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/833eaf25-0547-420d-a570-1d7cab6b5873',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'RoomCanvas.tsx:handleStageClick:door',message:'Before addDoor call',data:{id,x:snappedX,y:snappedY},timestamp:Date.now(),sessionId:'debug-session',runId:'promise-debug',hypothesisId:'C'})}).catch(()=>{});
        // #endregion
        try {
          await addDoor({
            id,
            x: snappedX,
            y: snappedY,
            width: 80,
            rotation: 0,
            type: 'single',
          }, token);
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/833eaf25-0547-420d-a570-1d7cab6b5873',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'RoomCanvas.tsx:handleStageClick:door',message:'After addDoor call',data:{id,success:true},timestamp:Date.now(),sessionId:'debug-session',runId:'promise-debug',hypothesisId:'C'})}).catch(()=>{});
          // #endregion
        } catch (error) {
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/833eaf25-0547-420d-a570-1d7cab6b5873',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'RoomCanvas.tsx:handleStageClick:door',message:'addDoor error',data:{id,error:error instanceof Error?error.message:String(error)},timestamp:Date.now(),sessionId:'debug-session',runId:'promise-debug',hypothesisId:'C'})}).catch(()=>{});
          // #endregion
          console.error('Error adding door:', error);
          throw error;
        }
        setDrawingMode(null);
      } else if (drawingMode === 'window') {
        const id = `window-${Date.now()}`;
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/833eaf25-0547-420d-a570-1d7cab6b5873',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'RoomCanvas.tsx:handleStageClick:window',message:'Before addWindow call',data:{id,x:snappedX,y:snappedY},timestamp:Date.now(),sessionId:'debug-session',runId:'promise-debug',hypothesisId:'D'})}).catch(()=>{});
        // #endregion
        try {
          await addWindow({
            id,
            x: snappedX,
            y: snappedY,
            width: 100,
            rotation: 0,
          }, token);
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/833eaf25-0547-420d-a570-1d7cab6b5873',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'RoomCanvas.tsx:handleStageClick:window',message:'After addWindow call',data:{id,success:true},timestamp:Date.now(),sessionId:'debug-session',runId:'promise-debug',hypothesisId:'D'})}).catch(()=>{});
          // #endregion
        } catch (error) {
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/833eaf25-0547-420d-a570-1d7cab6b5873',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'RoomCanvas.tsx:handleStageClick:window',message:'addWindow error',data:{id,error:error instanceof Error?error.message:String(error)},timestamp:Date.now(),sessionId:'debug-session',runId:'promise-debug',hypothesisId:'D'})}).catch(()=>{});
          // #endregion
          console.error('Error adding window:', error);
          throw error;
        }
        setDrawingMode(null);
      } else if (drawingMode === 'target') {
        // Find first unplaced target
        const unplacedTarget = roomTargets.find(
          target => !layout.some(t => String(t.id) === String(target.id))
        );
        
        if (unplacedTarget) {
          try {
            await placeTarget(unplacedTarget.id, { x: snappedX, y: snappedY }, token);
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/833eaf25-0547-420d-a570-1d7cab6b5873',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'RoomCanvas.tsx:handleStageClick:target',message:'After placeTarget call',data:{targetId:unplacedTarget.id,success:true},timestamp:Date.now(),sessionId:'debug-session',runId:'promise-debug',hypothesisId:'E'})}).catch(()=>{});
            // #endregion
          } catch (error) {
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/833eaf25-0547-420d-a570-1d7cab6b5873',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'RoomCanvas.tsx:handleStageClick:target',message:'placeTarget error',data:{targetId:unplacedTarget.id,error:error instanceof Error?error.message:String(error)},timestamp:Date.now(),sessionId:'debug-session',runId:'promise-debug',hypothesisId:'E'})}).catch(()=>{});
            // #endregion
            console.error('Error placing target:', error);
            throw error;
          }
          setDrawingMode(null);
        } else {
          // No unplaced targets available - could show a toast message
          console.warn('No unplaced targets available');
          setDrawingMode(null);
        }
      } else {
        // Deselect when clicking empty space
        selectTargets([]);
        selectGroup(null);
        selectFloorPlanElement(null);
      }
    } catch (error) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/833eaf25-0547-420d-a570-1d7cab6b5873',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'RoomCanvas.tsx:handleStageClick',message:'Unhandled error in handleStageClick',data:{drawingMode,error:error instanceof Error?error.message:String(error),errorStack:error instanceof Error?error.stack:undefined},timestamp:Date.now(),sessionId:'debug-session',runId:'promise-debug',hypothesisId:'F'})}).catch(()=>{});
      // #endregion
      console.error('Error in handleStageClick:', error);
    }
  }, [drawingMode, wallStartPos, snap, addWall, addRoom, addDoor, addWindow, placeTarget, roomTargets, layout, setDrawingMode, selectTargets, selectGroup, selectFloorPlanElement, isDragging, token, saveLayout, isTabletOrMobile, isGesturing]);

  // Handle target drag - using Konva native pattern
  const handleTargetDragStart = useCallback(() => {
    setIsDragging(true);
  }, []);

  const handleTargetDragEnd = useCallback(async (e: any, targetId: string) => {
    setIsDragging(false);
    try {
      // Get position directly from the Konva Group node (e.target is the Group)
      const node = e.target.getType() === 'Group' ? e.target : (e.target.getParent() || e.target);
      const nodeX = node.x();
      const nodeY = node.y();
      
      // Validate node positions
      if (typeof nodeX !== 'number' || typeof nodeY !== 'number' || 
          isNaN(nodeX) || isNaN(nodeY) || !isFinite(nodeX) || !isFinite(nodeY)) {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/833eaf25-0547-420d-a570-1d7cab6b5873',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'RoomCanvas.tsx:handleTargetDragEnd',message:'Invalid node position',data:{targetId,nodeX,nodeY},timestamp:Date.now(),sessionId:'debug-session',runId:'snap-debug',hypothesisId:'H'})}).catch(()=>{});
        // #endregion
        console.warn('Invalid node position in handleTargetDragEnd:', { nodeX, nodeY });
        return;
      }
      
      const newX = snap(nodeX);
      const newY = snap(nodeY);
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/833eaf25-0547-420d-a570-1d7cab6b5873',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'RoomCanvas.tsx:handleTargetDragEnd',message:'Target drag end',data:{targetId,targetType:e.target.getType(),parentType:e.target.getParent()?.getType(),nodeType:node.getType(),nodeX,nodeY,newX,newY},timestamp:Date.now(),sessionId:'debug-session',runId:'promise-debug',hypothesisId:'K'})}).catch(()=>{});
      // #endregion
      await moveTarget(targetId, { x: newX, y: newY }, token);
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/833eaf25-0547-420d-a570-1d7cab6b5873',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'RoomCanvas.tsx:handleTargetDragEnd',message:'Target drag end success',data:{targetId},timestamp:Date.now(),sessionId:'debug-session',runId:'promise-debug',hypothesisId:'K'})}).catch(()=>{});
      // #endregion
    } catch (error) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/833eaf25-0547-420d-a570-1d7cab6b5873',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'RoomCanvas.tsx:handleTargetDragEnd',message:'Target drag end error',data:{targetId,error:error instanceof Error?error.message:String(error)},timestamp:Date.now(),sessionId:'debug-session',runId:'promise-debug',hypothesisId:'K'})}).catch(()=>{});
      // #endregion
      console.error('Error moving target:', error);
    }
  }, [snap, moveTarget, token]);

  // Get room bounds for resize handle and drag calculations
  const getRoomBounds = useCallback((room: RoomShape) => {
    const xs = room.points.map(p => p.x);
    const ys = room.points.map(p => p.y);
    return {
      minX: Math.min(...xs),
      minY: Math.min(...ys),
      maxX: Math.max(...xs),
      maxY: Math.max(...ys),
    };
  }, []);

  // Calculate bounding box of all objects on the canvas
  const getAllObjectsBounds = useCallback(() => {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    let hasObjects = false;

    // Check rooms
    if (floorPlan?.rooms && floorPlan.rooms.length > 0) {
      floorPlan.rooms.forEach(room => {
        const bounds = getRoomBounds(room);
        minX = Math.min(minX, bounds.minX);
        minY = Math.min(minY, bounds.minY);
        maxX = Math.max(maxX, bounds.maxX);
        maxY = Math.max(maxY, bounds.maxY);
        hasObjects = true;
      });
    }

    // Check walls
    if (floorPlan?.walls && floorPlan.walls.length > 0) {
      floorPlan.walls.forEach(wall => {
        minX = Math.min(minX, wall.x1, wall.x2);
        minY = Math.min(minY, wall.y1, wall.y2);
        maxX = Math.max(maxX, wall.x1, wall.x2);
        maxY = Math.max(maxY, wall.y1, wall.y2);
        hasObjects = true;
      });
    }

    // Check doors (default height is 20)
    if (floorPlan?.doors && floorPlan.doors.length > 0) {
      floorPlan.doors.forEach(door => {
        minX = Math.min(minX, door.x);
        minY = Math.min(minY, door.y);
        maxX = Math.max(maxX, door.x + (door.width || 50));
        maxY = Math.max(maxY, door.y + 20); // Default door height
        hasObjects = true;
      });
    }

    // Check windows (default height is 20)
    if (floorPlan?.windows && floorPlan.windows.length > 0) {
      floorPlan.windows.forEach(window => {
        minX = Math.min(minX, window.x);
        minY = Math.min(minY, window.y);
        maxX = Math.max(maxX, window.x + (window.width || 50));
        maxY = Math.max(maxY, window.y + 20); // Default window height
        hasObjects = true;
      });
    }

    // Check targets
    if (layout && layout.length > 0) {
      layout.forEach(targetLayout => {
        const radius = 24; // Target radius
        minX = Math.min(minX, targetLayout.x - radius);
        minY = Math.min(minY, targetLayout.y - radius);
        maxX = Math.max(maxX, targetLayout.x + radius);
        maxY = Math.max(maxY, targetLayout.y + radius);
        hasObjects = true;
      });
    }

    if (!hasObjects) {
      return null;
    }

    // Add padding
    const padding = 50;
    return {
      minX: minX - padding,
      minY: minY - padding,
      maxX: maxX + padding,
      maxY: maxY + padding,
      width: maxX - minX + padding * 2,
      height: maxY - minY + padding * 2,
    };
  }, [floorPlan, layout, getRoomBounds]);

  // Update Stage size based on content bounds for scrolling (tablet and mobile)
  useEffect(() => {
    const bounds = getAllObjectsBounds();
    if (bounds && isTabletOrMobile) {
      // Enhanced padding for mobile gesture areas and better scrolling UX
      let padding = 100;
      if (isMobile) {
        // Extra padding for mobile to ensure comfortable gesture areas
        // and prevent content from being hidden behind fixed toolbars
        padding = 150; // Increased from 100 for better mobile UX
      } else if (isTablet) {
        // Generous padding for tablet landscape usage
        padding = 200; // Increased from 150 for better tablet UX
      }
      
      // CRITICAL FIX: Use viewport width, not canvasSize.width to prevent feedback loop
      // Calculate minimum scrollable area based on actual viewport, not canvas size
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      
      // Ensure stage is wider than viewport to enable horizontal scrolling
      // Content bounds + padding, but at least 1.5x viewport width for comfortable scrolling
      const contentBasedWidth = bounds.maxX + padding;
      // CRITICAL: Always make stage wider than viewport to enable horizontal scrolling
      // Use max of: content width, 1.5x viewport, or viewport + 300px (increased for better scrolling)
      const minScrollableWidth = Math.max(
        viewportWidth * 1.5, 
        contentBasedWidth,
        viewportWidth + 300 // Always at least 300px wider than viewport for comfortable scrolling
      );
      const minScrollableHeight = Math.max(viewportHeight * 1.2, bounds.maxY + padding);
      
      // Stage size should accommodate content with padding, but not exceed reasonable limits
      const maxStageWidth = viewportWidth * 3; // Never exceed 3x viewport width
      const maxStageHeight = viewportHeight * 3; // Never exceed 3x viewport height
      
      const stageWidth = Math.min(
        Math.max(
          contentBasedWidth,
          minScrollableWidth
        ),
        maxStageWidth
      );
      const stageHeight = Math.min(
        Math.max(
          bounds.maxY + padding,
          minScrollableHeight,
          canvasSize.height // At least as tall as viewport
        ),
        maxStageHeight
      );
      
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/833eaf25-0547-420d-a570-1d7cab6b5873',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'RoomCanvas.tsx:updateStageSize',message:'Stage size calculation before set',data:{boundsMinX:bounds.minX,boundsMinY:bounds.minY,boundsMaxX:bounds.maxX,boundsMaxY:bounds.maxY,stageWidth,stageHeight,canvasWidth:canvasSize.width,canvasHeight:canvasSize.height,viewportWidth,viewportHeight,padding,minScrollableWidth,minScrollableHeight,maxStageWidth,maxStageHeight,isTablet,isMobile,isFiniteWidth:isFinite(stageWidth),isFiniteHeight:isFinite(stageHeight),isNaNWidth:isNaN(stageWidth),isNaNHeight:isNaN(stageHeight),currentStageX:stagePosition.x,currentStageY:stagePosition.y},timestamp:Date.now(),sessionId:'debug-session',runId:'scroll-debug',hypothesisId:'B'})}).catch(()=>{});
      // #endregion
      
      // Validate stage size before setting
      // CRITICAL: Don't fall back to canvasSize.width - use calculated stageWidth to enable scrolling
      // Only validate that it's finite and positive, don't clamp to canvasSize
      const safeWidth = isFinite(stageWidth) && !isNaN(stageWidth) && stageWidth > 0 
        ? Math.min(stageWidth, maxStageWidth) // Clamp to max, but don't fall back to canvasSize
        : Math.max(viewportWidth + 200, canvasSize.width); // Fallback: ensure wider than viewport
      const safeHeight = isFinite(stageHeight) && !isNaN(stageHeight) && stageHeight > 0 
        ? Math.min(stageHeight, maxStageHeight)
        : canvasSize.height;
      
      // Only update if changed significantly to prevent feedback loops
      const widthChanged = Math.abs(stageSize.width - safeWidth) > 10;
      const heightChanged = Math.abs(stageSize.height - safeHeight) > 10;
      
      if (widthChanged || heightChanged) {
        setStageSize({ width: safeWidth, height: safeHeight });
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/833eaf25-0547-420d-a570-1d7cab6b5873',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'RoomCanvas.tsx:updateStageSize:applied',message:'Stage size applied',data:{safeWidth,safeHeight,originalWidth:stageWidth,originalHeight:stageHeight,previousWidth:stageSize.width,previousHeight:stageSize.height},timestamp:Date.now(),sessionId:'debug-session',runId:'scroll-debug',hypothesisId:'B'})}).catch(()=>{});
        // #endregion
      }
    } else {
      // Default stage size (desktop uses viewport size)
      // Only update if changed to prevent infinite loops
      const widthChanged = Math.abs(stageSize.width - canvasSize.width) > 10;
      const heightChanged = Math.abs(stageSize.height - canvasSize.height) > 10;
      if (widthChanged || heightChanged) {
        setStageSize({ width: canvasSize.width, height: canvasSize.height });
      }
    }
  }, [getAllObjectsBounds, canvasSize, floorPlan, layout, isTabletOrMobile, isTablet, isMobile, stagePosition]);

  // Auto-fit and center all objects (for initial view, but allow scrolling)
  const autoFitToObjects = useCallback(() => {
    const bounds = getAllObjectsBounds();
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/833eaf25-0547-420d-a570-1d7cab6b5873',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'RoomCanvas.tsx:autoFitToObjects:entry',message:'Auto-fit called',data:{hasBounds:!!bounds,isMobile,canvasWidth:canvasSize.width,canvasHeight:canvasSize.height},timestamp:Date.now(),sessionId:'debug-session',runId:'mobile-debug',hypothesisId:'B'})}).catch(()=>{});
    // #endregion
    if (!bounds || !stageRef.current || !canvasRef.current) {
      // Reset to default if no objects
      setStagePosition({ x: 0, y: 0 });
      setStageScale(1);
      if (stageRef.current) {
        stageRef.current.x(0);
        stageRef.current.y(0);
        stageRef.current.scale({ x: 1, y: 1 });
      }
      return;
    }

    const viewportWidth = canvasSize.width;
    const viewportHeight = canvasSize.height;
    const contentWidth = bounds.width;
    const contentHeight = bounds.height;
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/833eaf25-0547-420d-a570-1d7cab6b5873',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'RoomCanvas.tsx:autoFitToObjects:calculations',message:'Viewport and content dimensions',data:{viewportWidth,viewportHeight,contentWidth,contentHeight,boundsMinX:bounds.minX,boundsMinY:bounds.minY,boundsMaxX:bounds.maxX,boundsMaxY:bounds.maxY,isMobile},timestamp:Date.now(),sessionId:'debug-session',runId:'mobile-debug',hypothesisId:'C'})}).catch(()=>{});
    // #endregion

    // On mobile/tablet, don't auto-scale - let user scroll to see content
    // On desktop, scale to fit but don't zoom in beyond 1x
    if (isTabletOrMobile) {
      // Mobile/Tablet: position content at top-left with margin, no scaling
      const margin = 20;
      const calculatedX = margin - bounds.minX;
      const calculatedY = margin - bounds.minY;
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/833eaf25-0547-420d-a570-1d7cab6b5873',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'RoomCanvas.tsx:autoFitToObjects:mobile',message:'Mobile stage position calculation',data:{margin,boundsMinX:bounds.minX,boundsMinY:bounds.minY,calculatedX,calculatedY,isFiniteX:isFinite(calculatedX),isFiniteY:isFinite(calculatedY),isNaNX:isNaN(calculatedX),isNaNY:isNaN(calculatedY),viewportWidth,viewportHeight,stageSizeWidth:stageSize.width,stageSizeHeight:stageSize.height},timestamp:Date.now(),sessionId:'debug-session',runId:'scroll-debug',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      // Validate calculated positions before setting
      const safeX = isFinite(calculatedX) && !isNaN(calculatedX) ? calculatedX : 0;
      const safeY = isFinite(calculatedY) && !isNaN(calculatedY) ? calculatedY : 0;
      setStagePosition({ x: safeX, y: safeY });
      setStageScale(1);
      if (stageRef.current) {
        stageRef.current.x(safeX);
        stageRef.current.y(safeY);
        stageRef.current.scale({ x: 1, y: 1 });
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/833eaf25-0547-420d-a570-1d7cab6b5873',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'RoomCanvas.tsx:autoFitToObjects:mobile:applied',message:'Mobile stage position applied',data:{safeX,safeY,actualX:stageRef.current.x(),actualY:stageRef.current.y()},timestamp:Date.now(),sessionId:'debug-session',runId:'scroll-debug',hypothesisId:'A'})}).catch(()=>{});
        // #endregion
      }
      return;
    }

    // Desktop: calculate scale to fit content in viewport (with some margin)
    const margin = 40; // Padding around content
    const scaleX = (viewportWidth - margin * 2) / contentWidth;
    const scaleY = (viewportHeight - margin * 2) / contentHeight;
    const scale = Math.min(scaleX, scaleY, 1); // Don't zoom in beyond 1x

    // Calculate scaled content dimensions
    const scaledContentWidth = contentWidth * scale;
    const scaledContentHeight = contentHeight * scale;

    // Calculate center position of content
    const centerX = (bounds.minX + bounds.maxX) / 2;
    const centerY = (bounds.minY + bounds.maxY) / 2;

    // Calculate stage position to center content in viewport
    const stageX = viewportWidth / 2 - centerX * scale;
    const stageY = viewportHeight / 2 - centerY * scale;

    // Calculate where the top-left of content would be after transformation
    const topLeftX = stageX + bounds.minX * scale;
    const topLeftY = stageY + bounds.minY * scale;
    
    let finalStageX = stageX;
    let finalStageY = stageY;
    
    // Desktop: smart positioning
    if (scaledContentWidth < viewportWidth * 0.8 && scaledContentHeight < viewportHeight * 0.8) {
      // Content is small relative to viewport - align to top-left with margin
      finalStageX = margin - bounds.minX * scale;
      finalStageY = margin - bounds.minY * scale;
    } else {
      // Content is large - center it, but ensure it doesn't create negative space
      if (topLeftY < margin) {
        finalStageY = margin - bounds.minY * scale;
      }
      if (topLeftX < margin) {
        finalStageX = margin - bounds.minX * scale;
      }
      
      // Ensure content doesn't go beyond viewport
      const bottomRightX = finalStageX + bounds.maxX * scale;
      const bottomRightY = finalStageY + bounds.maxY * scale;
      if (bottomRightX > viewportWidth - margin) {
        finalStageX = viewportWidth - margin - bounds.maxX * scale;
      }
      if (bottomRightY > viewportHeight - margin) {
        finalStageY = viewportHeight - margin - bounds.maxY * scale;
      }
    }

    setStagePosition({ x: finalStageX, y: finalStageY });
    setStageScale(scale);

    // Apply to Konva stage
    if (stageRef.current) {
      stageRef.current.x(finalStageX);
      stageRef.current.y(finalStageY);
      stageRef.current.scale({ x: scale, y: scale });
    }
  }, [getAllObjectsBounds, canvasSize, isMobile, isTabletOrMobile]);

  // Track previous canvas size to detect viewport changes
  const prevCanvasSizeRef = useRef({ width: 0, height: 0 });
  
  // Auto-fit when canvas size changes (e.g., PC to mobile transition)
  useEffect(() => {
    // Only auto-fit if canvas size actually changed significantly
    const sizeChanged = 
      Math.abs(prevCanvasSizeRef.current.width - canvasSize.width) > 50 ||
      Math.abs(prevCanvasSizeRef.current.height - canvasSize.height) > 50;
    
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/833eaf25-0547-420d-a570-1d7cab6b5873',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'RoomCanvas.tsx:autoFitEffect:sizeChange',message:'Canvas size change check',data:{prevWidth:prevCanvasSizeRef.current.width,prevHeight:prevCanvasSizeRef.current.height,newWidth:canvasSize.width,newHeight:canvasSize.height,sizeChanged,isTabletOrMobile},timestamp:Date.now(),sessionId:'debug-session',runId:'scroll-debug',hypothesisId:'D'})}).catch(()=>{});
    // #endregion
    
    if (!sizeChanged && prevCanvasSizeRef.current.width > 0) {
      // Size hasn't changed significantly, skip auto-fit
      return;
    }
    
    prevCanvasSizeRef.current = { width: canvasSize.width, height: canvasSize.height };
    
    // Only auto-fit if there are objects on the canvas
    const bounds = getAllObjectsBounds();
    if (!bounds) {
      // Reset to default if no objects
      setStagePosition({ x: 0, y: 0 });
      setStageScale(1);
      return;
    }

    // Small delay to ensure canvas size is updated
    const timeoutId = setTimeout(() => {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/833eaf25-0547-420d-a570-1d7cab6b5873',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'RoomCanvas.tsx:autoFitEffect:triggered',message:'Auto-fit triggered from size change',data:{canvasWidth:canvasSize.width,canvasHeight:canvasSize.height,isTabletOrMobile},timestamp:Date.now(),sessionId:'debug-session',runId:'scroll-debug',hypothesisId:'D'})}).catch(()=>{});
      // #endregion
      autoFitToObjects();
    }, 150);
    return () => clearTimeout(timeoutId);
  }, [canvasSize.width, canvasSize.height, autoFitToObjects, getAllObjectsBounds, isTabletOrMobile]);

  // Auto-fit when objects are first loaded (but not on every update to avoid interrupting user)
  const hasInitializedRef = useRef(false);
  useEffect(() => {
    const hasObjects = getAllObjectsBounds() !== null;
    if (hasObjects && !hasInitializedRef.current) {
      // First time objects are loaded
      hasInitializedRef.current = true;
      const timeoutId = setTimeout(() => {
        autoFitToObjects();
      }, 200);
      return () => clearTimeout(timeoutId);
    }
  }, [floorPlan?.rooms?.length, floorPlan?.walls?.length, floorPlan?.doors?.length, floorPlan?.windows?.length, layout?.length, autoFitToObjects, getAllObjectsBounds]);

  // Handle room drag - using Konva native pattern
  const handleRoomDragStart = useCallback(() => {
    setIsDragging(true);
  }, []);

  const handleRoomDragEnd = useCallback(async (e: any, roomId: string) => {
    setIsDragging(false);
    try {
      const room = floorPlan?.rooms?.find(r => r.id === roomId);
      if (!room) return;

      // Get position directly from the Konva Group node (e.target is the Group)
      const node = e.target.getType() === 'Group' ? e.target : (e.target.getParent() || e.target);
      const nodeX = node.x();
      const nodeY = node.y();
      
      // Validate node positions
      if (typeof nodeX !== 'number' || typeof nodeY !== 'number' || 
          isNaN(nodeX) || isNaN(nodeY) || !isFinite(nodeX) || !isFinite(nodeY)) {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/833eaf25-0547-420d-a570-1d7cab6b5873',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'RoomCanvas.tsx:handleRoomDragEnd',message:'Invalid node position',data:{roomId,nodeX,nodeY},timestamp:Date.now(),sessionId:'debug-session',runId:'snap-debug',hypothesisId:'I'})}).catch(()=>{});
        // #endregion
        console.warn('Invalid node position in handleRoomDragEnd:', { nodeX, nodeY });
        return;
      }
      
      const newX = snap(nodeX);
      const newY = snap(nodeY);

      // Calculate delta from original position
      const bounds = getRoomBounds(room);
      const deltaX = newX - bounds.minX;
      const deltaY = newY - bounds.minY;
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/833eaf25-0547-420d-a570-1d7cab6b5873',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'RoomCanvas.tsx:handleRoomDragEnd',message:'Room drag end',data:{roomId,targetType:e.target.getType(),parentType:e.target.getParent()?.getType(),nodeType:node.getType(),nodeX,nodeY,newX,newY,boundsMinX:bounds.minX,boundsMinY:bounds.minY,deltaX,deltaY},timestamp:Date.now(),sessionId:'debug-session',runId:'promise-debug',hypothesisId:'G'})}).catch(()=>{});
      // #endregion

      // Update all room points
      const newPoints = room.points.map(point => ({
        x: snap(point.x + deltaX),
        y: snap(point.y + deltaY),
      }));

      await updateFloorPlanElement(roomId, 'room', { points: newPoints }, token);
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/833eaf25-0547-420d-a570-1d7cab6b5873',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'RoomCanvas.tsx:handleRoomDragEnd',message:'Room drag end success',data:{roomId},timestamp:Date.now(),sessionId:'debug-session',runId:'promise-debug',hypothesisId:'G'})}).catch(()=>{});
      // #endregion
    } catch (error) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/833eaf25-0547-420d-a570-1d7cab6b5873',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'RoomCanvas.tsx:handleRoomDragEnd',message:'Room drag end error',data:{roomId,error:error instanceof Error?error.message:String(error)},timestamp:Date.now(),sessionId:'debug-session',runId:'promise-debug',hypothesisId:'G'})}).catch(()=>{});
      // #endregion
      console.error('Error updating room position:', error);
    }
  }, [floorPlan, snap, updateFloorPlanElement, getRoomBounds, token]);

  // Handle wall drag - using Konva native pattern
  const handleWallDragStart = useCallback(() => {
    setIsDragging(true);
  }, []);

  const handleWallDragEnd = useCallback(async (e: any, wallId: string) => {
    setIsDragging(false);
    try {
      const wall = floorPlan?.walls?.find(w => w.id === wallId);
      if (!wall) return;

      // Get position directly from the Konva Group node (e.target is the Group)
      const node = e.target.getType() === 'Group' ? e.target : (e.target.getParent() || e.target);
      const nodeX = node.x();
      const nodeY = node.y();
      
      // Validate node positions
      if (typeof nodeX !== 'number' || typeof nodeY !== 'number' || 
          isNaN(nodeX) || isNaN(nodeY) || !isFinite(nodeX) || !isFinite(nodeY)) {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/833eaf25-0547-420d-a570-1d7cab6b5873',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'RoomCanvas.tsx:handleWallDragEnd',message:'Invalid node position',data:{wallId,nodeX,nodeY},timestamp:Date.now(),sessionId:'debug-session',runId:'snap-debug',hypothesisId:'J'})}).catch(()=>{});
        // #endregion
        console.warn('Invalid node position in handleWallDragEnd:', { nodeX, nodeY });
        return;
      }
      
      const newX = snap(nodeX);
      const newY = snap(nodeY);
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/833eaf25-0547-420d-a570-1d7cab6b5873',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'RoomCanvas.tsx:handleWallDragEnd',message:'Wall drag end',data:{wallId,targetType:e.target.getType(),parentType:e.target.getParent()?.getType(),nodeType:node.getType(),nodeX,nodeY,newX,newY,wallX1:wall.x1,wallY1:wall.y1},timestamp:Date.now(),sessionId:'debug-session',runId:'promise-debug',hypothesisId:'H'})}).catch(()=>{});
      // #endregion

      const deltaX = newX - wall.x1;
      const deltaY = newY - wall.y1;

      await updateFloorPlanElement(wallId, 'wall', {
        x1: newX,
        y1: newY,
        x2: snap(wall.x2 + deltaX),
        y2: snap(wall.y2 + deltaY),
      }, token);
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/833eaf25-0547-420d-a570-1d7cab6b5873',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'RoomCanvas.tsx:handleWallDragEnd',message:'Wall drag end success',data:{wallId},timestamp:Date.now(),sessionId:'debug-session',runId:'promise-debug',hypothesisId:'H'})}).catch(()=>{});
      // #endregion
    } catch (error) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/833eaf25-0547-420d-a570-1d7cab6b5873',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'RoomCanvas.tsx:handleWallDragEnd',message:'Wall drag end error',data:{wallId,error:error instanceof Error?error.message:String(error)},timestamp:Date.now(),sessionId:'debug-session',runId:'promise-debug',hypothesisId:'H'})}).catch(()=>{});
      // #endregion
      console.error('Error updating wall position:', error);
    }
  }, [floorPlan, snap, updateFloorPlanElement, token]);

  // Handle door/window drag - using Konva native pattern
  const handleDoorWindowDragStart = useCallback(() => {
    setIsDragging(true);
  }, []);

  const handleDoorWindowDragEnd = useCallback(async (e: any, elementId: string, elementType: 'door' | 'window') => {
    setIsDragging(false);
    try {
      // Get position directly from the Konva Group node (e.target is the Group)
      const node = e.target.getType() === 'Group' ? e.target : (e.target.getParent() || e.target);
      const nodeX = node.x();
      const nodeY = node.y();
      
      // Validate node positions
      if (typeof nodeX !== 'number' || typeof nodeY !== 'number' || 
          isNaN(nodeX) || isNaN(nodeY) || !isFinite(nodeX) || !isFinite(nodeY)) {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/833eaf25-0547-420d-a570-1d7cab6b5873',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'RoomCanvas.tsx:handleDoorWindowDragEnd',message:'Invalid node position',data:{elementId,elementType,nodeX,nodeY},timestamp:Date.now(),sessionId:'debug-session',runId:'snap-debug',hypothesisId:'K'})}).catch(()=>{});
        // #endregion
        console.warn('Invalid node position in handleDoorWindowDragEnd:', { nodeX, nodeY });
        return;
      }
      
      const newX = snap(nodeX);
      const newY = snap(nodeY);
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/833eaf25-0547-420d-a570-1d7cab6b5873',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'RoomCanvas.tsx:handleDoorWindowDragEnd',message:'Door/Window drag end',data:{elementId,elementType,targetType:e.target.getType(),parentType:e.target.getParent()?.getType(),nodeType:node.getType(),nodeX,nodeY,newX,newY},timestamp:Date.now(),sessionId:'debug-session',runId:'promise-debug',hypothesisId:'I'})}).catch(()=>{});
      // #endregion
      
      await updateFloorPlanElement(elementId, elementType, { x: newX, y: newY }, token);
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/833eaf25-0547-420d-a570-1d7cab6b5873',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'RoomCanvas.tsx:handleDoorWindowDragEnd',message:'Door/Window drag end success',data:{elementId,elementType},timestamp:Date.now(),sessionId:'debug-session',runId:'promise-debug',hypothesisId:'I'})}).catch(()=>{});
      // #endregion
    } catch (error) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/833eaf25-0547-420d-a570-1d7cab6b5873',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'RoomCanvas.tsx:handleDoorWindowDragEnd',message:'Door/Window drag end error',data:{elementId,elementType,error:error instanceof Error?error.message:String(error)},timestamp:Date.now(),sessionId:'debug-session',runId:'promise-debug',hypothesisId:'I'})}).catch(()=>{});
      // #endregion
      console.error(`Error updating ${elementType} position:`, error);
    }
  }, [snap, updateFloorPlanElement, token]);

  // Handle resize start
  const handleResizeStart = useCallback((e: any, roomId: string) => {
    e.cancelBubble = true;
    const room = floorPlan?.rooms?.find(r => r.id === roomId);
    if (!room) return;

    setIsResizing(true);
    setResizeRoomId(roomId);
    setResizeInitialBounds(getRoomBounds(room));
    const stage = stageRef.current?.getStage();
    if (stage) {
      const pointerPos = stage.getPointerPosition();
      if (pointerPos) {
        setResizeStartPos(pointerPos);
      }
    }
  }, [floorPlan, getRoomBounds]);

  // Handle resize move
  const handleResizeMove = useCallback(async (e: any) => {
    if (!isResizing || !resizeRoomId || !resizeInitialBounds || !resizeStartPos) return;

    try {
      const stage = e.target.getStage();
      if (!stage) return;

      const pointerPos = stage.getPointerPosition();
      if (!pointerPos) return;
      
      // Validate pointer position
      if (typeof pointerPos.x !== 'number' || typeof pointerPos.y !== 'number' || 
          isNaN(pointerPos.x) || isNaN(pointerPos.y) || 
          !isFinite(pointerPos.x) || !isFinite(pointerPos.y)) {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/833eaf25-0547-420d-a570-1d7cab6b5873',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'RoomCanvas.tsx:handleResizeMove',message:'Invalid pointer position',data:{pointerPos,resizeRoomId},timestamp:Date.now(),sessionId:'debug-session',runId:'snap-debug',hypothesisId:'L'})}).catch(()=>{});
        // #endregion
        console.warn('Invalid pointer position in handleResizeMove:', pointerPos);
        return;
      }
      
      // Validate resize start position
      if (!resizeStartPos || typeof resizeStartPos.x !== 'number' || typeof resizeStartPos.y !== 'number' ||
          isNaN(resizeStartPos.x) || isNaN(resizeStartPos.y) ||
          !isFinite(resizeStartPos.x) || !isFinite(resizeStartPos.y)) {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/833eaf25-0547-420d-a570-1d7cab6b5873',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'RoomCanvas.tsx:handleResizeMove',message:'Invalid resizeStartPos',data:{resizeStartPos,resizeRoomId},timestamp:Date.now(),sessionId:'debug-session',runId:'snap-debug',hypothesisId:'M'})}).catch(()=>{});
        // #endregion
        console.warn('Invalid resizeStartPos in handleResizeMove:', resizeStartPos);
        return;
      }

      const deltaX = pointerPos.x - resizeStartPos.x;
      const deltaY = pointerPos.y - resizeStartPos.y;

      const room = floorPlan?.rooms?.find(r => r.id === resizeRoomId);
      if (!room) return;

      const newMaxX = Math.max(resizeInitialBounds.minX + 50, snap(resizeInitialBounds.maxX + deltaX));
      const newMaxY = Math.max(resizeInitialBounds.minY + 50, snap(resizeInitialBounds.maxY + deltaY));

      const newPoints = [
        { x: resizeInitialBounds.minX, y: resizeInitialBounds.minY },
        { x: newMaxX, y: resizeInitialBounds.minY },
        { x: newMaxX, y: newMaxY },
        { x: resizeInitialBounds.minX, y: newMaxY },
      ];

      await updateFloorPlanElement(resizeRoomId, 'room', { points: newPoints }, token);
    } catch (error) {
      console.error('Error resizing room:', error);
    }
  }, [isResizing, resizeRoomId, resizeInitialBounds, resizeStartPos, floorPlan, snap, updateFloorPlanElement, token]);

  // Handle resize end
  const handleResizeEnd = useCallback(() => {
    setIsResizing(false);
    setResizeRoomId(null);
    setResizeInitialBounds(null);
    setResizeStartPos(null);
  }, []);

  // Get target type for rendering
  const getTargetType = useCallback((targetId: string) => {
    const target = roomTargets.find(t => String(t.id) === String(targetId)) || 
                  allTargets.find(t => String(t.id) === String(targetId));
    return target?.type || target?.deviceType || 'standard';
  }, [roomTargets, allTargets]);

  // Get target name for rendering
  const getTargetName = useCallback((targetId: string) => {
    const target = roomTargets.find(t => String(t.id) === String(targetId)) || 
                  allTargets.find(t => String(t.id) === String(targetId));
    return target?.customName || target?.name || `Target ${targetId.slice(-4)}`;
  }, [roomTargets, allTargets]);

  // Get target color based on type
  const getTargetColor = useCallback((type: string) => {
    const typeLower = type?.toLowerCase() || 'standard';
    switch (typeLower) {
      case 'standard':
        return '#3b82f6'; // brand-primary blue
      case 'reactive':
        return '#2563eb'; // blue-600
      case 'armored':
        return '#374151'; // gray-700
      case 'premium':
        return '#d97706'; // yellow-600
      default:
        return '#3b82f6';
    }
  }, []);

  // Objects should always be draggable after placement, regardless of drawing mode
  // Only disable dragging when actively drawing (to prevent accidental moves)
  const canDrag = true; // Always allow dragging placed objects
  
  // #region agent log
  useEffect(() => {
    const canDragValue = true;
    fetch('http://127.0.0.1:7242/ingest/833eaf25-0547-420d-a570-1d7cab6b5873',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'RoomCanvas.tsx:canDrag',message:'canDrag value check',data:{canDrag:canDragValue,drawingMode,roomCount:floorPlan?.rooms?.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
  }, [drawingMode, floorPlan]);
  // #endregion
  const hasTargets = layout.length > 0;
  const hasFloorPlanElements = floorPlan && (
    (floorPlan.rooms && floorPlan.rooms.length > 0) ||
    (floorPlan.walls && floorPlan.walls.length > 0) ||
    (floorPlan.doors && floorPlan.doors.length > 0) ||
    (floorPlan.windows && floorPlan.windows.length > 0)
  );
  const isEmpty = !hasTargets && !hasFloorPlanElements;

  // Enhanced touch gesture handlers for mobile
  // CRITICAL FIX: Only handle touch events when actually interacting with canvas objects
  // Don't prevent default scrolling behavior
  const handleTouchStart = useCallback((e: any) => {
    if (!isTabletOrMobile) return;
    
    const touches = e.evt?.touches;
    if (!touches) return;
    
    // Only handle multi-touch gestures or touches on draggable objects
    if (touches.length === 2) {
      // Two-finger gesture (pinch/zoom) - prevent drawing mode activation
      setIsGesturing(true);
      const touch1 = touches[0];
      const touch2 = touches[1];
      const distance = Math.sqrt(
        Math.pow(touch2.clientX - touch1.clientX, 2) + 
        Math.pow(touch2.clientY - touch1.clientY, 2)
      );
      setLastPointerDistance(distance);
      // Don't prevent default - allow native pinch zoom
    } else if (touches.length === 1) {
      // Single touch - check if it's on a draggable object
      const target = e.target;
      // If touching the stage background (not an object), allow scrolling
      if (target && target.getStage && target === target.getStage()) {
        // Touching empty stage - allow scroll, don't prevent default
        return;
      }
      // Touching an object - will be handled by object's drag handlers
    }
  }, [isTabletOrMobile]);

  const handleTouchMove = useCallback((e: any) => {
    if (!isTabletOrMobile) return;
    
    const touches = e.evt?.touches;
    if (touches && touches.length === 2 && lastPointerDistance !== null) {
      // Continue pinch gesture - don't prevent default scrolling
      setIsGesturing(true);
    } else if (touches && touches.length === 1) {
      // Single touch move - if not dragging an object, allow scrolling
      if (!isDragging) {
        // Allow native scroll behavior
        return;
      }
    }
  }, [isTabletOrMobile, lastPointerDistance, isDragging]);

  const handleTouchEnd = useCallback((e: any) => {
    if (!isTabletOrMobile) return;
    
    const touches = e.evt?.touches;
    if (!touches || touches.length < 2) {
      // Reset gesture state
      setTimeout(() => {
        setIsGesturing(false);
        setLastPointerDistance(null);
      }, 100); // Small delay to prevent immediate drawing after gesture
    }
  }, [isTabletOrMobile]);

  // Handle drop on canvas container
  const handleDrop = useCallback(async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    try {
      const targetId = e.dataTransfer.getData('application/target-id');
      if (targetId && stageRef.current) {
        const stage = stageRef.current.getStage();
        if (stage) {
          // Get drop position relative to stage
          const rect = stage.container().getBoundingClientRect();
          const x = e.clientX - rect.left;
          const y = e.clientY - rect.top;
          
          // Validate calculated positions
          if (typeof x !== 'number' || typeof y !== 'number' || 
              isNaN(x) || isNaN(y) || !isFinite(x) || !isFinite(y)) {
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/833eaf25-0547-420d-a570-1d7cab6b5873',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'RoomCanvas.tsx:handleDrop',message:'Invalid drop position',data:{targetId,clientX:e.clientX,clientY:e.clientY,rectLeft:rect.left,rectTop:rect.top,calculatedX:x,calculatedY:y},timestamp:Date.now(),sessionId:'debug-session',runId:'snap-debug',hypothesisId:'N'})}).catch(()=>{});
            // #endregion
            console.warn('Invalid drop position:', { x, y, clientX: e.clientX, clientY: e.clientY });
            return;
          }
          
          const snappedX = snap(x);
          const snappedY = snap(y);
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/833eaf25-0547-420d-a570-1d7cab6b5873',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'RoomCanvas.tsx:handleDrop',message:'Target drop coordinates',data:{targetId,clientX:e.clientX,clientY:e.clientY,rectLeft:rect.left,rectTop:rect.top,calculatedX:x,calculatedY:y,snappedX,snappedY},timestamp:Date.now(),sessionId:'debug-session',runId:'promise-debug',hypothesisId:'J'})}).catch(()=>{});
          // #endregion
          await placeTarget(targetId, { x: snappedX, y: snappedY }, token);
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/833eaf25-0547-420d-a570-1d7cab6b5873',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'RoomCanvas.tsx:handleDrop',message:'Target drop success',data:{targetId},timestamp:Date.now(),sessionId:'debug-session',runId:'promise-debug',hypothesisId:'J'})}).catch(()=>{});
          // #endregion
        }
      }
    } catch (error) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/833eaf25-0547-420d-a570-1d7cab6b5873',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'RoomCanvas.tsx:handleDrop',message:'Target drop error',data:{error:error instanceof Error?error.message:String(error)},timestamp:Date.now(),sessionId:'debug-session',runId:'promise-debug',hypothesisId:'J'})}).catch(()=>{});
      // #endregion
      console.error('Error placing target on drop:', error);
    }
  }, [snap, placeTarget, token]);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  // Validate canvas and stage dimensions before rendering
  const safeCanvasWidth = canvasSize.width > 0 && isFinite(canvasSize.width) ? canvasSize.width : MAX_CANVAS_WIDTH;
  const safeCanvasHeight = canvasSize.height > 0 && isFinite(canvasSize.height) ? canvasSize.height : MAX_CANVAS_HEIGHT_FIXED;
  // CRITICAL: Use stageSize.width directly for mobile/tablet to enable horizontal scrolling
  // Don't fall back to canvasSize.width as that prevents scrolling
  const safeStageWidth = isTabletOrMobile 
    ? (stageSize.width > 0 && isFinite(stageSize.width) ? stageSize.width : Math.max(window.innerWidth + 200, safeCanvasWidth))
    : safeCanvasWidth;
  const safeStageHeight = isTabletOrMobile
    ? (stageSize.height > 0 && isFinite(stageSize.height) ? stageSize.height : safeCanvasHeight)
    : safeCanvasHeight;
  const safeStageX = isFinite(stagePosition.x) ? stagePosition.x : 0;
  const safeStageY = isFinite(stagePosition.y) ? stagePosition.y : 0;
  const safeStageScale = stageScale > 0 && isFinite(stageScale) ? stageScale : 1;

  // Log canvas dimensions for debugging mobile crashes and scrolling
  useEffect(() => {
    if (canvasRef.current) {
      const container = canvasRef.current;
      const parent = container.parentElement;
      const scrollInfo = {
        scrollLeft: container.scrollLeft,
        scrollTop: container.scrollTop,
        scrollWidth: container.scrollWidth,
        scrollHeight: container.scrollHeight,
        clientWidth: container.clientWidth,
        clientHeight: container.clientHeight,
        canScrollX: container.scrollWidth > container.clientWidth,
        canScrollY: container.scrollHeight > container.clientHeight,
        containerWidth: container.offsetWidth,
        containerHeight: container.offsetHeight,
        parentWidth: parent?.clientWidth,
        parentHeight: parent?.clientHeight,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        computedWidth: getComputedStyle(container).width,
        computedMinWidth: getComputedStyle(container).minWidth,
      };
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/833eaf25-0547-420d-a570-1d7cab6b5873',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'RoomCanvas.tsx:render:dimensions',message:'Canvas render dimensions and scroll state',data:{isMobile,isTabletOrMobile,canvasWidth:canvasSize.width,canvasHeight:canvasSize.height,stageWidth:stageSize.width,stageHeight:stageSize.height,safeCanvasWidth,safeCanvasHeight,safeStageWidth,safeStageHeight,stageX:stagePosition.x,stageY:stagePosition.y,stageScale,scrollInfo},timestamp:Date.now(),sessionId:'debug-session',runId:'scroll-debug',hypothesisId:'C'})}).catch(()=>{});
      // #endregion
    }
  }, [isMobile, isTabletOrMobile, canvasSize.width, canvasSize.height, stageSize.width, stageSize.height, stagePosition.x, stagePosition.y, stageScale, safeCanvasWidth, safeCanvasHeight, safeStageWidth, safeStageHeight]);

  return (
    <div 
      ref={canvasRef} 
      className="relative bg-white"
      style={{
        // CRITICAL FIX: Set explicit width/height to Stage dimensions to enable scrolling
        // The parent container (data-canvas) handles overflow-auto, this div just needs to be
        // large enough to create scrollable content
        // Use explicit pixel dimensions to ensure it expands beyond parent viewport
        // CRITICAL: Use stageSize directly (not safeStageWidth) to ensure width exceeds viewport for scrolling
        // Ensure width is always wider than viewport for horizontal scrolling
        // Use the calculated stageWidth which should be wider than viewport
        width: isTabletOrMobile ? `${stageSize.width}px` : '100%',
        height: isTabletOrMobile ? `${stageSize.height}px` : '100%',
        // Ensure container expands to fit Stage content and creates overflow
        display: 'block',
        // Prevent flexbox from constraining width - critical for horizontal scrolling
        flexShrink: 0,
        flexGrow: 0,
        // Force minimum dimensions to ensure overflow - use stageSize directly for mobile/tablet
        // CRITICAL: Ensure minWidth matches width to prevent shrinking
        minWidth: isTabletOrMobile ? `${stageSize.width}px` : undefined,
        minHeight: isTabletOrMobile ? `${stageSize.height}px` : undefined,
        // Don't set overflow here - parent container handles scrolling
      }}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
    >
      <Stage
        ref={stageRef}
        width={safeStageWidth}
        height={safeStageHeight}
        x={safeStageX}
        y={safeStageY}
        scaleX={safeStageScale}
        scaleY={safeStageScale}
        onClick={handleStageClick}
        onMouseMove={handleResizeMove}
        onMouseUp={handleResizeEnd}
        onTouchStart={handleTouchStart}
        onTouchMove={(e) => {
          try {
            handleTouchMove(e);
            handleResizeMove(e);
          } catch (error) {
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/833eaf25-0547-420d-a570-1d7cab6b5873',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'RoomCanvas.tsx:onTouchMove',message:'Touch move error',data:{error:error instanceof Error?error.message:String(error)},timestamp:Date.now(),sessionId:'debug-session',runId:'mobile-crash-debug',hypothesisId:'B'})}).catch(()=>{});
            // #endregion
            console.error('Error in touch move handler:', error);
          }
        }}
        onTouchEnd={(e) => {
          try {
            handleTouchEnd(e);
            handleResizeEnd();
          } catch (error) {
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/833eaf25-0547-420d-a570-1d7cab6b5873',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'RoomCanvas.tsx:onTouchEnd',message:'Touch end error',data:{error:error instanceof Error?error.message:String(error)},timestamp:Date.now(),sessionId:'debug-session',runId:'mobile-crash-debug',hypothesisId:'C'})}).catch(()=>{});
            // #endregion
            console.error('Error in touch end handler:', error);
          }
        }}
        style={{ 
          cursor: isResizing ? 'nwse-resize' : drawingMode ? 'crosshair' : 'default',
          // CRITICAL FIX: Allow panning (scrolling) on mobile while still allowing object dragging
          // 'pan-x pan-y' allows native scrolling, but Konva can still detect drags on draggable objects
          touchAction: isTabletOrMobile ? 'pan-x pan-y' : 'auto',
        }}
      >
        {/* White background layer */}
        <Layer>
          <Rect
            x={0}
            y={0}
            width={safeStageWidth}
            height={safeStageHeight}
            fill="#ffffff"
            listening={false}
          />
        </Layer>

        {/* Floor Plan Layer */}
        <Layer>
          {/* Walls */}
          {floorPlan?.walls?.map(wall => {
            const isSelected = selectedFloorPlanElement === wall.id;
            return (
              <PositionedGroup
                key={wall.id}
                x={wall.x1}
                y={wall.y1}
                draggable={canDrag}
                perfectDrawEnabled={false}
                hitGraphEnabled={true}
                dragBoundFunc={(pos) => {
                  // Keep within canvas bounds
                  return {
                    x: Math.max(0, Math.min(pos.x, canvasSize.width - 50)),
                    y: Math.max(0, Math.min(pos.y, canvasSize.height - 50)),
                  };
                }}
                onDragStart={() => {
                  handleWallDragStart();
                  selectFloorPlanElement(wall.id);
                }}
                onDragEnd={(e) => handleWallDragEnd(e, wall.id)}
                onClick={(e) => {
                  e.cancelBubble = true;
                  selectFloorPlanElement(wall.id);
                }}
                onTap={(e) => {
                  e.cancelBubble = true;
                  selectFloorPlanElement(wall.id);
                }}
              >
                <Line
                  points={[0, 0, wall.x2 - wall.x1, wall.y2 - wall.y1]}
                  stroke={isSelected ? '#3b82f6' : (wall.color || '#666666')}
                  strokeWidth={isSelected ? 8 : (wall.thickness || 5)}
                  lineCap="round"
                  lineJoin="round"
                  listening={true}
                  draggable={false}
                />
              </PositionedGroup>
            );
          })}

          {/* Rooms */}
          {floorPlan?.rooms?.map(room => {
            const isSelected = selectedFloorPlanElement === room.id;
            const bounds = getRoomBounds(room);
            const relativePoints = room.points.map(p => ({
              x: p.x - bounds.minX,
              y: p.y - bounds.minY,
            }));
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/833eaf25-0547-420d-a570-1d7cab6b5873',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'RoomCanvas.tsx:render:room',message:'Rendering room with props',data:{roomId:room.id,boundsMinX:bounds.minX,boundsMinY:bounds.minY,points:room.points},timestamp:Date.now(),sessionId:'debug-session',runId:'placement-debug',hypothesisId:'E'})}).catch(()=>{});
            // #endregion

            return (
              <PositionedGroup
                key={room.id}
                x={bounds.minX}
                y={bounds.minY}
                rotation={room.rotation || 0}
                draggable={canDrag}
                perfectDrawEnabled={false}
                hitGraphEnabled={true}
                dragBoundFunc={(pos) => {
                  // Keep within canvas bounds
                  const roomWidth = bounds.maxX - bounds.minX;
                  const roomHeight = bounds.maxY - bounds.minY;
                  return {
                    x: Math.max(0, Math.min(pos.x, canvasSize.width - roomWidth)),
                    y: Math.max(0, Math.min(pos.y, canvasSize.height - roomHeight)),
                  };
                }}
                onDragStart={() => {
                  handleRoomDragStart();
                  selectFloorPlanElement(room.id);
                }}
                onDragEnd={(e) => handleRoomDragEnd(e, room.id)}
                onClick={(e) => {
                  e.cancelBubble = true;
                  selectFloorPlanElement(room.id);
                }}
                onTap={(e) => {
                  e.cancelBubble = true;
                  selectFloorPlanElement(room.id);
                }}
              >
                {/* Shape for visual rendering */}
                <Shape
                  sceneFunc={(context, shape) => {
                    context.beginPath();
                    context.moveTo(relativePoints[0].x, relativePoints[0].y);
                    for (let i = 1; i < relativePoints.length; i++) {
                      context.lineTo(relativePoints[i].x, relativePoints[i].y);
                    }
                    context.closePath();
                    (context as any).fillStyle = room.fillColor || '#e0e0e0';
                    context.fill();
                    context.strokeStyle = isSelected ? '#3b82f6' : (room.strokeColor || '#666666');
                    context.lineWidth = isSelected ? 3 : 2;
                    context.stroke();
                  }}
                  hitFunc={(context, shape) => {
                    // Define hit area matching the visual shape
                    context.beginPath();
                    context.moveTo(relativePoints[0].x, relativePoints[0].y);
                    for (let i = 1; i < relativePoints.length; i++) {
                      context.lineTo(relativePoints[i].x, relativePoints[i].y);
                    }
                    context.closePath();
                    context.fillStrokeShape(shape);
                  }}
                  listening={true}
                  draggable={false}
                />
              </PositionedGroup>
            );
          })}

          {/* Doors */}
          {floorPlan?.doors?.map(door => {
            const isSelected = selectedFloorPlanElement === door.id;
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/833eaf25-0547-420d-a570-1d7cab6b5873',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'RoomCanvas.tsx:render:door',message:'Rendering door with props',data:{doorId:door.id,doorX:door.x,doorY:door.y},timestamp:Date.now(),sessionId:'debug-session',runId:'placement-debug',hypothesisId:'E'})}).catch(()=>{});
            // #endregion
            return (
              <PositionedGroup
                key={door.id}
                x={door.x}
                y={door.y}
                rotation={door.rotation || 0}
                draggable={canDrag}
                perfectDrawEnabled={false}
                hitGraphEnabled={true}
                dragBoundFunc={(pos) => {
                  // Keep within canvas bounds
                  return {
                    x: Math.max(0, Math.min(pos.x, canvasSize.width - door.width)),
                    y: Math.max(0, Math.min(pos.y, canvasSize.height - 20)),
                  };
                }}
                onDragStart={() => {
                  handleDoorWindowDragStart();
                  selectFloorPlanElement(door.id);
                }}
                onDragEnd={(e) => handleDoorWindowDragEnd(e, door.id, 'door')}
                onClick={(e) => {
                  e.cancelBubble = true;
                  selectFloorPlanElement(door.id);
                }}
                onTap={(e) => {
                  e.cancelBubble = true;
                  selectFloorPlanElement(door.id);
                }}
              >
                <Rect
                  width={door.width}
                  height={20}
                  fill="#8b4513"
                  stroke={isSelected ? '#3b82f6' : '#654321'}
                  strokeWidth={isSelected ? 3 : 1}
                  listening={true}
                  draggable={false}
                />
              </PositionedGroup>
            );
          })}

          {/* Windows */}
          {floorPlan?.windows?.map(window => {
            const isSelected = selectedFloorPlanElement === window.id;
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/833eaf25-0547-420d-a570-1d7cab6b5873',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'RoomCanvas.tsx:render:window',message:'Rendering window with props',data:{windowId:window.id,windowX:window.x,windowY:window.y},timestamp:Date.now(),sessionId:'debug-session',runId:'placement-debug',hypothesisId:'E'})}).catch(()=>{});
            // #endregion
            return (
              <PositionedGroup
                key={window.id}
                x={window.x}
                y={window.y}
                rotation={window.rotation || 0}
                draggable={canDrag}
                perfectDrawEnabled={false}
                hitGraphEnabled={true}
                dragBoundFunc={(pos) => {
                  // Keep within canvas bounds
                  return {
                    x: Math.max(0, Math.min(pos.x, canvasSize.width - window.width)),
                    y: Math.max(0, Math.min(pos.y, canvasSize.height - 20)),
                  };
                }}
                onDragStart={() => {
                  handleDoorWindowDragStart();
                  selectFloorPlanElement(window.id);
                }}
                onDragEnd={(e) => handleDoorWindowDragEnd(e, window.id, 'window')}
                onClick={(e) => {
                  e.cancelBubble = true;
                  selectFloorPlanElement(window.id);
                }}
                onTap={(e) => {
                  e.cancelBubble = true;
                  selectFloorPlanElement(window.id);
                }}
              >
                <Rect
                  width={window.width}
                  height={20}
                  fill="#87ceeb"
                  stroke={isSelected ? '#3b82f6' : '#4682b4'}
                  strokeWidth={isSelected ? 3 : 1}
                  listening={true}
                  draggable={false}
                />
              </PositionedGroup>
            );
          })}
        </Layer>

        {/* Resize Handles Layer */}
        <Layer>
          {floorPlan?.rooms?.map(room => {
            if (selectedFloorPlanElement !== room.id) return null;
            const bounds = getRoomBounds(room);
            return (
              <Circle
                key={`resize-${room.id}`}
                x={bounds.maxX}
                y={bounds.maxY}
                radius={8}
                fill="#3b82f6"
                stroke="#ffffff"
                strokeWidth={2}
                shadowBlur={4}
                shadowColor="rgba(0,0,0,0.3)"
                draggable={false}
                onMouseDown={(e) => handleResizeStart(e, room.id)}
                onTouchStart={(e) => handleResizeStart(e, room.id)}
                style={{ cursor: 'nwse-resize' }}
              />
            );
          })}
        </Layer>

        {/* Targets Layer */}
        <Layer>
          {layout.map(targetLayout => {
            // Skip targets that are part of a group when rendering individually
            const isInGroup = groups.some(g => g.targetIds.includes(targetLayout.id));
            if (isInGroup) return null;

            const isSelected = selectedIds.includes(targetLayout.id);
            const targetType = getTargetType(targetLayout.id);
            const targetColor = getTargetColor(targetType);
            const targetName = getTargetName(targetLayout.id);

            return (
              <Group key={`target-${targetLayout.id}`}>
                <PositionedGroup
                  x={targetLayout.x}
                  y={targetLayout.y}
                  draggable={canDrag}
                  perfectDrawEnabled={false}
                  hitGraphEnabled={true}
                  dragBoundFunc={(pos) => {
                    // Keep within canvas bounds (target radius is 24)
                    return {
                      x: Math.max(24, Math.min(pos.x, canvasSize.width - 24)),
                      y: Math.max(24, Math.min(pos.y, canvasSize.height - 24)),
                    };
                  }}
                  onDragStart={() => {
                    handleTargetDragStart();
                    if (!selectedIds.includes(targetLayout.id)) {
                      selectTargets([targetLayout.id]);
                    }
                  }}
                  onDragEnd={(e) => handleTargetDragEnd(e, targetLayout.id)}
                  onClick={(e) => {
                    e.cancelBubble = true;
                    if (e.evt?.shiftKey) {
                      // Multi-select
                      if (selectedIds.includes(targetLayout.id)) {
                        selectTargets(selectedIds.filter(id => id !== targetLayout.id));
                      } else {
                        selectTargets([...selectedIds, targetLayout.id]);
                      }
                    } else {
                      selectTargets([targetLayout.id]);
                      selectGroup(null);
                    }
                  }}
                  onTap={(e) => {
                    e.cancelBubble = true;
                    selectTargets([targetLayout.id]);
                    selectGroup(null);
                  }}
                >
                  {/* Target icon with concentric circles - 1.5x bigger */}
                  {/* Outer circle */}
                  <Circle
                    radius={24}
                    fill="none"
                    stroke={isSelected ? '#22c55e' : '#ef4444'}
                    strokeWidth={isSelected ? 3 : 2}
                    shadowBlur={isSelected ? 8 : 4}
                    shadowColor="rgba(0,0,0,0.3)"
                    listening={true}
                    draggable={false}
                  />
                  {/* Middle circle */}
                  <Circle
                    radius={15}
                    fill="none"
                    stroke={isSelected ? '#22c55e' : '#ef4444'}
                    strokeWidth={isSelected ? 2.5 : 1.5}
                    listening={true}
                    draggable={false}
                  />
                  {/* Inner circle (center dot) */}
                  <Circle
                    radius={4.5}
                    fill={isSelected ? '#22c55e' : '#ef4444'}
                    stroke={isSelected ? '#16a34a' : '#dc2626'}
                    strokeWidth={isSelected ? 2 : 1}
                    listening={true}
                    draggable={false}
                  />
                </PositionedGroup>
                {/* Floating name tag when selected */}
                {isSelected && (
                  <Group x={targetLayout.x} y={targetLayout.y - 40}>
                    {/* Background rectangle - brand purple */}
                    <Rect
                      x={-60}
                      y={-16}
                      width={120}
                      height={32}
                      fill="#816E94"
                      cornerRadius={6}
                      shadowBlur={4}
                      shadowColor="rgba(0,0,0,0.3)"
                      listening={false}
                    />
                    {/* Name text - white with brand font */}
                    <Text
                      text={targetName}
                      fontSize={12}
                      fontFamily="Raleway, sans-serif"
                      fontStyle="bold"
                      fill="#FFFFFF"
                      x={-58}
                      y={-12}
                      width={116}
                      align="center"
                      listening={false}
                    />
                  </Group>
                )}
              </Group>
            );
          })}
        </Layer>

        {/* Empty State */}
        {isEmpty && safeCanvasWidth > 0 && safeCanvasHeight > 0 && (
          <Layer>
            <Text
              x={safeCanvasWidth / 2}
              y={safeCanvasHeight / 2 - 40}
              text="Drag targets here"
              fontSize={16}
              fill="#a78bfa"
              align="center"
              offsetX={60}
            />
            <Text
              x={safeCanvasWidth / 2}
              y={safeCanvasHeight / 2}
              text="Drag targets from the Palette panel to place them on the canvas"
              fontSize={12}
              fill="#6b7280"
              align="center"
              offsetX={150}
            />
          </Layer>
        )}
      </Stage>
      {isTabletOrMobile && (
        <div
          aria-hidden="true"
          className="w-full flex-shrink-0"
          style={{
            height: isMobile ? 96 : 120,
          }}
        />
      )}
    </div>
  );
};

export default RoomCanvas;
