import { create } from 'zustand';
import API from '@/lib/api';
import { toast } from "@/components/ui/sonner";
import { RoomLayoutResponse, FloorPlanLayout, Wall, RoomShape, Door, Window } from '@/lib/types';

export type Position = {
  x: number;
  y: number;
};

export type TargetLayout = {
  id: string;
  x: number;
  y: number;
};

export type TargetGroup = {
  id: string;
  name: string;
  targetIds: string[];
};

export type DrawingMode = 'wall' | 'room' | 'door' | 'window' | 'target' | null;

type UndoAction = {
  type: 'move' | 'group' | 'ungroup' | 'rename' | 'floorplan';
  previous: any;
  current: any;
};

interface RoomDesignerState {
  roomId: string | null;
  layout: TargetLayout[];
  groups: TargetGroup[];
  selectedIds: string[];
  selectedGroupId: string | null;
  snapToGrid: boolean;
  gridSize: number;
  undoStack: UndoAction[];
  redoStack: UndoAction[];
  floorPlan: FloorPlanLayout | null;
  drawingMode: DrawingMode;
  selectedFloorPlanElement: string | null;
  
  // Methods
  setRoom: (roomId: string) => void;
  fetchLayout: (token: string) => Promise<void>;
  placeTarget: (targetId: string, position: Position, token: string) => Promise<void>;
  moveTarget: (id: string, position: Position, token: string) => Promise<void>;
  createGroup: (name: string, targetIds: string[], token: string) => Promise<void>;
  renameGroup: (groupId: string, name: string, token: string) => Promise<void>;
  ungroupTargets: (groupId: string, token: string) => Promise<void>;
  selectTargets: (ids: string[]) => void;
  selectGroup: (groupId: string | null) => void;
  toggleSnapToGrid: () => void;
  setGridSize: (size: number) => void;
  undo: (token: string) => Promise<void>;
  redo: (token: string) => Promise<void>;
  saveLayout: (token: string) => Promise<boolean>;
  // Floor plan methods
  setDrawingMode: (mode: DrawingMode) => void;
  addWall: (wall: Wall) => void;
  saveLayout: (token: string) => Promise<boolean>;
  addRoom: (room: RoomShape, token: string) => Promise<void>;
  addDoor: (door: Door, token: string) => Promise<void>;
  addWindow: (window: Window, token: string) => Promise<void>;
  deleteFloorPlanElement: (id: string, type: 'wall' | 'room' | 'door' | 'window') => void;
  updateFloorPlanElement: (id: string, type: 'wall' | 'room' | 'door' | 'window', updates: any, token: string) => Promise<void>;
  rotateFloorPlanElement: (id: string, type: 'wall' | 'room' | 'door' | 'window', token: string) => Promise<void>;
  selectFloorPlanElement: (id: string | null) => void;
}

