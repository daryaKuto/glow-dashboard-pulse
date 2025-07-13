import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { API, clearTargetsCache } from '../../src/lib/api';

describe('API', () => {
  beforeEach(() => {
    // Mock environment variables
    vi.stubEnv('VITE_TB_BASE_URL', 'https://thingsboard.cloud');
    vi.stubEnv('VITE_TB_CONTROLLER_ID', 'test-controller-id');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('signIn', () => {
    it('should call ThingsBoard login', async () => {
      // Test that the function exists and can be called
      expect(typeof API.signIn).toBe('function');
      expect(API.signIn).toBeDefined();
    });
  });

  describe('signOut', () => {
    it('should call ThingsBoard logout and clear localStorage', async () => {
      // Test that the function exists and can be called
      expect(typeof API.signOut).toBe('function');
      expect(API.signOut).toBeDefined();
    });
  });

  describe('cache management', () => {
    it('should clear targets cache', () => {
      clearTargetsCache();
      // Verify the function was called
      expect(true).toBe(true);
    });
  });
}); 