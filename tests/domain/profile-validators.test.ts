import { describe, it, expect } from 'vitest';
import {
  PROFILE_CONSTRAINTS,
  validateUserId,
  validateEmail,
  validateUpdateProfileInput,
  validateProfileQueryOptions,
  validateRecentSessionsQuery,
  validateStatsTrendQuery,
  validateProfileName,
  validateAvatarUrl,
} from '../../src/domain/profile/validators';

describe('profile validators', () => {
  describe('validateUserId', () => {
    it('validates valid UUID', () => {
      const result = validateUserId('123e4567-e89b-12d3-a456-426614174000');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe('123e4567-e89b-12d3-a456-426614174000');
      }
    });

    it('rejects empty string', () => {
      const result = validateUserId('');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors[0].code).toBe('required');
      }
    });

    it('rejects invalid UUID format', () => {
      const result = validateUserId('not-a-uuid');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors[0].code).toBe('invalid_uuid');
      }
    });

    it('rejects null', () => {
      const result = validateUserId(null);
      expect(result.success).toBe(false);
    });

    it('rejects whitespace-only string', () => {
      const result = validateUserId('   ');
      expect(result.success).toBe(false);
    });
  });

  describe('validateEmail', () => {
    it('validates valid email', () => {
      const result = validateEmail('user@example.com');
      expect(result.success).toBe(true);
    });

    it('validates email with subdomain', () => {
      const result = validateEmail('user@mail.example.com');
      expect(result.success).toBe(true);
    });

    it('rejects invalid email', () => {
      const result = validateEmail('not-an-email');
      expect(result.success).toBe(false);
    });

    it('rejects email without domain', () => {
      const result = validateEmail('user@');
      expect(result.success).toBe(false);
    });
  });

  describe('validateUpdateProfileInput', () => {
    it('validates valid input with name', () => {
      const result = validateUpdateProfileInput({ name: 'John Doe' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe('John Doe');
      }
    });

    it('validates valid input with avatar URL', () => {
      const result = validateUpdateProfileInput({ avatarUrl: 'https://example.com/avatar.png' });
      expect(result.success).toBe(true);
    });

    it('trims name whitespace', () => {
      const result = validateUpdateProfileInput({ name: '  John Doe  ' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe('John Doe');
      }
    });

    it('validates empty object', () => {
      const result = validateUpdateProfileInput({});
      expect(result.success).toBe(true);
    });

    it('rejects name that is too long', () => {
      const longName = 'a'.repeat(PROFILE_CONSTRAINTS.NAME_MAX_LENGTH + 1);
      const result = validateUpdateProfileInput({ name: longName });
      expect(result.success).toBe(false);
    });

    it('rejects invalid avatar URL', () => {
      const result = validateUpdateProfileInput({ avatarUrl: 'not-a-url' });
      expect(result.success).toBe(false);
    });
  });

  describe('validateProfileQueryOptions', () => {
    it('validates valid options', () => {
      const result = validateProfileQueryOptions({
        includeStats: true,
        includeRecentSessions: true,
        recentSessionsLimit: 20,
      });
      expect(result.success).toBe(true);
    });

    it('validates empty options', () => {
      const result = validateProfileQueryOptions({});
      expect(result.success).toBe(true);
    });

    it('rejects recentSessionsLimit below minimum', () => {
      const result = validateProfileQueryOptions({ recentSessionsLimit: 0 });
      expect(result.success).toBe(false);
    });

    it('rejects recentSessionsLimit above maximum', () => {
      const result = validateProfileQueryOptions({
        recentSessionsLimit: PROFILE_CONSTRAINTS.MAX_RECENT_SESSIONS + 1,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('validateRecentSessionsQuery', () => {
    it('validates valid query', () => {
      const result = validateRecentSessionsQuery({
        userId: '123e4567-e89b-12d3-a456-426614174000',
        limit: 10,
        offset: 0,
      });
      expect(result.success).toBe(true);
    });

    it('applies defaults', () => {
      const result = validateRecentSessionsQuery({
        userId: '123e4567-e89b-12d3-a456-426614174000',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.limit).toBe(10);
        expect(result.data.offset).toBe(0);
      }
    });

    it('rejects invalid userId', () => {
      const result = validateRecentSessionsQuery({
        userId: 'invalid',
        limit: 10,
        offset: 0,
      });
      expect(result.success).toBe(false);
    });

    it('rejects negative offset', () => {
      const result = validateRecentSessionsQuery({
        userId: '123e4567-e89b-12d3-a456-426614174000',
        offset: -1,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('validateStatsTrendQuery', () => {
    it('validates valid query', () => {
      const result = validateStatsTrendQuery({
        userId: '123e4567-e89b-12d3-a456-426614174000',
        periodType: 'weekly',
        days: 30,
      });
      expect(result.success).toBe(true);
    });

    it('applies defaults', () => {
      const result = validateStatsTrendQuery({
        userId: '123e4567-e89b-12d3-a456-426614174000',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.periodType).toBe('daily');
        expect(result.data.days).toBe(30);
      }
    });

    it('rejects invalid periodType', () => {
      const result = validateStatsTrendQuery({
        userId: '123e4567-e89b-12d3-a456-426614174000',
        periodType: 'invalid',
      });
      expect(result.success).toBe(false);
    });

    it('rejects days above maximum', () => {
      const result = validateStatsTrendQuery({
        userId: '123e4567-e89b-12d3-a456-426614174000',
        days: 366,
      });
      expect(result.success).toBe(false);
    });

    it('rejects days below minimum', () => {
      const result = validateStatsTrendQuery({
        userId: '123e4567-e89b-12d3-a456-426614174000',
        days: 0,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('validateProfileName', () => {
    it('validates valid name', () => {
      const result = validateProfileName('John Doe');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe('John Doe');
      }
    });

    it('trims whitespace', () => {
      const result = validateProfileName('  Jane  ');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe('Jane');
      }
    });

    it('rejects empty string', () => {
      const result = validateProfileName('');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors[0].code).toBe('required');
      }
    });

    it('rejects whitespace-only string', () => {
      const result = validateProfileName('   ');
      expect(result.success).toBe(false);
    });

    it('rejects name that is too long', () => {
      const longName = 'a'.repeat(PROFILE_CONSTRAINTS.NAME_MAX_LENGTH + 1);
      const result = validateProfileName(longName);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors[0].code).toBe('too_long');
      }
    });

    it('rejects non-string value', () => {
      const result = validateProfileName(123);
      expect(result.success).toBe(false);
    });
  });

  describe('validateAvatarUrl', () => {
    it('validates valid URL', () => {
      const result = validateAvatarUrl('https://example.com/avatar.png');
      expect(result.success).toBe(true);
    });

    it('returns undefined for empty string', () => {
      const result = validateAvatarUrl('');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBeUndefined();
      }
    });

    it('returns undefined for null', () => {
      const result = validateAvatarUrl(null);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBeUndefined();
      }
    });

    it('returns undefined for undefined', () => {
      const result = validateAvatarUrl(undefined);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBeUndefined();
      }
    });

    it('rejects invalid URL', () => {
      const result = validateAvatarUrl('not-a-url');
      expect(result.success).toBe(false);
    });
  });
});
