/**
 * Performance monitoring utility for tracking page load and operation timing
 */

interface PerformanceMark {
  name: string;
  timestamp: number;
  duration?: number;
}

const marks: PerformanceMark[] = [];
const startTime = typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();

/**
 * Mark a performance checkpoint
 */
export function mark(name: string): void {
  const now = typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
  const relativeTime = typeof performance !== 'undefined' && performance.now 
    ? now - startTime 
    : now - startTime;
  
  marks.push({
    name,
    timestamp: relativeTime,
  });
  
  if (typeof performance !== 'undefined' && performance.mark) {
    performance.mark(name);
  }
}

/**
 * Measure time between two marks
 */
export function measure(name: string, startMark: string, endMark?: string): number {
  if (typeof performance !== 'undefined' && performance.measure) {
    try {
      performance.measure(name, startMark, endMark);
      const measure = performance.getEntriesByName(name, 'measure')[0];
      return measure.duration;
    } catch {
      // Fallback if marks don't exist
    }
  }
  
  // Fallback calculation
  const start = marks.find(m => m.name === startMark);
  const end = endMark ? marks.find(m => m.name === endMark) : marks[marks.length - 1];
  
  if (start && end) {
    return end.timestamp - start.timestamp;
  }
  
  return 0;
}

/**
 * Log all performance marks (for debugging)
 */
export function logPerformanceSummary(): void {
  if (marks.length === 0) return;
  
  console.group('⚡ Performance Summary');
  marks.forEach((mark, index) => {
    const prevMark = index > 0 ? marks[index - 1] : null;
    const duration = prevMark ? mark.timestamp - prevMark.timestamp : 0;
    console.log(`${mark.name}: ${mark.timestamp.toFixed(2)}ms${duration > 0 ? ` (+${duration.toFixed(2)}ms)` : ''}`);
  });
  
  const totalTime = marks[marks.length - 1]?.timestamp || 0;
  console.log(`Total: ${totalTime.toFixed(2)}ms`);
  console.groupEnd();
}

/**
 * Clear all performance marks
 */
export function clearMarks(): void {
  marks.length = 0;
  if (typeof performance !== 'undefined' && performance.clearMarks) {
    performance.clearMarks();
    performance.clearMeasures();
  }
}



