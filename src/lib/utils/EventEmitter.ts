
/**
 * Simple browser-compatible EventEmitter implementation
 */
export class EventEmitter {
  private events: Record<string, Function[]> = {};

  /**
   * Register an event listener
   */
  on(event: string, listener: (...args: any[]) => void): this {
    if (!this.events[event]) {
      this.events[event] = [];
    }
    this.events[event].push(listener);
    return this;
  }

  /**
   * Remove an event listener
   */
  off(event: string, listener: (...args: any[]) => void): this {
    if (this.events[event]) {
      this.events[event] = this.events[event].filter(l => l !== listener);
    }
    return this;
  }

  /**
   * Emit an event
   */
  emit(event: string, ...args: any[]): this {
    if (this.events[event]) {
      this.events[event].forEach(listener => listener(...args));
    }
    return this;
  }
}
