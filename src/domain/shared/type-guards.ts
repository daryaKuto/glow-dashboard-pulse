/**
 * Shared Type Guards
 * 
 * Type guard functions for runtime type checking.
 * Pure functions with no external dependencies.
 */

/**
 * Check if a value is defined (not null or undefined)
 */
export function isDefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

/**
 * Check if a value is null or undefined
 */
export function isNullish(value: unknown): value is null | undefined {
  return value === null || value === undefined;
}

/**
 * Check if a value is an object (not null, not array)
 */
export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Check if a value is a non-empty array
 */
export function isNonEmptyArray<T>(value: unknown): value is T[] {
  return Array.isArray(value) && value.length > 0;
}

/**
 * Check if a value is an empty array
 */
export function isEmptyArray(value: unknown): value is [] {
  return Array.isArray(value) && value.length === 0;
}

/**
 * Check if a value is a Date object
 */
export function isDate(value: unknown): value is Date {
  return value instanceof Date && !isNaN(value.getTime());
}

/**
 * Check if a value is a valid ISO date string
 */
export function isIsoDateString(value: unknown): value is string {
  if (typeof value !== 'string') {
    return false;
  }
  const date = new Date(value);
  return !isNaN(date.getTime()) && value.includes('T');
}

/**
 * Check if a value is a function
 */
export function isFunction(value: unknown): value is (...args: unknown[]) => unknown {
  return typeof value === 'function';
}

/**
 * Check if a value has a specific property
 */
export function hasProperty<K extends string>(
  value: unknown,
  key: K
): value is Record<K, unknown> {
  return isObject(value) && key in value;
}

/**
 * Check if a value has all specified properties
 */
export function hasProperties<K extends string>(
  value: unknown,
  keys: K[]
): value is Record<K, unknown> {
  return isObject(value) && keys.every((key) => key in value);
}

/**
 * Assert that a condition is true, throw if not
 */
export function assertCondition(
  condition: boolean,
  message: string
): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

/**
 * Assert that a value is defined
 */
export function assertDefined<T>(
  value: T | null | undefined,
  message: string
): asserts value is T {
  if (value === null || value === undefined) {
    throw new Error(message);
  }
}

