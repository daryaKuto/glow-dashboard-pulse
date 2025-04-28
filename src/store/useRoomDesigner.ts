
import { create } from 'zustand';
import { fetcher } from '@/lib/api';
import { toast } from "@/components/ui/sonner";

export type Position = {
  x: number;
  y: number;
};

export type TargetLayout = {
  id: number;
  x: number;
  y: number;
};

export type TargetGroup = {
  id: number;
  name: string;
  targetIds: number[];
};

type UndoAction = {
  type: 'move' | 'group' | 'ungroup' | 'rename';
  previous: any;
  current: any;
};

interface RoomDesignerState {
  roomId: number | null;
  layout: TargetLayout[];
  groups: TargetGroup[];
  selectedIds: number[];
  selectedGroupId: number | null;
  snapToGrid: boolean;
  gridSize: number;
  undoStack: UndoAction[];
  redoStack: UndoAction[];
  
  // Methods
  setRoom: (roomId: number) => void;
  fetchLayout: (token: string) => Promise<void>;
  moveTarget: (id: number, position: Position, token: string) => Promise<void>;
  createGroup: (name: string, targetIds: number[], token: string) => Promise<void>;
  renameGroup: (groupId: number, name: string, token: string) => Promise<void>;
  ungroupTargets: (groupId: number, token: string) => Promise<void>;
  selectTargets: (ids: number[]) => void;
  selectGroup: (groupId: number | null) => void;
  toggleSnapToGrid: () => void;
  setGridSize: (size: number) => void;
  undo: (token: string) => Promise<void>;
  redo: (token: string) => Promise<void>;
  saveLayout: (token: string) => Promise<void>;
}

// Helper to snap values to grid
export const gridSnap = (value: number, gridSize: number): number => {
  return Math.round(value / gridSize) * gridSize;
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
  
  setRoom: (roomId) => {
    set({ 
      roomId,
      layout: [],
      groups: [], 
      selectedIds: [],
      selectedGroupId: null,
      undoStack: [],
      redoStack: []
    });
  },
  
  fetchLayout: async (token) => {
    const { roomId } = get();
    if (!roomId) return;
    
    try {
      const { targets, groups } = await fetcher(`/rooms/${roomId}/layout`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      set({ 
        layout: targets || [],
        groups: groups || [],
      });
    } catch (error) {
      toast.error('Failed to load room layout');
    }
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
    const undoAction = {
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
      toast.error('Failed to update target position');
    }
  },
  
  createGroup: async (name, targetIds, token) => {
    if (targetIds.length < 2) {
      toast.error('Select at least two targets to create a group');
      return;
    }
    
    // Generate a new group ID
    const newGroupId = Date.now();
    const newGroup = {
      id: newGroupId,
      name,
      targetIds
    };
    
    // Add to undo stack
    const undoAction = {
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
      await fetcher(`/rooms/${get().roomId}/groups`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({ groups: [...get().groups] })
      });
      
      toast.success('Group created');
    } catch (error) {
      // Revert on error
      set(state => ({
        groups: state.groups.filter(g => g.id !== newGroupId),
        undoStack: state.undoStack.slice(0, -1)
      }));
      toast.error('Failed to create group');
    }
  },
  
  renameGroup: async (groupId, name, token) => {
    const { groups } = get();
    const groupIndex = groups.findIndex(g => g.id === groupId);
    
    if (groupIndex === -1) return;
    
    const oldName = groups[groupIndex].name;
    
    // Add to undo stack
    const undoAction = {
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
      await fetcher(`/rooms/${get().roomId}/groups`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({ groups: updatedGroups })
      });
      
      toast.success('Group renamed');
    } catch (error) {
      // Revert on error
      set(state => ({
        groups: groups,
        undoStack: state.undoStack.slice(0, -1)
      }));
      toast.error('Failed to rename group');
    }
  },
  
  ungroupTargets: async (groupId, token) => {
    const { groups } = get();
    const group = groups.find(g => g.id === groupId);
    
    if (!group) return;
    
    // Add to undo stack
    const undoAction = {
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
      await fetcher(`/rooms/${get().roomId}/groups`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({ groups: get().groups })
      });
      
      toast.success('Group deleted');
    } catch (error) {
      // Revert on error
      set(state => ({
        groups: groups,
        selectedIds: [],
        selectedGroupId: groupId,
        undoStack: state.undoStack.slice(0, -1)
      }));
      toast.error('Failed to delete group');
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
    const { roomId, layout, groups } = get();
    if (!roomId) return;
    
    try {
      await fetcher(`/rooms/${roomId}/layout`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({ targets: layout, groups })
      });
      
      return true;
    } catch (error) {
      toast.error('Failed to save layout');
      return false;
    }
  }
}));
