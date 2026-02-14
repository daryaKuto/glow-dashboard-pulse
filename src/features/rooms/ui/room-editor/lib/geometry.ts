/**
 * Geometry utilities for the room editor
 * Point-to-line projection, distance, angle calculations
 */

import type { Point, WallData, WallSnapResult } from './types';

/** Distance between two points */
export function distance(a: Point, b: Point): number {
  return Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2);
}

/** Snap a value to the nearest grid increment */
export function snapToGrid(value: number, gridSize: number): number {
  return Math.round(value / gridSize) * gridSize;
}

/** Snap a point to the nearest grid intersection */
export function snapPointToGrid(point: Point, gridSize: number): Point {
  return {
    x: snapToGrid(point.x, gridSize),
    y: snapToGrid(point.y, gridSize),
  };
}

/** Angle of a line from point a to point b (radians) */
export function lineAngle(a: Point, b: Point): number {
  return Math.atan2(b.y - a.y, b.x - a.x);
}

/**
 * Project a point onto a line segment, returning the closest point
 * and the normalized position (0-1) along the segment.
 */
export function projectPointOntoSegment(
  point: Point,
  segStart: Point,
  segEnd: Point
): { projection: Point; t: number; distance: number } {
  const dx = segEnd.x - segStart.x;
  const dy = segEnd.y - segStart.y;
  const lenSq = dx * dx + dy * dy;

  if (lenSq === 0) {
    // Degenerate segment (zero length)
    return { projection: { ...segStart }, t: 0, distance: distance(point, segStart) };
  }

  // Clamp t to [0,1] to stay on the segment
  let t = ((point.x - segStart.x) * dx + (point.y - segStart.y) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));

  const projection: Point = {
    x: segStart.x + t * dx,
    y: segStart.y + t * dy,
  };

  return {
    projection,
    t,
    distance: distance(point, projection),
  };
}

/**
 * Extract segment endpoints from a wall's flat points array.
 * Returns pairs of points for each segment.
 */
export function getWallSegments(wall: WallData): Array<[Point, Point]> {
  const segments: Array<[Point, Point]> = [];
  const { points, closed } = wall;

  for (let i = 0; i < points.length - 2; i += 2) {
    segments.push([
      { x: points[i], y: points[i + 1] },
      { x: points[i + 2], y: points[i + 3] },
    ]);
  }

  // If closed, add segment from last point back to first
  if (closed && points.length >= 4) {
    segments.push([
      { x: points[points.length - 2], y: points[points.length - 1] },
      { x: points[0], y: points[1] },
    ]);
  }

  return segments;
}

/**
 * Find the nearest wall segment to a canvas point.
 * Returns null if no wall is within maxDistance.
 */
export function findNearestWallSegment(
  point: Point,
  walls: WallData[],
  maxDistance = 30
): WallSnapResult | null {
  let best: WallSnapResult | null = null;
  let bestDist = maxDistance;

  for (const wall of walls) {
    const segments = getWallSegments(wall);
    for (let segIdx = 0; segIdx < segments.length; segIdx++) {
      const [segStart, segEnd] = segments[segIdx];
      const { projection, t, distance: dist } = projectPointOntoSegment(point, segStart, segEnd);

      if (dist < bestDist) {
        bestDist = dist;
        best = {
          wallId: wall.id,
          segmentIndex: segIdx,
          positionOnWall: t,
          snapPoint: projection,
          wallAngle: lineAngle(segStart, segEnd),
        };
      }
    }
  }

  return best;
}

/**
 * Get the position on a wall segment given wallId, segmentIndex, and positionOnWall.
 */
export function getPositionOnWall(
  wall: WallData,
  segmentIndex: number,
  positionOnWall: number
): { point: Point; angle: number } {
  const segments = getWallSegments(wall);
  if (segmentIndex < 0 || segmentIndex >= segments.length) {
    return { point: { x: 0, y: 0 }, angle: 0 };
  }

  const [start, end] = segments[segmentIndex];
  const point: Point = {
    x: start.x + positionOnWall * (end.x - start.x),
    y: start.y + positionOnWall * (end.y - start.y),
  };
  const angle = lineAngle(start, end);

  return { point, angle };
}

/**
 * Check if two points are within a threshold distance.
 */
export function isNear(a: Point, b: Point, threshold: number): boolean {
  return distance(a, b) <= threshold;
}
