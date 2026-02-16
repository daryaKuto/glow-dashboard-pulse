/**
 * Zustand store for Room Editor state
 *
 * Three-layer state separation:
 * 1. Document State — walls, doors, windows, targets (persisted)
 * 2. Interaction State — active tool, selection, drawing mode
 * 3. History State — undo/redo snapshots
 * 4. Viewport State — zoom, pan, grid
 */

import { create } from 'zustand';
import type {
  WallData,
  DoorData,
  WindowData,
  PlacedTargetData,
  DocumentSnapshot,
} from '../lib/types';
import type { ToolType } from '../lib/constants';
import {
  DEFAULT_CANVAS_WIDTH,
  DEFAULT_CANVAS_HEIGHT,
  DEFAULT_GRID_SIZE,
  WALL_STROKE_WIDTH,
  DEFAULT_ROOM_WIDTH_UNITS,
  DEFAULT_ROOM_HEIGHT_UNITS,
} from '../lib/constants';
import { snapToGrid } from '../lib/geometry';

const MAX_HISTORY = 50;

interface RoomEditorState {
  // ── Document State (persisted) ──
  walls: WallData[];
  doors: DoorData[];
  windows: WindowData[];
  targets: PlacedTargetData[];
  canvasWidth: number;
  canvasHeight: number;
  roomName: string;

  // ── Interaction State ──
  activeTool: ToolType;
  selectedIds: string[];
  isDrawingWall: boolean;
  wallDraftPoints: number[];
  hoveredId: string | null;
  isDirty: boolean;

  // ── History State ──
  history: DocumentSnapshot[];
  historyIndex: number;

  // ── Viewport State ──
  stageScale: number;
  stagePosition: { x: number; y: number };
  gridSize: number;

  // ── Document Actions ──
  addWall: (wall: WallData) => void;
  updateWall: (id: string, updates: Partial<WallData>) => void;
  removeWall: (id: string) => void;
  addDoor: (door: DoorData) => void;
  updateDoor: (id: string, updates: Partial<DoorData>) => void;
  removeDoor: (id: string) => void;
  addWindow: (window: WindowData) => void;
  updateWindow: (id: string, updates: Partial<WindowData>) => void;
  removeWindow: (id: string) => void;
  addTarget: (target: PlacedTargetData) => void;
  updateTarget: (id: string, updates: Partial<PlacedTargetData>) => void;
  removeTarget: (id: string) => void;

  addPrebuiltRoom: (containerWidth?: number, containerHeight?: number) => void;

  // ── Interaction Actions ──
  setActiveTool: (tool: ToolType) => void;
  setSelectedIds: (ids: string[]) => void;
  toggleSelection: (id: string) => void;
  clearSelection: () => void;
  setIsDrawingWall: (drawing: boolean) => void;
  setWallDraftPoints: (points: number[]) => void;
  addWallDraftPoint: (x: number, y: number) => void;
  clearWallDraft: () => void;
  setHoveredId: (id: string | null) => void;
  deleteSelected: () => void;

  // ── History Actions ──
  saveToHistory: () => void;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;

