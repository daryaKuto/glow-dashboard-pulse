import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import {
  validateWithSchema,
  isValidUuid,
  isNonEmptyString,
  isPositiveNumber,
  isNonNegativeInteger,
  normalizeString,
  stringsEqualIgnoreCase,
  sanitizeDisplayString,
  truncateString,
} from '../../src/domain/shared/validation-helpers';

describe('shared validation helpers', () => {
  describe('validateWithSchema', () => {
    const testSchema = z.object({
      name: z.string().min(1, 'Name is required'),
      age: z.number().min(0),
    });

    it('returns success for valid data', () => {
      const result = validateWithSchema(testSchema, { name: 'John', age: 30 });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe('John');
        expect(result.data.age).toBe(30);
      }
    });

    it('returns errors for invalid data', () => {
      const result = validateWithSchema(testSchema, { name: '', age: -1 });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.length).toBeGreaterThan(0);
        expect(result.errors[0]).toHaveProperty('field');
        expect(result.errors[0]).toHaveProperty('message');
        expect(result.errors[0]).toHaveProperty('code');
      }
    });

    it('includes correct field paths in errors', () => {
      const nestedSchema = z.object({
        user: z.object({
          email: z.string().email(),
        }),
      });

      const result = validateWithSchema(nestedSchema, { user: { email: 'invalid' } });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors[0].field).toBe('user.email');
      }
    });
  });

  describe('isValidUuid', () => {
    it('returns true for valid UUIDs', () => {
      expect(isValidUuid('123e4567-e89b-12d3-a456-426614174000')).toBe(true);
      expect(isValidUuid('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
    });

    it('returns true for uppercase UUIDs', () => {
      expect(isValidUuid('123E4567-E89B-12D3-A456-426614174000')).toBe(true);
    });

    it('returns false for invalid UUIDs', () => {
      expect(isValidUuid('not-a-uuid')).toBe(false);
      expect(isValidUuid('123e4567-e89b-12d3-a456')).toBe(false); // too short
      expect(isValidUuid('123e4567-e89b-12d3-a456-4266141740001')).toBe(false); // too long
      expect(isValidUuid('')).toBe(false);
    });

    it('returns false for UUID with invalid version', () => {
      // Version must be 1-5 (third segment first char)
      expect(isValidUuid('123e4567-e89b-62d3-a456-426614174000')).toBe(false);
    });

    it('returns false for UUID with invalid variant', () => {
      // Variant must be 8, 9, a, or b (fourth segment first char)
      expect(isValidUuid('123e4567-e89b-12d3-7456-426614174000')).toBe(false);
    });
  });

  describe('isNonEmptyString', () => {
    it('returns true for non-empty strings', () => {
      expect(isNonEmptyString('hello')).toBe(true);
      expect(isNonEmptyString('a')).toBe(true);
      expect(isNonEmptyString('  hello  ')).toBe(true);
    });

    it('returns false for empty string', () => {
      expect(isNonEmptyString('')).toBe(false);
    });

    it('returns false for whitespace-only string', () => {
      expect(isNonEmptyString('   ')).toBe(false);
      expect(isNonEmptyString('\t\n')).toBe(false);
    });

    it('returns false for non-strings', () => {
      expect(isNonEmptyString(null)).toBe(false);
      expect(isNonEmptyString(undefined)).toBe(false);
      expect(isNonEmptyString(123)).toBe(false);
      expect(isNonEmptyString(['hello'])).toBe(false);
    });
  });

  describe('isPositiveNumber', () => {
    it('returns true for positive numbers', () => {
      expect(isPositiveNumber(1)).toBe(true);
      expect(isPositiveNumber(0.5)).toBe(true);
      expect(isPositiveNumber(1000000)).toBe(true);
    });

    it('returns false for zero', () => {
      expect(isPositiveNumber(0)).toBe(false);
    });

    it('returns false for negative numbers', () => {
      expect(isPositiveNumber(-1)).toBe(false);
      expect(isPositiveNumber(-0.5)).toBe(false);
    });

    it('returns false for non-finite numbers', () => {
      expect(isPositiveNumber(Infinity)).toBe(false);
      expect(isPositiveNumber(NaN)).toBe(false);
    });

    it('returns false for non-numbers', () => {
      expect(isPositiveNumber('5')).toBe(false);
      expect(isPositiveNumber(null)).toBe(false);
      expect(isPositiveNumber(undefined)).toBe(false);
    });
  });

  describe('isNonNegativeInteger', () => {
    it('returns true for non-negative integers', () => {
      expect(isNonNegativeInteger(0)).toBe(true);
      expect(isNonNegativeInteger(1)).toBe(true);
      expect(isNonNegativeInteger(100)).toBe(true);
    });

    it('returns false for negative integers', () => {
      expect(isNonNegativeInteger(-1)).toBe(false);
    });

    it('returns false for non-integers', () => {
      expect(isNonNegativeInteger(1.5)).toBe(false);
      expect(isNonNegativeInteger(0.1)).toBe(false);
    });

    it('returns false for non-numbers', () => {
      expect(isNonNegativeInteger('0')).toBe(false);
      expect(isNonNegativeInteger(null)).toBe(false);
    });
  });

  describe('normalizeString', () => {
    it('lowercases and trims string', () => {
      expect(normalizeString('  Hello World  ')).toBe('hello world');
    });

    it('handles already normalized strings', () => {
      expect(normalizeString('hello')).toBe('hello');
    });

    it('handles empty string', () => {
      expect(normalizeString('')).toBe('');
    });
  });

  describe('stringsEqualIgnoreCase', () => {
    it('returns true for equal strings ignoring case', () => {
      expect(stringsEqualIgnoreCase('Hello', 'hello')).toBe(true);
      expect(stringsEqualIgnoreCase('HELLO', 'hello')).toBe(true);
      expect(stringsEqualIgnoreCase('HeLLo', 'hEllO')).toBe(true);
    });

    it('returns true for equal strings with whitespace differences', () => {
      expect(stringsEqualIgnoreCase('  hello  ', 'hello')).toBe(true);
      expect(stringsEqualIgnoreCase('hello', '  hello  ')).toBe(true);
    });

    it('returns false for different strings', () => {
      expect(stringsEqualIgnoreCase('hello', 'world')).toBe(false);
    });
  });

  describe('sanitizeDisplayString', () => {
    it('escapes HTML special characters', () => {
      expect(sanitizeDisplayString('<script>alert("xss")</script>')).toBe(
        '&lt;script&gt;alert(&quot;xss&quot;)&lt;&#x2F;script&gt;'
      );
    });

    it('escapes angle brackets', () => {
      expect(sanitizeDisplayString('<div>')).toBe('&lt;div&gt;');
    });

    it('escapes quotes', () => {
      expect(sanitizeDisplayString('"hello"')).toBe('&quot;hello&quot;');
      expect(sanitizeDisplayString("'hello'")).toBe('&#x27;hello&#x27;');
    });

    it('escapes forward slashes', () => {
      expect(sanitizeDisplayString('a/b')).toBe('a&#x2F;b');
    });

    it('leaves safe strings unchanged', () => {
      expect(sanitizeDisplayString('Hello World 123')).toBe('Hello World 123');
    });
  });

  describe('truncateString', () => {
    it('truncates long strings with ellipsis', () => {
      expect(truncateString('Hello World', 8)).toBe('Hello...');
    });

    it('returns original string if within limit', () => {
      expect(truncateString('Hello', 10)).toBe('Hello');
    });

    it('returns original string if exactly at limit', () => {
      expect(truncateString('Hello', 5)).toBe('Hello');
    });

    it('handles short maxLength', () => {
      expect(truncateString('Hello World', 5)).toBe('He...');
    });

    it('handles empty string', () => {
      expect(truncateString('', 10)).toBe('');
    });
  });
});
