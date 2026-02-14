/**
 * Room Editor constants — colors, sizes, defaults
 * All colors match Design Gospel Phase 1 brand colors.
 */

// Canvas defaults
export const DEFAULT_CANVAS_WIDTH = 1200;
export const DEFAULT_CANVAS_HEIGHT = 800;
export const DEFAULT_GRID_SIZE = 20;

// Zoom limits
export const MIN_ZOOM = 0.25;
export const MAX_ZOOM = 4.0;
export const ZOOM_STEP = 0.1;

// Wall drawing
export const WALL_STROKE_WIDTH = 6;
export const WALL_HIT_STROKE_WIDTH = 20;
export const WALL_CLOSE_THRESHOLD = 15; // px distance to close polygon
export const CORNER_ANCHOR_RADIUS = 5;

// Door / window defaults
export const DEFAULT_DOOR_WIDTH = 3; // grid units
export const DEFAULT_WINDOW_WIDTH = 3; // grid units
export const DEFAULT_SWING_ANGLE = 90;

// Target shape
export const TARGET_RADIUS = 16;
export const TARGET_LABEL_OFFSET = 24;

// Colors — from Design Gospel Phase 1
export const EDITOR_COLORS = {
  // Canvas
  canvasBackground: '#F6F7EB', // var(--background) ivory
  gridStroke: 'rgba(28,25,43,0.06)', // CHART_STYLE.gridStroke

  // Walls
  wallStroke: '#1C192B', // brand-dark
  wallSelectedStroke: '#CE3E0A', // brand-primary
  wallDraftStroke: '#CE3E0A', // brand-primary
  wallDraftDash: [8, 6],
  cornerAnchorFill: '#FFFFFF',
  cornerAnchorStroke: '#1C192B',
  cornerAnchorSelectedStroke: '#CE3E0A',

  // Doors
  doorStroke: '#1C192B',
  doorArcStroke: 'rgba(28,25,43,0.3)',
  doorArcDash: [4, 4],

  // Windows
  windowStroke: '#816E94', // brand-secondary

  // Targets
  targetFill: 'rgba(206,62,10,0.1)',
  targetStroke: '#CE3E0A', // brand-primary
  targetCenterDot: '#CE3E0A',
  targetLabelColor: '#1C192B',

  // Selection
  selectionStroke: '#CE3E0A',
  selectionFill: 'rgba(206,62,10,0.05)',
  transformerAnchorStroke: '#CE3E0A',
  transformerAnchorFill: '#FFFFFF',

  // Status dots
  statusOnline: '#22c55e',
  statusStandby: '#f59e0b',
  statusOffline: '#9ca3af',
} as const;

// Tool types
export type ToolType = 'select' | 'wall' | 'door' | 'window' | 'target' | 'delete';

// Auto-save debounce delay (ms)
export const AUTO_SAVE_DELAY = 3000;
