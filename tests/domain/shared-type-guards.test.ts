import { describe, it, expect } from 'vitest';
import {
  isDefined,
  isNullish,
  isObject,
  isNonEmptyArray,
  isEmptyArray,
  isDate,
  isIsoDateString,
  isFunction,
  hasProperty,
  hasProperties,
  assertCondition,
  assertDefined,
} from '../../src/domain/shared/type-guards';

describe('shared type guards', () => {
  describe('isDefined', () => {
    it('returns true for non-null values', () => {
      expect(isDefined('string')).toBe(true);
      expect(isDefined(0)).toBe(true);
      expect(isDefined(false)).toBe(true);
      expect(isDefined('')).toBe(true);
      expect(isDefined([])).toBe(true);
      expect(isDefined({})).toBe(true);
    });

    it('returns false for null', () => {
      expect(isDefined(null)).toBe(false);
    });

    it('returns false for undefined', () => {
      expect(isDefined(undefined)).toBe(false);
    });
  });

  describe('isNullish', () => {
    it('returns true for null', () => {
      expect(isNullish(null)).toBe(true);
    });

    it('returns true for undefined', () => {
      expect(isNullish(undefined)).toBe(true);
    });

    it('returns false for defined values', () => {
      expect(isNullish('')).toBe(false);
      expect(isNullish(0)).toBe(false);
      expect(isNullish(false)).toBe(false);
      expect(isNullish([])).toBe(false);
      expect(isNullish({})).toBe(false);
    });
  });

  describe('isObject', () => {
    it('returns true for plain objects', () => {
      expect(isObject({})).toBe(true);
      expect(isObject({ a: 1 })).toBe(true);
    });

    it('returns false for null', () => {
      expect(isObject(null)).toBe(false);
    });

    it('returns false for arrays', () => {
      expect(isObject([])).toBe(false);
      expect(isObject([1, 2, 3])).toBe(false);
    });

    it('returns false for primitives', () => {
      expect(isObject('string')).toBe(false);
      expect(isObject(123)).toBe(false);
      expect(isObject(true)).toBe(false);
      expect(isObject(undefined)).toBe(false);
    });

    it('returns true for class instances', () => {
      expect(isObject(new Date())).toBe(true);
    });
  });

  describe('isNonEmptyArray', () => {
    it('returns true for non-empty arrays', () => {
      expect(isNonEmptyArray([1])).toBe(true);
      expect(isNonEmptyArray([1, 2, 3])).toBe(true);
      expect(isNonEmptyArray(['a', 'b'])).toBe(true);
    });

    it('returns false for empty arrays', () => {
      expect(isNonEmptyArray([])).toBe(false);
    });

    it('returns false for non-arrays', () => {
      expect(isNonEmptyArray(null)).toBe(false);
      expect(isNonEmptyArray(undefined)).toBe(false);
      expect(isNonEmptyArray({})).toBe(false);
      expect(isNonEmptyArray('string')).toBe(false);
    });
  });

  describe('isEmptyArray', () => {
    it('returns true for empty arrays', () => {
      expect(isEmptyArray([])).toBe(true);
    });

    it('returns false for non-empty arrays', () => {
      expect(isEmptyArray([1])).toBe(false);
      expect(isEmptyArray([1, 2, 3])).toBe(false);
    });

    it('returns false for non-arrays', () => {
      expect(isEmptyArray(null)).toBe(false);
      expect(isEmptyArray(undefined)).toBe(false);
      expect(isEmptyArray({})).toBe(false);
    });
  });

  describe('isDate', () => {
    it('returns true for valid Date objects', () => {
      expect(isDate(new Date())).toBe(true);
      expect(isDate(new Date('2024-01-01'))).toBe(true);
    });

    it('returns false for invalid Date objects', () => {
      expect(isDate(new Date('invalid'))).toBe(false);
    });

    it('returns false for non-Date values', () => {
      expect(isDate(null)).toBe(false);
      expect(isDate(undefined)).toBe(false);
      expect(isDate('2024-01-01')).toBe(false);
      expect(isDate(1704067200000)).toBe(false);
    });
  });

  describe('isIsoDateString', () => {
    it('returns true for valid ISO date strings', () => {
      expect(isIsoDateString('2024-01-01T00:00:00Z')).toBe(true);
      expect(isIsoDateString('2024-01-15T10:30:00.000Z')).toBe(true);
    });

    it('returns false for date strings without T separator', () => {
      expect(isIsoDateString('2024-01-01')).toBe(false);
      expect(isIsoDateString('2024-01-01 00:00:00')).toBe(false);
    });

    it('returns false for invalid date strings', () => {
      expect(isIsoDateString('not-a-date')).toBe(false);
      expect(isIsoDateString('2024-13-01T00:00:00Z')).toBe(false); // Invalid month
    });

    it('returns false for non-strings', () => {
      expect(isIsoDateString(null)).toBe(false);
      expect(isIsoDateString(undefined)).toBe(false);
      expect(isIsoDateString(new Date())).toBe(false);
      expect(isIsoDateString(123)).toBe(false);
    });
  });

  describe('isFunction', () => {
    it('returns true for functions', () => {
      expect(isFunction(() => {})).toBe(true);
      expect(isFunction(function() {})).toBe(true);
      expect(isFunction(Array.isArray)).toBe(true);
    });

    it('returns true for async functions', () => {
      expect(isFunction(async () => {})).toBe(true);
    });

    it('returns false for non-functions', () => {
      expect(isFunction(null)).toBe(false);
      expect(isFunction(undefined)).toBe(false);
      expect(isFunction({})).toBe(false);
      expect(isFunction('function')).toBe(false);
    });
  });

  describe('hasProperty', () => {
    it('returns true when property exists', () => {
      expect(hasProperty({ name: 'John' }, 'name')).toBe(true);
      expect(hasProperty({ a: undefined }, 'a')).toBe(true);
    });

    it('returns false when property does not exist', () => {
      expect(hasProperty({ name: 'John' }, 'age')).toBe(false);
    });

    it('returns false for non-objects', () => {
      expect(hasProperty(null, 'name')).toBe(false);
      expect(hasProperty(undefined, 'name')).toBe(false);
      expect(hasProperty([], 'name')).toBe(false);
      expect(hasProperty('string', 'length')).toBe(false);
    });
  });

  describe('hasProperties', () => {
    it('returns true when all properties exist', () => {
      expect(hasProperties({ name: 'John', age: 30 }, ['name', 'age'])).toBe(true);
    });

    it('returns true for empty keys array', () => {
      expect(hasProperties({ name: 'John' }, [])).toBe(true);
    });

    it('returns false when some properties are missing', () => {
      expect(hasProperties({ name: 'John' }, ['name', 'age'])).toBe(false);
    });

    it('returns false for non-objects', () => {
      expect(hasProperties(null, ['name'])).toBe(false);
      expect(hasProperties(undefined, ['name'])).toBe(false);
    });
  });

  describe('assertCondition', () => {
    it('does not throw for true condition', () => {
      expect(() => assertCondition(true, 'Should not throw')).not.toThrow();
    });

    it('throws for false condition', () => {
      expect(() => assertCondition(false, 'Assertion failed')).toThrow('Assertion failed');
    });

    it('throws with custom message', () => {
      expect(() => assertCondition(1 === 2, 'Custom error message')).toThrow('Custom error message');
    });
  });

  describe('assertDefined', () => {
    it('does not throw for defined values', () => {
      expect(() => assertDefined('value', 'Should not throw')).not.toThrow();
      expect(() => assertDefined(0, 'Should not throw')).not.toThrow();
      expect(() => assertDefined(false, 'Should not throw')).not.toThrow();
      expect(() => assertDefined('', 'Should not throw')).not.toThrow();
    });

    it('throws for null', () => {
      expect(() => assertDefined(null, 'Value is required')).toThrow('Value is required');
    });

    it('throws for undefined', () => {
      expect(() => assertDefined(undefined, 'Value is required')).toThrow('Value is required');
    });
  });
});