  // ── Viewport Actions ──
  setStageScale: (scale: number) => void;
  setStagePosition: (pos: { x: number; y: number }) => void;
  setGridSize: (size: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  resetZoom: () => void;

  // ── Move Action ──
  moveSelected: (dx: number, dy: number) => void;

  // ── Bulk Actions ──
  setCanvasSize: (width: number, height: number) => void;
  setRoomName: (name: string) => void;
  loadDocument: (snapshot: DocumentSnapshot, canvasWidth: number, canvasHeight: number, gridSize: number) => void;
  getDocumentSnapshot: () => DocumentSnapshot;
  reset: () => void;
  markClean: () => void;
}

function createDocumentSnapshot(state: RoomEditorState): DocumentSnapshot {
  return {
    walls: JSON.parse(JSON.stringify(state.walls)),
    doors: JSON.parse(JSON.stringify(state.doors)),
    windows: JSON.parse(JSON.stringify(state.windows)),
    targets: JSON.parse(JSON.stringify(state.targets)),
  };
}

export const useRoomEditorStore = create<RoomEditorState>((set, get) => ({
  // ── Initial Document State ──
  walls: [],
  doors: [],
  windows: [],
  targets: [],
  canvasWidth: DEFAULT_CANVAS_WIDTH,
  canvasHeight: DEFAULT_CANVAS_HEIGHT,
  roomName: '',

  // ── Initial Interaction State ──
  activeTool: 'select',
  selectedIds: [],
  isDrawingWall: false,
  wallDraftPoints: [],
  hoveredId: null,
  isDirty: false,

  // ── Initial History State ──
  history: [],
  historyIndex: -1,

  // ── Initial Viewport State ──
  stageScale: 1,
  stagePosition: { x: 0, y: 0 },
  gridSize: DEFAULT_GRID_SIZE,

  // ── Document Actions ──
  addWall: (wall) => {
    get().saveToHistory();
    set((s) => ({ walls: [...s.walls, wall], isDirty: true }));
  },

  updateWall: (id, updates) => {
    get().saveToHistory();
    set((s) => ({
      walls: s.walls.map((w) => (w.id === id ? { ...w, ...updates } : w)),
      isDirty: true,
    }));
  },

  removeWall: (id) => {
    get().saveToHistory();
    set((s) => ({
      walls: s.walls.filter((w) => w.id !== id),
      // Also remove doors/windows attached to this wall
      doors: s.doors.filter((d) => d.wallId !== id),
      windows: s.windows.filter((w) => w.wallId !== id),
      isDirty: true,
    }));
  },

  addDoor: (door) => {
    get().saveToHistory();
    set((s) => ({ doors: [...s.doors, door], isDirty: true }));
  },

  updateDoor: (id, updates) => {
    get().saveToHistory();
    set((s) => ({
      doors: s.doors.map((d) => (d.id === id ? { ...d, ...updates } : d)),
      isDirty: true,
    }));
  },

  removeDoor: (id) => {
    get().saveToHistory();
    set((s) => ({ doors: s.doors.filter((d) => d.id !== id), isDirty: true }));
  },

  addWindow: (win) => {
    get().saveToHistory();
    set((s) => ({ windows: [...s.windows, win], isDirty: true }));
  },

  updateWindow: (id, updates) => {
    get().saveToHistory();
    set((s) => ({
      windows: s.windows.map((w) => (w.id === id ? { ...w, ...updates } : w)),
      isDirty: true,
    }));
  },

  removeWindow: (id) => {
    get().saveToHistory();
    set((s) => ({ windows: s.windows.filter((w) => w.id !== id), isDirty: true }));
  },

  addTarget: (target) => {
    get().saveToHistory();
    set((s) => ({ targets: [...s.targets, target], isDirty: true }));
  },

  updateTarget: (id, updates) => {
    get().saveToHistory();
    set((s) => ({
      targets: s.targets.map((t) => (t.id === id ? { ...t, ...updates } : t)),
      isDirty: true,
    }));
  },

  removeTarget: (id) => {
    get().saveToHistory();
    set((s) => ({ targets: s.targets.filter((t) => t.id !== id), isDirty: true }));
  },

  addPrebuiltRoom: (containerWidth, containerHeight) => {
    const state = get();
    state.saveToHistory();

    const grid = state.gridSize;
    const roomW = DEFAULT_ROOM_WIDTH_UNITS * grid;
    const roomH = DEFAULT_ROOM_HEIGHT_UNITS * grid;

    // Calculate visible center in canvas coordinates
    const viewW = containerWidth ?? state.canvasWidth;
    const viewH = containerHeight ?? state.canvasHeight;
    const centerX = snapToGrid(
      (viewW / 2 - state.stagePosition.x) / state.stageScale,
      grid
    );
    const centerY = snapToGrid(
      (viewH / 2 - state.stagePosition.y) / state.stageScale,
      grid
    );

    const x = snapToGrid(centerX - roomW / 2, grid);
    const y = snapToGrid(centerY - roomH / 2, grid);

    const newWall: WallData = {
      id: crypto.randomUUID(),
      points: [
        x,         y,           // top-left
        x + roomW, y,           // top-right
        x + roomW, y + roomH,   // bottom-right
        x,         y + roomH,   // bottom-left
      ],
      thickness: WALL_STROKE_WIDTH,
      closed: true,
    };

    set({
      walls: [...state.walls, newWall],
      isDirty: true,
      selectedIds: [newWall.id],
      activeTool: 'select',
    });
  },

  // ── Interaction Actions ──
  setActiveTool: (tool) =>
    set({
      activeTool: tool,
      isDrawingWall: false,
      wallDraftPoints: [],
      selectedIds: [],
    }),

  setSelectedIds: (ids) => set({ selectedIds: ids }),

  toggleSelection: (id) =>
    set((s) => ({
      selectedIds: s.selectedIds.includes(id)
        ? s.selectedIds.filter((i) => i !== id)
        : [...s.selectedIds, id],
    })),

  clearSelection: () => set({ selectedIds: [] }),

  setIsDrawingWall: (drawing) => set({ isDrawingWall: drawing }),

  setWallDraftPoints: (points) => set({ wallDraftPoints: points }),

  addWallDraftPoint: (x, y) =>
    set((s) => ({ wallDraftPoints: [...s.wallDraftPoints, x, y] })),

  clearWallDraft: () => set({ wallDraftPoints: [], isDrawingWall: false }),

  setHoveredId: (id) => set({ hoveredId: id }),

  deleteSelected: () => {
    const state = get();
    if (state.selectedIds.length === 0) return;
    state.saveToHistory();
    set((s) => ({
      walls: s.walls.filter((w) => !s.selectedIds.includes(w.id)),
      doors: s.doors.filter((d) => {
        // Remove doors if directly selected OR if their parent wall is selected
        if (s.selectedIds.includes(d.id)) return false;
        if (s.selectedIds.includes(d.wallId)) return false;
        return true;
      }),
      windows: s.windows.filter((w) => {
        if (s.selectedIds.includes(w.id)) return false;
        if (s.selectedIds.includes(w.wallId)) return false;
        return true;
      }),
      targets: s.targets.filter((t) => !s.selectedIds.includes(t.id)),
      selectedIds: [],
      isDirty: true,
    }));
  },

  // ── History Actions ──
  saveToHistory: () =>
    set((s) => {
      const snapshot = createDocumentSnapshot(s);
      // Truncate any redo history beyond current index
      const newHistory = s.history.slice(0, s.historyIndex + 1);
      newHistory.push(snapshot);
      // Cap history size
      if (newHistory.length > MAX_HISTORY) {
        newHistory.shift();
      }
      return {
        history: newHistory,
        historyIndex: newHistory.length - 1,
      };
    }),

  undo: () =>
    set((s) => {
      if (s.historyIndex < 0) return s;
      const snapshot = s.history[s.historyIndex];
      return {
        walls: JSON.parse(JSON.stringify(snapshot.walls)),
        doors: JSON.parse(JSON.stringify(snapshot.doors)),
        windows: JSON.parse(JSON.stringify(snapshot.windows)),
        targets: JSON.parse(JSON.stringify(snapshot.targets)),
        historyIndex: s.historyIndex - 1,
        selectedIds: [],
        isDirty: true,
      };
    }),

  redo: () =>
    set((s) => {
      if (s.historyIndex >= s.history.length - 1) return s;
      const nextIndex = s.historyIndex + 1;
      // The snapshot at nextIndex+1 is the state we want to restore to
      // Actually: history[i] represents state BEFORE action i.
      // To redo, we need to go to the state that was saved when the next action happened.
      // We stored snapshots before each action, so redo means advancing the index
      // and applying the snapshot at historyIndex + 2 if it exists.
      // Simpler: re-implement as storing full state snapshots.
      if (nextIndex + 1 < s.history.length) {
        const snapshot = s.history[nextIndex + 1];
        return {
          walls: JSON.parse(JSON.stringify(snapshot.walls)),
          doors: JSON.parse(JSON.stringify(snapshot.doors)),
          windows: JSON.parse(JSON.stringify(snapshot.windows)),
          targets: JSON.parse(JSON.stringify(snapshot.targets)),
          historyIndex: nextIndex,
          selectedIds: [],
          isDirty: true,
        };
      }
      return { historyIndex: nextIndex };
    }),

  canUndo: () => get().historyIndex >= 0,
  canRedo: () => get().historyIndex < get().history.length - 1,

  // ── Viewport Actions ──
  setStageScale: (scale) => set({ stageScale: scale }),
  setStagePosition: (pos) => set({ stagePosition: pos }),
  setGridSize: (size) => set({ gridSize: size }),

  zoomIn: () =>
    set((s) => ({ stageScale: Math.min(s.stageScale + 0.1, 4) })),

  zoomOut: () =>
    set((s) => ({ stageScale: Math.max(s.stageScale - 0.1, 0.25) })),

  resetZoom: () =>
    set({ stageScale: 1, stagePosition: { x: 0, y: 0 } }),

  // ── Move Action ──
  moveSelected: (dx, dy) => {
    const state = get();
    if (state.selectedIds.length === 0 || (dx === 0 && dy === 0)) return;
    state.saveToHistory();
    const sel = new Set(state.selectedIds);

    // Collect wallIds of selected walls (doors/windows on moved walls move implicitly)
    const movedWallIds = new Set(
      state.walls.filter((w) => sel.has(w.id)).map((w) => w.id)
    );

    set({
      walls: state.walls.map((w) => {
        if (!sel.has(w.id)) return w;
        return {
          ...w,
          points: w.points.map((v, i) => v + (i % 2 === 0 ? dx : dy)),
        };
      }),
      doors: state.doors.map((d) => {
        // Doors on moved walls: no change needed (they reference wall by ID + positionOnWall)
        // Doors selected directly but wall NOT selected: cannot move independently (skip)
        return d;
      }),
      windows: state.windows.map((w) => {
        // Same as doors — position is relative to wall
        return w;
      }),
      targets: state.targets.map((t) => {
        if (!sel.has(t.id)) return t;
        return { ...t, x: t.x + dx, y: t.y + dy };
      }),
      isDirty: true,
    });
  },

  // ── Bulk Actions ──
  setCanvasSize: (width, height) => set({ canvasWidth: width, canvasHeight: height }),

  setRoomName: (name) => set({ roomName: name, isDirty: true }),

  loadDocument: (snapshot, canvasWidth, canvasHeight, gridSize) =>
    set({
      walls: snapshot.walls,
      doors: snapshot.doors,
      windows: snapshot.windows,
      targets: snapshot.targets,
      canvasWidth,
      canvasHeight,
      gridSize,
      isDirty: false,
      history: [],
      historyIndex: -1,
      selectedIds: [],
      activeTool: 'select',
      isDrawingWall: false,
      wallDraftPoints: [],
    }),

  getDocumentSnapshot: () => createDocumentSnapshot(get()),

  reset: () =>
    set({
      walls: [],
      doors: [],
      windows: [],
      targets: [],
      canvasWidth: DEFAULT_CANVAS_WIDTH,
      canvasHeight: DEFAULT_CANVAS_HEIGHT,
      roomName: '',
      activeTool: 'select',
      selectedIds: [],
      isDrawingWall: false,
      wallDraftPoints: [],
      hoveredId: null,
      isDirty: false,
      history: [],
      historyIndex: -1,
      stageScale: 1,
      stagePosition: { x: 0, y: 0 },
      gridSize: DEFAULT_GRID_SIZE,
    }),

  markClean: () => set({ isDirty: false }),
}));
