/** Brand-aligned chart color palette. Use in order for multi-series charts. */
export const CHART_COLORS = [
  '#CE3E0A', // Primary - burnt orange (always first)
  '#816E94', // Secondary - purple
  '#1C192B', // Dark
  '#6B4A38', // Brown
  '#A884FF', // Lavender
  '#FF7A00', // Orange
] as const;

/** Gradient definitions reusable across charts */
export const CHART_GRADIENTS = {
  primary: { start: 'rgba(206,62,10,0.2)', end: 'rgba(206,62,10,0)' },
  secondary: { start: 'rgba(129,110,148,0.12)', end: 'rgba(129,110,148,0)' },
} as const;

/** Shared axis/grid styling constants */
export const CHART_STYLE = {
  gridStroke: 'rgba(28,25,43,0.06)',
  gridDash: '4 4',
  axisStroke: 'rgba(28,25,43,0.3)',
  axisFontSize: 10,
  axisFontFamily: 'Raleway',
  tooltipCursor: 'rgba(28,25,43,0.1)',
  barCursorFill: 'rgba(206,62,10,0.04)',
  animationDuration: 800,
  animationEasing: 'ease-out' as const,
} as const;
