import { vi } from 'vitest';

// Setup global mocks
global.localStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  length: 0,
  key: vi.fn(),
};

// Mock environment variables
process.env.VITE_TB_URL = 'https://thingsboard.cloud';
process.env.VITE_TB_CONTROLLER_ID = 'test-controller-id';

// Mock console to reduce noise
global.console = {
  ...console,
  log: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};