// Helper to snap values to grid
export const gridSnap = (value: number, gridSize: number): number => {
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/833eaf25-0547-420d-a570-1d7cab6b5873',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useRoomDesigner.ts:gridSnap',message:'gridSnap called',data:{value,gridSize,valueType:typeof value,gridSizeType:typeof gridSize,isNaNValue:isNaN(value),isNaNGridSize:isNaN(gridSize),isFiniteValue:isFinite(value),isFiniteGridSize:isFinite(gridSize)},timestamp:Date.now(),sessionId:'debug-session',runId:'snap-debug',hypothesisId:'A'})}).catch(()=>{});
  // #endregion
  
  // Validate inputs
  if (typeof value !== 'number' || isNaN(value) || !isFinite(value)) {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/833eaf25-0547-420d-a570-1d7cab6b5873',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useRoomDesigner.ts:gridSnap',message:'Invalid value in gridSnap',data:{value,gridSize},timestamp:Date.now(),sessionId:'debug-session',runId:'snap-debug',hypothesisId:'B'})}).catch(()=>{});
    // #endregion
    console.warn('gridSnap: Invalid value', value);
    return 0; // Return safe default
  }
  
  if (typeof gridSize !== 'number' || isNaN(gridSize) || !isFinite(gridSize) || gridSize <= 0) {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/833eaf25-0547-420d-a570-1d7cab6b5873',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useRoomDesigner.ts:gridSnap',message:'Invalid gridSize in gridSnap',data:{value,gridSize},timestamp:Date.now(),sessionId:'debug-session',runId:'snap-debug',hypothesisId:'C'})}).catch(()=>{});
    // #endregion
    console.warn('gridSnap: Invalid gridSize', gridSize);
    return value; // Return original value if gridSize is invalid
  }
  
  const result = Math.round(value / gridSize) * gridSize;
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/833eaf25-0547-420d-a570-1d7cab6b5873',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useRoomDesigner.ts:gridSnap',message:'gridSnap result',data:{value,gridSize,result,isNaNResult:isNaN(result),isFiniteResult:isFinite(result)},timestamp:Date.now(),sessionId:'debug-session',runId:'snap-debug',hypothesisId:'A'})}).catch(()=>{});
  // #endregion
  
  // Validate result
  if (isNaN(result) || !isFinite(result)) {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/833eaf25-0547-420d-a570-1d7cab6b5873',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useRoomDesigner.ts:gridSnap',message:'gridSnap produced invalid result',data:{value,gridSize,result},timestamp:Date.now(),sessionId:'debug-session',runId:'snap-debug',hypothesisId:'D'})}).catch(()=>{});
    // #endregion
    console.warn('gridSnap: Invalid result', { value, gridSize, result });
    return value; // Return original value if result is invalid
  }
  
  return result;
};

