/**
 * Shared Validation Helpers
 * 
 * Common validation functions used across domain modules.
 * Pure functions with no external dependencies.
 */

import { z } from 'zod';

/**
 * Validation result type
 */
export type ValidationResult<T> = 
  | { success: true; data: T }
  | { success: false; errors: ValidationError[] };

export type ValidationError = {
  field: string;
  message: string;
  code: string;
};

/**
 * Validate data against a Zod schema and return a standardized result
 */
export function validateWithSchema<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): ValidationResult<T> {
  const result = schema.safeParse(data);
  
  if (result.success) {
    return { success: true, data: result.data };
  }
  
  const errors: ValidationError[] = result.error.errors.map((err) => ({
    field: err.path.join('.'),
    message: err.message,
    code: err.code,
  }));
  
  return { success: false, errors };
}

/**
 * Check if a string is a valid UUID
 */
export function isValidUuid(value: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(value);
}

/**
 * Check if a string is non-empty after trimming
 */
export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Check if a value is a positive number
 */
export function isPositiveNumber(value: unknown): value is number {
  return typeof value === 'number' && value > 0 && Number.isFinite(value);
}

/**
 * Check if a value is a non-negative integer
 */
export function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

/**
 * Normalize a string for comparison (lowercase, trimmed)
 */
export function normalizeString(value: string): string {
  return value.toLowerCase().trim();
}

/**
 * Check if two strings are equal (case-insensitive)
 */
export function stringsEqualIgnoreCase(a: string, b: string): boolean {
  return normalizeString(a) === normalizeString(b);
}

/**
 * Sanitize a string for safe display (removes potential XSS)
 */
export function sanitizeDisplayString(value: string): string {
  return value
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

/**
 * Truncate a string to a maximum length with ellipsis
 */
export function truncateString(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, maxLength - 3)}...`;
}

