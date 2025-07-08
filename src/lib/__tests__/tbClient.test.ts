import { describe, it, expect } from 'vitest';
import api from '@/lib/tbClient';

describe('tbClient', () => {
  it('should be importable using @ alias', () => {
    expect(api).toBeDefined();
    expect(api.defaults.baseURL).toBe(import.meta.env.VITE_TB_BASE_URL);
  });

  it('should have request and response interceptors configured', () => {
    expect(api.interceptors.request).toBeDefined();
    expect(api.interceptors.response).toBeDefined();
  });
}); 