export const useRoomDesigner = create<RoomDesignerState>((set, get) => ({
  roomId: null,
  layout: [],
  groups: [],
  selectedIds: [],
  selectedGroupId: null,
  snapToGrid: true,
  gridSize: 16,
  undoStack: [],
  redoStack: [],
  floorPlan: null,
  drawingMode: null,
  selectedFloorPlanElement: null,
  
  setRoom: (roomId) => {
    set({ 
      roomId,
      layout: [],
      groups: [], 
      selectedIds: [],
      selectedGroupId: null,
      undoStack: [],
      redoStack: [],
      floorPlan: null,
      drawingMode: null,
      selectedFloorPlanElement: null,
    });
  },
  
  fetchLayout: async (token) => {
    const { roomId } = get();
    if (!roomId) return;
    
    try {
      const result = await API.getRoomLayout(roomId);
      set({ 
        layout: result.targets || [],
        groups: result.groups || [],
        floorPlan: result.floorPlan?.layout || null,
      });
    } catch (error) {
      // Room layout not implemented yet, set empty arrays
      set({ 
        layout: [],
        groups: [],
        floorPlan: null,
      });
      console.log('Room layout not implemented yet');
    }
  },
  
  placeTarget: async (targetId, position, token) => {
    const { layout, snapToGrid, gridSize } = get();
    
    // Check if target is already placed
    if (layout.some(t => t.id === targetId)) {
      return; // Target already placed
    }
    
    let newX = position.x;
    let newY = position.y;
    
    if (snapToGrid) {
      newX = gridSnap(newX, gridSize);
      newY = gridSnap(newY, gridSize);
    }
    
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/833eaf25-0547-420d-a570-1d7cab6b5873',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useRoomDesigner.ts:placeTarget',message:'Placing target in state',data:{targetId,receivedX:position.x,receivedY:position.y,finalX:newX,finalY:newY,snapToGrid},timestamp:Date.now(),sessionId:'debug-session',runId:'placement-debug',hypothesisId:'F'})}).catch(()=>{});
    // #endregion
    
    // Add target to layout
    const newTarget: TargetLayout = {
      id: targetId,
      x: newX,
      y: newY,
    };
    
    set({ layout: [...layout, newTarget] });
    
    // Save to backend
    await get().saveLayout(token);
  },

  moveTarget: async (id, position, token) => {
    const { layout, snapToGrid, gridSize } = get();
    const targetIndex = layout.findIndex(t => t.id === id);
    
    if (targetIndex === -1) return;
    
    const oldPosition = { 
      x: layout[targetIndex].x, 
      y: layout[targetIndex].y 
    };
    
    let newX = position.x;
    let newY = position.y;
    
    if (snapToGrid) {
      newX = gridSnap(newX, gridSize);
      newY = gridSnap(newY, gridSize);
    }
    
    // Update local state first for responsiveness
    const updatedLayout = [...layout];
    updatedLayout[targetIndex] = { ...updatedLayout[targetIndex], x: newX, y: newY };
    
    // Add to undo stack
    const undoAction: UndoAction = {
      type: 'move',
      previous: { id, position: oldPosition },
      current: { id, position: { x: newX, y: newY } }
    };
    
    set(state => ({
      layout: updatedLayout,
      undoStack: [...state.undoStack, undoAction],
      redoStack: [] // Clear redo stack on new action
    }));
    
    // Persist to backend
    try {
      await get().saveLayout(token);
    } catch (error) {
      // Revert on error
      set(state => ({
        layout: layout,
        undoStack: state.undoStack.slice(0, -1)
      }));
      toast.error('Move target not implemented with ThingsBoard yet');
    }
  },
  
  createGroup: async (name, targetIds, token) => {
    if (targetIds.length < 2) {
      toast.error('Select at least two targets to create a group');
      return;
    }
    
    // Generate a new group ID (UUID-like string)
    const newGroupId = `group-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newGroup = {
      id: newGroupId,
      name,
      targetIds
    };
    
    // Add to undo stack
    const undoAction: UndoAction = {
      type: 'group',
      previous: null,
      current: newGroup
    };
    
    // Update local state
    set(state => ({
      groups: [...state.groups, newGroup],
      selectedIds: [],
      selectedGroupId: newGroupId,
      undoStack: [...state.undoStack, undoAction],
      redoStack: []
    }));
    
    // Persist to backend
    try {
      await API.createGroup(get().roomId!, newGroup);
      toast.success('Group created');
    } catch (error) {
      // Revert on error
      set(state => ({
        groups: state.groups.filter(g => g.id !== newGroupId),
        undoStack: state.undoStack.slice(0, -1)
      }));
      toast.error('Create group not implemented with ThingsBoard yet');
    }
  },
  
  renameGroup: async (groupId, name, token) => {
    const { groups } = get();
    const groupIndex = groups.findIndex(g => g.id === groupId);
    
    if (groupIndex === -1) return;
    
    const oldName = groups[groupIndex].name;
    
    // Add to undo stack
    const undoAction: UndoAction = {
      type: 'rename',
      previous: { id: groupId, name: oldName },
      current: { id: groupId, name }
    };
    
    // Update local state
    const updatedGroups = [...groups];
    updatedGroups[groupIndex] = { ...updatedGroups[groupIndex], name };
    
    set(state => ({
      groups: updatedGroups,
      undoStack: [...state.undoStack, undoAction],
      redoStack: []
    }));
    
    // Persist to backend
    try {
      await API.updateGroup(get().roomId!, { id: groupId, name });
      toast.success('Group renamed');
    } catch (error) {
      // Revert on error
      set(state => ({
        groups: groups,
        undoStack: state.undoStack.slice(0, -1)
      }));
      toast.error('Rename group not implemented with ThingsBoard yet');
    }
  },
  
  ungroupTargets: async (groupId, token) => {
    const { groups } = get();
    const group = groups.find(g => g.id === groupId);
    
    if (!group) return;
    
    // Add to undo stack
    const undoAction: UndoAction = {
      type: 'ungroup',
      previous: group,
      current: null
    };
    
    // Update local state
    set(state => ({
      groups: state.groups.filter(g => g.id !== groupId),
      selectedIds: group.targetIds,
      selectedGroupId: null,
      undoStack: [...state.undoStack, undoAction],
      redoStack: []
    }));
    
    // Persist to backend
    try {
      await API.deleteGroup(get().roomId!, { id: groupId });
      toast.success('Group deleted');
    } catch (error) {
      // Revert on error
      set(state => ({
        groups: groups,
        selectedIds: [],
        selectedGroupId: groupId,
        undoStack: state.undoStack.slice(0, -1)
      }));
      toast.error('Ungroup targets not implemented with ThingsBoard yet');
    }
  },
  
  selectTargets: (ids) => {
    set({ selectedIds: ids, selectedGroupId: null });
  },
  
  selectGroup: (groupId) => {
    set({ selectedGroupId: groupId, selectedIds: [] });
  },
  
  toggleSnapToGrid: () => {
    set(state => ({ snapToGrid: !state.snapToGrid }));
  },
  
  setGridSize: (size) => {
    set({ gridSize: size });
  },
  
  undo: async (token) => {
    const { undoStack } = get();
    
    if (undoStack.length === 0) return;
    
    const lastAction = undoStack[undoStack.length - 1];
    
    // Apply undo based on action type
    switch (lastAction.type) {
      case 'move': {
        const { id, position } = lastAction.previous;
        const targetIndex = get().layout.findIndex(t => t.id === id);
        
        if (targetIndex !== -1) {
          const updatedLayout = [...get().layout];
          updatedLayout[targetIndex] = { ...updatedLayout[targetIndex], x: position.x, y: position.y };
          
          set(state => ({
            layout: updatedLayout,
            undoStack: state.undoStack.slice(0, -1),
            redoStack: [...state.redoStack, lastAction]
          }));
        }
        break;
      }
      case 'group': {
        // Remove the group
        set(state => ({
          groups: state.groups.filter(g => g.id !== lastAction.current.id),
          undoStack: state.undoStack.slice(0, -1),
          redoStack: [...state.redoStack, lastAction],
          selectedIds: lastAction.current.targetIds,
          selectedGroupId: null
        }));
        break;
      }
      case 'ungroup': {
        // Restore the group
        set(state => ({
          groups: [...state.groups, lastAction.previous],
          undoStack: state.undoStack.slice(0, -1),
          redoStack: [...state.redoStack, lastAction],
          selectedIds: [],
          selectedGroupId: lastAction.previous.id
        }));
        break;
      }
      case 'rename': {
        const { id, name } = lastAction.previous;
        const groupIndex = get().groups.findIndex(g => g.id === id);
        
        if (groupIndex !== -1) {
          const updatedGroups = [...get().groups];
          updatedGroups[groupIndex] = { ...updatedGroups[groupIndex], name };
          
          set(state => ({
            groups: updatedGroups,
            undoStack: state.undoStack.slice(0, -1),
            redoStack: [...state.redoStack, lastAction]
          }));
        }
        break;
      }
    }
    
    // Persist changes to backend
    await get().saveLayout(token);
  },
  
  redo: async (token) => {
    const { redoStack } = get();
    
    if (redoStack.length === 0) return;
    
    const lastAction = redoStack[redoStack.length - 1];
    
    // Apply redo based on action type
    switch (lastAction.type) {
      case 'move': {
        const { id, position } = lastAction.current;
        const targetIndex = get().layout.findIndex(t => t.id === id);
        
        if (targetIndex !== -1) {
          const updatedLayout = [...get().layout];
          updatedLayout[targetIndex] = { ...updatedLayout[targetIndex], x: position.x, y: position.y };
          
          set(state => ({
            layout: updatedLayout,
            redoStack: state.redoStack.slice(0, -1),
            undoStack: [...state.undoStack, lastAction]
          }));
        }
        break;
      }
      case 'group': {
        // Restore the group
        set(state => ({
          groups: [...state.groups, lastAction.current],
          redoStack: state.redoStack.slice(0, -1),
          undoStack: [...state.undoStack, lastAction],
          selectedIds: [],
          selectedGroupId: lastAction.current.id
        }));
        break;
      }
      case 'ungroup': {
        // Remove the group again
        set(state => ({
          groups: state.groups.filter(g => g.id !== lastAction.previous.id),
          redoStack: state.redoStack.slice(0, -1),
          undoStack: [...state.undoStack, lastAction],
          selectedIds: lastAction.previous.targetIds,
          selectedGroupId: null
        }));
        break;
      }
      case 'rename': {
        const { id, name } = lastAction.current;
        const groupIndex = get().groups.findIndex(g => g.id === id);
        
        if (groupIndex !== -1) {
          const updatedGroups = [...get().groups];
          updatedGroups[groupIndex] = { ...updatedGroups[groupIndex], name };
          
          set(state => ({
            groups: updatedGroups,
            redoStack: state.redoStack.slice(0, -1),
            undoStack: [...state.undoStack, lastAction]
          }));
        }
        break;
      }
    }
    
    // Persist changes to backend
    await get().saveLayout(token);
  },
  
  saveLayout: async (token) => {
    const { roomId, layout, groups, floorPlan } = get();
    if (!roomId) return false;
    
    try {
      const floorPlanData = floorPlan ? {
        layout: floorPlan,
        canvasWidth: 600,
        canvasHeight: 750,
        viewportScale: 1.0,
        viewportX: 0,
        viewportY: 0,
      } : undefined;
      
      await API.saveRoomLayout(roomId, layout, groups, floorPlanData);
      toast.success('Layout saved');
      return true;
    } catch (error) {
      toast.error('Failed to save layout');
      return false;
    }
  },
  
  // Floor plan methods
  setDrawingMode: (mode) => {
    set({ drawingMode: mode, selectedFloorPlanElement: null });
  },
  
  addWall: (wall) => {
    const { floorPlan } = get();
    const currentWalls = floorPlan?.walls || [];
    set({
      floorPlan: {
        ...floorPlan,
        walls: [...currentWalls, wall],
      } as FloorPlanLayout,
    });
  },
  
  addRoom: async (room, token) => {
    const { floorPlan } = get();
    const currentRooms = floorPlan?.rooms || [];
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/833eaf25-0547-420d-a570-1d7cab6b5873',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useRoomDesigner.ts:addRoom',message:'Adding room to state',data:{roomId:room.id,points:room.points},timestamp:Date.now(),sessionId:'debug-session',runId:'placement-debug',hypothesisId:'G'})}).catch(()=>{});
    // #endregion
    set({
      floorPlan: {
        ...floorPlan,
        rooms: [...currentRooms, room],
      } as FloorPlanLayout,
    });
    // Save immediately to prevent state loss
    if (token) {
      await get().saveLayout(token);
    }
  },
  
  addDoor: async (door, token) => {
    const { floorPlan } = get();
    const currentDoors = floorPlan?.doors || [];
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/833eaf25-0547-420d-a570-1d7cab6b5873',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useRoomDesigner.ts:addDoor',message:'Adding door to state',data:{doorId:door.id,doorX:door.x,doorY:door.y},timestamp:Date.now(),sessionId:'debug-session',runId:'placement-debug',hypothesisId:'G'})}).catch(()=>{});
    // #endregion
    set({
      floorPlan: {
        ...floorPlan,
        doors: [...currentDoors, door],
      } as FloorPlanLayout,
    });
    // Save immediately to prevent state loss
    if (token) {
      await get().saveLayout(token);
    }
  },
  
  addWindow: async (window, token) => {
    const { floorPlan } = get();
    const currentWindows = floorPlan?.windows || [];
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/833eaf25-0547-420d-a570-1d7cab6b5873',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useRoomDesigner.ts:addWindow',message:'Adding window to state',data:{windowId:window.id,windowX:window.x,windowY:window.y},timestamp:Date.now(),sessionId:'debug-session',runId:'placement-debug',hypothesisId:'G'})}).catch(()=>{});
    // #endregion
    set({
      floorPlan: {
        ...floorPlan,
        windows: [...currentWindows, window],
      } as FloorPlanLayout,
    });
    // Save immediately to prevent state loss
    if (token) {
      await get().saveLayout(token);
    }
  },
  
  deleteFloorPlanElement: (id, type) => {
    const { floorPlan } = get();
    if (!floorPlan) return;
    
    let updatedFloorPlan: FloorPlanLayout = { ...floorPlan };
    
    switch (type) {
      case 'wall':
        updatedFloorPlan.walls = (floorPlan.walls || []).filter(w => w.id !== id);
        break;
      case 'room':
        updatedFloorPlan.rooms = (floorPlan.rooms || []).filter(r => r.id !== id);
        break;
      case 'door':
        updatedFloorPlan.doors = (floorPlan.doors || []).filter(d => d.id !== id);
        break;
      case 'window':
        updatedFloorPlan.windows = (floorPlan.windows || []).filter(w => w.id !== id);
        break;
    }
    
    set({ floorPlan: updatedFloorPlan, selectedFloorPlanElement: null });
  },
  
  updateFloorPlanElement: async (id, type, updates, token) => {
    const { floorPlan } = get();
    if (!floorPlan) return;
    
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/833eaf25-0547-420d-a570-1d7cab6b5873',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useRoomDesigner.ts:updateFloorPlanElement',message:'Updating floor plan element',data:{id,type,updates},timestamp:Date.now(),sessionId:'debug-session',runId:'drag-debug',hypothesisId:'E'})}).catch(()=>{});
    // #endregion
    
    let updatedFloorPlan: FloorPlanLayout = { ...floorPlan };
    
    switch (type) {
      case 'wall':
        updatedFloorPlan.walls = (floorPlan.walls || []).map(w => 
          w.id === id ? { ...w, ...updates } : w
        );
        break;
      case 'room':
        updatedFloorPlan.rooms = (floorPlan.rooms || []).map(r => 
          r.id === id ? { ...r, ...updates } : r
        );
        break;
      case 'door':
        updatedFloorPlan.doors = (floorPlan.doors || []).map(d => 
          d.id === id ? { ...d, ...updates } : d
        );
        break;
      case 'window':
        updatedFloorPlan.windows = (floorPlan.windows || []).map(w => 
          w.id === id ? { ...w, ...updates } : w
        );
        break;
    }
    
    set({ floorPlan: updatedFloorPlan });
    
    // Save immediately to prevent state loss
    if (token) {
      await get().saveLayout(token);
    }
  },
  
  rotateFloorPlanElement: async (id, type, token) => {
    const { floorPlan } = get();
    if (!floorPlan) return;
    
    let currentRotation = 0;
    let element: Door | Window | RoomShape | null = null;
    
    if (type === 'door') {
      element = floorPlan.doors?.find(d => d.id === id) || null;
      currentRotation = element?.rotation || 0;
    } else if (type === 'window') {
      element = floorPlan.windows?.find(w => w.id === id) || null;
      currentRotation = element?.rotation || 0;
    } else if (type === 'room') {
      element = floorPlan.rooms?.find(r => r.id === id) || null;
      currentRotation = element?.rotation || 0;
    } else {
      // Walls don't support rotation
      return;
    }
    
    if (!element) return;
    
    // Rotate by 90 degrees
    const newRotation = (currentRotation + 90) % 360;
    
    await get().updateFloorPlanElement(id, type, { rotation: newRotation }, token);
  },
  
  selectFloorPlanElement: (id) => {
    set({ selectedFloorPlanElement: id });
  },
}));
